import CustomSplashScreen from "@/components/CustomSplashScreen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  OpenSans_300Light,
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/open-sans";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import "react-native-reanimated";
import ToastManager from "toastify-react-native";

import {
  AppOpenAdManager,
  InterstitialAdManager,
  RewardedAdManager,
  RewardedInterstitialAdManager,
} from "../ads/Admobmanager";
import { checkForAppUpdate } from "../constants/appUpdate";
import { initCrashlytics } from "../constants/crashlytics";
import { Logger } from "../constants/Logger";
import { initMixpanel, trackEvent } from "../constants/mixpanel";
import {
  setupForegroundMessageHandler,
  subscribeToBroadcastTopic,
} from "../constants/pushNotifications";
import { initRemoteConfig } from "../constants/remoteConfig";
import { switchToTab } from "../constants/tabNavigation";
import { useRouteTracking } from "../constants/useScreenTracking";
import {
  markBackgrounded,
  markResumed,
  reportPreviousSessionEnd,
} from "../constants/appLifecycle";
import UserProvider from "../constants/UserContext";
import {
  getGoalGlasses,
  logGlass,
  WATER_ACTION_DETAILS,
  WATER_ACTION_LOG,
} from "../constants/waterReminder";
import "../locales/i18";

// Expo Router calls preventAutoHideAsync() internally, which pins the native
// OS splash on screen until we explicitly dismiss it. Call hideAsync() at
// module level so it fires the instant the JS bundle evaluates — before any
// React render — and our CustomSplashScreen takes over with no white flash.
SplashScreen.hideAsync().catch(() => { });

export default function RootLayout() {
  const colorScheme = useColorScheme?.() || "light";
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [adsInitialized, setAdsInitialized] = useState(false);

  const [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
  });

  // Auto-track file-route screen changes (gated by the Remote Config flag).
  useRouteTracking();

  useEffect(() => {
    initMixpanel();
    // Crashlytics: enable collection + install the global JS error handler so
    // uncaught crashes are recorded and an "App Crashed" event is fired.
    initCrashlytics();
    // Fetch the screen-tracking flag from Firebase Remote Config so screen
    // events can be switched on/off remotely without an app update.
    initRemoteConfig();
    // Nudge the user to update if a higher version is live on the Play Store.
    // Non-blocking (flexible) flow; preserves all local data.
    checkForAppUpdate("flexible");

    const initializeAds = async () => {
      try {
        await mobileAds().initialize();
        Logger.log("[AdMob] SDK initialized");

        AppOpenAdManager.getInstance();
        InterstitialAdManager.getInstance();
        RewardedAdManager.getInstance();
        RewardedInterstitialAdManager.getInstance();

        setAdsInitialized(true);
      } catch (error) {
        Logger.log("[AdMob] SDK initialization failed:", String(error));
      }
    };

    initializeAds();
  }, []);

  // ─── "Where did the user quit?" ───────────────────────────────────────────
  // A kill gives us no callback, so we report the PREVIOUS session's last
  // screen on this cold start, then track foreground/background transitions
  // so the next report knows how the app went away.
  useEffect(() => {
    reportPreviousSessionEnd();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
        markBackgrounded();
      } else if (prev.match(/inactive|background/) && next === "active") {
        markResumed();
      }
    });

    return () => sub.remove();
  }, []);

  // Remote push (FCM): subscribe to the broadcast topic and listen.
  // Permission is requested only in the signup flow (last step).
  // Both functions wait internally for Firebase to initialize (New Architecture
  // timing fix) so we don't need a manual delay here.
  useEffect(() => {
    subscribeToBroadcastTopic().then((status) => {
      // ─── DEBUG TOAST — remove before release ───────────────────────────────
      // if (status === "subscribed") {
      //   Toast.success("FCM ✅ Subscribed to daily_updates", "bottom");
      // } else if (status === "skipped") {
      //   Toast.error("FCM ❌ Firebase not ready — rebuild needed", "bottom");
      // } else if (status === "failed") {
      //   Toast.error("FCM ❌ Subscription failed — check logs", "bottom");
      // }
    });

    const unsubscribeForeground = setupForegroundMessageHandler();

    // Fires when the user taps a notification (foreground, background, or after
    // the app was launched from a killed state by tapping it).
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      async (resp) => {
        const data = resp.notification.request.content.data;
        const notifId = resp.notification.request.identifier;
        Logger.log(
          "[Push] notification response:",
          resp.actionIdentifier,
          data,
        );

        // ── Track EVERY notification interaction (workouts, water, FCM…) ──
        const DEFAULT_ACTION = Notifications.DEFAULT_ACTION_IDENTIFIER;
        const notifType =
          resp.actionIdentifier === WATER_ACTION_LOG
            ? "water_log_action"
            : resp.actionIdentifier === WATER_ACTION_DETAILS
              ? "water_details_action"
              : data?.type === "water"
                ? "water_reminder"
                : data?.type === "daily_update"
                  ? "daily_update"
                  : data?.screen === "Home"
                    ? "workout_reminder"
                    : (data?.type as string) || "other";

        trackEvent("Notification Opened", {
          type: notifType,
          action:
            resp.actionIdentifier === DEFAULT_ACTION
              ? "tap"
              : resp.actionIdentifier,
          title: resp.notification.request.content.title || "",
          ...(data || {}),
        });

        // Action buttons don't auto-dismiss on Android — clear the notification
        // from the shade once the user has acted on it.
        const dismiss = () =>
          Notifications.dismissNotificationAsync(notifId).catch(() => {});

        // "Yes, I drank water" action → increment the count from the shade,
        // without opening the app. Works while the JS runtime is alive.
        if (resp.actionIdentifier === WATER_ACTION_LOG) {
          try {
            const goal = await getGoalGlasses();
            const next = await logGlass(goal);
            Logger.log("[Water] logged from notification →", next, "/", goal);
          } catch (e) {
            Logger.log("[Water] notification log failed:", String(e));
          }
          dismiss();
          return;
        }

        // Daily quiz reminder → open Home, then switch to the Quiz tab.
        if (data?.type === "quiz") {
          dismiss();
          router.replace("/home");
          setTimeout(() => switchToTab("Quiz"), 450);
          return;
        }

        // Push-up leaderboard broadcast (sent from the Worker cron) → open the
        // Event tab, which is what the notification is inviting them to.
        if (data?.type === "pushup_event") {
          dismiss();
          router.replace("/home");
          setTimeout(() => switchToTab("Event"), 450);
          return;
        }

        // "Show me details" action OR tapping the notification body → open the
        // Water Reminder screen.
        if (resp.actionIdentifier === WATER_ACTION_DETAILS || data?.type === "water") {
          dismiss();
          router.push("/profile/water");
        } else if (data?.screen === "Home" || data?.type === "daily_update") {
          dismiss();
          router.replace("/home");
        }
      },
    );

    return () => {
      unsubscribeForeground();
      responseSub.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return <CustomSplashScreen />;
  }

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />

          <Stack.Screen
            name="signup"
            options={{
              headerShown: false,
              animationTypeForReplace: "push",
              animation: "slide_from_right",
            }}
          />

          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="workouts" options={{ headerShown: false }} />
          <Stack.Screen name="stats" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>

        <StatusBar style="auto" />
      </ThemeProvider>

      <ToastManager useModal={false} />
    </UserProvider>
  );
}