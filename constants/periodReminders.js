import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { Logger } from "./Logger";
import { averageCycle, fromKey, loadPeriodData } from "./periodTracker";

// ─── Period reminders (local notifications) ──────────────────────────────────
// Nudges the user to log a period date so predictions stay accurate.
//
//   • Logged at least once → around the expected date (last start + her
//     average cycle): the day before, the day itself, and 3 days after if it
//     still hasn't been logged.
//   • Nothing logged yet, or the expected date is long gone → every 15 days.
//
// Available to everyone. A woman tracks her own cycle; anyone else is tracking
// a partner's, so the wording switches to "her" (isPartnerMode). The wording is
// re-applied whenever the profile gender changes (syncPeriodReminders is
// called from the home layout on every launch and on gender edits).
//
// Every sync cancels and re-creates the reminders from FIXED dates (her last
// start, or a stored anchor), so opening the app never pushes them further
// away — a plain "repeat every 15 days" would restart on every launch.
//
// Notification text never includes dates or cycle details: it shows on the
// lock screen.

export const PERIOD_TYPE = "period";
const CHANNEL = "period-reminders";
const K_OFF = "period_reminders_off"; // "true" = user switched them off
const K_ANCHOR = "period_reminder_anchor"; // ms; start of the 15-day rhythm
const K_ASKED = "period_reminder_primer_shown";

const DAY = 86400000;
const EVERY_DAYS = 15;
const HOUR = 10; // 10:00 local — awake, not intrusive

/** Anyone whose profile isn't Female is tracking a partner's cycle. */
export const isPartnerMode = (gender) => String(gender || "").trim().toLowerCase() !== "female";

const COPY = {
  self: {
    before: ["Your period may start tomorrow 🌸", "Keep the essentials handy. Tap to see your cycle."],
    due: ["Did your period start? 🩸", "Log it in one tap so your next prediction stays accurate."],
    late: ["Still waiting? 🤍", "If it has started, log the date — a few days late is common."],
    every: ["Add your period date 🩸", "Logging it keeps your cycle predictions accurate. Takes 5 seconds."],
  },
  partner: {
    before: ["Her period may start tomorrow 🌸", "A little extra care goes a long way. Tap to see her cycle."],
    due: ["Did her period start? 🩸", "Log it in one tap so the next prediction stays accurate."],
    late: ["Still waiting? 🤍", "If it has started, log the date — a few days late is common."],
    every: ["Add her period date 🩸", "Logging it keeps her cycle predictions accurate. Takes 5 seconds."],
  },
};

const at = (date, hour = HOUR) => {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const ensureChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Period reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
};

export const cancelPeriodReminders = async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n?.content?.data?.type === PERIOD_TYPE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch (e) {
    Logger.log("[PeriodReminder] cancel failed:", String(e));
  }
};

export const arePeriodRemindersOff = async () =>
  (await AsyncStorage.getItem(K_OFF).catch(() => null)) === "true";

export const hasNotificationPermission = async () => {
  try {
    return (await Notifications.getPermissionsAsync()).status === "granted";
  } catch {
    return false;
  }
};

/**
 * The reminder plan for a given state — pure, so it can be tested.
 * Returns [{ date, title, body }] in the future, soonest first.
 */
export const planPeriodReminders = (
  data,
  { now = new Date(), anchor = now.getTime(), partner = false } = {},
) => {
  const c = partner ? COPY.partner : COPY.self;
  const out = [];
  const add = (date, title, body) => {
    if (date.getTime() > now.getTime() + 60000) out.push({ date, title, body });
  };

  if (data?.cycles?.length) {
    const expected = at(fromKey(data.cycles[0].start));
    expected.setDate(expected.getDate() + averageCycle(data));

    const dayBefore = new Date(expected.getTime() - DAY);
    const after = new Date(expected.getTime() + 3 * DAY);

    add(dayBefore, ...c.before);
    add(expected, ...c.due);
    add(after, ...c.late);
    if (out.length) return out;
    // Expected date long past and nothing new logged → fall through to the
    // regular rhythm, counted from the expected date.
    anchor = expected.getTime();
  }

  // Every 15 days from the anchor — the next three occurrences.
  const first = at(new Date(anchor));
  for (let k = 1; out.length < 3 && k < 400; k++) {
    add(new Date(first.getTime() + k * EVERY_DAYS * DAY), ...c.every);
  }
  return out;
};

/**
 * Makes the scheduled reminders match the current state. Safe to call often.
 * Never asks for permission — that only happens from an explicit tap
 * (enablePeriodReminders), after the benefits have been shown.
 *
 * @return "scheduled" | "off" | "no_permission" | "error"
 */
export const syncPeriodReminders = async ({ gender } = {}) => {
  try {
    if (await arePeriodRemindersOff()) {
      await cancelPeriodReminders();
      return "off";
    }
    if (!(await hasNotificationPermission())) return "no_permission";

    let anchor = Number(await AsyncStorage.getItem(K_ANCHOR));
    if (!Number.isFinite(anchor) || anchor <= 0) {
      anchor = Date.now();
      await AsyncStorage.setItem(K_ANCHOR, String(anchor));
    }

    const plan = planPeriodReminders(await loadPeriodData(), {
      anchor,
      partner: isPartnerMode(gender),
    });

    await ensureChannel();
    await cancelPeriodReminders();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: "default", data: { type: PERIOD_TYPE } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.date,
          channelId: CHANNEL,
        },
      });
    }
    Logger.log(`[PeriodReminder] scheduled ${plan.length}`, plan.map((p) => p.date.toISOString()));
    return "scheduled";
  } catch (e) {
    Logger.log("[PeriodReminder] sync failed:", String(e));
    return "error";
  }
};

/**
 * User tapped "Turn on reminders" (after seeing the benefits). Asks for the
 * notification permission if needed, then schedules.
 *
 * @return "scheduled" | "denied" | "blocked" | other sync results
 */
export const enablePeriodReminders = async ({ gender } = {}) => {
  await AsyncStorage.setItem(K_ASKED, "true").catch(() => {});
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    if (perm.canAskAgain === false) return "blocked";
    perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== "granted") return perm.canAskAgain === false ? "blocked" : "denied";
  }
  await AsyncStorage.removeItem(K_OFF).catch(() => {});
  return syncPeriodReminders({ gender });
};

export const disablePeriodReminders = async () => {
  await AsyncStorage.setItem(K_OFF, "true").catch(() => {});
  await cancelPeriodReminders();
};

/** Whether reminders are actually active right now (on + permission). */
export const periodRemindersActive = async () =>
  !(await arePeriodRemindersOff()) && (await hasNotificationPermission());

/** The benefits sheet auto-opens once (after the first log); never nags. */
export const wasPeriodPrimerShown = async () =>
  (await AsyncStorage.getItem(K_ASKED).catch(() => null)) === "true";
export const markPeriodPrimerShown = () => AsyncStorage.setItem(K_ASKED, "true").catch(() => {});

export const openNotificationSettings = () => Linking.openSettings().catch(() => {});
