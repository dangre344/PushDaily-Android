import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { AnimatePresence, MotiView } from "moti";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../../constants/colors";
import { selectionHaptic } from "../../../constants/haptics";
import { scaling } from "../../../constants/useScaling";
import { EXPRESSION_IMAGES } from "../../../constants/widgetPromo";

const ms = (n) => scaling().moderateScale(n);

const ROSE = "#E8466B";

const CONTENT = {
  water: {
    accent: colors.primary,
    soft: colors.primary + "14",
    mascot: "water",
    title: "Stay hydrated, stay strong",
    subtitle:
      "Your body is ~60% water. Even mild dehydration drains your energy, focus and workout performance. A few reminders a day keep you on track.",
    benefits: [
      { icon: "flash-outline", text: "More energy & less fatigue" },
      { icon: "bulb-outline", text: "Sharper focus all day" },
      { icon: "flame-outline", text: "Better metabolism & recovery" },
    ],
    cta: "Set Water Reminder",
    ctaIcon: "water",
  },
  period: {
    accent: ROSE,
    soft: "#FFF1F4",
    mascot: "hi",
    title: "Train in sync with your cycle",
    subtitle:
      "Energy changes through the month. Track your period to know what's coming and get gentle support on the tough days.",
    benefits: [
      { icon: "calendar-outline", text: "Know when your next period is due" },
      { icon: "barbell-outline", text: "Workout tips for every phase" },
      { icon: "lock-closed-outline", text: "Private — stays on your phone" },
    ],
    cta: "Start Period Tracking",
    ctaIcon: "water",
  },
};

/**
 * Gentle, occasional nudge to set up water reminders — and, for women, period
 * tracking. Routes to the Water & Periods screen on the chosen tab. Shown via
 * the gating in constants/waterReminder.js (pickWellnessPrompt: never right
 * after sign-in, with a cooldown).
 */
export default function WaterPromptModal({
  visible,
  onClose,
  onEnable,
  showPeriods = false,
  initialTab = "water",
}) {
  const [tab, setTab] = useState(initialTab);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setTab(showPeriods ? initialTab : "water");
    opacity.setValue(0);
    scale.setValue(0.9);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const c = CONTENT[tab];
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -ms(5)] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          {showPeriods ? (
            <View style={styles.segment}>
              {[
                { id: "water", label: "Water", icon: "cup-water", color: "#2E90FA" },
                { id: "period", label: "Periods", icon: "water", color: "#DC2626" },
              ].map((t) => {
                const on = tab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      if (!on) selectionHaptic();
                      setTab(t.id);
                    }}
                    style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                  >
                    <MaterialCommunityIcons name={t.icon} size={ms(16)} color={t.color} style={{ opacity: on ? 1 : 0.5 }} />
                    <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <AnimatePresence exitBeforeEnter>
            <MotiView
              key={tab}
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "timing", duration: 200 }}
              style={styles.content}
            >
              <Animated.View style={[styles.iconCircle, { backgroundColor: c.soft, transform: [{ translateY: bobY }] }]}>
                <Image source={EXPRESSION_IMAGES[c.mascot]} style={styles.mascot} contentFit="contain" />
              </Animated.View>

              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.subtitle}>{c.subtitle}</Text>

              <View style={styles.benefits}>
                {c.benefits.map((b) => (
                  <View key={b.icon} style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: c.soft }]}>
                      <Ionicons name={b.icon} size={ms(15)} color={c.accent} />
                    </View>
                    <Text style={styles.benefitText}>{b.text}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: c.accent, shadowColor: c.accent }]}
                onPress={() => onEnable?.(tab)}
                activeOpacity={0.9}
              >
                <Ionicons name={c.ctaIcon} size={ms(18)} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{c.cta}</Text>
              </TouchableOpacity>
            </MotiView>
          </AnimatePresence>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(24),
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(26),
    paddingHorizontal: ms(22),
    paddingTop: ms(18),
    paddingBottom: ms(14),
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  content: { alignSelf: "stretch", alignItems: "center" },

  segment: {
    alignSelf: "stretch",
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: ms(12),
    padding: 3,
    marginBottom: ms(14),
  },
  segmentBtn: {
    flex: 1,
    height: ms(34),
    borderRadius: ms(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  segmentBtnOn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: "OpenSans_700Bold", fontSize: ms(12.5), color: colors.textLight },
  segmentTextOn: { color: colors.text, fontFamily: "OpenSans_800ExtraBold" },

  iconCircle: {
    width: ms(84),
    height: ms(84),
    borderRadius: ms(42),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(12),
  },
  mascot: { width: ms(74), height: ms(74) },
  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(12.5),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(19),
    marginTop: ms(8),
    marginBottom: ms(16),
  },
  benefits: { alignSelf: "stretch", gap: ms(10), marginBottom: ms(18) },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  benefitIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontFamily: "OpenSans_600SemiBold", fontSize: ms(13), color: colors.text },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    alignSelf: "stretch",
    height: ms(52),
    borderRadius: ms(16),
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(15), color: "#FFFFFF" },
  secondaryBtn: { paddingVertical: ms(12), marginTop: ms(2) },
  secondaryBtnText: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(13), color: colors.textLight },
});
