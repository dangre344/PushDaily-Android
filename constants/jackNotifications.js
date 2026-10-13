import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { AppState, Platform } from "react-native";

import { Logger } from "./Logger";
import { fillName } from "./notificationCopy";
import { switchToTab } from "./tabNavigation";
import { EXPRESSION_IMAGES } from "./widgetPromo";

// ─── Jack's notifications ────────────────────────────────────────────────────
// Local reminders that show Jack's face (Android large icon), play our own
// tune, and open the right screen when tapped.
//
// expo-notifications can't attach an image on Android, so scheduling goes
// through Notifee when it's available. If Notifee isn't (an old build without
// the native module, or any native error), everything falls back to
// expo-notifications with the same text and routing — just no picture. A
// reminder is never lost because of the picture.
//
// Water reminders stay on expo-notifications on purpose: they carry the
// "I drank water" action button handled in app/_layout.tsx.

let notifee = null;
let NF = {};
try {
  NF = require("@notifee/react-native");
  notifee = NF.default;
} catch (e) {
  Logger.log("[Jack] Notifee unavailable, using expo-notifications:", String(e));
}

/** Android channels. A channel's sound can't change after it's created, so the
 *  ids are new (the old "default"/"quiz-reminders" channels keep the system sound). */
export const CHANNELS = {
  workout: { id: "jack-workouts", name: "Workout reminders", sound: "jack_ping", high: true },
  quiz: { id: "jack-quiz", name: "Daily quiz", sound: "jack_ping", high: false },
  event: { id: "jack-events", name: "Push-up challenge", sound: "jack_cheer", high: true },
  period: { id: "jack-period", name: "Period reminders", sound: "jack_ping", high: false },
  general: { id: "jack-general", name: "Updates from Jack", sound: "jack_ping", high: false },
};

const BRAND = "#FF6B35";

let channelsReady = null;
/** Creates every channel once per launch (cheap, idempotent). */
export const ensureJackChannels = () => {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelsReady) {
    channelsReady = Promise.all(
      Object.values(CHANNELS).map((c) =>
        Notifications.setNotificationChannelAsync(c.id, {
          name: c.name,
          importance: c.high
            ? Notifications.AndroidImportance.HIGH
            : Notifications.AndroidImportance.DEFAULT,
          sound: `${c.sound}.wav`,
          vibrationPattern: [0, 180, 120, 180],
          lightColor: BRAND,
        }),
      ),
    ).catch((e) => {
      channelsReady = null;
      Logger.log("[Jack] channel setup failed:", String(e));
    });
  }
  return channelsReady;
};

let notifeeOk = null;
const canUseNotifee = async () => {
  if (notifeeOk !== null) return notifeeOk;
  if (!notifee || Platform.OS !== "android") return (notifeeOk = false);
  try {
    await notifee.getChannels(); // throws if the native module isn't linked
    notifeeOk = true;
  } catch (e) {
    Logger.log("[Jack] Notifee native module missing:", String(e));
    notifeeOk = false;
  }
  return notifeeOk;
};

// Notifee only accepts string values in `data`.
const stringify = (data) =>
  Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v ?? "")]));

const atTime = (base, hour, minute) => {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** Next occurrence (strictly in the future) for a weekly / daily schedule. */
export const nextOccurrence = (when, now = new Date()) => {
  if (when.kind === "date") return new Date(when.date);
  const d = atTime(now, when.hour, when.minute);
  if (when.kind === "daily") {
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  // weekly: weekday 1 = Sunday … 7 = Saturday (expo's convention)
  const target = when.weekday - 1;
  let add = (target - d.getDay() + 7) % 7;
  if (add === 0 && d <= now) add = 7;
  d.setDate(d.getDate() + add);
  return d;
};

/**
 * Schedules one of Jack's notifications.
 *
 * @param {object} n
 * @param {string} n.type     routing key, also used to cancel ("workout", "quiz", "period"…)
 * @param {string} n.channel  key of CHANNELS
 * @param {string} n.title
 * @param {string} n.body
 * @param {string} [n.jack]   mascot mood (EXPRESSION_IMAGES key)
 * @param {string} [n.name]   fills {name}
 * @param {object} n.when     { kind:"weekly", weekday, hour, minute } |
 *                            { kind:"daily", hour, minute } | { kind:"date", date }
 * @param {object} [n.data]   extra routing data
 */
export const scheduleJack = async ({ type, channel, title, body, jack, name, when, data = {} }) => {
  await ensureJackChannels();
  const ch = CHANNELS[channel] || CHANNELS.general;
  const t = fillName(title, name);
  const b = fillName(body, name);
  const payload = { ...data, type };

  if (await canUseNotifee()) {
    try {
      return await notifee.createTriggerNotification(
        {
          title: t,
          body: b,
          data: stringify(payload),
          android: {
            channelId: ch.id,
            color: BRAND,
            // White Jack silhouette (app.json → expo-notifications "icon").
            smallIcon: "notification_icon",
            ...(jack && EXPRESSION_IMAGES[jack]
              ? { largeIcon: EXPRESSION_IMAGES[jack] }
              : {}),
            pressAction: { id: "default", launchActivity: "default" },
          },
        },
        {
          type: NF.TriggerType.TIMESTAMP,
          timestamp: nextOccurrence(when).getTime(),
          ...(when.kind === "weekly"
            ? { repeatFrequency: NF.RepeatFrequency.WEEKLY }
            : when.kind === "daily"
              ? { repeatFrequency: NF.RepeatFrequency.DAILY }
              : {}),
          // Fires in Doze too, without the exact-alarm permission.
          alarmManager: { type: NF.AlarmType.SET_AND_ALLOW_WHILE_IDLE },
        },
      );
    } catch (e) {
      Logger.log("[Jack] Notifee schedule failed, falling back:", String(e));
    }
  }

  const trigger =
    when.kind === "weekly"
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: when.weekday,
          hour: when.hour,
          minute: when.minute,
        }
      : when.kind === "daily"
        ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: when.hour, minute: when.minute }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(when.date) };

  return Notifications.scheduleNotificationAsync({
    content: { title: t, body: b, sound: `${ch.sound}.wav`, data: payload },
    trigger: { ...trigger, channelId: ch.id },
  });
};

