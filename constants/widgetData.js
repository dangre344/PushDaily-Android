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
      "{days} on the line, {name} ⏰",
      "Don't break it now, {name} 🔥",
      "Still time, {name}. Just 10 min ⏳",
    ],
  },
  {
    id: "comeback",
    expression: "missed",
    lines: [
      "Been a few days, {name}. Bounce back 💪",
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
      "Day {next} starts now, {name} 💪",
      "🔥 {days} in. Don't stop, {name}",
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
 * @param {number} s.hour           0-23, local
 * @param {number} s.streak         current streak in days
 * @param {number} s.daysSinceLast  whole days since the last session; 0 means
 *                                  today, -1 means they have never trained.
 *                                  "trained today" and "ever trained" are
 *                                  derived from this, not passed separately.
 */
function pickBucket({ hour, streak = 0, daysSinceLast = -1 }) {
  // Derived, never passed in. These used to be separate arguments and it was a
  // bug factory: a caller could say daysSinceLast:0 yet trainedToday:false and
  // get nonsense. One input, one meaning.
  const everTrained = daysSinceLast >= 0;
  const trainedToday = daysSinceLast === 0;

  if (trainedToday) return byId("done_today");

  if (!everTrained) return byId("welcome");

  // Genuinely lapsed — offer a hand, don't scold. Deliberately NOT keyed on
  // "streak === 0": that is also true on a planned rest day, and greeting
  // someone with "we missed a day" for resting is the nagging we're avoiding.
  if (daysSinceLast >= 3) return byId("comeback");

  // The morning greeting outranks the streak copy: someone who trained
  // yesterday should be greeted and pointed at TODAY, not congratulated for
  // what they already did.
  if (hour < 10) return byId("morning");

  // A live streak with the day running out is the one moment worth a nudge.
  if (streak > 0 && hour >= 19) return byId("streak_danger");

  // Any live streak carries through the day. Covers streak 1 (trained
  // yesterday) as much as streak 20 — in both cases the job is to motivate
  // today's session, not to needle.
  if (streak > 0) return byId("streak_proud");

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

/**
 * Fills the placeholders. Mirrored in Kotlin.
 *   {name}   first name, or "champ"
 *   {streak} the raw number
 *   {days}   pluralised — "1 day" / "7 days", so no line reads "1 days"
 *   {next}   streak + 1, for "Day 2 starts now"
 */
function format(line, { name, streak = 0 }) {
  const who = (name || "").trim().split(/\s+/)[0] || "champ";
  return line
    .replace(/\{name\}/g, who)
    .replace(/\{streak\}/g, String(streak))
    .replace(/\{days\}/g, streak === 1 ? "1 day" : `${streak} days`)
    .replace(/\{next\}/g, String(streak + 1));
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
