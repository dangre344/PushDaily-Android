// ─── Header subtitle quotes ──────────────────────────────────────────────────
// One quote is chosen when the JS bundle first evaluates and stays fixed for
// the whole app session — it changes on the next cold start, not on every
// re-render, so the header never flickers mid-use.

export const MOTIVATION_QUOTES = [
  "Sore today, strong tomorrow.",
  "Small reps, big changes.",
  "The only bad workout is the one you skipped.",
  "Discipline beats motivation every time.",
  "You don't have to be extreme, just consistent.",
  "Your body can do it. Convince your mind.",
  "Start where you are. Use what you have.",
  "One more rep than yesterday.",
  "Sweat now, shine later.",
  "Progress, not perfection.",
  "Show up, even on the slow days.",
  "Strength grows in the moments you push through.",
  "Nobody regrets the workout they finished.",
  "Train like you mean it, rest like you earned it.",
  "Habits build bodies. Not motivation.",
  "The hardest lift is getting off the couch.",
  "Be stronger than your excuses.",
  "Every session counts, even the short ones.",
  "You're one workout away from a better mood.",
  "Fall in love with the process.",
  "Slow progress is still progress.",
  "Your future self is watching. Make them proud.",
  "Consistency turns effort into results.",
  "Comfort zones make poor gyms.",
  "It never gets easier — you get stronger.",
  "Do it tired. Do it anyway.",
  "A little every day beats a lot never.",
  "Rest is part of the plan, not a break from it.",
  "Champions are built on ordinary days.",
  "Move today so tomorrow feels lighter.",
];

// Picked once at module load — i.e. once per app launch — then frozen for the
// session. Requiring this module anywhere returns the same line.
export const SESSION_QUOTE =
  MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];
