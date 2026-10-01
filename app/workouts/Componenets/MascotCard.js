import { Image } from "expo-image";
import { useEffect, useRef } from "react";
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
import { scaling } from "../../../constants/useScaling";
import { EXPRESSION_IMAGES, resolveWidget } from "../../../constants/widgetPromo";

const ms = (n) => scaling().moderateScale(n);

/**
 * The widget's mascot, in the app.
 *
 * Resolved through the SAME resolveWidget() the home-screen widget calls, so
 * the character and line here always match what is on their home screen — two
 * separate message tables would drift within a week.
 *
 * @param {number} streak         current streak in days
 * @param {number} daysSinceLast  0 = trained today, -1 = never trained
 */
export default function MascotCard({ name, streak = 0, daysSinceLast = -1, onPress }) {
  const bob = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  const shown = resolveWidget({
    hour: new Date().getHours(),
    streak,
    daysSinceLast,
    // Rotate the line by day so it is not identical every time they open the
    // app, and matches the widget's own day-of-year rotation.
    rotation: Math.floor(Date.now() / 86400000),
    name,
  });

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Slow idle bob — enough to catch the eye, not enough to nag.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, enter]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={onPress ? 0.9 : 1}
        onPress={() => {
          if (!onPress) return;
          tapHaptic();
          onPress(shown);
        }}
      >
        <Animated.View
          style={{
            transform: [
              {
                translateY: bob.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -ms(5)],
                }),
              },
            ],
          }}
        >
          <Image
            source={EXPRESSION_IMAGES[shown.expression]}
            style={styles.mascot}
            contentFit="contain"
          />
        </Animated.View>

        <View style={{ flex: 1 }}>
          <Text style={styles.message}>{shown.text}</Text>

          {streak > 0 ? (
            <View style={styles.streak}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakText}>
                {streak === 1 ? "1 day streak" : `${streak} day streak`}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    backgroundColor: "#FFF9E8",
    borderWidth: 1,
    borderColor: "#FFE9A8",
    borderRadius: ms(18),
    paddingVertical: ms(12),
    paddingHorizontal: ms(14),
    // Matches the other cards on this screen.
    marginHorizontal: ms(20),
    marginBottom: ms(16),
  },
  mascot: { width: ms(62), height: ms(62) },
  message: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13.5),
    color: colors.text,
    lineHeight: ms(19),
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(4),
    marginTop: ms(5),
  },
  streakFire: { fontSize: ms(11) },
  streakText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11),
    color: "#C2410C",
  },
});
