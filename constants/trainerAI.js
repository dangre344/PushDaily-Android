import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_TOKEN, WORKER_URL } from "./api";
import { Logger } from "./Logger";

// Honest status messages shown when Gemini can't answer — we no longer fall
// back to canned/static replies; every real answer comes from Gemini.
const MSG_NOT_CONFIGURED =
  "The AI trainer isn't set up yet. Please try again soon!";
const MSG_ERROR =
  "Hmm, I couldn't reach my brain just now 🤔 Please check your connection and try again.";
const MSG_BUSY =
  "I'm getting a lot of questions right now 😅 Please try again in a moment.";
export const MSG_DAILY_LIMIT =
  "You've used today's free questions. Watch a quick ad to ask more, or come back tomorrow! 💪";

// ── Config ──────────────────────────────────────────────────────────────────
// Single source of truth for the endpoint lives in constants/api.js. No LLM or
// database keys exist in the app — the Worker holds them all server-side.

// Tunables (could later be driven by Firebase Remote Config without an update).
const FREE_AI_PER_DAY = 2; // free Gemini answers before the rewarded-ad gate
const REWARD_GRANT = 3; //     answers unlocked per rewarded ad watched
const HARD_CAP = 12; //        absolute per-user daily ceiling (protects the shared quota)
const TIMEOUT_MS = 20000;

const K_USAGE = "ai_usage"; // { date: "YYYY-MM-DD", used, granted }

const today = () => new Date().toISOString().slice(0, 10);

const readUsage = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_USAGE);
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.date !== today()) return { date: today(), used: 0, granted: 0 };
    return u;
  } catch {
    return { date: today(), used: 0, granted: 0 };
  }
};

const writeUsage = (u) => AsyncStorage.setItem(K_USAGE, JSON.stringify(u));

/** Current AI allowance for today. */
export const getAiAllowance = async () => {
  const u = await readUsage();
  const limit = Math.min(FREE_AI_PER_DAY + u.granted, HARD_CAP);
  return {
    used: u.used,
    limit,
    remaining: Math.max(0, limit - u.used),
    canEarn: limit < HARD_CAP, // is there still room to unlock more via an ad?
  };
};

/** Call after a rewarded ad is watched to unlock more AI answers. */
export const grantRewardQuestions = async () => {
  const u = await readUsage();
  u.granted = Math.min(u.granted + REWARD_GRANT, HARD_CAP - FREE_AI_PER_DAY);
  await writeUsage(u);
};

const markUsed = async () => {
  const u = await readUsage();
  u.used += 1;
  await writeUsage(u);
};

const callWorker = async (text, user) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": APP_TOKEN,
      },
      body: JSON.stringify({
        question: text,
        profile: {
          gender: user?.gender,
          age: user?.age,
          weight: user?.weight,
          height: user?.height,
          goal: user?.goal,
          experience: user?.experience,
        },
      }),
      signal: ctrl.signal,
    });
    if (res.status === 429) return { quota: true }; // shared free quota exhausted
    if (!res.ok) throw new Error(`worker ${res.status}`);
    const data = await res.json();
    if (!data?.reply) throw new Error("empty reply");
    return { text: String(data.reply).trim() };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Returns one of:
 *   { source: "ai", text }            → Gemini's reply
 *   { source: "error"|"busy"|..., text } → honest status message (no canned answer)
 *   { status: "need_reward" }         → show a rewarded ad, then call again
 *
 * Every real answer comes from Gemini — there is no static/rule-based reply.
 */
export const askTrainer = async (text, user) => {
  if (!WORKER_URL) return { source: "error", text: MSG_NOT_CONFIGURED };

  const { remaining, canEarn } = await getAiAllowance();
  if (remaining <= 0) {
    return canEarn
      ? { status: "need_reward" }
      : { source: "limit", text: MSG_DAILY_LIMIT };
  }

  try {
    const r = await callWorker(text, user);
    if (r.quota) return { source: "busy", text: MSG_BUSY };
    await markUsed();
    return { source: "ai", text: r.text };
  } catch (e) {
    Logger.log("[TrainerAI] Gemini error:", String(e));
    return { source: "error", text: MSG_ERROR };
  }
};

// Builds an encouraging analysis from the raw numbers — used when the Worker
// isn't reachable, so a user who watched the ads still gets useful feedback.
const localWorkoutAnalysis = (s) => {
  const body = Object.entries(s?.byBodyPart || {}).sort((a, b) => b[1] - a[1]);
  const fav = body[0]?.[0];
  const neglected = body.length > 1 ? body[body.length - 1][0] : null;

  const lines = [];
  lines.push(
    `🎉 Incredible effort! You've logged ${s.totalWorkouts} workouts, burned about ${s.totalCalories} kcal across ${s.activeDays} active days. That's real commitment.`,
  );
  if (fav) lines.push(`💪 What's going well: ${fav} is clearly your strong suit — you keep showing up for it.`);
  if (neglected && neglected !== fav)
    lines.push(`👀 Focus next: add a bit more ${neglected} work to keep your body balanced and injury-free.`);
  lines.push(`🎯 Your next move: aim for one more session this week than last. Small, steady wins win the long game.`);
  lines.push(`Keep it up — your future self is already proud of you. Let's go! 🚀`);
  return lines.join("\n\n");
};

/**
 * Full workout-history review. Gated by rewarded ads in the UI (NOT the daily
 * free quota), so it does not call markUsed(). Falls back to a local analysis
 * if the Worker/AI is unreachable so the user always gets a result.
 */
export const analyzeWorkoutsAI = async (summary, user) => {
  if (!WORKER_URL) return { source: "local", text: localWorkoutAnalysis(summary) };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(`${WORKER_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Token": APP_TOKEN },
      body: JSON.stringify({
        mode: "analyze",
        stats: summary,
        profile: {
          gender: user?.gender,
          age: user?.age,
          weight: user?.weight,
          height: user?.height,
          goal: user?.goal,
          experience: user?.experience,
        },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`worker ${res.status}`);
    const data = await res.json();
    if (!data?.reply) throw new Error("empty reply");
    return { source: "ai", text: String(data.reply).trim() };
  } catch (e) {
    Logger.log("[TrainerAI] analyze fallback to local:", String(e));
    return { source: "local", text: localWorkoutAnalysis(summary) };
  } finally {
    clearTimeout(timer);
  }
};
