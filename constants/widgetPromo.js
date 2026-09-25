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

/** Local previews for the guide — same art the widget ships. */
export const EXPRESSION_IMAGES = {
  coffee: require("../assets/widget/jack_coffee.png"),
  morning: require("../assets/widget/jack_morning.png"),
  ready: require("../assets/widget/jack_ready.png"),
  encouraging: require("../assets/widget/jack_encouraging.png"),
  confident: require("../assets/widget/jack_confident.png"),
  teasing: require("../assets/widget/jack_teasing.png"),
  waiting: require("../assets/widget/jack_waiting.png"),
  challenge: require("../assets/widget/jack_challenge.png"),
  gentle: require("../assets/widget/jack_gentle.png"),
  late: require("../assets/widget/jack_late.png"),
  after_workout: require("../assets/widget/jack_after_workout.png"),
  missed: require("../assets/widget/jack_missed.png"),
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
export const syncWidget = async ({
  name,
  streak = 0,
  trainedToday = false,
  everTrained = false,
  daysSinceLast = -1,
} = {}) => {
  if (Platform.OS !== "android") return;

  try {
    const payload = {
      // First name only: the widget re-splits it anyway, but there is no
      // reason to put a surname on someone's home screen.
      name: (name || "").trim().split(/\s+/)[0] || "",
      streak,
      trainedToday,
      everTrained,
      // -1 for "never trained" — the widget treats any negative value as
      // unknown and falls through to the welcome copy.
      daysSinceLast: daysSinceLast ?? -1,
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
