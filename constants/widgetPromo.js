import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { Logger } from "./Logger";
import { trackEvent } from "./mixpanel";
import { EXPRESSIONS, resolveWidget } from "./widgetData";

// ─── Home-screen widget ──────────────────────────────────────────────────────
// The widget itself is native Android (see plugins/withWidget.js). This module
// owns the JS side: the data bridge, the promo state, and the analytics.
//
// The copy and the character live in ./widgetData.js, shared with the plugin.

export { EXPRESSIONS, resolveWidget };

/**
 * In-app copies of the widget art — used by the "how to add" guide and the
 * mascot card on the Workouts screen. Same PNGs the widget ships, so what
 * users see in the app matches their home screen exactly.
 *
 * require() needs literal paths, so this cannot be generated from EXPRESSIONS.
 * The test in widgetData keeps the two in step.
 */
export const EXPRESSION_IMAGES = {
  hi: require("../assets/widget/mascot_hi.png"),
  water: require("../assets/widget/mascot_water.png"),
  think: require("../assets/widget/mascot_think.png"),
  phone: require("../assets/widget/mascot_phone.png"),
  wink: require("../assets/widget/mascot_wink.png"),
  dumbbell: require("../assets/widget/mascot_dumbbell.png"),
  flex: require("../assets/widget/mascot_flex.png"),
  proud: require("../assets/widget/mascot_proud.png"),
  cheer: require("../assets/widget/mascot_cheer.png"),
  wow: require("../assets/widget/mascot_wow.png"),
  sad: require("../assets/widget/mascot_sad.png"),
  sleepy: require("../assets/widget/mascot_sleepy.png"),
};

// Marketing line shown on the promo card. Keep it in one place so it is easy
// to swap for a figure the analytics can actually back — as written this is
// not sourced from anything we measure.
export const WIDGET_SOCIAL_PROOF =
  "Over 80% of people stay consistent after adding it";

// ─── Data bridge ─────────────────────────────────────────────────────────────
// Must match BRIDGE_FILE in plugins/withWidget.js. Paths.document maps to
// context.filesDir on Android, which is where the widget reads from.
const BRIDGE_FILE = "push_daily_widget.json";

/**
 * Hands the widget the state it cannot compute itself.
 *
 * Only a first name and a workout count cross this boundary — a home screen is
 * visible to anyone standing nearby, so nothing sensitive goes in the file.
 *
 * Safe to call often; it is a small synchronous write and a no-op off Android.
 */
/** Days since the local epoch, i.e. a stable calendar-day number. */
export const localEpochDay = (d = new Date()) =>
  Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

export const syncWidget = async ({
  name,
  streak = 0,
  daysSinceLast = -1,
} = {}) => {
  if (Platform.OS !== "android") return;

  try {
    const today = localEpochDay();
    const since = daysSinceLast ?? -1;

    const payload = {
      // First name only: the widget re-splits it anyway, but there is no
      // reason to put a surname on someone's home screen.
      name: (name || "").trim().split(/\s+/)[0] || "",
      streak,
      // WHEN the last workout was, never "did they train today".
      //
      // This file can sit unread for days. A boolean like trainedToday is only
      // true for the day it was written — after midnight it silently becomes a
      // lie, and the widget goes on congratulating someone for a session they
      // did yesterday. Storing the day lets the widget recompute against the
      // current date on every render and correct itself with no app running.
      //
      // null = never trained.
      lastWorkoutDay: since < 0 ? null : today - since,
      updatedAt: Date.now(),
    };

    new File(Paths.document, BRIDGE_FILE).write(JSON.stringify(payload));
  } catch (e) {
    // A stale widget is a cosmetic problem — never let it break a screen.
    Logger.log("[Widget] sync failed:", String(e));
  }
};

// ─── Promo state ─────────────────────────────────────────────────────────────
const K_STATE = "widget_promo"; // { dismissed, guideOpenedAt, markedAdded }

const read = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_STATE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const write = async (patch) => {
  try {
    const next = { ...(await read()), ...patch };
    await AsyncStorage.setItem(K_STATE, JSON.stringify(next));
    return next;
  } catch (e) {
    Logger.log("[Widget] state write failed:", String(e));
    return null;
  }
};

export const getWidgetPromoState = read;

/** Opened the "how to add" guide. */
export const trackWidgetGuideOpened = (from = "profile") => {
  write({ guideOpenedAt: Date.now() });
  trackEvent("Widget Guide Opened", { from });
};

/** Walked through to the end of the guide. */
export const trackWidgetGuideCompleted = () =>
  trackEvent("Widget Guide Completed");

/**
 * User tapped "I've added it". Self-reported — Android gives no reliable way to
 * ask whether a widget is on the home screen, so this is the honest signal we
 * have, and the event name says so.
 */
export const markWidgetAdded = async () => {
  await write({ markedAdded: true, markedAddedAt: Date.now() });
  trackEvent("Widget Marked Added", { selfReported: true });
};

export const trackWidgetGuideDismissed = (step) =>
  trackEvent("Widget Guide Dismissed", { step });
