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
//   2. Cloudflare Worker  → ONE small request per user per day
// If neither succeeds we return an empty set and the UI shows a retry state.
//
// No database keys live in the app: the Worker reads Supabase with the service
// key server-side, exactly like the trainer chat does for the LLM keys.

const K_CACHE = "quiz_daily_set"; // { date, questions }

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

const readCache = async (date) => {
  try {
    const raw = await AsyncStorage.getItem(K_CACHE);
    const o = raw ? JSON.parse(raw) : null;
    if (o?.date === date && Array.isArray(o.questions) && o.questions.length) {
      const qs = normalize(o.questions);
      if (qs.length >= DAILY_QUESTION_COUNT) return qs;
    }
  } catch {}
  return null;
};

const writeCache = async (date, questions) => {
  try {
    await AsyncStorage.setItem(K_CACHE, JSON.stringify({ date, questions }));
  } catch {}
};

// ONE small request per user per day (then cached), via the Worker.
const fetchRemote = async () => {
  const res = await callBackend("daily-quiz", {}, 8000);
  const list = res?.questions;
  return Array.isArray(list) && list.length ? list : null;
};

/**
 * The 10 AI-generated questions everyone gets today.
 * Returns [] when the set can't be fetched (offline / not generated yet) —
 * callers must handle the empty case.
 */
export const getDailySet = async () => {
  const date = todayKey();

  const cached = await readCache(date);
  if (cached) return cached;

  const raw = await fetchRemote();
  if (raw) {
    const qs = normalize(raw);
    if (qs.length >= DAILY_QUESTION_COUNT) {
      const set = qs.slice(0, DAILY_QUESTION_COUNT);
      await writeCache(date, set);
      return set;
    }
    Logger.log("[Quiz] remote set failed validation");
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
