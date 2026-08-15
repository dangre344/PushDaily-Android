// Lets any screen make the floating trainer bubble say something — a short
// congratulation after a workout, quiz or exercise. Module-level pub/sub (same
// pattern as constants/tabNavigation.js) so no provider or prop drilling.

let listener = null;
let hiddenListener = null;
let hidden = false;

/**
 * Screens that take over the display (a live camera, say) can hide the bubble
 * for as long as they need, then bring it back. Route-level hiding was too
 * blunt: it also swallowed the messages those screens want to send.
 */
export const setBubbleHidden = (value) => {
  hidden = !!value;
  hiddenListener?.(hidden);
};

export const isBubbleHidden = () => hidden;

export const registerBubbleVisibility = (fn) => {
  hiddenListener = fn;
  fn(hidden);
  return () => {
    if (hiddenListener === fn) hiddenListener = null;
  };
};

/** TrainerBubble registers itself here on mount. */
export const registerBubbleListener = (fn) => {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
};

/**
 * Show a message next to the bubble. No-ops when the bubble isn't mounted
 * (signup, chat, camera), so call sites never need to check.
 * @param text  short line — one sentence, it sits in a small bubble
 * @param ms    how long it stays before auto-dismissing (long enough
 *              to read comfortably after an ad or a screen change)
 */
export const sayFromJack = (text, ms = 9000) => {
  if (!text) return;
  listener?.(String(text), ms);
};

// Keys already spoken during THIS app session. Module scope, so it resets on
// a cold start but survives every navigation — revisiting a screen stays quiet.
const saidThisSession = new Set();

/**
 * Says something at most once per app session.
 * @param key  stable id for the message ("attendance_nudge", …)
 * @return true if it was spoken, false if it had already been said
 */
export const sayOncePerSession = (key, text, ms) => {
  if (!key || saidThisSession.has(key)) return false;
  saidThisSession.add(key);
  sayFromJack(text, ms);
  return true;
};

/** Test helper / manual reset — not used in normal flow. */
export const resetSessionMessages = () => saidThisSession.clear();

const firstName = (name) =>
  String(name || "")
    .trim()
    .split(" ")[0];

// ── Ready-made lines, so wording stays consistent across screens ────────────
export const praiseWorkout = (name, count) =>
  count > 1
    ? `Good job${firstName(name) ? `, ${firstName(name)}` : ""}! That's ${count} this week 💪`
    : `Good job${firstName(name) ? `, ${firstName(name)}` : ""}! See you tomorrow 💪`;

export const praiseQuiz = (name) =>
  `Nice${firstName(name) ? `, ${firstName(name)}` : ""}! You've gained some knowledge — come back tomorrow 🧠`;

export const praiseExercise = (exercise) =>
  `${exercise} done — keep that form 👏`;

// ── Food scan reactions ──
export const foodVerdictMessage = (verdict, alreadyHadUnhealthy) => {
  if (verdict === "healthy") return "Good to go — solid choice 👍";
  if (verdict === "sometimes")
    return "Okay once in a while — just don't make it a habit 🙂";
  return alreadyHadUnhealthy
    ? "You've already had junk today 😤 Please skip this one."
    : "I'd suggest skipping this one 🚫";
};

// ── Screen-entry nudges (all once per session) ──
export const attendanceNudge = (name) =>
  `No workout logged today${firstName(name) ? `, ${firstName(name)}` : ""} — consistency is what builds results.💪`;

export const leaderboardNudge = (leaderName) =>
  leaderName
    ? `${leaderName} is top today — let's take that crown 😤`
    : "Nobody has scored yet. Be the first on the board 🥇";

export const waterNudge = () =>
  "Water helps you train harder and recover faster 💧 Add Reminder now :)";

export const praisePushups = (name, count) =>
  `${count} push-ups${firstName(name) ? `, ${firstName(name)}` : ""}! Strong work 🔥`;
