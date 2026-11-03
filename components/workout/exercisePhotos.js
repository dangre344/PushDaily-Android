import { Image } from "expo-image";

// ─── Exercise photos, decoded ahead of time ─────────────────────────────────
// The rest screen shows the next exercise's photo. Decoding it only when that
// screen mounts made it pop in late, so the workout screen decodes it while
// the user is still exercising and the rest screen draws it straight away.

const MAX_KEPT = 3; // up next + a couple for "Previous"
const decoded = new Map(); // photo source → ImageRef
const loading = new Set();

/** Starts decoding a photo (a `require(...)` source). Safe to call repeatedly. */
export function preloadExercisePhoto(source) {
  if (!source || decoded.has(source) || loading.has(source)) return;
  loading.add(source);
  Image.loadAsync(source, { maxWidth: 1024, maxHeight: 1024 })
    .then((ref) => {
      decoded.set(source, ref);
      // Oldest out first; a dropped ref is freed once nothing shows it.
      while (decoded.size > MAX_KEPT) {
        decoded.delete(decoded.keys().next().value);
      }
    })
    .catch(() => {}) // falls back to loading the source itself
    .finally(() => loading.delete(source));
}

/** The decoded image when it's ready, otherwise the plain source. */
export const exercisePhoto = (source) => decoded.get(source) ?? source;
