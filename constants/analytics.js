import { Logger } from "./Logger";

// ─── Google Analytics for Firebase ───────────────────────────────────────────
// Only for measuring ad campaigns: Google Ads can optimise for people who
// actually work out (an imported `workout_completed` conversion), not just
// installs. Product analytics stays in Mixpanel.
//
// Loaded lazily for the same reason as Crashlytics: the package touches its
// native module on import, and a build without it must still boot. Until the
// native module is in the build every call here is a silent no-op.
let _cache = null;
const loadAnalytics = () => {
  if (_cache) return _cache;
  try {
    const mod = require("@react-native-firebase/analytics");
    _cache = { mod, an: mod.getAnalytics() };
    return _cache;
  } catch (e) {
    Logger.log("[Analytics] not ready (rebuild required):", String(e));
    return null;
  }
};

/**
 * Logs `workout_completed` once a finished session has been saved.
 *
 * Deliberately coarse — no body part, calories, exercise names or body
 * details — so it stays a measurement signal rather than a copy of the
 * user's workout history (which, per the privacy policy, lives on the device).
 *
 * @param {object} w
 * @param {number} w.exercisesDone     exercises the user completed
 * @param {number} w.exercisesTotal    exercises in the session
 * @param {number} w.durationSec       time from opening the session to finishing
 */
export const logWorkoutCompleted = async ({
  exercisesDone,
  exercisesTotal,
  durationSec,
}) => {
  const a = loadAnalytics();
  if (!a) return;
  try {
    await a.mod.logEvent(a.an, "workout_completed", {
      exercises_done: Number(exercisesDone) || 0,
      exercises_total: Number(exercisesTotal) || 0,
      completion_pct:
        exercisesTotal > 0 ? Math.round((exercisesDone / exercisesTotal) * 100) : 0,
      duration_sec: Math.max(0, Math.round(Number(durationSec) || 0)),
    });
  } catch (e) {
    Logger.log("[Analytics] workout_completed failed:", String(e));
  }
};
