import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBadgeForScore, getPointsFromLevelCounts } from "../app/home/WorkoutBadgeInfo";
import {
  WORKOUTS_VERSION_KEY,
  getCurrentStreak,
  getDaysSinceLastWorkout,
  getLevelCounts,
  getRecentWorkouts,
  initDB,
} from "../offlinedb/workoutdb";
import { Logger } from "./Logger";

// ─── Workouts (home) screen data ────────────────────────────────────────────
// The home screen used to read every workout ever logged, plus four more
// queries, each time it gained focus. Now it reads a small snapshot:
//   recent     — the last RECENT_DAYS of workouts (what the week strip, the
//                "what to train today" plan and Jack's mood look at)
//   total      — how many workouts exist at all
//   points     — badge points, summed in SQL
//   streak / daysSinceLast
// The snapshot is rebuilt only when the workouts table changed (every writer
// bumps WORKOUTS_VERSION_KEY) or the local day changed (streak and "days since"
// depend on today). It's kept in memory and on disk, so a relaunch paints the
// last known numbers straight away.

const K_SNAPSHOT = "home_snapshot_v1";
const RECENT_DAYS = 60;

let snapshot = null;
let inflight = null;

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const isValid = (s) =>
  !!s && Array.isArray(s.recent) && typeof s.points === "number";

/** The in-memory snapshot right now (null before the first load). */
export const peekHomeSnapshot = () => snapshot;

/** Last snapshot known on this phone (memory, else disk), even if stale. */
export const readHomeSnapshot = async () => {
  if (snapshot) return snapshot;
  try {
    const raw = await AsyncStorage.getItem(K_SNAPSHOT);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isValid(parsed)) snapshot = parsed;
  } catch {}
  return snapshot;
};

const build = async (version, day) => {
  await initDB();
  const [recent, levelCounts, streak, daysSince] = await Promise.all([
    getRecentWorkouts(RECENT_DAYS),
    getLevelCounts(),
    getCurrentStreak(),
    getDaysSinceLastWorkout(),
  ]);
  const total = (levelCounts || []).reduce((n, r) => n + (Number(r?.n) || 0), 0);
  return {
    version,
    day,
    recent: recent || [],
    total,
    points: getPointsFromLevelCounts(levelCounts),
    streak: Number(streak) || 0,
    daysSinceLast: daysSince ?? -1,
  };
};

/**
 * The snapshot, rebuilt only if the data or the day changed.
 * Resolves to { snapshot, changed } — `changed` is false when nothing was
 * queried, so callers can skip re-rendering. Never rejects.
 */
export const getHomeSnapshot = async () => {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [cached, version] = await Promise.all([
        readHomeSnapshot(),
        AsyncStorage.getItem(WORKOUTS_VERSION_KEY).catch(() => null),
      ]);
      const v = version || "0";
      const day = localDay();
      if (cached && cached.version === v && cached.day === day) {
        return { snapshot: cached, changed: false };
      }
      const fresh = await build(v, day);
      snapshot = fresh;
      AsyncStorage.setItem(K_SNAPSHOT, JSON.stringify(fresh)).catch(() => {});
      return { snapshot: fresh, changed: true };
    } catch (e) {
      Logger.log("[HomeSnapshot] load failed:", String(e));
      return { snapshot, changed: false };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

/** Badge for a snapshot (Rabbit at 0 points). */
export const badgeForSnapshot = (s) => getBadgeForScore(s?.points || 0);
