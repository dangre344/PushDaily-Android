// App entry. Notifee needs its background handler registered before anything
// else: tapping a Jack notification while the app is closed starts the JS in
// the background first, and with no handler registered that start-up collided
// with the app screen opening (the app closed shortly after the tap).
import notifee, { EventType } from "@notifee/react-native";
import "expo-router/entry";

try {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    // Remember the tap; constants/jackNotifications.js routes it once the
    // app is on screen.
    if (type !== EventType.PRESS) return;
    const data = detail?.notification?.data || null;
    // App already running (e.g. tapped from the shade while open): route now.
    // Otherwise keep it until the app is on screen.
    if (data && typeof globalThis.__onJackOpen === "function") globalThis.__onJackOpen(data);
    else globalThis.__pendingJackOpen = data;
  });
} catch {}
