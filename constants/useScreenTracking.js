import { usePathname } from "expo-router";
import { useEffect } from "react";
import { setCurrentScreen } from "./appLifecycle";
import { trackScreen } from "./mixpanel";

/**
 * Auto-tracks file-route screen changes (index, signup, home, workoutlisting,
 * workoutdetail, stats, modal, …). Each navigation fires trackScreen(), which
 * only sends to Mixpanel when the Remote Config flag is on.
 *
 * Drop this once in the root layout. Bottom-tab switches inside /home keep the
 * same pathname, so those are tracked separately via the Tab.Navigator's
 * screenListeners in app/home/_layout.js.
 */
export const useRouteTracking = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      // Always remembered, even when the Remote Config flag is off — the
      // "App Killed" report needs it and it costs one AsyncStorage write.
      setCurrentScreen(pathname);
      // Normalize "/home" → "Home", "/workouts/workoutlisting" → readable name
      trackScreen(pathname);
    }
  }, [pathname]);
};
