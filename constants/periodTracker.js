import AsyncStorage from "@react-native-async-storage/async-storage";

import { Logger } from "./Logger";

// ─── Period tracking (on device only) ────────────────────────────────────────
// Everything lives in AsyncStorage on the phone. Nothing is sent anywhere —
// this is health data, and the app has no reason to know it server-side.
//
// Stored shape (one key):
//   {
//     cycles: [{ start: "YYYY-MM-DD", expected: "YYYY-MM-DD" | null,
//                delay: number | null, loggedAt: ms }],   newest first
//     cycleLength: 28,   // what she told us; used until history is enough
//     periodLength: 5,
//   }
//
// `expected` is the prediction that was showing when she logged that period,
// so `delay` (days late, negative = early) is a real record of how the cycle
// behaved — not something recomputed later from a moving average.

const K_PERIOD = "period_tracker_v1";

export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;
export const CYCLE_RANGE = [21, 45];
export const PERIOD_RANGE = [2, 10];

const DAY = 86400000;

/** "YYYY-MM-DD" in local time. */
export const toKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/** Local-midnight Date from "YYYY-MM-DD" (never parsed as UTC). */
export const fromKey = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Whole calendar days from a to b (b - a), DST-safe. */
export const daysBetween = (a, b) =>
  Math.round((fromKey(toKey(b)) - fromKey(toKey(a))) / DAY);

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const clamp = (n, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(n)));

// A function, not a shared object: callers push into `cycles`, and a shared
// array would leak entries between loads.
const empty = () => ({ cycles: [], cycleLength: DEFAULT_CYCLE, periodLength: DEFAULT_PERIOD });

export const loadPeriodData = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_PERIOD);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return {
      cycles: Array.isArray(data.cycles) ? data.cycles : [],
      cycleLength: clamp(data.cycleLength || DEFAULT_CYCLE, CYCLE_RANGE),
      periodLength: clamp(data.periodLength || DEFAULT_PERIOD, PERIOD_RANGE),
    };
  } catch (e) {
    Logger.log("[Period] load failed:", String(e));
    return empty();
  }
};

const save = async (data) => {
  await AsyncStorage.setItem(K_PERIOD, JSON.stringify(data));
  return data;
};

export const isPeriodSetUp = async () => (await loadPeriodData()).cycles.length > 0;

/**
 * Average cycle length from her own history (last 6 gaps), ignoring gaps that
 * can't be a single cycle (a missed log looks like a 60-day "cycle"). Falls
 * back to the length she entered.
 */
export const averageCycle = (data) => {
  const starts = data.cycles.map((c) => c.start);
  const gaps = [];
  for (let i = 0; i < starts.length - 1 && gaps.length < 6; i++) {
    const g = daysBetween(fromKey(starts[i + 1]), fromKey(starts[i]));
    if (g >= CYCLE_RANGE[0] && g <= CYCLE_RANGE[1]) gaps.push(g);
  }
  if (gaps.length === 0) return data.cycleLength;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
};

/**
 * Logs a period start. Records what we had predicted at that moment, so the
 * delay is preserved in history. Logging the same date twice is a no-op;
 * logging inside the current period's days just moves that start.
 */
export const logPeriodStart = async (date, { cycleLength, periodLength } = {}) => {
  const data = await loadPeriodData();
  if (cycleLength) data.cycleLength = clamp(cycleLength, CYCLE_RANGE);
  if (periodLength) data.periodLength = clamp(periodLength, PERIOD_RANGE);

  const key = toKey(date);
  if (data.cycles.some((c) => c.start === key)) return save(data);

  // Within a few days of an existing start = correcting that entry.
  const near = data.cycles.findIndex(
    (c) => Math.abs(daysBetween(fromKey(c.start), fromKey(key))) < data.periodLength,
  );
  if (near >= 0) data.cycles.splice(near, 1);

  const prev = data.cycles
    .filter((c) => c.start < key)
    .sort((a, b) => (a.start < b.start ? 1 : -1))[0];

  let expected = null;
  let delay = null;
  if (prev) {
    const exp = addDays(fromKey(prev.start), averageCycle(data));
    expected = toKey(exp);
    delay = daysBetween(exp, fromKey(key));
  }

  data.cycles.push({ start: key, expected, delay, loggedAt: Date.now() });
  data.cycles.sort((a, b) => (a.start < b.start ? 1 : -1));
  return save(data);
};

export const removePeriodStart = async (key) => {
  const data = await loadPeriodData();
  data.cycles = data.cycles.filter((c) => c.start !== key);
  // Delays further up the list referenced the removed entry; recompute them
  // against the entry that is now before each one.
  const asc = [...data.cycles].reverse();
  for (let i = 0; i < asc.length; i++) {
    if (i === 0) {
      asc[i] = { ...asc[i], expected: null, delay: null };
    } else if (asc[i].expected) {
      const exp = addDays(fromKey(asc[i - 1].start), data.cycleLength);
      asc[i] = { ...asc[i], expected: toKey(exp), delay: daysBetween(exp, fromKey(asc[i].start)) };
    }
  }
  data.cycles = asc.reverse();
  return save(data);
};

export const updateCycleSettings = async ({ cycleLength, periodLength }) => {
  const data = await loadPeriodData();
  if (cycleLength) data.cycleLength = clamp(cycleLength, CYCLE_RANGE);
  if (periodLength) data.periodLength = clamp(periodLength, PERIOD_RANGE);
  return save(data);
};

/**
 * Where she is in her cycle today.
 *
 * phase:
 *   "none"      — nothing logged yet
 *   "period"    — within the period days (dayOfPeriod 1..periodLength)
 *   "late"      — past the expected date with no new log (lateBy days)
 *   "due"       — expected today
 *   "soon"      — 1–3 days away
 *   "pms"       — 4–7 days away
 *   "ovulation" — fertile window, ~14 days before the next period (±2)
 *   "follicular"— the energetic stretch after the period
 *   "luteal"    — the rest
 */
export const getCycleStatus = (data, today = new Date()) => {
  if (!data?.cycles?.length) return { phase: "none" };

  const avg = averageCycle(data);
  const last = fromKey(data.cycles[0].start);
  const next = addDays(last, avg);
  const sinceStart = daysBetween(last, today);
  const untilNext = daysBetween(today, next);

  const base = {
    avgCycle: avg,
    periodLength: data.periodLength,
    lastStart: data.cycles[0].start,
    nextStart: toKey(next),
    cycleDay: sinceStart + 1,
    untilNext,
  };

  if (sinceStart >= 0 && sinceStart < data.periodLength) {
    return { ...base, phase: "period", dayOfPeriod: sinceStart + 1 };
  }
  if (untilNext < 0) return { ...base, phase: "late", lateBy: -untilNext };
  if (untilNext === 0) return { ...base, phase: "due" };
  if (untilNext <= 3) return { ...base, phase: "soon" };
  if (untilNext <= 7) return { ...base, phase: "pms" };
  if (Math.abs(untilNext - 14) <= 2) return { ...base, phase: "ovulation" };
  if (sinceStart < 12) return { ...base, phase: "follicular" };
  return { ...base, phase: "luteal" };
};

/** True when the period is close enough that support content should show. */
export const isPeriodNearby = (status) =>
  ["period", "late", "due", "soon", "pms"].includes(status?.phase);
