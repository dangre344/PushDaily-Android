import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBar } from "expo-status-bar";
import { colors } from "../constants/colors";
import { Logger } from "../constants/Logger";
import { useUser } from "../constants/UserContext";
import { scaling } from "../constants/useScaling";
const { width, height } = Dimensions.get("window");

const { scaleHeight, moderateScale } = scaling();

export default function Splash() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const { user, updateUser } = useUser();

  Logger.log("user--Splash-->", user);

  useEffect(() => {
    if (user === undefined) return; // optional guard
    async function prepare() {
      await SplashScreen.preventAutoHideAsync();

      // Check if user has completed signup

      Logger.log("user--prepare-->", user?.name);
      const userName = user?.name || null;

      // Optional: Keep splash visible for 2 seconds
      await new Promise((res) => setTimeout(res, 2000));

      Logger.log("User name from storage--->", userName);

      // Navigate
      if (userName) {
        // router.replace("/signup");
        router.replace("/home");
      } else {
        router.replace("/signup");
      }

      await SplashScreen.hideAsync();
    }
    prepare();
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        backgroundColor="red"
        barStyle="light-content"
        translucent={false}
      />

      <Image
        source={require("../assets/images/workout.jpg")}
        style={styles.image}
      />

      {/* Centered text container on top of image */}
      <View style={styles.overlay}>
        <Text style={styles.text}>{t("tagLine")}</Text>
        <Text style={styles.appName}>{t("appName")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignContent: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "120%",
    position: "absolute",
    resizeMode: "cover",
  },
  overlay: {
    alignContent: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 90,
  },
  text: {
    fontSize: scaleHeight(20),
    color: colors.white,
    textAlign: "center",
    fontFamily: "OpenSans_600SemiBold",
  },
  appName: {
    fontSize: scaleHeight(16),
    color: colors.white,
    marginTop: 8,
    textAlign: "center",
    fontFamily: "OpenSans_600SemiBold",
  },
});
