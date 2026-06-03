import { Mixpanel } from "mixpanel-react-native";
import { Logger } from "./Logger";
import { isScreenTrackingEnabled } from "./remoteConfig";

const MIXPANEL_TOKEN = "3342707f6d2ec658953866e71502b736";

const trackAutomaticEvents = false;
const useNative = false; // Important for Expo JavaScript Mode

export const mixpanel = new Mixpanel(
  MIXPANEL_TOKEN,
  trackAutomaticEvents,
  useNative,
);

let isMixpanelReady = false;

export const initMixpanel = async () => {
  if (isMixpanelReady) return;

  try {
    await mixpanel.init();
    isMixpanelReady = true;
  } catch (error) {
    Logger.log("Mixpanel init error:", String(error));
  }
};

// Ensures init() has run before any call that touches the SDK.
const ensureReady = async () => {
  if (!isMixpanelReady) await initMixpanel();
};

// ─── Core event tracking ─────────────────────────────────────────────────────
export const trackEvent = async (eventName, properties = {}) => {
  try {
    await ensureReady();

    mixpanel.track(eventName, {
      ...properties,
      app_source: "PushDaily",
      tracked_at: new Date().toISOString(),
    });

    mixpanel.flush();
  } catch (error) {
    Logger.log(`Mixpanel track error: ${eventName}`, String(error));
  }
};

// ─── Screen / journey tracking (gated by Firebase Remote Config) ─────────────
/**
 * Sends a "Screen Viewed" event — but ONLY when the `enable_screen_tracking`
 * Remote Config flag is true. This lets us follow the full user journey for
 * smaller traffic and instantly switch it off (from the Firebase console) when
 * traffic spikes would flood Mixpanel with events.
 */
export const trackScreen = async (screenName, properties = {}) => {
  if (!isScreenTrackingEnabled()) return; // flag off → no event, no cost
  if (!screenName) return;

  await trackEvent("Screen Viewed", {
    screen: screenName,
    ...properties,
  });
};

// ─── User identity / profile ─────────────────────────────────────────────────
/**
 * Creates (or updates) the Mixpanel user. In Mixpanel a "user" is a People
 * profile, created by identify() + people.set(). Call this once at signup so
 * the person shows up under Users, with all subsequent events attributed to
 * their distinct id.
 */
export const registerUser = async (userId, profile = {}) => {
  try {
    await ensureReady();

    const id = String(userId);
    mixpanel.identify(id);

    const people = mixpanel.getPeople();

    // Map common fields to Mixpanel's reserved profile properties so they show
    // nicely in the dashboard, then spread the rest as custom properties.
    people.set({
      $name: profile.name ?? "",
      $email: profile.email ?? "",
      $created: profile.$created ?? new Date().toISOString(),
      distinct_id: id,
      gender: profile.gender ?? "",
      age: profile.age ?? null,
      experience: profile.experience ?? "",
      goal: profile.goal ?? "",
      days: profile.days ?? [],
      time: profile.time ?? "",
      height: profile.height ?? null,
      weight: profile.weight ?? null,
    });

    mixpanel.flush();
    Logger.log("[Mixpanel] User registered:", id);
  } catch (error) {
    Logger.log("Mixpanel registerUser error:", String(error));
  }
};

/**
 * Identifies an existing user (without rewriting the full profile). Useful on
 * app launch when we already know who the user is.
 */
export const identifyUser = async (userId, properties = {}) => {
  try {
    await ensureReady();

    mixpanel.identify(String(userId));
    if (Object.keys(properties).length > 0) {
      mixpanel.getPeople().set(properties);
    }
  } catch (error) {
    Logger.log("Mixpanel identify error:", String(error));
  }
};

// Sets / updates arbitrary properties on the current user's People profile.
export const setUserProperties = async (properties = {}) => {
  try {
    await ensureReady();
    mixpanel.getPeople().set(properties);
    mixpanel.flush();
  } catch (error) {
    Logger.log("Mixpanel setUserProperties error:", String(error));
  }
};

// Increments a numeric People property (e.g. total workouts, total calories).
export const incrementUserProperty = async (property, value = 1) => {
  try {
    await ensureReady();
    mixpanel.getPeople().increment(property, value);
    mixpanel.flush();
  } catch (error) {
    Logger.log("Mixpanel increment error:", String(error));
  }
};

export const resetMixpanel = async () => {
  try {
    await ensureReady();
    mixpanel.reset();
  } catch (error) {
    Logger.log("Mixpanel reset error:", String(error));
  }
};
