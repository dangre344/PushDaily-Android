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
import { initMixpanel } from "../constants/mixpanel";
import {
  setupForegroundMessageHandler,
  subscribeToBroadcastTopic,
} from "../constants/pushNotifications";
import { initRemoteConfig } from "../constants/remoteConfig";
import { useRouteTracking } from "../constants/useScreenTracking";
import UserProvider from "../constants/UserContext";
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
      (resp) => {
        const data = resp.notification.request.content.data;
        Logger.log("[Push] notification tapped:", data);
        if (data?.type === "water") {
          // Water reminder → open the Water Reminder screen directly.
          router.push("/profile/water");
        } else if (data?.screen === "Home" || data?.type === "daily_update") {
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