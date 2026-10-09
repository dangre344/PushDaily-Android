import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── "What to train today" ───────────────────────────────────────────────────
// Reads the last 7 days of completed workouts and picks the body part that has
// recovered longest, following a push / pull / legs rotation. Runs entirely on
// device — no network, no AI cost — so the free daily use costs us nothing.

// Body part → the id used by the existing level → workoutlisting flow.
export const BODY_PART_IDS = {
  Shoulder: 1,
  Back: 2,
  Arms: 3,
  Chest: 4,
  Abs: 5,
  Legs: 6,
  HIIT: 7,
  "Upper Body": 8,
  "Full Body": 9,
  Glutes: 10,
  "Posture Correction": 11,
};

// The quick-start programs (the banner row), as opposed to body-part splits.
export const QUICK_WORKOUTS = ["Full Body", "HIIT", "Upper Body", "Glutes", "Posture Correction"];

// "Plan again" swaps to a sibling that trains similar muscles, so the second
// suggestion is still sensible for the day — Chest → Shoulder (both push),
// Back → Arms (both pull), and so on. First entry is the closest match.
const ALTERNATIVES = {
  Chest: ["Shoulder", "Upper Body", "Arms"],
  Shoulder: ["Chest", "Upper Body", "Arms"],
  Back: ["Arms", "Upper Body", "Posture Correction"],
  Arms: ["Back", "Upper Body", "Shoulder"],
  Legs: ["Glutes", "Full Body", "HIIT"],
  Glutes: ["Legs", "Full Body", "Abs"],
  Abs: ["Posture Correction", "HIIT", "Full Body"],
  HIIT: ["Full Body", "Abs", "Legs"],
  "Full Body": ["HIIT", "Upper Body", "Legs"],
  "Upper Body": ["Chest", "Back", "Shoulder"],
  "Posture Correction": ["Back", "Abs", "Full Body"],
};

const SIBLING_REASON = {
  Push: "works the same pushing muscles from a different angle",
  Pull: "hits the same pulling chain without repeating the exact moves",
  Legs: "keeps the focus on your lower body",
};

const isBeginner = (experience) =>
  String(experience || "").toLowerCase().includes("beginner");

const PPL_GROUPS = {
  Push: ["Chest", "Shoulder"],
  Pull: ["Back", "Arms"],
  Legs: ["Legs"],
};

const GROUP_ORDER = ["Push", "Pull", "Legs"];

const groupOf = (bodyPart) => {
  for (const [g, parts] of Object.entries(PPL_GROUPS)) {
    if (parts.includes(bodyPart)) return g;
  }
  return null; // Abs / HIIT / Full Body sit outside the rotation
};

const daysAgo = (dateTime) =>
  Math.floor((Date.now() - new Date(dateTime).getTime()) / 86_400_000);

/**
 * @param  history  all completed workouts: [{ bodyPart, dateTime }]
 * @return { bodyPart, id, group, why[], weekSummary, restAdvised, forTomorrow }
 */
