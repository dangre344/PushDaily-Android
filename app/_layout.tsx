import CustomSplashScreen from "@/components/CustomSplashScreen";
import { useColorScheme } from "@/hooks/use-color-scheme";
// Per-weight imports: the package root bundles all 12 files (italics included).
import { OpenSans_400Regular } from "@expo-google-fonts/open-sans/400Regular";
import { OpenSans_500Medium } from "@expo-google-fonts/open-sans/500Medium";
import { OpenSans_600SemiBold } from "@expo-google-fonts/open-sans/600SemiBold";
import { OpenSans_700Bold } from "@expo-google-fonts/open-sans/700Bold";
import { OpenSans_800ExtraBold } from "@expo-google-fonts/open-sans/800ExtraBold";
import { useFonts } from "@expo-google-fonts/open-sans/useFonts";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
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
import { captureInstallAttribution } from "../constants/installAttribution";
import { Logger } from "../constants/Logger";
import { initMixpanel, trackEvent } from "../constants/mixpanel";
import {
  setupForegroundMessageHandler,
  subscribeToBroadcastTopic,
} from "../constants/pushNotifications";
import { initRemoteConfig } from "../constants/remoteConfig";
import { switchToTab } from "../constants/tabNavigation";
import TrainerBubble from "../components/TrainerBubble";
import { useRouteTracking } from "../constants/useScreenTracking";
import {
  markBackgrounded,
  markResumed,
  reportPreviousSessionEnd,
} from "../constants/appLifecycle";
import UserProvider from "../constants/UserContext";
import {
  listenForJackTaps,
  openFromNotification,
} from "../constants/jackNotifications";
import {
  getGoalGlasses,
  logGlass,
  WATER_ACTION_DETAILS,
  WATER_ACTION_LOG,
} from "../constants/waterReminder";
import "../locales/i18";
import { runAfterStartup } from "../constants/afterStartup";

// Expo Router calls preventAutoHideAsync() internally, which pins the native
// OS splash on screen until we explicitly dismiss it. Call hideAsync() at
// module level so it fires the instant the JS bundle evaluates — before any
// React render — and our CustomSplashScreen takes over with no white flash.
SplashScreen.hideAsync().catch(() => { });

export default function RootLayout() {
  const colorScheme = useColorScheme?.() || "light";
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [adsInitialized, setAdsInitialized] = useState(false);

  // Only the weights the app uses (300 Light had no users) — each one is
  // read and registered before the first screen.
  const [fontsLoaded, fontError] = useFonts({
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
  });

  // Auto-track file-route screen changes (gated by the Remote Config flag).
  useRouteTracking();

  useEffect(() => {
    // Attribution waits for Mixpanel so "App First Open" and the utm super
    // properties land on the same initialised instance.
    initMixpanel().then(() => captureInstallAttribution());
    // Crashlytics: enable collection + install the global JS error handler so
    // uncaught crashes are recorded and an "App Crashed" event is fired.
    initCrashlytics();
    // Fetch the screen-tracking flag from Firebase Remote Config so screen
    // events can be switched on/off remotely without an app update.
    initRemoteConfig();
    // Nudge the user to update if a higher version is live on the Play Store.
    // Non-blocking (flexible) flow; preserves all local data. Waits a few
    // seconds so it doesn't compete with drawing the home screen.
    const cancelUpdateCheck = runAfterStartup(
      () => checkForAppUpdate("flexible"),
      4000,
    );

    // Ads aren't on the first screen: start the SDK once the home screen has
    // drawn, preload the app-open and interstitial ads first and the two
    // rewarded ones a little later. (Screens that need a rewarded ad sooner
    // create and load it themselves through getInstance().)
    let cancelRewarded = () => {};
    const cancelAds = runAfterStartup(async () => {
      try {
        await mobileAds().initialize();
        Logger.log("[AdMob] SDK initialized");

        AppOpenAdManager.getInstance();
        InterstitialAdManager.getInstance();
        setAdsInitialized(true);

        cancelRewarded = runAfterStartup(() => {
          RewardedAdManager.getInstance();
          RewardedInterstitialAdManager.getInstance();
        }, 3000);
      } catch (error) {
        Logger.log("[AdMob] SDK initialization failed:", String(error));
      }
    }, 1500);

    return () => {
      cancelUpdateCheck();
      cancelAds();
      cancelRewarded();
    };
  }, []);

  // ─── Deep links that name a bottom tab ────────────────────────────────────
  // The home-screen widget opens pushdaily://home?tab=Workouts. expo-router
  // handles the /home part; the tab itself lives inside a bottom-tab navigator
  // that has no route of its own, so it is selected through the registry once
  // the navigator has mounted — same 450ms pattern the notification handlers
  // above use.
  useEffect(() => {
    const openTab = (url: string | null) => {
      if (!url) return;
      try {
        const tab = ExpoLinking.parse(url).queryParams?.tab;
        if (typeof tab !== "string" || !tab) return;

        Logger.log("[DeepLink] switching to tab:", tab);
        trackEvent("Deep Link Opened", { tab, source: "widget" });
        setTimeout(() => switchToTab(tab), 450);
      } catch (e) {
        Logger.log("[DeepLink] could not parse url:", String(e));
      }
    };

    // Cold start (widget tap launched the app) and warm (already running).
    ExpoLinking.getInitialURL().then(openTab).catch(() => {});
    const sub = ExpoLinking.addEventListener("url", ({ url }) => openTab(url));

    return () => sub.remove();
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

        // "Show me details" on a water reminder → the Water screen.
        if (resp.actionIdentifier === WATER_ACTION_DETAILS) {
          dismiss();
          router.push("/profile/water");
          return;
        }

        // Everything else: one routing table for every notification source
        // (workout → Workouts, quiz → Quiz, pushup_event → Event, water,
        // period, daily_update → Home). See constants/jackNotifications.js.
        if (openFromNotification((data || {}) as Record<string, string>)) {
          dismiss();
        }
      },
    );

    // Taps on Jack's picture notifications (scheduled through Notifee) arrive
    // through Notifee, not the listener above — same tracking, same routing.
    const stopJackTaps = listenForJackTaps((data: Record<string, string>) => {
      trackEvent("Notification Opened", {
        type: data?.type || "other",
        action: "tap",
        source: "jack",
        ...(data || {}),
      });
      openFromNotification(data);
    });

    return () => {
      unsubscribeForeground();
      responseSub.remove();
      stopJackTaps();
    };
  }, []);

  // Fonts must never hold the app on the splash: useFonts reports a failure
  // through `fontError` (never through `fontsLoaded`), and a stalled asset
  // download never settles at all. Either way, start with the system font.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    if (fontsLoaded) return;
    const t = setTimeout(() => {
      Logger.log("[Fonts] still loading after 5 s, starting without them");
      setFontWaitOver(true);
    }, 5000);
    return () => clearTimeout(t);
  }, [fontsLoaded]);
  useEffect(() => {
    if (fontError) Logger.log("[Fonts] failed to load:", String(fontError));
  }, [fontError]);

  if (!fontsLoaded && !fontError && !fontWaitOver) {
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

        {/* Draggable chat bubble, above every screen (hides itself on the
            chat, signup and camera routes). */}
        <TrainerBubble />
      </ThemeProvider>

      <ToastManager useModal={false} />
    </UserProvider>
  );
}