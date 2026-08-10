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
  "Full Body": 9,
};

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
 * @return { bodyPart, id, group, why[], weekSummary, restAdvised }
 */
export const recommendToday = (history = []) => {
  const week = history.filter((w) => w?.dateTime && daysAgo(w.dateTime) <= 7);
  const sorted = [...week].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime),
  );

  // Trained days this week (distinct calendar days, not sessions).
  const trainedDays = new Set(
    week.map((w) => new Date(w.dateTime).toDateString()),
  ).size;

  // ── Nobody has trained yet: start with Push, the most familiar entry point.
  if (week.length === 0) {
    return {
      bodyPart: "Chest",
      id: BODY_PART_IDS.Chest,
      group: "Push",
      restAdvised: false,
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

  return {
    bodyPart,
    id: BODY_PART_IDS[bodyPart],
    group: nextGroup,
    restAdvised: false,
    weekSummary: `${trainedDays} training day${trainedDays === 1 ? "" : "s"} this week · ${trainedParts.join(", ")}`,
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
