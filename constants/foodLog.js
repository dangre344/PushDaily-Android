import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logger } from "./Logger";
import { VERDICT } from "./foodScan";

// ─── Local scan / eaten history ──────────────────────────────────────────────
// Everything stays on the device — food intake is personal and there is no
// reason for it to leave the phone. Newest first, capped so the store can't
// grow without bound.

const K_LOG = "food_scan_log";
const MAX_ENTRIES = 300;

export const dayKeyOf = (ts = Date.now()) =>
  new Date(ts).toISOString().slice(0, 10);

/** Full history, newest first. */
export const getFoodLog = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_LOG);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    Logger.log("[FoodLog] read failed:", String(e));
    return [];
  }
};

/**
 * Records a scan. `ate` marks it as actually eaten — scanning alone is just
 * curiosity, so only eaten items count toward the daily warning.
 */
export const addFoodEntry = async (result, ate = false) => {
  if (!result) return null;
  const entry = {
    id: `${Date.now()}`,
    at: Date.now(),
    day: dayKeyOf(),
    name: result.name || "Unknown product",
    verdict: result.verdict,
    ate,
    per100g: {
      sugars_g: result.per100g?.sugars_g ?? null,
      fat_g: result.per100g?.fat_g ?? null,
      saturates_g: result.per100g?.saturates_g ?? null,
      salt_g: result.per100g?.salt_g ?? null,
    },
    allergens: result.allergens || [],
    image: result.image || null,
  };

  try {
    const list = await getFoodLog();
    const next = [entry, ...list].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(K_LOG, JSON.stringify(next));
  } catch (e) {
    Logger.log("[FoodLog] write failed:", String(e));
  }
  return entry;
};

/** Flips an existing entry to "eaten" (used by the I'm eating this button). */
export const markEaten = async (id) => {
  try {
    const list = await getFoodLog();
    const next = list.map((e) => (e.id === id ? { ...e, ate: true } : e));
    await AsyncStorage.setItem(K_LOG, JSON.stringify(next));
  } catch (e) {
    Logger.log("[FoodLog] markEaten failed:", String(e));
  }
};

/** Unhealthy items ALREADY EATEN today — scans alone don't count. */
export const unhealthyEatenToday = async () => {
  const list = await getFoodLog();
  const today = dayKeyOf();
  return list.filter(
    (e) => e.day === today && e.ate && e.verdict === VERDICT.AVOID,
  );
};

/** Groups the log into SectionList sections, newest day first. */
export const toSections = (list = []) => {
  const byDay = new Map();
  for (const e of list) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const today = dayKeyOf();
  const yesterday = dayKeyOf(Date.now() - 86_400_000);

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, data]) => ({
      day,
      title:
        day === today
          ? "Today"
          : day === yesterday
            ? "Yesterday"
            : new Date(day).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
      data,
    }));
};
