import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Logger } from "./Logger";

// One "session"/glass = 250 ml.
export const WATER_GLASS_ML = 250;

const K_ENABLED = "water_tracking_enabled";
const K_IDS = "water_notification_ids";
const K_CONSUMED = "water_consumed"; // { date: "YYYY-MM-DD", glasses }
const K_GOAL = "water_goal_glasses"; // remembered so the notification action can cap
const K_PROMPT = "water_prompt_state"; // { opens, lastShown, declines }

// Notification action buttons wired via a category:
//   • LOG     → "Yes, I drank water" (increments the count from the shade)
//   • DETAILS → "Show me details"    (opens the Water Reminder screen)
export const WATER_CATEGORY = "water-reminder";
export const WATER_ACTION_LOG = "WATER_LOG_GLASS";
export const WATER_ACTION_DETAILS = "WATER_SHOW_DETAILS";

const localDateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/**
 * Daily water target based on body weight (35 ml/kg) with a small adjustment
 * for height, then rounded to the nearest 50 ml and clamped to a sensible range.
 */
export const calculateWaterGoal = (weightKg, heightCm) => {
  const w = Number(weightKg) || 70;
  const h = Number(heightCm) || 170;

  let ml = w * 35 + (h - 170) * 7;
  ml = Math.round(ml / 50) * 50;
  ml = Math.max(1500, Math.min(ml, 4000));

  const glasses = Math.max(6, Math.round(ml / WATER_GLASS_ML));
  return { ml, glasses };
};

// Reminder slots: ~1.5 h apart across waking hours (08:00 → 21:30).
const WATER_SLOTS = [
  { h: 8, m: 0 },
  { h: 9, m: 30 },
  { h: 11, m: 0 },
  { h: 12, m: 30 },
  { h: 14, m: 0 },
  { h: 15, m: 30 },
  { h: 17, m: 0 },
  { h: 18, m: 30 },
  { h: 20, m: 0 },
  { h: 21, m: 30 },
];

const WATER_MESSAGES = [
  { title: "💧 Hydration time!", body: "Grab a glass of water and refresh yourself." },
  { title: "🚰 Stay hydrated", body: "A glass of water now keeps your energy up." },
  { title: "💦 Water break!", body: "Your body needs water — take a sip now." },
  { title: "🥤 Time to drink", body: "Sip some water to stay focused and sharp." },
  { title: "🌊 Refuel with water", body: "Keep your plant (and you) happy — drink up!" },
  { title: "💧 Don't forget water", body: "A glass now beats feeling sluggish later." },
  { title: "🚰 Hydrate & thrive", body: "Drinking water boosts mood and metabolism." },
  { title: "💦 Quick water check", body: "How about a refreshing glass of water?" },
  { title: "🥤 Sip sip hooray", body: "Almost done for the day — finish strong!" },
  { title: "🌙 Last call for water", body: "One more glass to hit today's goal." },
];

export const ensureWaterChannel = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("water-reminders", {
      name: "Water Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 200, 100, 200],
    });
  }
};

/**
 * Registers the two water-reminder action buttons:
 *   • "Yes, I drank water" — opensAppToForeground:false → logs the glass straight
 *     from the shade without opening the app.
 *   • "Show me details"    — opensAppToForeground:true → opens the Water screen.
 * Both are handled by the response listener in app/_layout.tsx.
 */
export const registerWaterCategory = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
      {
        identifier: WATER_ACTION_LOG,
        buttonTitle: "✅ Yes, I drank water",
        options: { opensAppToForeground: false },
      },
      {
        identifier: WATER_ACTION_DETAILS,
        buttonTitle: "📊 Show me details",
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    Logger.log("[Water] category register failed:", String(e));
  }
};

// Today's goal in glasses — used by the notification action to cap the count.
export const getGoalGlasses = async () => {
  const raw = await AsyncStorage.getItem(K_GOAL);
  const n = parseInt(raw || "", 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
};

/**
 * Requests permission and schedules the repeating daily water reminders.
 * `goalGlasses` is stored so the notification action can cap the count.
 * Returns { ok, reason?, count? }.
 */
export const startWaterTracking = async (goalGlasses = 8) => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return { ok: false, reason: "permission" };
  }

  await ensureWaterChannel();
  await registerWaterCategory();
  await AsyncStorage.setItem(K_GOAL, String(goalGlasses));

  // Clear any previous water reminders first to avoid duplicates.
  await stopWaterTracking(false);

  const ids = [];
  for (let i = 0; i < WATER_SLOTS.length; i++) {
    const slot = WATER_SLOTS[i];
    const msg = WATER_MESSAGES[i % WATER_MESSAGES.length];
    // A DAILY repeating notification's text is fixed at schedule time, so we
    // can't show the live count. Instead show the pace target for this slot —
    // i.e. roughly how many of the total you should have had by now.
    const target = Math.max(
      1,
      Math.min(goalGlasses, Math.round(((i + 1) / WATER_SLOTS.length) * goalGlasses)),
    );
    const body = `${msg.body}\n🎯 Goal: about ${target} of ${goalGlasses} glasses by now.`;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body,
          sound: "default",
          data: { type: "water" },
          // Attaches the "I drank a glass" action button.
          categoryIdentifier: WATER_CATEGORY,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.h,
          minute: slot.m,
          channelId: "water-reminders",
        },
      });
      ids.push(id);
    } catch (e) {
      Logger.log("[Water] schedule slot failed:", String(e));
    }
  }

  await AsyncStorage.setItem(K_IDS, JSON.stringify(ids));
  await AsyncStorage.setItem(K_ENABLED, "true");
  Logger.log(`[Water] scheduled ${ids.length} reminders`);
  return { ok: true, count: ids.length };
};

