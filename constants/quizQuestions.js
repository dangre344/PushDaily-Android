// ─── Fitness Quiz — shared metadata ──────────────────────────────────────────
// Questions are NOT bundled with the app. They are generated fresh every day by
// the AI (Cloudflare cron → Gemini → Supabase) and fetched through the Worker,
// so every user gets the same set. See constants/quizDaily.js.
//
// Question shape returned by the backend:
//   { id, category, difficulty, emoji, question, options[4], correct, tip }
//   • `correct` is the INDEX of the right option
//   • `tip` is a HINT (it must not reveal the answer)
//   • category "water" questions surface the "Set Water Reminder" CTA

export const QUIZ_CATEGORIES = {
  fat_loss: { label: "Fat Loss", icon: "flame", color: "#EF4444" },
  calories: { label: "Calories", icon: "calculator", color: "#F59E0B" },
  nutrients: { label: "Nutrition", icon: "nutrition", color: "#22C55E" },
  workouts: { label: "Workouts", icon: "barbell", color: "#FF6B35" },
  muscles: { label: "Muscles", icon: "body", color: "#7C3AED" },
  home: { label: "Home Workout", icon: "home", color: "#06B6D4" },
  vitamins: { label: "Vitamins", icon: "medkit", color: "#EC4899" },
  water: { label: "Hydration", icon: "water", color: "#2E90FA" },
  recovery: { label: "Recovery", icon: "moon", color: "#64748B" },
};

export const getCategoryMeta = (key) =>
  QUIZ_CATEGORIES[key] || {
    label: "Fitness",
    icon: "fitness",
    color: "#FF6B35",
  };

// How many questions make up a day's shared set (must match the Worker).
export const DAILY_QUESTION_COUNT = 10;

// Difficulty ordering, so each quiz session ramps from easier to harder.
export const DIFF_RANK = { basic: 0, intermediate: 1, advanced: 2 };

/** Local (device) calendar day key — used only for caching today's set. */
export const todayKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
