import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const JACK = require("../../assets/widget/jack_gentle.png");

/**
 * Asks for notification permission BEFORE the OS dialog.
 *
 * Android only gives an app one shot at the system prompt — a decline is
 * permanent until the user digs into Settings. So this explains what the
 * reminders actually are first, and a "Maybe later" here costs nothing
 * because the OS prompt is never fired.
 *
 * @param {string} reminderLabel e.g. "6:45 AM" — the real scheduled time, not
 *                               a generic promise. Omitted if unknown.
 */
export default function NotificationPrimer({
  visible,
  reminderLabel,
  onAllow,
  onSkip,
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const rows = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;

    enter.setValue(0);
    rows.forEach((r) => r.setValue(0));

    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();

    // Benefits arrive one after another so the eye is walked down the list.
    Animated.stagger(
      90,
      rows.map((r) =>
        Animated.timing(r, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();

    // Bell rings, pauses, rings again — a constant jitter reads as broken.
    const bell = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        ...[1, -1, 0.7, -0.7, 0].map((to) =>
          Animated.timing(wobble, {
            toValue: to,
            duration: 90,
            useNativeDriver: true,
          }),
        ),
      ]),
    );

    const pulse = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1900,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );

    bell.start();
    pulse.start();
    return () => {
      bell.stop();
      pulse.stop();
    };
  }, [visible, enter, wobble, ring, rows]);

  const BENEFITS = [
    {
      icon: "alarm",
      tint: "#FF6B35",
      title: reminderLabel
        ? `A nudge at ${reminderLabel}`
        : "A nudge before your slot",
      text: "15 minutes ahead, so you have time to change.",
    },
    {
      icon: "flame",
      tint: "#F7931E",
      title: "Your streak stays alive",
      text: "Most streaks break on a day someone simply forgot.",
    },
    {
      icon: "notifications-off",
      tint: "#636E72",
      title: "Two a day. That's it.",
      text: "Turn them off anytime from your profile.",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onSkip}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: enter,
              transform: [
                {
                  scale: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.hero}>
            {/* Expanding rings behind the bell */}
            {[0, 0.5].map((offset) => (
              <Animated.View
                key={offset}
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
                          outputRange: [0.7 + offset * 0.3, 1.9],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}

            <View style={styles.bellWrap}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: wobble.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ["-16deg", "16deg"],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons
                  name="notifications"
                  size={ms(30)}
                  color={colors.primary}
                />
              </Animated.View>
            </View>

            <Image source={JACK} style={styles.jack} contentFit="contain" />
          </View>

          <Text style={styles.title}>Can I remind you?</Text>
          <Text style={styles.subtitle}>
            You picked a workout time. Let me make sure you actually get there.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b, i) => (
              <Animated.View
                key={b.title}
                style={[
                  styles.row,
                  {
                    opacity: rows[i],
                    transform: [
                      {
                        translateY: rows[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: b.tint + "1A" }]}>
                  <Ionicons name={b.icon} size={ms(15)} color={b.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{b.title}</Text>
                  <Text style={styles.rowText}>{b.text}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.9}
            onPress={() => {
              tapHaptic();
              onAllow?.();
            }}
          >
            <Ionicons name="notifications" size={ms(16)} color="#FFFFFF" />
            <Text style={styles.ctaText}>Yes, remind me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skip}
            activeOpacity={0.7}
            onPress={() => {
              tapHaptic();
              onSkip?.();
            }}
          >
            <Text style={styles.skipText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: ms(22),
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(24),
    paddingHorizontal: ms(20),
    paddingTop: ms(6),
    paddingBottom: ms(14),
    alignItems: "center",
  },

  hero: {
    height: ms(112),
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: ms(78),
    height: ms(78),
    borderRadius: ms(39),
    backgroundColor: colors.primary + "33",
  },
  bellWrap: {
    position: "absolute",
    left: ms(24),
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
    justifyContent: "center",
  },
  jack: { width: ms(104), height: ms(104), marginLeft: ms(46) },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: ms(6),
    paddingHorizontal: ms(6),
  },

  benefits: { alignSelf: "stretch", gap: ms(11), marginTop: ms(18) },
  row: { flexDirection: "row", alignItems: "center", gap: ms(11) },
  rowIcon: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(11),
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.text,
  },
  rowText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    lineHeight: ms(15),
    marginTop: ms(1),
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    alignSelf: "stretch",
    height: ms(50),
    borderRadius: ms(15),
    backgroundColor: colors.primary,
    marginTop: ms(20),
  },
  ctaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },
  skip: { alignItems: "center", paddingVertical: ms(12) },
  skipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12.5),
    color: colors.textLight,
  },
});
