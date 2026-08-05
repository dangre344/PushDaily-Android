import AsyncStorage from "@react-native-async-storage/async-storage";
import { DAILY_QUESTION_COUNT } from "./quizQuestions";

// ─── Quiz progress + daily limit ──────────────────────────────────────────────
const K_STATE = "quiz_state"; // { totalXp, totalCorrect, totalAnswered, bestScore, quizzesPlayed }
const K_DAILY = "quiz_daily"; // { date, count, correct, wrong, skipped, reported }

export const XP_PER_CORRECT = 10;
export const QUESTIONS_PER_QUIZ = 5;
// The day has a fixed shared pool of 10 questions, played 5 at a time →
// 2 quiz sessions per day. Derived so the two can never drift apart.
export const DAILY_QUIZ_LIMIT = Math.ceil(
  DAILY_QUESTION_COUNT / QUESTIONS_PER_QUIZ,
);

const todayKey = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  totalXp: 0,
  totalCorrect: 0,
  totalAnswered: 0,
  bestScore: 0,
  quizzesPlayed: 0,
};

export const getQuizState = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_STATE);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
};

const EMPTY_DAY = {
  date: "",
  count: 0,
  correct: 0,
  wrong: 0,
  skipped: 0,
  reported: false,
};

/** Today's quiz record (auto-resets on a new day). */
export const getTodayRecord = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_DAILY);
    const o = raw ? JSON.parse(raw) : null;
    if (!o || o.date !== todayKey()) return { ...EMPTY_DAY, date: todayKey() };
    return { ...EMPTY_DAY, ...o };
  } catch {
    return { ...EMPTY_DAY, date: todayKey() };
  }
};

/** How many quizzes were submitted today (resets each day). */
export const getTodayQuizCount = async () => (await getTodayRecord()).count;

export const getQuizSummary = async () => {
  const [state, day] = await Promise.all([getQuizState(), getTodayRecord()]);
  const accuracy =
    state.totalAnswered > 0
      ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
      : 0;
  return {
    ...state,
    accuracy,
    todayCount: day.count,
    todayCorrect: day.correct,
    todayWrong: day.wrong,
    todaySkipped: day.skipped,
    dayReported: day.reported,
    remaining: Math.max(0, DAILY_QUIZ_LIMIT - day.count),
  };
};

/** Marks today's Mixpanel report as sent so it only fires once. */
export const markDayReported = async () => {
  const day = await getTodayRecord();
  await AsyncStorage.setItem(
    K_DAILY,
    JSON.stringify({ ...day, reported: true }),
  );
};

/**
 * Records a finished quiz: adds XP, updates accuracy totals + best score and
 * increments today's counter. Returns the fresh summary.
 */
export const submitQuizResult = async ({ correct, total, skipped = 0 }) => {
  const state = await getQuizState();
  const gainedXp = correct * XP_PER_CORRECT;
  const wrong = Math.max(0, total - correct - skipped);
  // Skipped questions don't count toward lifetime accuracy.
  const attempted = correct + wrong;

  const next = {
    totalXp: state.totalXp + gainedXp,
    totalCorrect: state.totalCorrect + correct,
    totalAnswered: state.totalAnswered + attempted,
    bestScore: Math.max(state.bestScore, correct),
    quizzesPlayed: state.quizzesPlayed + 1,
  };
  await AsyncStorage.setItem(K_STATE, JSON.stringify(next));

  const day = await getTodayRecord();
  await AsyncStorage.setItem(
    K_DAILY,
    JSON.stringify({
      ...day,
      date: todayKey(),
      count: day.count + 1,
      correct: day.correct + correct,
      wrong: day.wrong + wrong,
      skipped: day.skipped + skipped,
    }),
  );

  return { gainedXp, wrong, ...(await getQuizSummary()) };
};

// ── Rank tiers driven by lifetime XP (gamification) ──
const RANKS = [
  { min: 0, title: "Rookie", emoji: "🌱" },
  { min: 100, title: "Trainee", emoji: "🏃" },
  { min: 300, title: "Athlete", emoji: "💪" },
  { min: 600, title: "Pro", emoji: "🔥" },
  { min: 1000, title: "Elite", emoji: "🏆" },
  { min: 2000, title: "Legend", emoji: "👑" },
];

export const getRank = (xp = 0) => {
  let current = RANKS[0];
  let nextRank = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].min) {
      current = RANKS[i];
      nextRank = RANKS[i + 1] || null;
    }
  }
  const span = nextRank ? nextRank.min - current.min : 1;
  const progress = nextRank
    ? Math.min(1, Math.max(0, (xp - current.min) / span))
    : 1;
  return {
    ...current,
    next: nextRank,
    progress,
    toNext: nextRank ? nextRank.min - xp : 0,
  };
};
