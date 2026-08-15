import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../../../constants/colors";
import { tapHaptic } from "../../../constants/haptics";
import { trackEvent } from "../../../constants/mixpanel";
import { scaling } from "../../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Cycled under the icon so the button explains itself without extra chrome.
const ROLL = ["Packet food", "Check sugar", "Find allergens", "Is it healthy?"];
const ROLL_MS = 2000;

/**
 * Compact "Scan" launcher for the Workouts header.
 *
 * The icon is drawn with a sweeping scan line rather than a Lottie file — drop
 * a `scan.json` into assets/animations and swap the inner <View> for a
 * <LottieView> if you'd rather use one; nothing else needs to change.
 */
export default function ScanButton() {
  const router = useRouter();

  const [word, setWord] = useState(0);
  const wordFade = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  // Rolling caption.
  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(wordFade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setWord((i) => (i + 1) % ROLL.length);
        Animated.timing(wordFade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, ROLL_MS);
    return () => clearInterval(id);
  }, [wordFade]);

  // Scan line + halo, so it reads as a live scanner.
  useEffect(() => {
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ]),
    );
    sweepLoop.start();
    ringLoop.start();
    return () => {
      sweepLoop.stop();
      ringLoop.stop();
    };
  }, [sweep, ring]);

  return (
    <TouchableOpacity
      style={styles.wrap}
      activeOpacity={0.85}
      onPress={() => {
        tapHaptic();
        trackEvent("Food Scan Opened", { from: "workouts" });
        router.push("/scan/food");
      }}
    >
      <View style={styles.iconBox}>
        {/* Expanding halo — a quiet "this is new, tap me". */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: ring.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 0],
              }),
              transform: [
                {
                  scale: ring.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.7],
                  }),
                },
              ],
            },
          ]}
        />

        <Ionicons name="scan-outline" size={ms(21)} color={colors.primary} />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweepLine,
            {
              transform: [
                {
                  translateY: sweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-ms(7), ms(7)],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <Text style={styles.label}>Scan</Text>

      <Animated.Text
        style={[styles.roll, { opacity: wordFade }]}
        numberOfLines={1}
      >
        {ROLL[word]}
      </Animated.Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", width: ms(66) },
  iconBox: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(12),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    width: ms(36),
    height: ms(36),
    borderRadius: ms(12),
    backgroundColor: colors.primary,
  },
  sweepLine: {
    position: "absolute",
    left: ms(7),
    right: ms(7),
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  label: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(10),
    color: colors.primary,
    marginTop: ms(2),
  },
  roll: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(7.5),
    color: colors.textLight,
    marginTop: 0,
  },
});
