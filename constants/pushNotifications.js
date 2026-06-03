import { getMessaging } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Logger } from "./Logger";

// Topic the backend broadcasts to (admin.messaging().send({ topic: ... })).
export const BROADCAST_TOPIC = "daily_updates";

// ─── Firebase messaging accessor ─────────────────────────────────────────────
// @react-native-firebase auto-initializes the [DEFAULT] app natively from
// google-services.json via the Google Services Gradle plugin.
// getMessaging() simply retrieves that already-initialized instance.
// If the native modules are not autolinked (i.e. expo prebuild --clean was not
// run after adding Firebase packages), this will throw and return null.
let _messagingInstance = null;

const getFirebaseMessaging = () => {
  if (_messagingInstance) return _messagingInstance;
  try {
    _messagingInstance = getMessaging();
    Logger.log("[Push] Firebase messaging ready ✅");
    return _messagingInstance;
  } catch (e) {
    Logger.log("[Push] Firebase not ready — run expo prebuild --clean:", String(e));
    return null;
  }
};

// ─── Notification handler (foreground banners) ────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Android notification channel ────────────────────────────────────────────
export async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/**
 * Requests notification permission, ensures the Android channel, and logs
 * the FCM device token. Called from the signup flow last step only.
 */
export async function registerForPushNotificationsAsync() {
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Logger.log("[Push] Permission not granted — cannot obtain FCM token");
    return null;
  }

  try {
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    Logger.log("[Push] FCM device token:", tokenResponse?.data);
    return tokenResponse?.data ?? null;
  } catch (e) {
    Logger.log("[Push] Failed to get device push token:", String(e));
    return null;
  }
}

/**
 * Subscribes this device to the broadcast topic so it receives the server's
 * general notifications. Idempotent — safe to call on every launch.
 */
// Returns "subscribed" | "skipped" | "failed" so callers can surface the status.
export async function subscribeToBroadcastTopic() {
  const fb = getFirebaseMessaging();
  if (!fb) {
    Logger.log("[Push] ⚠️ Topic subscription skipped — Firebase unavailable.");
    return "skipped";
  }
  try {
    await fb.subscribeToTopic(BROADCAST_TOPIC);
    Logger.log(
      `[Push] ✅ Subscribed to topic "${BROADCAST_TOPIC}" — broadcasts enabled.`,
    );
    return "subscribed";
  } catch (e) {
    Logger.log(
      `[Push] ❌ subscribeToTopic("${BROADCAST_TOPIC}") failed:`,
      String(e),
    );
    return "failed";
  }
}

/**
 * Shows FCM messages as banners while the app is in the foreground.
 * Background / killed delivery is handled by the OS automatically.
 * Returns an unsubscribe function.
 */
export function setupForegroundMessageHandler() {
  const fb = getFirebaseMessaging();
  if (!fb) {
    Logger.log("[Push] ⚠️ Foreground handler skipped — Firebase unavailable.");
    return () => {};
  }
  return fb.onMessage(async (remoteMessage) => {
    const { title, body } = remoteMessage?.notification ?? {};
    Logger.log("[Push] foreground message:", title, body);
    if (!title && !body) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title ?? "",
        body: body ?? "",
        sound: "default",
        data: remoteMessage?.data ?? {},
      },
      trigger: null,
    });
  });
}
