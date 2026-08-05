import AsyncStorage from "@react-native-async-storage/async-storage";
import { callBackend } from "./api";

// ─── Push-up leaderboard ──────────────────────────────────────────────────────
// NO database keys live in the app. Every read/write goes through our
// Cloudflare Worker, which holds the Supabase service key server-side — the
// same pattern the trainer chat uses for the LLM keys.

const K_BEST = "pushup_best";
const K_SESSIONS = "pushup_sessions"; // { date: "YYYY-MM-DD", count }
const K_TOTAL = "pushup_total"; // lifetime reps

// ─── TIMEZONE: the challenge day is UTC everywhere ───────────────────────────
// The leaderboard is global, so the "day" MUST be the same instant for every
// user — otherwise a player in India and one in the US would be compared across
// different windows and the board would mismatch. We therefore use UTC for the
// day key, the Supabase range filter and the stored timestamp.
// ⚠️ Do NOT switch these to local time (getFullYear/getMonth/getDate).
export const utcDayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const todayKey = () => utcDayKey();

/** Milliseconds until the global (UTC) leaderboard reset. */
export const msUntilUtcReset = () => {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
};

// ── Daily session gate (first free, rest need a rewarded ad) ──
export const getTodaySessionCount = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_SESSIONS);
    const o = raw ? JSON.parse(raw) : null;
    if (!o || o.date !== todayKey()) return 0;
    return o.count || 0;
  } catch {
    return 0;
  }
};

export const incrementTodaySession = async () => {
  const cur = await getTodaySessionCount();
  const next = cur + 1;
  await AsyncStorage.setItem(
    K_SESSIONS,
    JSON.stringify({ date: todayKey(), count: next }),
  );
  return next;
};

// ── Local personal best (TODAY only — resets to 0 each new day) ──
export const getPushupBest = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_BEST);
    const o = raw ? JSON.parse(raw) : null;
    if (!o || o.date !== todayKey()) return 0; // no record for today → 0
    return o.best || 0;
  } catch {
    return 0;
  }
};

// ── Lifetime push-ups (never resets) ──
export const getPushupTotal = async () => {
  const v = parseInt((await AsyncStorage.getItem(K_TOTAL)) || "0", 10);
  return Number.isFinite(v) ? v : 0;
};

/** Adds this session's reps to the all-time total. Returns the new total. */
export const addPushupTotal = async (count) => {
  const n = Math.max(0, Number(count) || 0);
  const total = (await getPushupTotal()) + n;
  await AsyncStorage.setItem(K_TOTAL, String(total));
  return total;
};

export const savePushupBest = async (count) => {
  const best = await getPushupBest(); // today's best (0 on a new day)
  if (count > best) {
    await AsyncStorage.setItem(
      K_BEST,
      JSON.stringify({ date: todayKey(), best: count }),
    );
    return count;
  }
  return best;
};

// ── Country / flag ──
export const getDeviceCountry = () => {
  try {
    const RNL = require("react-native-localize");
    return RNL.getCountry?.() || null; // e.g. "IN"
  } catch {
    return null;
  }
};

const flagOf = (cc) =>
  cc && cc.length === 2
    ? String.fromCodePoint(
        ...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)),
      )
    : "🌍";

// ── Upload this user's best score (via the Worker) ──
// The Worker stamps the row in UTC, so the challenge day is global.
export const saveScore = async (id, name, count, country) => {
  if (!id) return false;
  const res = await callBackend("submit-score", {
    id: String(id),
    name: name || "Anonymous",
    count,
    country: country || null,
  });
  return !!res?.ok;
};

/**
 * Live top-10 + the user's own best/rank, fetched through the Worker.
 * { top: [{rank, name, pushups, flag, isUser}], me: { rank, best, lifetime } }
 * `top` is empty when nobody has logged a score yet (or we're offline).
 */
export const getLeaderboard = async (userId, userName) => {
  const [best, lifetime] = await Promise.all([
    getPushupBest(),
    getPushupTotal(),
  ]);

  const res = await callBackend("leaderboard", {
    userId: userId ? String(userId) : "",
    best,
    limit: 10,
  });

  const rows = Array.isArray(res?.rows) ? res.rows : [];
  const top = rows.map((r, i) => ({
    rank: i + 1,
    name: r.name || "Anonymous",
    pushups: r.pushup_count || 0,
    flag: flagOf(r.country),
    isUser: !!userId && String(r.id) === String(userId),
  }));

  return { top, me: { rank: res?.rank || 0, best, lifetime } };
};