/** Shows a notification right now (used for FCM messages in the foreground). */
export const showJackNow = async ({ type, channel = "general", title, body, jack, data = {} }) => {
  await ensureJackChannels();
  const ch = CHANNELS[channel] || CHANNELS.general;
  const payload = { ...data, type: type || data.type || "" };
  if (await canUseNotifee()) {
    try {
      await notifee.displayNotification({
        title,
        body,
        data: stringify(payload),
        android: {
          channelId: ch.id,
          color: BRAND,
          // White Jack silhouette (app.json → expo-notifications "icon").
          smallIcon: "notification_icon",
          ...(jack && EXPRESSION_IMAGES[jack] ? { largeIcon: EXPRESSION_IMAGES[jack] } : {}),
          pressAction: { id: "default", launchActivity: "default" },
        },
      });
      return;
    } catch (e) {
      Logger.log("[Jack] Notifee display failed, falling back:", String(e));
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: `${ch.sound}.wav`, data: payload },
    trigger: Platform.OS === "android" ? { channelId: ch.id } : null,
  });
};

/**
 * Cancels every scheduled notification matching `match(data)` — in Notifee and
 * in expo-notifications (older builds scheduled through expo).
 */
export const cancelJack = async (match) => {
  const test = typeof match === "string" ? (d) => d?.type === match : match;
  try {
    if (await canUseNotifee()) {
      const ids = (await notifee.getTriggerNotifications())
        .filter((t) => test(t?.notification?.data))
        .map((t) => t.notification.id);
      if (ids.length) await notifee.cancelTriggerNotifications(ids);
    }
  } catch (e) {
    Logger.log("[Jack] Notifee cancel failed:", String(e));
  }
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => test(n?.content?.data))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch (e) {
    Logger.log("[Jack] expo cancel failed:", String(e));
  }
};

// ─── Where a tap goes ────────────────────────────────────────────────────────

const openTab = (tab) => {
  router.replace("/home");
  // The tab navigator mounts under /home; select the tab once it exists.
  setTimeout(() => switchToTab(tab), 450);
};

/**
 * Opens the screen a notification is about. Shared by expo-notifications'
 * response listener and Notifee's press events, so every source routes alike.
 * Returns true when it handled the data.
 */
export const openFromNotification = (data = {}) => {
  const type = data?.type || (data?.screen === "Home" ? "workout" : "");
  switch (type) {
    case "workout":
      openTab("Workouts");
      return true;
    case "quiz":
      openTab("Quiz");
      return true;
    case "pushup_event":
    case "event":
      openTab("Event");
      return true;
    case "attendance":
      openTab("Attendance");
      return true;
    case "water":
      router.push("/profile/water");
      return true;
    case "period":
      router.push("/profile/water?tab=period");
      return true;
    case "daily_update":
      router.replace("/home");
      return true;
    default:
      return false;
  }
};

// Notifee presses while the app is in the background arrive here before the
// app is on screen; hold them until it is. Registered at module load, as
// Notifee requires, so it exists whenever the JS runtime is alive.
let pendingOpen = null;
if (notifee) {
  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === NF.EventType.PRESS) pendingOpen = detail?.notification?.data || null;
    });
  } catch {}
}

/**
 * Wires Notifee taps to `onOpen` (default: openFromNotification): a tap that
 * launched the app, taps while it's open, and taps from the background.
 * Returns a cleanup.
 *
 * @param {(data: any) => any} [onOpen]
 */
export const listenForJackTaps = (onOpen = openFromNotification) => {
  if (!notifee) return () => {};
  let unsubFg = () => {};
  let appSub = null;
  const flush = () => {
    if (!pendingOpen) return;
    const d = pendingOpen;
    pendingOpen = null;
    onOpen(d);
  };

  canUseNotifee().then((ok) => {
    if (!ok) return;
    notifee
      .getInitialNotification()
      .then((initial) => {
        if (initial?.notification?.data) onOpen(initial.notification.data);
      })
      .catch(() => {});
    unsubFg = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === NF.EventType.PRESS && detail?.notification?.data) onOpen(detail.notification.data);
    });
    flush();
    appSub = AppState.addEventListener("change", (s) => s === "active" && flush());
  });

  return () => {
    unsubFg();
    appSub?.remove();
  };
};
