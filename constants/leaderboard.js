import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Push-up leaderboard (Supabase) ───────────────────────────────────────────
// IMPORTANT: only the PUBLISHABLE (anon) key may live in the app — it ships in
// the APK. The secret key grants full DB access and must NEVER be embedded.
// The publishable key requires Row Level Security policies on the `scores`
// table that allow public SELECT and INSERT/UPSERT.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

const REST = `${SUPABASE_URL}/rest/v1/scores`;
const baseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const K_BEST = "pushup_best";
const K_SESSIONS = "pushup_sessions"; // { date: "YYYY-MM-DD", count }

const todayKey = () => new Date().toISOString().slice(0, 10);

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

// PostgREST filter for "date within today (UTC)". Shared by fetch + rank so the
// board and the user's rank are always scoped to the current day.
const todayRangeQuery = () => {
  const n = new Date();
  const start = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0),
  ).toISOString();
  const end = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 23, 59, 59, 999),
  ).toISOString();
  return `&date=gte.${start}&date=lte.${end}`;
};

// ── Supabase: upsert this user's best score (stamped with today's date) ──
export const saveScore = async (id, name, count, country) => {
  if (!id) return false;
  try {
    const res = await fetch(REST, {
      method: "POST",
      headers: { ...baseHeaders, Prefer: "resolution=merge-duplicates" }, // upsert
      body: JSON.stringify({
        id: String(id),
        name: name || "Anonymous",
        pushup_count: count,
        country: country || null,
        date: new Date().toISOString(), // refresh so the row counts for today
      }),
    });
    return res.ok;
  } catch {
    return false; // best-effort; local best is still saved
  }
};

// Top scores for TODAY only.
const fetchTop = async (limit = 10) => {
  try {
    const res = await fetch(
      `${REST}?select=id,name,pushup_count,country&order=pushup_count.desc&limit=${limit}` +
        todayRangeQuery(),
      { headers: baseHeaders },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

// How many athletes scored higher than `best` TODAY (for the user's rank).
const countAbove = async (best) => {
  try {
    const res = await fetch(
      `${REST}?select=id&pushup_count=gt.${best}` + todayRangeQuery(),
      { method: "HEAD", headers: { ...baseHeaders, Prefer: "count=exact" } },
    );
    const cr = res.headers.get("content-range"); // "*/N"
    const total = cr ? parseInt(cr.split("/")[1], 10) : 0;
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
};

/**
 * Live top-10 from Supabase + the user's own best/rank.
 * { top: [{rank, name, pushups, flag, isUser}], me: { rank, best } }
 * `top` is empty when nobody has logged a score yet.
 */
export const getLeaderboard = async (userId, userName) => {
  const best = await getPushupBest();
  const rows = await fetchTop(10);

  const top = rows.map((r, i) => ({
    rank: i + 1,
    name: r.name || "Anonymous",
    pushups: r.pushup_count || 0,
    flag: flagOf(r.country),
    isUser: !!userId && String(r.id) === String(userId),
  }));

  let rank = 0;
  const mine = top.find((t) => t.isUser);
  if (mine) rank = mine.rank;
  else if (best > 0) rank = (await countAbove(best)) + 1;

  return { top, me: { rank, best } };
};
