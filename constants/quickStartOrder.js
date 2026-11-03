import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Quick starts order ─────────────────────────────────────────────────────
// The Quick starts row on the Workouts screen is ordered for the person:
//   • women see Glutes first
//   • anyone over 25 sees Posture Correction next
//   • then HIIT, Full Body, Upper Body
//   • anything not placed yet goes last
// It's worked out once, when the profile is submitted (sign-up or Edit
// Profile), and stored; the Workouts screen only reads the stored order.

const STORAGE_KEY = "quickStartOrder";
const BASE_ORDER = ["HIIT", "Full Body", "Upper Body"];
const ALL = ["Glutes", "Posture Correction", ...BASE_ORDER];

let cached = null;

/** The order for a profile (`gender`, `age` as saved by sign-up). */
export function quickStartOrderFor(profile) {
  const order = [];
  if (profile?.gender === "Female") order.push("Glutes");
  if (Number(profile?.age) > 25) order.push("Posture Correction");
  order.push(...BASE_ORDER);
  for (const category of ALL) {
    if (!order.includes(category)) order.push(category);
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

/** Sorts quick-start plans (by `bodyPart`) into the given order. */
export function sortByQuickStartOrder(items, order) {
  if (!order?.length) return items;
  const rank = (item) => {
    const i = order.indexOf(item.bodyPart);
    return i === -1 ? order.length : i;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}
