import { Logger } from "./Logger";
import { trackEvent } from "./mixpanel";

// ─── Lazy Crashlytics loader ─────────────────────────────────────────────────
// IMPORTANT: @react-native-firebase/crashlytics eagerly touches the native
// module the moment its package is imported. If we `import` it statically and
// the native module isn't in the build yet (before `expo prebuild` + rebuild),
// the import THROWS at module-evaluation time — which would crash the entire
// root layout ("_layout.tsx missing default export"). So we require it lazily,
// inside a try/catch, so the app boots fine and Crashlytics simply no-ops until
// the native module is present.
let _cache = null;
const loadCrashlytics = () => {
  if (_cache) return _cache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-firebase/crashlytics");
    const cl = mod.getCrashlytics();
    _cache = { cl, mod };
    return _cache;
  } catch (e) {
    Logger.log("[Crashlytics] not ready (rebuild required):", String(e));
    return null;
  }
};

/**
 * Enables Crashlytics collection and installs the global JS error handler.
 * The handler is installed even if the native module isn't ready yet, so the
 * "App Crashed" Mixpanel event still fires. Native crashes are captured
 * automatically by the SDK once the module is linked. Call once at startup.
 */
export const initCrashlytics = async () => {
  const c = loadCrashlytics();
  if (c) {
    try {
      await c.mod.setCrashlyticsCollectionEnabled(c.cl, true);
      Logger.log("[Crashlytics] collection enabled ✅");
    } catch (e) {
      Logger.log("[Crashlytics] enable failed:", String(e));
    }
  }

  // Always install the handler (works for Mixpanel even without native module).
  setupGlobalErrorHandler();
};

/**
 * Wraps React Native's global error handler. Uncaught JS errors flow through
 * ErrorUtils — we record them to Crashlytics and fire a Mixpanel event, then
 * call the original handler so the normal crash/red-box behaviour is preserved.
 */
let _handlerInstalled = false;
export const setupGlobalErrorHandler = () => {
  if (_handlerInstalled) return;
  // eslint-disable-next-line no-undef
  const g = global;
  if (!g?.ErrorUtils?.setGlobalHandler) return;

  const previousHandler = g.ErrorUtils.getGlobalHandler?.();

  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const c = loadCrashlytics();
      if (c) {
        c.mod.log(
          c.cl,
          `Uncaught JS error${isFatal ? " (fatal)" : ""}: ${error?.message ?? error}`,
        );
        c.mod.recordError(
          c.cl,
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      // Best-effort analytics event (may not flush on a hard crash, but helps).
      trackEvent("App Crashed", {
        message: String(error?.message ?? error),
        fatal: !!isFatal,
        stack: String(error?.stack ?? "").slice(0, 1000),
      });
    } catch (e) {
      Logger.log("[Crashlytics] handler error:", String(e));
    }

    if (typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });

  _handlerInstalled = true;
  Logger.log("[Crashlytics] global error handler installed");
};

/**
 * Records a handled (non-fatal) error — use in catch blocks for errors you
 * recover from but still want visibility into.
 */
export const recordCrash = (error, context = {}) => {
  const c = loadCrashlytics();
  if (!c) return;
  try {
    if (Object.keys(context).length > 0) {
      const stringified = {};
      Object.keys(context).forEach((k) => {
        stringified[k] = String(context[k]);
      });
      c.mod.setAttributes(c.cl, stringified);
    }
    c.mod.recordError(
      c.cl,
      error instanceof Error ? error : new Error(String(error)),
    );
  } catch (e) {
    Logger.log("[Crashlytics] recordCrash failed:", String(e));
  }
};

// Adds a breadcrumb that shows up in the crash report's log trail.
export const crashLog = (message) => {
  const c = loadCrashlytics();
  if (!c) return;
  try {
    c.mod.log(c.cl, String(message));
  } catch (e) {
    Logger.log("[Crashlytics] log failed:", String(e));
  }
};

// Associates crash reports with a user id (call when the user is identified).
export const setCrashUser = async (userId) => {
  const c = loadCrashlytics();
  if (!c || !userId) return;
  try {
    await c.mod.setUserId(c.cl, String(userId));
  } catch (e) {
    Logger.log("[Crashlytics] setUser failed:", String(e));
  }
};
