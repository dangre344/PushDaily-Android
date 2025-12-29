import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  OpenSans_300Light,
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_800ExtraBold,
  useFonts
} from '@expo-google-fonts/open-sans';
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import 'react-native-reanimated';
import ToastManager from 'toastify-react-native';
import { Logger } from '../constants/Logger.js';
import UserProvider from "../constants/UserContext.js"; // adjust path if needed
import "../locales/i18.js";



export default function RootLayout() {
  const colorScheme = useColorScheme?.() || "light";

  let [fontsLoaded] = useFonts({
    OpenSans_300Light,
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
  });


  Logger.log("fontsLoaded----" + fontsLoaded)

  if (!fontsLoaded) {
    return null; // or loading screen
  }


  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack initialRouteName="Splash">
          <Stack.Screen name="Splash" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{
            headerShown: false, animationTypeForReplace: 'push',
            animation: 'slide_from_right'
          }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />

          <Stack.Screen name="modal" options={{ presentation: "modal" }} />


        </Stack>
        <StatusBar style="auto" />

        <ToastManager useModal={false} />
      </ThemeProvider>
    </UserProvider>
  );
}
