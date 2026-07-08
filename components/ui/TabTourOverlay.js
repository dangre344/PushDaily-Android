import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../constants/colors";
import { trackEvent } from "../../constants/mixpanel";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);
const { width: SCREEN_W } = Dimensions.get("window");

const K_SEEN = "tab_tour_seen_v1";

// One step per bottom tab, in tab order: Stats, Attendance, Workouts, Event, Profile.
const STEPS = [
  {
    emoji: "📊",
    title: "Stats",
    text: "Calories, favourite body parts and progress charts — all in one place.",
  },
  {
    emoji: "📅",
    title: "Attendance",
    text: "See which days you showed up and keep your weekly streak alive.",
  },
  {
    emoji: "🏋️",
    title: "Workouts",
    text: "Your daily home workouts — pick a body part and start training.",
  },
  {
    emoji: "🏆",
    title: "Event",
    text: "Join the push-up challenge! The camera counts your reps — tap here to compete.",
  },
  {
    emoji: "👤",
    title: "Profile",
    text: "Milestones, water reminder, and your personal settings live here.",
  },
];

const TAB_COUNT = STEPS.length;
const TAB_BAR_H = ms(70); // approximate height of the floating tab bar

export const hasSeenTabTour = () =>
  AsyncStorage.getItem(K_SEEN).then((v) => v === "true");

export const markTabTourSeen = () => AsyncStorage.setItem(K_SEEN, "true");

/**
 * One-time coach-mark tour of the bottom tabs. A pulsing circle + arrow points
 * at each tab with a short explanation. Fully finishing it stores a flag so it
 * never shows again (dismissing early also counts as done — no nagging).
 */
export default function TabTourOverlay({ visible, onDone }) {
  const [step, setStep] = useState(0);

  const pulse = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.timing(fade, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 0,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible]);

  if (!visible) return null;

  const finish = (completed) => {
    markTabTourSeen();
    trackEvent("Tab Tour", { completed, lastStep: step });
    onDone?.();
  };

  const next = () => {
    if (step < TAB_COUNT - 1) setStep(step + 1);
    else finish(true);
  };

  // Horizontal center of the current tab in the evenly-split bottom bar.
  const tabW = SCREEN_W / TAB_COUNT;
  const centerX = tabW * step + tabW / 2;
  const RING = ms(64);

  const s = STEPS[step];
  const isLast = step === TAB_COUNT - 1;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        {/* Tooltip card */}
        <View style={styles.cardWrap} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.cardEmoji}>{s.emoji}</Text>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardText}>{s.text}</Text>

            {/* Step dots */}
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={next}
              activeOpacity={0.9}
            >
              <Text style={styles.nextText}>
                {isLast ? "Got it — let's go!" : "Next"}
              </Text>
              {!isLast && (
                <Ionicons name="arrow-forward" size={ms(16)} color="#FFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => finish(false)} style={styles.skip}>
              <Text style={styles.skipText}>Skip tour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouncing arrow pointing down at the tab */}
        <Animated.View
          style={[
            styles.arrow,
            {
              left: centerX - ms(14),
              transform: [
                {
                  translateY: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, ms(10)],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="arrow-down" size={ms(28)} color={colors.primary} />
        </Animated.View>

        {/* Pulsing spotlight circle over the tab */}
        <View
          style={[styles.ringWrap, { left: centerX - RING / 2 }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.ringPulse,
              {
                width: RING,
                height: RING,
                borderRadius: RING / 2,
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 0],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.5],
                    }),
                  },
                ],
              },
            ]}
          />
          <View
            style={[
              styles.ring,
              { width: RING, height: RING, borderRadius: RING / 2 },
            ]}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,15,30,0.82)",
  },

  cardWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: ms(28),
    paddingBottom: ms(120),
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(24),
    paddingHorizontal: ms(22),
    paddingVertical: ms(24),
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cardEmoji: { fontSize: ms(40) },
  cardTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(20),
    color: colors.text,
    marginTop: ms(8),
  },
  cardText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(20),
    marginTop: ms(6),
  },
  dots: {
    flexDirection: "row",
    gap: ms(6),
    marginTop: ms(16),
  },
  dot: {
    width: ms(7),
    height: ms(7),
    borderRadius: ms(4),
    backgroundColor: "#E2E8F0",
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: ms(18),
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(6),
    alignSelf: "stretch",
    height: ms(48),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    marginTop: ms(18),
  },
  nextText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },
  skip: { paddingVertical: ms(10), marginTop: ms(2) },
  skipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
  },

  arrow: {
    position: "absolute",
    bottom: TAB_BAR_H + ms(64),
  },
  ringWrap: {
    position: "absolute",
    bottom: ms(6),
    alignItems: "center",
    justifyContent: "center",
  },
  ringPulse: {
    position: "absolute",
    borderWidth: 3,
    borderColor: colors.primary,
  },
  ring: {
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: "rgba(255,107,53,0.12)",
  },
});