/**
 * Cancels the water reminders. Pass clearState=false when re-scheduling.
 * Cancels by stored IDs and also sweeps any water-typed scheduled notifications.
 */
export const stopWaterTracking = async (clearState = true) => {
  try {
    const raw = await AsyncStorage.getItem(K_IDS);
    const ids = raw ? JSON.parse(raw) : [];
    for (const id of ids) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {}
    }

    // Robust sweep in case IDs were lost.
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n?.content?.data?.type === "water") {
        try {
          await Notifications.cancelScheduledNotificationAsync(n.identifier);
        } catch {}
      }
    }

    await AsyncStorage.removeItem(K_IDS);
    if (clearState) await AsyncStorage.setItem(K_ENABLED, "false");
  } catch (e) {
    Logger.log("[Water] stop failed:", String(e));
  }
};

export const isWaterTrackingEnabled = async () =>
  (await AsyncStorage.getItem(K_ENABLED)) === "true";

// ─── "Set a water reminder?" nudge gating ─────────────────────────────────────
// Decides whether to occasionally prompt the user. Rules:
//   • never if tracking is already on
//   • not in the first 2 app opens (so we don't ask right after sign-in)
//   • stop nagging after 3 dismissals
//   • at most once every 4 days
//   • only "sometimes" even when eligible
const PROMPT_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;

const readPromptState = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_PROMPT);
    return raw ? JSON.parse(raw) : { opens: 0, lastShown: 0, declines: 0 };
  } catch {
    return { opens: 0, lastShown: 0, declines: 0 };
  }
};

/**
 * Call once per app launch. Increments the open counter and returns true only
 * when it's a good moment to show the water-reminder nudge.
 */
export const shouldOfferWaterReminder = async () => {
  try {
    if (await isWaterTrackingEnabled()) return false;

    const s = await readPromptState();
    s.opens = (s.opens || 0) + 1;
    await AsyncStorage.setItem(K_PROMPT, JSON.stringify(s));

    if (s.opens < 3) return false; // skip first launches (incl. just after sign-in)
    if ((s.declines || 0) >= 3) return false; // they keep saying no — stop asking
    if (s.lastShown && Date.now() - s.lastShown < PROMPT_COOLDOWN_MS) return false;

    return Math.random() < 0.5; // only sometimes, so it never feels naggy
  } catch {
    return false;
  }
};

export const markWaterPromptShown = async () => {
  const s = await readPromptState();
  s.lastShown = Date.now();
  await AsyncStorage.setItem(K_PROMPT, JSON.stringify(s));
};

export const markWaterPromptDismissed = async () => {
  const s = await readPromptState();
  s.declines = (s.declines || 0) + 1;
  s.lastShown = Date.now();
  await AsyncStorage.setItem(K_PROMPT, JSON.stringify(s));
};

// Returns today's consumed glasses, resetting automatically on a new day.
export const getConsumedGlasses = async () => {
  const today = localDateKey();
  const raw = await AsyncStorage.getItem(K_CONSUMED);
  if (!raw) return 0;
  try {
    const obj = JSON.parse(raw);
    if (obj.date !== today) {
      await AsyncStorage.setItem(
        K_CONSUMED,
        JSON.stringify({ date: today, glasses: 0 }),
      );
      return 0;
    }
    return obj.glasses || 0;
  } catch {
    return 0;
  }
};

export const logGlass = async (max = 999) => {
  const today = localDateKey();
  const current = await getConsumedGlasses();
  const next = Math.min(current + 1, max);
  await AsyncStorage.setItem(
    K_CONSUMED,
    JSON.stringify({ date: today, glasses: next }),
  );
  return next;
};

export const removeGlass = async () => {
  const today = localDateKey();
  const current = await getConsumedGlasses();
  const next = Math.max(0, current - 1);
  await AsyncStorage.setItem(
    K_CONSUMED,
    JSON.stringify({ date: today, glasses: next }),
  );
  return next;
};
