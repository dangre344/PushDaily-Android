import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { cancelJack, scheduleJack } from "./jackNotifications";
import { Logger } from "./Logger";
import { QUIZ_COPY } from "./notificationCopy";

// ─── Daily "your quiz is ready" reminder ──────────────────────────────────────
// 10:00 every day, a different line (and Jack mood) for each weekday — seven
// weekly notifications rather than one daily one, so it never reads the same
// two days running. We never *request* permission here; we only schedule when
// it's already been granted (signup / water / period flows).

// v2 = Jack's copy + picture + tune. Bumping the key makes installs that
// scheduled the old single reminder replace it once.
const K_SCHEDULED = "quiz_reminder_v2";
export const QUIZ_NOTIFICATION_TYPE = "quiz";
const HOUR = 10;

/** Idempotent — safe to call on every Quiz screen focus. */
export const scheduleQuizReminder = async () => {
  try {
    if ((await AsyncStorage.getItem(K_SCHEDULED)) === "true") return "already";

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return "no-permission";

    await cancelJack(QUIZ_NOTIFICATION_TYPE); // includes the old v1 reminder
    for (let day = 0; day < 7; day++) {
      await scheduleJack({
        type: QUIZ_NOTIFICATION_TYPE,
        channel: "quiz",
        ...QUIZ_COPY[day],
        when: { kind: "weekly", weekday: day + 1, hour: HOUR, minute: 0 },
      });
    }

    await AsyncStorage.setItem(K_SCHEDULED, "true");
    Logger.log("[Quiz] weekly reminders scheduled");
    return "scheduled";
  } catch (e) {
    Logger.log("[Quiz] reminder schedule failed:", String(e));
    return "failed";
  }
};

export const cancelQuizReminder = async () => {
  try {
    await cancelJack(QUIZ_NOTIFICATION_TYPE);
    await AsyncStorage.removeItem(K_SCHEDULED);
  } catch (e) {
    Logger.log("[Quiz] reminder cancel failed:", String(e));
  }
};
