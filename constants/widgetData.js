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
  hi: "mascot_hi", // waving hello
  water: "mascot_water", // holding a water bottle
  think: "mascot_think", // hand on chin, "?" overhead
  phone: "mascot_phone", // staring at a phone
  wink: "mascot_wink", // cheeky one-eyed wink
  dumbbell: "mascot_dumbbell", // mid curl
  flex: "mascot_flex", // both arms flexed, sweat drop
  proud: "mascot_proud", // double flex with sparkles
  cheer: "mascot_cheer", // arms overhead, celebrating
  wow: "mascot_wow", // eyes wide, shocked
  sad: "mascot_sad", // frowning, arms down
  sleepy: "mascot_sleepy", // eyes shut, Zzz
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
    expression: "cheer",
    lines: [
      "Done and dusted, {name} 🎉",
      "Logged it, {name}. Rest easy 💪",
      "That's today handled 🔥",
    ],
  },
  {
    id: "streak_danger",
    expression: "wow",
    lines: [
      "{days} on the line, {name} ⏰",
      "Don't break it now, {name} 🔥",
      "Still time, {name}. Just 10 min ⏳",
    ],
  },
  {
    id: "comeback",
    expression: "sad",
    lines: [
      "Been a few days, {name}. Bounce back 💪",
      "Fresh start today, {name} 🤝",
      "One session and we're rolling again",
    ],
  },
  {
    id: "morning",
    expression: "water",
    lines: [
      "Good morning, {name} 💧",
      "Water first. Then push-ups 💧",
      "Morning, {name}. Body's ready ⚡",
    ],
  },
  {
    id: "midmorning",
    expression: "think",
    lines: [
      "You're warm now, {name}. Let's move 💪",
      "Perfect time, {name}. 10 minutes ⏱️",
      "Your body is ready. Are you? 💪",
    ],
  },
  {
    id: "streak_proud",
    expression: "proud",
    lines: [
      "Day {next} starts now, {name} 💪",
      "🔥 {days} in. Don't stop, {name}",
      "Beat yesterday, {name}? 😈",
    ],
  },
  {
    id: "afternoon",
    expression: "phone",
    lines: [
      "Still scrolling, {name}? I noticed 👀",
      "The sofa will still be here after 🛋️",
      "Excuses burn zero calories 😏",
    ],
  },
  {
    id: "late_afternoon",
    expression: "wink",
    lines: [
      "I'm waiting, {name}. Your workout isn't 😏",
      "Think you can beat yesterday? 😈",
      "One set beats zero. Every time.",
    ],
  },
  {
    id: "prime_time",
    expression: "dumbbell",
    lines: [
      "Prime time, {name}. Let's crush it 🔥",
      "Best hour of the day. Go 💪",
      "No excuses, {name}. 10 minutes.",
    ],
  },
  {
    id: "evening",
    expression: "flex",
    lines: [
      "You know what time it is, {name} 😎",
      "Let's finish the day strong 🔥",
      "10 minutes before dinner? 💪",
    ],
  },
  {
    id: "night",
    expression: "sleepy",
    lines: [
      "Just 5 minutes today, {name}? 🥹",
      "Before bed, {name}. 10 minutes 🌙",
      "Late, but not too late ⏰",
    ],
  },
  {
    id: "welcome",
    expression: "hi",
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
  return tightenEmoji(
    line
      .replace(/\{name\}/g, who)
      .replace(/\{streak\}/g, String(streak))
      .replace(/\{days\}/g, streak === 1 ? "1 day" : `${streak} days`)
      .replace(/\{next\}/g, String(streak + 1)),
  );
}

/**
 * Glues a trailing emoji to the word before it with a non-breaking space.
 *
 * The widget is a 2x2 square with maxLines=2, so nearly every line wraps. A
 * trailing emoji is its own word to the line breaker, and it was landing alone
 * on the second row — "Let's start today, Gagan" / "💪" — on 8 of 36 lines.
 *
 * Applied here for the in-app card, and again by plugins/withWidget.js when it
 * bakes these strings into Kotlin, so the widget gets it without needing any
 * emoji detection of its own. Idempotent: it only ever matches a plain space.
 */
function tightenEmoji(line) {
  return line.replace(/ (\S+)$/u, (m, last) =>
    /\p{Extended_Pictographic}/u.test(last) ? ` ${last}` : m,
  );
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

module.exports = {
  EXPRESSIONS,
  BUCKETS,
  pickBucket,
  resolveWidget,
  format,
  tightenEmoji,
};
