// Lets code outside the bottom-tab navigator (e.g. the notification handler in
// app/_layout.tsx) switch tabs. The custom tab bar registers its navigation
// object here on render — kept in its own module to avoid import cycles.
let tabNav = null;

export const registerTabNavigation = (nav) => {
  tabNav = nav;
};

export const switchToTab = (name, params) => {
  try {
    tabNav?.navigate(name, params);
    return true;
  } catch {
    return false;
  }
};

/**
 * Opens the Attendance tab on a given local date ("YYYY-MM-DD"). `at` makes
 * every tap a new param value, so tapping the same day twice still re-selects
 * it after the user has moved the calendar elsewhere.
 */
export const openAttendanceOn = (dateKey) =>
  switchToTab("Attendance", { date: dateKey, at: Date.now() });
