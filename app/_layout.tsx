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
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import mobileAds from "react-native-google-mobile-ads";
import "react-native-reanimated";
import ToastManager from "toastify-react-native";

import { Logger } from "../constants/Logger";
import { initMixpanel } from "../constants/mixpanel";
import UserProvider from "../constants/UserContext";
import "../locales/i18";

import {
  AppOpenAdManager,
  InterstitialAdManager,
  RewardedAdManager,
  RewardedInterstitialAdManager,
} from "../ads/Admobmanager";

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

  useEffect(() => {
    initMixpanel();

    const initializeAds = async () => {
      try {
        await mobileAds().initialize();

        Logger.log("[AdMob] SDK initialized");

        // Create and preload all singleton ads
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

  // Show App Open Ad when app comes back from background
  // useEffect(() => {
  //   if (!adsInitialized) return;

  //   const subscription = AppState.addEventListener("change", (nextState) => {
  //     const wasInBackground =
  //       appState.current === "inactive" || appState.current === "background";

  //     if (wasInBackground && nextState === "active") {
  //       AppOpenAdManager.getInstance().showOnForeground();
  //     }

  //     appState.current = nextState;
  //   });

  //   return () => {
  //     subscription.remove();
  //   };
  // }, [adsInitialized]);

  Logger.log("fontsLoaded----" + fontsLoaded);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack initialRouteName="Splash">
          <Stack.Screen name="Splash" options={{ headerShown: false }} />

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