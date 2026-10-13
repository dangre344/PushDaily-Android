import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { cancelJack, scheduleJack } from "./jackNotifications";
import { Logger } from "./Logger";
import { WORKOUT_COPY } from "./notificationCopy";

// ─── Workout reminders ───────────────────────────────────────────────────────
// Two per weekday, every week: 15 minutes before the user's workout time
// ("pre") and at it ("start"). 14 notifications in all, each with its own
// line and Jack mood.

// Bump when the copy or the way reminders are built changes: installs with an
// older version get their reminders rebuilt on next launch.
const VERSION = "2";
const K_VERSION = "workout_reminders_version";

const SLOT_TIME = {
  Morning: { hour: 6, minute: 0 },
  Afternoon: { hour: 12, minute: 0 },
  Evening: { hour: 17, minute: 0 },
  Night: { hour: 20, minute: 0 },
};

/** The user's reminder time: a custom "HH:MM", else their slot's default. */
export const workoutTimeFor = (user) => {
  const custom = user?.reminderTime;
  if (custom && /^\d{1,2}:\d{2}$/.test(custom)) {
    const [hour, minute] = custom.split(":").map(Number);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) return { hour, minute };
  }
  return SLOT_TIME[user?.time] || null;
};

/** Workout notifications only: new ones carry type "workout"; the 14 legacy
 *  expo ones carried just { screen: "Home" }. Water/quiz/period are untouched. */
const isWorkout = (d) => d?.type === "workout" || (!d?.type && d?.screen === "Home");

export const cancelWorkoutReminders = () => cancelJack(isWorkout);

/**
 * (Re)builds the 14 weekly reminders for this user. Replaces only workout
 * reminders — the old code called cancelAllScheduledNotificationsAsync(),
 * which also wiped water, quiz and period reminders on every profile save.
 */
export const scheduleWorkoutReminders = async (user) => {
  const time = workoutTimeFor(user);
  if (!time) return "no-time";

  await cancelWorkoutReminders();

  let preHour = time.hour;
  let preMinute = time.minute - 15;
  if (preMinute < 0) {
    preMinute += 60;
    preHour = (preHour + 23) % 24;
  }

  for (let day = 0; day < 7; day++) {
    const copy = WORKOUT_COPY[day];
    // If 15 min earlier crosses midnight, the "pre" reminder belongs to the day before.
    const preWeekday = (time.hour === 0 && time.minute < 15 ? (day + 6) % 7 : day) + 1;
    await scheduleJack({
      type: "workout",
      channel: "workout",
      ...copy.pre,
      name: user?.name,
      when: { kind: "weekly", weekday: preWeekday, hour: preHour, minute: preMinute },
      data: { screen: "Home", slot: "pre" },
    });
    await scheduleJack({
      type: "workout",
      channel: "workout",
      ...copy.start,
      name: user?.name,
      when: { kind: "weekly", weekday: day + 1, hour: time.hour, minute: time.minute },
      data: { screen: "Home", slot: "start" },
    });
  }

  await AsyncStorage.setItem(K_VERSION, VERSION).catch(() => {});
  Logger.log("[Workout] scheduled 14 weekly reminders at", time);
  return "scheduled";
};

/**
 * On launch: rebuilds reminders scheduled by an older version (old copy, no
 * Jack, system sound). Never asks for permission — only acts if it's granted.
 */
export const upgradeWorkoutRemindersIfNeeded = async (user) => {
  try {
    if (!user || !workoutTimeFor(user)) return;
    if ((await AsyncStorage.getItem(K_VERSION)) === VERSION) return;
    if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
    await scheduleWorkoutReminders(user);
  } catch (e) {
    Logger.log("[Workout] reminder upgrade failed:", String(e));
  }
};
