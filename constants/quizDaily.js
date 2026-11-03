import AsyncStorage from "@react-native-async-storage/async-storage";
import { callBackend } from "./api";
import { Logger } from "./Logger";
import {
  DAILY_QUESTION_COUNT,
  DIFF_RANK,
  todayKey,
} from "./quizQuestions";

// ─── Today's shared question set ──────────────────────────────────────────────
// Questions come ONLY from the AI-generated daily set — nothing is bundled.
//   1. AsyncStorage cache → 0 network, instant (once fetched today)
//   2. Cloudflare Worker  → its newest set (today's, or the last good one)
//   3. The last set we ever cached, if the Worker can't be reached
// Only when all three come up empty does the UI show its retry state.
//
// No database keys live in the app: the Worker reads Supabase with the service
// key server-side, exactly like the trainer chat does for the LLM keys.

const K_CACHE = "quiz_daily_set"; // { date, serverDate, questions, checkedAt }

// The Worker's quiz day is a UTC date; ours is the local one. When the cached
// set isn't the server's current one yet, look again at most this often.
const RECHECK_MS = 20 * 60 * 1000;

const utcKey = (d = new Date()) => d.toISOString().slice(0, 10);

// Guards against a malformed/partial remote payload reaching the UI.
const isValidQuestion = (q) =>
  q &&
  typeof q.question === "string" &&
  Array.isArray(q.options) &&
  q.options.length === 4 &&
  q.options.every((o) => typeof o === "string" && o.trim()) &&
  Number.isInteger(q.correct) &&
  q.correct >= 0 &&
  q.correct <= 3 &&
  typeof q.tip === "string";

const normalize = (list) =>
  list
    .filter(isValidQuestion)
    .map((q, i) => ({
      id: q.id ?? i + 1,
      category: q.category || "workouts",
      difficulty: q.difficulty || "basic",
      emoji: q.emoji || "💪",
      question: q.question,
      options: q.options,
      correct: q.correct,
      tip: q.tip,
    }));

/** The cached entry (any day), or null. */
const readCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_CACHE);
    const o = raw ? JSON.parse(raw) : null;
    if (Array.isArray(o?.questions)) {
      const questions = normalize(o.questions);
      if (questions.length >= DAILY_QUESTION_COUNT) return { ...o, questions };
    }
  } catch {}
  return null;
};

const writeCache = async (entry) => {
  try {
    await AsyncStorage.setItem(K_CACHE, JSON.stringify(entry));
  } catch {}
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// One small request (plus one retry on a network blip), via the Worker.
// Returns { questions, serverDate } or null.
const fetchRemote = async () => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await callBackend("daily-quiz", {}, 10000);
    const list = res?.questions;
    if (Array.isArray(list) && list.length) {
      // Older Workers only ever returned today's set, without a date.
      return { questions: list, serverDate: res.date || utcKey() };
    }
    // A reachable Worker with no set won't change in a second; only retry
    // when the request itself failed.
    if (res) return null;
    if (attempt === 1) await wait(1500);
  }
  return null;
};

/**
 * The 10 AI-generated questions everyone gets today.
 *
 * Used to fail whenever today's exact set wasn't in the cache or on the server
 * yet — every day right after UTC midnight, after any failed generation, and on
 * a single dropped request. Now: the Worker serves its newest set, the cache
 * keeps whatever we last got, and an error state is only shown when there has
 * never been a set at all.
 * Returns [] in that case — callers must handle the empty case.
 */
export const getDailySet = async () => {
  const date = todayKey();
  const cached = await readCache();
  const forToday = cached?.date === date;

  // Today's, and already the server's set for the current UTC day.
  if (forToday && cached.serverDate === utcKey()) return cached.questions;
  // Today's but possibly superseded — don't ask on every screen visit.
  if (forToday && Date.now() - (cached.checkedAt || 0) < RECHECK_MS) {
    return cached.questions;
  }

  const remote = await fetchRemote();
  if (remote) {
    const qs = normalize(remote.questions);
    if (qs.length >= DAILY_QUESTION_COUNT) {
      const questions = qs.slice(0, DAILY_QUESTION_COUNT);
      await writeCache({ date, serverDate: remote.serverDate, questions, checkedAt: Date.now() });
      return questions;
    }
    Logger.log("[Quiz] remote set failed validation");
  }

  // Offline or the Worker is down: any set we already have beats an error
  // screen, even yesterday's.
  if (cached) {
    if (forToday) await writeCache({ ...cached, checkedAt: Date.now() });
    return cached.questions;
  }
  return [];
};

/** Slice of today's set for quiz session `sessionIndex`, easiest first. */
export const getSessionQuestions = async (sessionIndex = 0, perQuiz = 5) => {
  const daily = await getDailySet();
  const start = sessionIndex * perQuiz;
  return daily
    .slice(start, start + perQuiz)
    .sort(
      (a, b) => (DIFF_RANK[a.difficulty] ?? 0) - (DIFF_RANK[b.difficulty] ?? 0),
    );
};
