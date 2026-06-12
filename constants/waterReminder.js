import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Logger } from "./Logger";

// One "session"/glass = 250 ml.
export const WATER_GLASS_ML = 250;

const K_ENABLED = "water_tracking_enabled";
const K_IDS = "water_notification_ids";
const K_CONSUMED = "water_consumed"; // { date: "YYYY-MM-DD", glasses }

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
 * Requests permission and schedules the repeating daily water reminders.
 * Returns { ok, reason?, count? }.
 */
export const startWaterTracking = async () => {
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

  // Clear any previous water reminders first to avoid duplicates.
  await stopWaterTracking(false);

  const ids = [];
  for (let i = 0; i < WATER_SLOTS.length; i++) {
    const slot = WATER_SLOTS[i];
    const msg = WATER_MESSAGES[i % WATER_MESSAGES.length];
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          sound: "default",
          data: { type: "water" },
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
