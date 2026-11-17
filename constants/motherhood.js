import AsyncStorage from "@react-native-async-storage/async-storage";

// Remembers (on the device only) that a woman has done the Pregnancy or Post
// Pregnancy plan, so Jack's chat can tailor diet and workout advice to it.
// Nothing here leaves the phone except the small flag sent with a chat request.

const KEY = "motherhoodStage_v1";
const STAGES = { Pregnancy: "pregnancy", "Post Pregnancy": "postpartum" };

/** Call when a workout is completed. No-op unless a woman finished one of the two plans. */
export async function markMotherhoodWorkout(bodyPart, gender) {
  const stage = STAGES[bodyPart];
  if (!stage || gender !== "Female") return;
  try {
    let saved = {};
    try {
      const parsed = JSON.parse((await AsyncStorage.getItem(KEY)) || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
    } catch {} // corrupt value: start fresh rather than never saving again
    saved[stage] = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
}

/**
 * The flag for a chat request: `{ stage, lastDone }` for the most recently
 * done plan, or null. Never throws.
 */
export async function getMotherhoodFlag(gender) {
  if (gender !== "Female") return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved) return null;
    const stage = Object.keys(saved)
      .filter((s) => s === "pregnancy" || s === "postpartum")
      .sort((a, b) => String(saved[b]).localeCompare(String(saved[a])))[0];
    return stage ? { stage, lastDone: String(saved[stage]).slice(0, 10) } : null;
  } catch {
    return null;
  }
}
