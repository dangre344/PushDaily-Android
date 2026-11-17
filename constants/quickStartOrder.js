import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Quick starts order ─────────────────────────────────────────────────────
// The Quick starts row on the Workouts screen is ordered for the person:
//   • women see Glutes first
//   • anyone over 25 sees Posture Correction next
//   • over 35: Mobility & Flexibility next
//   • then HIIT, Full Body, Upper Body, then Mobility & Flexibility (35 and under)
//   • anything not placed yet goes last
//   • Kegel Stamina: 2nd (and "Trending") for men over 18, last for other
//     adults, and not shown under 18 or when the age is unknown
//   • Pregnancy: 2nd for women over 25, last for other adults (men see it
//     with a "for your wife, sister or a relative" tag), not shown under 18
//   • Post Pregnancy: directly after Pregnancy, same rules and the same tag
// It's worked out once, when the profile is submitted (sign-up or Edit
// Profile), and stored; the Workouts screen only reads the stored order.

// v3: Mobility & Flexibility was added — older saved orders are recomputed once.
// v4: Pregnancy was added (adult women only).
// v5: Pregnancy moved to 2nd for women over 25.
// v6: Pregnancy is shown to adult men too (last).
// v7: Post Pregnancy was added, directly after Pregnancy.
const STORAGE_KEY = "quickStartOrder_v7";
const KEGEL = "Kegel Stamina";
const MOBILITY = "Mobility & Flexibility";
const PREGNANCY = "Pregnancy";
const POST_PREGNANCY = "Post Pregnancy";
const isAdult = (p) => Number(p?.age) >= 18;
const isMaleAdult = (p) => p?.gender === "Male" && Number(p?.age) > 18;
const BASE_ORDER = ["HIIT", "Full Body", "Upper Body"];
const ALL = ["Glutes", "Posture Correction", ...BASE_ORDER, MOBILITY, KEGEL];

let cached = null;

/** The order for a profile (`gender`, `age` as saved by sign-up). */
export function quickStartOrderFor(profile) {
  const order = [];
  if (profile?.gender === "Female") order.push("Glutes");
  if (Number(profile?.age) > 25) order.push("Posture Correction");
  if (Number(profile?.age) > 35) order.push(MOBILITY);
  order.push(...BASE_ORDER);
  if (isMaleAdult(profile)) order.splice(1, 0, KEGEL);
  for (const category of ALL) {
    if (category === KEGEL && !isAdult(profile)) continue; // adults only
    if (!order.includes(category)) order.push(category);
  }
  if (isAdult(profile)) {
    if (profile?.gender === "Female" && Number(profile?.age) > 25)
      order.splice(1, 0, PREGNANCY, POST_PREGNANCY); // 2nd and 3rd posters
    else order.push(PREGNANCY, POST_PREGNANCY);
  }
  return order;
}

/** Works out and stores the order. Call when the profile is submitted. */
export async function saveQuickStartOrder(profile) {
  cached = quickStartOrderFor(profile);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {}
  return cached;
}

/**
 * The stored order. Profiles made before this existed have none yet: theirs
 * is worked out from `profile` once and stored, then never again.
 */
export async function getQuickStartOrder(profile) {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      cached = parsed;
      return cached;
    }
  } catch {}
  return profile ? saveQuickStartOrder(profile) : null;
}

/** The quick start that gets a "Trending" tag for this profile, if any. */
export const trendingQuickStart = (profile) => (isMaleAdult(profile) ? KEGEL : null);

/** A short tag shown on a quick start's poster for this profile, if any. */
export const quickStartNote = (profile, bodyPart) =>
  (bodyPart === PREGNANCY || bodyPart === POST_PREGNANCY) && profile?.gender === "Male"
    ? "For your wife, sister or a relative"
    : null;

/**
 * Sorts quick-start plans (by `bodyPart`) into the given order. Kegel Stamina
 * only shows when the order includes it (adults); before the order is known it
 * stays hidden.
 */
export function sortByQuickStartOrder(items, order) {
  // Kegel Stamina, Pregnancy and Post Pregnancy only show when the order includes them.
  const gated = (i) => [KEGEL, PREGNANCY, POST_PREGNANCY].includes(i.bodyPart);
  if (!order?.length) return items.filter((i) => !gated(i));
  items = items.filter((i) => !gated(i) || order.includes(i.bodyPart));
  const rank = (item) => {
    const i = order.indexOf(item.bodyPart);
    return i === -1 ? order.length : i;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}