export const recommendToday = (history = [], { experience } = {}) => {
  const week = history.filter((w) => w?.dateTime && daysAgo(w.dateTime) <= 7);

  // ── Brand-new beginner with no log at all: a split day is a big ask. A short
  // quick-start program is the friendliest first session.
  if (history.length === 0 && isBeginner(experience)) {
    return {
      bodyPart: "Full Body",
      id: BODY_PART_IDS["Full Body"],
      group: null,
      isQuick: true,
      restAdvised: false,
      forTomorrow: false,
      trainedToday: [],
      weekSummary: "First session · Beginner",
      why: [
        "You're just starting — a short full-body session is the easiest way in.",
        "It touches every major muscle once, so nothing gets overloaded.",
        "Finish this and you'll know exactly what to train next.",
      ],
    };
  }
  const sorted = [...week].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime),
  );

  // Trained days this week (distinct calendar days, not sessions).
  const trainedDays = new Set(
    week.map((w) => new Date(w.dateTime).toDateString()),
  ).size;

  // What was already done TODAY — if anything, the plan is for tomorrow.
  const todayStr = new Date().toDateString();
  const trainedToday = [
    ...new Set(
      week
        .filter((w) => new Date(w.dateTime).toDateString() === todayStr)
        .map((w) => w.bodyPart)
        .filter(Boolean),
    ),
  ];
  const doneToday = trainedToday.length > 0;

  // ── Nobody has trained yet: start with Push, the most familiar entry point.
  if (week.length === 0) {
    return {
      bodyPart: "Chest",
      id: BODY_PART_IDS.Chest,
      group: "Push",
      restAdvised: false,
      forTomorrow: false,
      trainedToday: [],
      weekSummary: "No sessions logged in the last 7 days.",
      why: [
        "You have a clean slate — every muscle is fully recovered.",
        "Chest is the easiest place to build momentum at home.",
        "Starting with a push day sets up a simple weekly rotation.",
      ],
    };
  }

  // ── Trained 6+ distinct days: recovery matters more than another session.
  if (trainedDays >= 6) {
    return {
      bodyPart: "Abs",
      id: BODY_PART_IDS.Abs,
      group: null,
      restAdvised: true,
      forTomorrow: doneToday,
      trainedToday,
      weekSummary: `${trainedDays} training days in the last week — that's a lot.`,
      why: [
        "Muscle is built while you recover, not while you train.",
        "A light core session keeps the habit without adding fatigue.",
        "Consider a full rest day if anything still feels sore.",
      ],
    };
  }

  // ── Normal case: rotate to whichever group was trained least recently.
  let lastGroup = null;
  let lastGroupDays = null;
  for (const w of sorted) {
    const g = groupOf(w.bodyPart);
    if (g) {
      lastGroup = g;
      lastGroupDays = daysAgo(w.dateTime);
      break;
    }
  }

  const nextGroup = lastGroup
    ? GROUP_ORDER[(GROUP_ORDER.indexOf(lastGroup) + 1) % GROUP_ORDER.length]
    : "Push";

  // Within the group, pick the part trained longest ago (or never).
  const candidates = PPL_GROUPS[nextGroup];
  const lastSeen = {};
  for (const p of candidates) lastSeen[p] = Infinity;
  for (const w of sorted) {
    if (candidates.includes(w.bodyPart) && lastSeen[w.bodyPart] === Infinity) {
      lastSeen[w.bodyPart] = daysAgo(w.dateTime);
    }
  }
  const bodyPart = candidates.reduce((best, p) =>
    lastSeen[p] > lastSeen[best] ? p : best,
  );

  const trainedParts = [...new Set(week.map((w) => w.bodyPart).filter(Boolean))];
  const restedFor = lastSeen[bodyPart];

  const why = [];

  if (doneToday) {
    // Already trained today — the honest coaching answer is "rest, here's
    // tomorrow", not "here's a second session".
    why.push(
      `You already trained ${trainedToday.join(" & ")} today — nice work.`,
    );
    why.push(
      "Training the same day again adds fatigue, not muscle. Recovery is when you actually grow.",
    );
    why.push(
      `Tomorrow, ${bodyPart} will be your freshest muscle — a ${nextGroup.toLowerCase()} day keeps the rotation balanced.`,
    );
  } else {
    if (lastGroup) {
      why.push(
        lastGroupDays === 0
          ? `You trained ${lastGroup.toLowerCase()} muscles today, so they need recovery.`
          : `Your last ${lastGroup.toLowerCase()} session was ${lastGroupDays} day${lastGroupDays === 1 ? "" : "s"} ago.`,
      );
    }
    why.push(
      restedFor === Infinity
        ? `${bodyPart} hasn't been trained at all this week — it's the freshest.`
        : `${bodyPart} last trained ${restedFor} day${restedFor === 1 ? "" : "s"} ago, so it's recovered.`,
    );
    why.push(
      `A ${nextGroup.toLowerCase()} day keeps your rotation balanced and avoids overworking one area.`,
    );
  }

  return {
    bodyPart,
    id: BODY_PART_IDS[bodyPart],
    group: nextGroup,
    restAdvised: false,
    forTomorrow: doneToday,
    trainedToday,
    weekSummary: doneToday
      ? `Done today: ${trainedToday.join(", ")} · ${trainedDays} training day${trainedDays === 1 ? "" : "s"} this week`
      : `${trainedDays} training day${trainedDays === 1 ? "" : "s"} this week · ${trainedParts.join(", ")}`,
    why,
  };
};

