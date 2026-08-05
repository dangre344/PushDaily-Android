// Lets code outside the bottom-tab navigator (e.g. the notification handler in
// app/_layout.tsx) switch tabs. The custom tab bar registers its navigation
// object here on render — kept in its own module to avoid import cycles.
let tabNav = null;

export const registerTabNavigation = (nav) => {
  tabNav = nav;
};

export const switchToTab = (name) => {
  try {
    tabNav?.navigate(name);
    return true;
  } catch {
    return false;
  }
};
