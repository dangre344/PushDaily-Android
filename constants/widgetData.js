// ─── Widget character + copy (shared source of truth) ───────────────────────
// Deliberately CommonJS: this file is required from TWO runtimes.
//   1. Metro, for the in-app preview in the "how to add" guide.
//   2. Node, by plugins/withWidget.js, which bakes it into Kotlin.
// The widget's messages used to be duplicated between JS and the plugin; with
// 12 expressions that drift was a matter of time, so there is now one table.
//
// TONE — the Duolingo widget is famous partly for guilt-tripping, and that
// lands very differently in fitness than in language learning. These lines are
// cheeky about SHOWING UP, never shaming about being away. Same rule the
// trainer bubble follows.

/**
 * Jack's expressions. `drawable` is the Android resource name; the matching
 * PNG lives at assets/widget/<drawable>.png and the config plugin copies it
 * into res/drawable-nodpi at prebuild time.
 */
const EXPRESSIONS = {
  coffee: "jack_coffee", // mug in hand, fist up
  morning: "jack_morning", // hands on hips, cheerful
  ready: "jack_ready", // fists clenched, determined
  encouraging: "jack_encouraging", // thumbs up, warm grin
  confident: "jack_confident", // arms crossed, cool smirk
  teasing: "jack_teasing", // arms crossed, smug eyebrow
  waiting: "jack_waiting", // open palm, "well?"
  challenge: "jack_challenge", // wink, towel, pointing at you
  gentle: "jack_gentle", // hands together, hopeful
  late: "jack_late", // pointing at watch, alarmed
  after_workout: "jack_after_workout", // sweaty, hands on knees, proud
  missed: "jack_missed", // chin on hand, disappointed
};

/**
 * Message buckets, in priority order. `pickBucket` below walks this list and
 * takes the first whose rule matches — Kotlin implements the identical walk so
 * the widget stays correct for 30 minutes at a time without the app running.
 *
 * Placeholders: {name} (falls back to "champ"), {streak}.
 * Lines are kept SHORT — the widget gives them two lines at 13sp.
 */
const BUCKETS = [
  {
    id: "done_today",
    expression: "after_workout",
    lines: [
      "Done and dusted, {name} 🥵",
      "Logged it, {name}. Rest easy 💪",
      "That's today handled 🔥",
    ],
  },
  {
    id: "streak_danger",
    expression: "late",
    lines: [
      "{streak} days on the line, {name} ⏰",
      "Don't break it now, {name} 🔥",
      "Still time, {name}. Just 10 min ⏳",
    ],
  },
  {
    id: "comeback",
    expression: "missed",
    lines: [
      "We missed a day, {name}. Bounce back 💪",
      "Fresh start today, {name} 🤝",
      "One session and we're rolling again",
    ],
  },
  {
    id: "morning",
    expression: "coffee",
    lines: [
      "Good morning, {name} ☕",
      "Coffee first. Then push-ups ☕",
      "Morning, {name}. Body's ready ⚡",
    ],
  },
  {
    id: "midmorning",
    expression: "morning",
    lines: [
      "You're warm now, {name}. Let's move 💪",
      "Perfect time, {name}. 10 minutes ⏱️",
      "Your body is ready. Are you? 💪",
    ],
  },
  {
    id: "streak_proud",
    expression: "challenge",
    lines: [
      "🔥 {streak} days, {name}. Keep rolling",
      "{streak} days strong. Unstoppable 🔥",
      "Beat yesterday, {name}? 😈",
    ],
  },
  {
    id: "afternoon",
    expression: "teasing",
    lines: [
      "Still scrolling, {name}? I noticed 👀",
      "The sofa will still be here after 🛋️",
      "Excuses burn zero calories 😏",
    ],
  },
  {
    id: "late_afternoon",
    expression: "waiting",
    lines: [
      "I'm waiting, {name}. Your workout isn't 😏",
      "Think you can beat yesterday? 😈",
      "One set beats zero. Every time.",
    ],
  },
  {
    id: "prime_time",
    expression: "ready",
    lines: [
      "Prime time, {name}. Let's crush it 🔥",
      "Best hour of the day. Go 💪",
      "No excuses, {name}. 10 minutes.",
    ],
  },
  {
    id: "evening",
    expression: "confident",
    lines: [
      "You know what time it is, {name} 😎",
      "Let's finish the day strong 🔥",
      "10 minutes before dinner? 💪",
    ],
  },
  {
    id: "night",
    expression: "gentle",
    lines: [
      "Just 5 minutes today, {name}? 🥹",
      "Before bed, {name}. 10 minutes 🌙",
      "Late, but not too late ⏰",
    ],
  },
  {
    id: "welcome",
    expression: "encouraging",
    lines: [
      "Let's start today, {name} 💪",
      "First session is the hardest. Go 🚀",
      "Tap me. Let's build something 💪",
    ],
  },
];

/**
 * Chooses the bucket for the given state. Mirrored exactly in Kotlin.
 *
 * @param {object}  s
 * @param {number}  s.hour           0-23, local
 * @param {number}  s.streak         current streak in days
 * @param {boolean} s.trainedToday
 * @param {boolean} s.everTrained
 * @param {number}  s.daysSinceLast  whole days since the last session, -1 if never
 */
function pickBucket({
  hour,
  streak = 0,
  trainedToday = false,
  everTrained = false,
  daysSinceLast = -1,
}) {
  if (trainedToday) return byId("done_today");

  if (!everTrained) return byId("welcome");

  // Genuinely lapsed — offer a hand, don't scold. Deliberately NOT keyed on
  // "streak === 0": that is also true on a planned rest day, and greeting
  // someone with "we missed a day" for resting is the nagging we're avoiding.
  if (daysSinceLast >= 3) return byId("comeback");

  // A live streak with the day running out is the one moment worth a nudge.
  if (streak > 0 && hour >= 19) return byId("streak_danger");

  // Someone mid-streak gets celebrated, not needled — the teasing buckets are
  // for people who have nothing on the line today.
  if (streak >= 3 && hour >= 12 && hour < 19) return byId("streak_proud");

  if (hour < 10) return byId("morning");
  if (hour < 12) return byId("midmorning");
  if (hour < 15) return byId("afternoon");
  if (hour < 17) return byId("late_afternoon");
  if (hour < 19) return byId("prime_time");
  if (hour < 22) return byId("evening");
  return byId("night");
}

function byId(id) {
  return BUCKETS.find((b) => b.id === id);
}

/** Fills {name} / {streak} and keeps the line short enough for two lines. */
function format(line, { name, streak = 0 }) {
  const who = (name || "").trim().split(/\s+/)[0] || "champ";
  return line.replace(/\{name\}/g, who).replace(/\{streak\}/g, String(streak));
}

/**
 * Full resolve: state in, {expression, drawable, text} out.
 * `rotation` picks which line of the bucket to use — the widget passes
 * day-of-year so the line changes daily rather than flickering each refresh.
 */
function resolveWidget(state = {}) {
  const bucket = pickBucket(state);
  const rotation = state.rotation ?? 0;
  const line = bucket.lines[Math.abs(rotation) % bucket.lines.length];
  return {
    bucket: bucket.id,
    expression: bucket.expression,
    drawable: EXPRESSIONS[bucket.expression],
    text: format(line, state),
  };
}

module.exports = { EXPRESSIONS, BUCKETS, pickBucket, resolveWidget, format };