/**
 * "Plan again": a different body part from the same family as `previous`.
 *
 * Keeps the day's verdict (rest advised / plan for tomorrow) from the
 * original analysis — only the focus changes. Among the siblings not yet
 * suggested (`exclude`), prefers the one trained longest ago. When every
 * sibling has been shown, it starts over from the original suggestion's list.
 */
export const recommendAlternative = (
  previous,
  history = [],
  { experience, exclude = [], anchor } = {},
) => {
  const base = recommendToday(history, { experience });
  const current = previous?.bodyPart || base.bodyPart;
  // Siblings are always taken from the FIRST suggestion of the round, so
  // repeated taps stay in one family (Chest → Shoulder → Upper Body → Arms →
  // Chest…) instead of drifting from push to pull.
  const from = anchor || current;
  const siblings = ALTERNATIVES[from] || ALTERNATIVES[base.bodyPart] || ["Full Body"];

  let pool = siblings.filter((p) => !exclude.includes(p) && p !== current);
  const wrapped = pool.length === 0;
  if (wrapped) pool = [from, ...siblings].filter((p) => p !== current);

  // Longest since last trained wins; never-trained counts as "longest".
  const lastSeen = (part) => {
    const hit = history
      .filter((w) => w?.bodyPart === part && w?.dateTime)
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0];
    return hit ? daysAgo(hit.dateTime) : Infinity;
  };
  const bodyPart = pool.reduce((best, p) => (lastSeen(p) > lastSeen(best) ? p : best), pool[0]);

  const group = groupOf(bodyPart);
  const sameFamily = group && group === groupOf(current);
  const rested = lastSeen(bodyPart);

  const why = [
    sameFamily
      ? `${bodyPart} ${SIBLING_REASON[group]} as ${current}.`
      : `${bodyPart} is a solid swap for ${current} today.`,
    rested === Infinity
      ? `You haven't trained ${bodyPart} recently, so it's fully fresh.`
      : `${bodyPart} last trained ${rested} day${rested === 1 ? "" : "s"} ago — it's had time to recover.`,
  ];
  if (QUICK_WORKOUTS.includes(bodyPart)) {
    why.push("It's a quick-start program — short, simple, no planning needed.");
  } else if (base.forTomorrow) {
    why.push("Keep it for tomorrow — today's work is already done.");
  } else {
    why.push("Mixing it up keeps workouts fun and stops you plateauing.");
  }

  return {
    ...base,
    bodyPart,
    id: BODY_PART_IDS[bodyPart],
    group,
    isQuick: QUICK_WORKOUTS.includes(bodyPart),
    isAlternative: true,
    replaced: current,
    wrapped,
    why,
  };
};

// ─── Free once a day, then a rewarded ad ─────────────────────────────────────

const K_USES = "train_reco_uses"; // { date: "YYYY-MM-DD", used }

const todayKey = () => new Date().toISOString().slice(0, 10);

const read = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_USES);
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.date !== todayKey()) return { date: todayKey(), used: 0 };
    return u;
  } catch {
    return { date: todayKey(), used: 0 };
  }
};

/** True when today's free analysis is still available. */
export const isRecommendationFree = async () => (await read()).used === 0;

export const markRecommendationUsed = async () => {
  const u = await read();
  u.used += 1;
  await AsyncStorage.setItem(K_USES, JSON.stringify(u)).catch(() => {});
};
