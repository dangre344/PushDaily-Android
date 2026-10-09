// Short labels for body parts, for places with room for only a few letters
// (the week strip on Workouts, the Attendance calendar).

const CODES = {
  Chest: "C",
  Back: "B",
  Legs: "L",
  Arms: "A",
  Abs: "Ab",
  Shoulder: "S",
  HIIT: "H",
  "Full Body": "FB",
  "Upper Body": "UB",
  Glutes: "G",
  "Posture Correction": "P",
};

const NAMES = {
  "Full Body": "Full body",
  "Upper Body": "Upper",
  "Posture Correction": "Posture",
};

/** "Chest" → "C", unknown → first two letters. */
export const partCode = (part) => CODES[part] || String(part || "?").slice(0, 2);

/** Readable short name: "Posture Correction" → "Posture". */
export const shortPartName = (part) => NAMES[part] || part;

/**
 * One label for a day's body parts:
 *   ["Chest"]                  → "Chest"
 *   ["Chest", "Back"]          → "C+B"
 *   ["Chest", "Back", "Legs"]  → "C+B+1"
 */
export const dayPartsLabel = (parts = []) => {
  if (parts.length === 0) return "";
  if (parts.length === 1) return shortPartName(parts[0]);
  const shown = parts.slice(0, 2).map(partCode).join("+");
  return parts.length > 2 ? `${shown}+${parts.length - 2}` : shown;
};

/** Local calendar day "YYYY-MM-DD" (not UTC — a 2am workout is that day). */
export const localDayKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
