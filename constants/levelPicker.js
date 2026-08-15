// Lets a screen that is about to unmount (e.g. the Stats modal) hand a body
// part to the Workouts tab, so the level picker opens there instead of the
// user being dropped on the tab with their choice lost.
// Module-level, same pattern as constants/tabNavigation.js.

let handler = null;

/** WorkoutScreen registers its level-modal opener here while mounted. */
export const registerLevelPicker = (fn) => {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
};

/** No-ops if the Workouts tab isn't mounted yet — the caller can retry. */
export const openLevelPicker = (bodyPart) => {
  if (!bodyPart || !handler) return false;
  handler(bodyPart);
  return true;
};
