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
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import "react-native-reanimated";
import ToastManager from "toastify-react-native";

import {
  AppOpenAdManager,
  InterstitialAdManager,
  RewardedAdManager,
  RewardedInterstitialAdManager,
} from "../ads/Admobmanager";
import { Logger } from "../constants/Logger";
import { initMixpanel } from "../constants/mixpanel";
import UserProvider, { useUser } from "../constants/UserContext";
import "../locales/i18";

SplashScreen.preventAutoHideAsync();

function AppBootRedirect({ fontsLoaded }: { fontsLoaded: boolean }) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const hasRedirected = useRef(false);

  const { user, isUserLoaded } = useUser();

  useEffect(() => {
    const bootApp = async () => {
      if (!fontsLoaded) return;
      if (!isUserLoaded) return;
      if (!rootNavigationState?.key) return;
      if (hasRedirected.current) return;

      hasRedirected.current = true;

      try {
        Logger.log("user--RootBoot-->", user);
        Logger.log("isUserLoaded--RootBoot-->", isUserLoaded);

        if (user?.name) {
          router.replace("/home");
        } else {
          router.replace("/signup");
        }
      } catch (error) {
        Logger.log("[RootBoot] Navigation failed: " + String(error));
        router.replace("/signup");
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    bootApp();
  }, [fontsLoaded, isUserLoaded, user, rootNavigationState?.key, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme?.() || "light";
  const appState = useRef<import("react-native").AppStateStatus>(AppState.currentState);
  const [adsInitialized, setAdsInitialized] = useState(false);

  const [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
  });

  useEffect(() => {
    initMixpanel();

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
        Logger.log("[AdMob] SDK initialization failed: " + String(error));
      }
    };

    initializeAds();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AppBootRedirect fontsLoaded={fontsLoaded} />

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
        <ToastManager useModal={false} />
      </ThemeProvider>
    </UserProvider>
  );
}