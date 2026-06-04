import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  setConfigSettings,
  setDefaults,
} from "@react-native-firebase/remote-config";
import { Logger } from "./Logger";

// ─── Remote Config keys ──────────────────────────────────────────────────────
// Create these in Firebase Console → Remote Config with matching names.
//   enable_screen_tracking  (Boolean)  → when true, every screen the user
//                                         visits sends a "Screen Viewed" event
//                                         to Mixpanel. Flip to false to instantly
//                                         stop the event flood for big traffic.
export const RC_KEYS = {
  SCREEN_TRACKING: "enable_screen_tracking",
};

// Local defaults used until the first successful fetch (and as a safe fallback
// if Firebase is unavailable). Screen tracking is OFF by default so we never
// flood Mixpanel unless the flag is explicitly turned on in the console.
const DEFAULTS = {
  [RC_KEYS.SCREEN_TRACKING]: false,
};

// Cached values so callers can read flags synchronously on the hot path.
let _cache = { ...DEFAULTS };
let _ready = false;

// @react-native-firebase initializes lazily on New Architecture — wrap access
// so a not-yet-ready native module returns null instead of throwing.
const safeRC = () => {
  try {
    return getRemoteConfig();
  } catch (e) {
    Logger.log("[RemoteConfig] not ready:", String(e));
    return null;
  }
};

/**
 * Initializes Remote Config: registers defaults, fetches the latest values,
 * activates them, and caches them. Call once at app startup.
 */
export const initRemoteConfig = async () => {
  const rc = safeRC();
  if (!rc) return;

  try {
    await setDefaults(rc, DEFAULTS);
    await setConfigSettings(rc, {
      // Dev: always fetch fresh so flag flips show immediately.
      // Prod: cache for 1 hour to avoid hammering the network.
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });

    await fetchAndActivate(rc);

    _cache[RC_KEYS.SCREEN_TRACKING] = getValue(
      rc,
      RC_KEYS.SCREEN_TRACKING,
    ).asBoolean();
    _ready = true;

    Logger.log(
      `[RemoteConfig] ✅ ${RC_KEYS.SCREEN_TRACKING} = ${_cache[RC_KEYS.SCREEN_TRACKING]}`,
    );
  } catch (e) {
    Logger.log("[RemoteConfig] init/fetch failed:", String(e));
  }
};

/**
 * Re-fetches and re-activates the latest config (e.g. on app foreground) so a
 * flag flipped in the console takes effect without a full restart.
 */
export const refreshRemoteConfig = async () => {
  const rc = safeRC();
  if (!rc) return;
  try {
    await fetchAndActivate(rc);
    _cache[RC_KEYS.SCREEN_TRACKING] = getValue(
      rc,
      RC_KEYS.SCREEN_TRACKING,
    ).asBoolean();
    Logger.log(
      `[RemoteConfig] 🔄 ${RC_KEYS.SCREEN_TRACKING} = ${_cache[RC_KEYS.SCREEN_TRACKING]}`,
    );
  } catch (e) {
    Logger.log("[RemoteConfig] refresh failed:", String(e));
  }
};

// Synchronous flag reader — returns the cached value (default until ready).
export const isScreenTrackingEnabled = () =>
  _cache[RC_KEYS.SCREEN_TRACKING] === true;

export const isRemoteConfigReady = () => _ready;
