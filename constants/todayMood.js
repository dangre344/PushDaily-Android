// ─── Jack's mood on the Workouts "Today" card ────────────────────────────────
// The home-screen widget keeps its own (gentler, Kotlin-mirrored) copy in
// ./widgetData.js. Inside the app we can afford more personality: these lines
// are cheeky, sarcastic and a little dramatic — but they tease the HABIT,
// never the person's body.
//
// The character and the line both follow how many days the user trained in
// the last 7, so the card visibly "levels up" through the week.

/** Who Jack claims to be more devoted than. Driven by the signup gender. */
const partnerFor = (gender) => {
  const g = String(gender || "").toLowerCase();
  if (g === "male") return "girlfriend";
  if (g === "female") return "boyfriend";
  return "crush";
};

/**
 * Buckets in priority order; the first matching `when` wins.
 * Placeholders: {name} {partner} {week} {weekDays} {streak} {gone}
 */
const MOODS = [
  {
    id: "done_today",
    expression: "cheer",
    when: (s) => s.trainedToday && s.week >= 5,
    lines: [
      "{week} days this week?! Leave some gains for the rest of us 🤯",
      "Done again. At this point I'm scared of you 😳",
      "Beast mode logged. Go hydrate, legend 💧",
    ],
  },
  {
    id: "done_today",
    expression: "proud",
    when: (s) => s.trainedToday,
    lines: [
      "Workout done. You may now flex at strangers 💪",
      "Look at you, sweaty and smug. I love it 🎉",
      "Done already? Who even are you? 🔥",
    ],
  },
  {
    id: "welcome",
    expression: "hi",
    when: (s) => s.never,
    lines: [
      "New here? I don't bite. Burpees might 😏",
      "The couch called. I said you're busy now 🛋️",
      "Day one, {name}. Let's make the mirror jealous 💪",
    ],
  },
  {
    id: "ghosted",
    expression: "sad",
    when: (s) => s.gone >= 7,
    lines: [
      "I missed you more than your {partner} did 💔",
      "{gone} days, {name}. I counted. Every. Single. One 🥲",
      "Your muscles filed a missing-person report 🚨",
    ],
  },
  {
    id: "drifting",
    expression: "phone",
    when: (s) => s.gone >= 3,
    lines: [
      "{gone} days off. Rest day or retirement? 🤔",
      "Still scrolling? Your abs are hiding from you 👀",
      "Even your {partner} texts back faster than you train 📱",
    ],
  },
  {
    id: "streak_danger",
    expression: "wow",
    when: (s) => s.streak > 0 && s.hour >= 19,
    lines: [
      "{streak}-day streak on the line. No pressure… okay, some ⏰",
      "Don't let the streak die tonight, {name} 😬",
      "Clock's ticking. Your streak is sweating more than you ⏳",
    ],
  },
  {
    id: "week_beast",
    expression: "flex",
    when: (s) => s.week >= 5,
    lines: [
      "{week} days this week. Okay, show-off 😎",
      "Your {partner} is going to notice. Just saying 😏",
      "Even I'm tired watching you. Keep going 🔥",
    ],
  },
  {
    id: "week_rolling",
    expression: "dumbbell",
    when: (s) => s.week >= 3,
    lines: [
      "{week} days this week. Somebody's getting serious 💪",
      "Consistency looks good on you, {name} 😉",
      "Halfway to legend status. Don't stop now 🚀",
    ],
  },
  {
    id: "week_started",
    expression: "wink",
    when: (s) => s.week >= 1,
    lines: [
      "{weekDays} this week. Cute. Let's make it a habit 😉",
      "Good start. Now don't ghost me like an ex 😏",
      "You came back. I knew you liked me 😌",
    ],
  },
  {
    id: "night",
    expression: "sleepy",
    when: (s) => s.hour >= 22 || s.hour < 5,
    lines: [
      "Late, but 10 minutes still counts 🌙",
      "Quick one before bed? I'll keep it short 😴",
      "Sleep comes easier after a few reps 🌙",
    ],
  },
  {
    id: "fallback",
    expression: "think",
    when: () => true,
    lines: [
      "Thinking about working out burns 0 kcal 🤔",
      "Ten minutes, {name}. That's one reel… or five 👀",
      "Your future self is watching. Don't embarrass them 😅",
    ],
  },
];

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Distinct training days in the last 7 (today included). */
export const trainedDaysThisWeek = (history = []) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);
  const days = new Set();
  for (const w of history) {
    const t = new Date(w?.dateTime);
    if (!Number.isNaN(t.getTime()) && t >= since) days.add(dayKey(t));
  }
  return days.size;
};

/**
 * @param {object} s
 * @param {Array}  s.history        completed workouts [{ dateTime }]
 * @param {number} s.streak
 * @param {number} s.daysSinceLast  0 = today, -1 = never
 * @param {string} s.name
 * @param {string} s.gender         "Male" | "Female" | "Other"
 * @param {number} s.shift          bumps the line (tap the mascot for another)
 * @return {{ id, expression, text }}
 */
export const resolveTodayMood = ({
  history = [],
  streak = 0,
  daysSinceLast = -1,
  name,
  gender,
  shift = 0,
} = {}) => {
  const state = {
    week: trainedDaysThisWeek(history),
    streak,
    gone: daysSinceLast,
    never: daysSinceLast < 0,
    trainedToday: daysSinceLast === 0,
    hour: new Date().getHours(),
  };

  const mood = MOODS.find((m) => m.when(state));
  // Changes once a day on its own; `shift` lets a tap cycle through.
  const day = Math.floor(Date.now() / 86400000);
  const line = mood.lines[(day + shift) % mood.lines.length];
  const who = (name || "").trim().split(/\s+/)[0] || "champ";

  const text = line
    .replace(/\{name\}/g, who)
    .replace(/\{partner\}/g, partnerFor(gender))
    .replace(/\{weekDays\}/g, state.week === 1 ? "1 day" : `${state.week} days`)
    .replace(/\{week\}/g, String(state.week))
    .replace(/\{streak\}/g, String(streak))
    .replace(/\{gone\}/g, String(Math.max(daysSinceLast, 0)));

  return { id: mood.id, expression: mood.expression, text };
};
