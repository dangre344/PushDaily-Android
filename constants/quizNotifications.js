import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Logger } from "./Logger";

// ─── Daily "your quiz is ready" reminder ──────────────────────────────────────
// Scheduled once (and re-scheduled if the messages change) at 10:00 every day.
// We never *request* permission here — that would nag; we only schedule when
// the user has already allowed notifications (signup / water reminder flow).

const K_SCHEDULED = "quiz_reminder_v1";
const CHANNEL = "quiz-reminders";
export const QUIZ_NOTIFICATION_TYPE = "quiz";

const MESSAGES = [
  {
    title: "🧠 Your daily quiz is ready!",
    body: "10 fresh fitness questions are waiting. Can you score 5/5 today?",
  },
];

const ensureChannel = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Quiz Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
};

/**
 * Schedules the repeating daily quiz reminder (idempotent — safe to call on
 * every Quiz screen focus).
 */
export const scheduleQuizReminder = async () => {
  try {
    if ((await AsyncStorage.getItem(K_SCHEDULED)) === "true") return "already";

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return "no-permission";

    await ensureChannel();

    const msg = MESSAGES[0];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        sound: "default",
        data: { type: QUIZ_NOTIFICATION_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
        channelId: CHANNEL,
      },
    });

    await AsyncStorage.setItem(K_SCHEDULED, "true");
    Logger.log("[Quiz] daily reminder scheduled");
    return "scheduled";
  } catch (e) {
    Logger.log("[Quiz] reminder schedule failed:", String(e));
    return "failed";
  }
};

export const cancelQuizReminder = async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n?.content?.data?.type === QUIZ_NOTIFICATION_TYPE) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    await AsyncStorage.removeItem(K_SCHEDULED);
  } catch (e) {
    Logger.log("[Quiz] reminder cancel failed:", String(e));
  }
};
