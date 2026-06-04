// ─── Milestone definitions ───────────────────────────────────────────────────
// Each milestone maps to a metric from getMilestoneStats(). getMilestones(stats)
// returns the same list enriched with { current, unlocked, progress } so the UI
// can render progress bars and locked/unlocked states.
//
// metric ∈ totalWorkouts | currentStreak | longestStreak | totalCalories |
//          activeDays | bestWeek | variety

export const MILESTONE_CATEGORIES = [
  { key: "streak", title: "Streaks", icon: "flame", color: "#FF6B35" },
  { key: "workouts", title: "Workouts Done", icon: "barbell", color: "#4F46E5" },
  { key: "calories", title: "Calories Burned", icon: "flash", color: "#F59E0B" },
  { key: "consistency", title: "Consistency", icon: "calendar", color: "#10B981" },
  { key: "power", title: "Power Weeks", icon: "trophy", color: "#8B5CF6" },
  { key: "explorer", title: "Explorer", icon: "compass", color: "#EC4899" },
];

const DEFS = [
  // ── Streaks (based on longest streak achieved) ──────────────────────────────
  { id: "streak_3", category: "streak", metric: "longestStreak", target: 3, emoji: "🔥", title: "3-Day Spark", desc: "Work out 3 days in a row." },
  { id: "streak_7", category: "streak", metric: "longestStreak", target: 7, emoji: "⚡", title: "Week Warrior", desc: "A full 7-day streak." },
  { id: "streak_14", category: "streak", metric: "longestStreak", target: 14, emoji: "🌟", title: "Fortnight Fighter", desc: "14 days straight — habit forming." },
  { id: "streak_30", category: "streak", metric: "longestStreak", target: 30, emoji: "🏅", title: "Monthly Master", desc: "30-day streak. Serious discipline." },
  { id: "streak_60", category: "streak", metric: "longestStreak", target: 60, emoji: "💪", title: "Iron Will", desc: "60 days of showing up." },
  { id: "streak_100", category: "streak", metric: "longestStreak", target: 100, emoji: "👑", title: "Unbreakable", desc: "100-day streak. Legendary." },

  // ── Workouts done ───────────────────────────────────────────────────────────
  { id: "wk_1", category: "workouts", metric: "totalWorkouts", target: 1, emoji: "👟", title: "First Step", desc: "Complete your very first workout." },
  { id: "wk_10", category: "workouts", metric: "totalWorkouts", target: 10, emoji: "🌱", title: "Getting Going", desc: "10 workouts in the books." },
  { id: "wk_25", category: "workouts", metric: "totalWorkouts", target: 25, emoji: "🚀", title: "Quarter Century", desc: "25 workouts completed." },
  { id: "wk_50", category: "workouts", metric: "totalWorkouts", target: 50, emoji: "🎯", title: "Half Century", desc: "50 workouts done." },
  { id: "wk_100", category: "workouts", metric: "totalWorkouts", target: 100, emoji: "💯", title: "Century Club", desc: "100 workouts — elite consistency." },
  { id: "wk_250", category: "workouts", metric: "totalWorkouts", target: 250, emoji: "🔱", title: "Double Century+", desc: "250 workouts crushed." },
  { id: "wk_500", category: "workouts", metric: "totalWorkouts", target: 500, emoji: "🏆", title: "Living Legend", desc: "500 workouts. Unstoppable." },

  // ── Calories burned ─────────────────────────────────────────────────────────
  { id: "cal_1000", category: "calories", metric: "totalCalories", target: 1000, emoji: "🔥", title: "Warm Up", desc: "Burn 1,000 total calories." },
  { id: "cal_5000", category: "calories", metric: "totalCalories", target: 5000, emoji: "♨️", title: "Fat Burner", desc: "5,000 calories torched." },
  { id: "cal_10000", category: "calories", metric: "totalCalories", target: 10000, emoji: "🌋", title: "Furnace", desc: "10,000 calories burned." },
  { id: "cal_25000", category: "calories", metric: "totalCalories", target: 25000, emoji: "☄️", title: "Inferno", desc: "25,000 calories — on fire." },
  { id: "cal_50000", category: "calories", metric: "totalCalories", target: 50000, emoji: "💥", title: "Calorie Crusher", desc: "50,000 calories destroyed." },

  // ── Consistency (distinct active days) ──────────────────────────────────────
  { id: "day_7", category: "consistency", metric: "activeDays", target: 7, emoji: "📅", title: "One Week In", desc: "Active on 7 different days." },
  { id: "day_30", category: "consistency", metric: "activeDays", target: 30, emoji: "🗓️", title: "Regular", desc: "30 active days total." },
  { id: "day_100", category: "consistency", metric: "activeDays", target: 100, emoji: "🧭", title: "Devoted", desc: "100 active days. A true habit." },

  // ── Power weeks (most workouts in one calendar week) ────────────────────────
  { id: "week_5", category: "power", metric: "bestWeek", target: 5, emoji: "🐝", title: "Busy Bee", desc: "5 workouts in a single week." },
  { id: "week_10", category: "power", metric: "bestWeek", target: 10, emoji: "⚙️", title: "Power Week", desc: "10 workouts in one week." },
  { id: "week_15", category: "power", metric: "bestWeek", target: 15, emoji: "🤖", title: "Machine", desc: "15 workouts in a week. Wow." },

  // ── Explorer (distinct body parts trained) ──────────────────────────────────
  { id: "var_3", category: "explorer", metric: "variety", target: 3, emoji: "🧗", title: "Explorer", desc: "Train 3 different body parts." },
  { id: "var_6", category: "explorer", metric: "variety", target: 6, emoji: "🌍", title: "All-Rounder", desc: "Train 6 different body parts." },
];

/**
 * Enriches each milestone with live progress from the user's stats.
 * @param {object} stats  result of getMilestoneStats()
 * @returns milestones + a summary { unlocked, total, percent }
 */
export const getMilestones = (stats = {}) => {
  const milestones = DEFS.map((m) => {
    const current = Number(stats[m.metric] ?? 0);
    const unlocked = current >= m.target;
    const progress = Math.max(0, Math.min(current / m.target, 1));
    return { ...m, current, unlocked, progress };
  });

  const unlocked = milestones.filter((m) => m.unlocked).length;
  const total = milestones.length;
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return { milestones, summary: { unlocked, total, percent } };
};

export const getCategory = (key) =>
  MILESTONE_CATEGORIES.find((c) => c.key === key) ?? MILESTONE_CATEGORIES[0];
