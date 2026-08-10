import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logger } from "./Logger";
import { trackEvent } from "./mixpanel";

// ─── "Where did they quit?" tracking ─────────────────────────────────────────
// Mobile apps get NO callback when the user swipes them away, so a kill can
// only be detected in hindsight: we persist the current screen as the user
// moves around, and on the NEXT cold start we report where the previous
// session ended. That last screen is the one the user abandoned — exactly the
// signal we want for finding UI/UX dead ends.
//
// Caveat worth remembering when reading the dashboard: this cannot distinguish
// a deliberate swipe-away from the OS reclaiming memory in the background.
// `secondsInBackground` helps — a large value usually means an OS kill.

const K_LAST = "lifecycle_last_screen"; // { screen, at, backgroundedAt }

let currentScreen = null;

/** Records the screen the user is on. Cheap, fire-and-forget. */
export const setCurrentScreen = (screen) => {
  if (!screen || screen === currentScreen) return;
  currentScreen = screen;
  AsyncStorage.setItem(
    K_LAST,
    JSON.stringify({ screen, at: Date.now(), backgroundedAt: null }),
  ).catch(() => {});
};

/** Called when the app goes to background — the last moment we ever run. */
export const markBackgrounded = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_LAST);
    const prev = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(
      K_LAST,
      JSON.stringify({
        screen: currentScreen || prev.screen || "unknown",
        at: prev.at || Date.now(),
        backgroundedAt: Date.now(),
      }),
    );
  } catch {}
};

/** Called when the app comes back — the session did NOT end, so clear the flag. */
export const markResumed = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_LAST);
    if (!raw) return;
    const prev = JSON.parse(raw);
    if (prev.backgroundedAt) {
      await AsyncStorage.setItem(
        K_LAST,
        JSON.stringify({ ...prev, backgroundedAt: null }),
      );
    }
  } catch {}
};

/**
 * Fires ONCE per cold start. If a previous session left a screen behind, that
 * session ended without coming back — i.e. the app was killed there.
 */
export const reportPreviousSessionEnd = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_LAST);
    if (!raw) return; // genuine first launch — nothing to report
    await AsyncStorage.removeItem(K_LAST);

    const { screen, at, backgroundedAt } = JSON.parse(raw);
    if (!screen) return;

    const secondsInBackground = backgroundedAt
      ? Math.round((Date.now() - backgroundedAt) / 1000)
      : null;

    await trackEvent("App Killed", {
      screen,
      // false → killed straight from the foreground (a hard swipe-away).
      from_background: !!backgroundedAt,
      seconds_in_background: secondsInBackground,
      seconds_on_screen: at ? Math.round(((backgroundedAt || Date.now()) - at) / 1000) : null,
    });
    Logger.log(`[Lifecycle] previous session ended on "${screen}"`);
  } catch (e) {
    Logger.log("[Lifecycle] report failed:", String(e));
  }
};
