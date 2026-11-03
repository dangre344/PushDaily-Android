import AsyncStorage from "@react-native-async-storage/async-storage";

import { getUserBadge } from "../app/home/WorkoutBadgeInfo";
import {
  getAllWorkouts,
  getCurrentStreak,
  getDaysSinceLastWorkout,
  getProfileStats,
  initDB,
  WORKOUTS_VERSION_KEY,
} from "../offlinedb/workoutdb";
import { Logger } from "./Logger";

// ─── Profile stats cache ─────────────────────────────────────────────────────
// Profile used to run four queries (including a full history read for the
// badge) every time it came into focus. The results are kept here and only
// recomputed when they can actually have changed:
//   • a workout was saved / deleted (workoutdb bumps WORKOUTS_VERSION_KEY)
//   • the day changed (the streak and "days since last" move at midnight)

const KEY = "profile_stats_cache_v1";
let memo = null;

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parse = (raw) => {
  try {
    const o = raw ? JSON.parse(raw) : null;
    return o && o.stats && typeof o.streak === "number" ? o : null;
  } catch {
    return null;
  }
};

/** Last snapshot, possibly stale — for painting Profile instantly. */
export const readCachedProfileSnapshot = async () => {
  if (memo) return memo;
  try {
    memo = parse(await AsyncStorage.getItem(KEY));
  } catch {
    memo = null;
  }
  return memo;
};

/**
 * { stats, streak, daysSinceLast, badge, fresh } — from the cache when it is
 * still valid, otherwise recomputed from the database (fresh: true).
 */
export const getProfileSnapshot = async () => {
  let version = "0";
  try {
    version = (await AsyncStorage.getItem(WORKOUTS_VERSION_KEY)) || "0";
  } catch {}

  const cached = await readCachedProfileSnapshot();
  if (cached && cached.version === version && cached.day === dayKey()) {
    return { ...cached, fresh: false };
  }

  await initDB();
  const [stats, streak, daysSinceLast, all] = await Promise.all([
    getProfileStats(),
    getCurrentStreak(),
    getDaysSinceLastWorkout(),
    getAllWorkouts(),
  ]);
  // Stamped with the version read BEFORE the queries: a workout saved while
  // they ran leaves the version different, so the next visit recomputes.
  memo = {
    stats,
    streak: streak ?? 0,
    daysSinceLast: daysSinceLast ?? -1,
    badge: getUserBadge(all || []),
    version,
    day: dayKey(),
  };
  AsyncStorage.setItem(KEY, JSON.stringify(memo)).catch((e) =>
    Logger.log("[ProfileStats] cache write failed:", String(e)),
  );
  return { ...memo, fresh: true };
};
