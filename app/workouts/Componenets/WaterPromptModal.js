import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
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
import { scaling } from "../../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const BENEFITS = [
  { icon: "flash-outline", text: "More energy & less fatigue" },
  { icon: "bulb-outline", text: "Sharper focus all day" },
  { icon: "flame-outline", text: "Better metabolism & recovery" },
];

/**
 * Gentle, occasional nudge to set up water reminders. Explains why hydration
 * matters and routes to the Water Reminder screen. Shown via the gating in
 * constants/waterReminder.js (never right after sign-in, with a cooldown).
 */
export default function WaterPromptModal({ visible, onClose, onEnable }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const drop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      drop.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Gentle bobbing water drop.
      Animated.loop(
        Animated.sequence([
          Animated.timing(drop, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(drop, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [visible]);

  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: [0, -ms(6)] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
        >
          <Animated.View
            style={[styles.iconCircle, { transform: [{ translateY: dropY }] }]}
          >
            <Text style={styles.iconEmoji}>💧</Text>
          </Animated.View>

          <Text style={styles.title}>Stay hydrated, stay strong</Text>
          <Text style={styles.subtitle}>
            Your body is ~60% water. Even mild dehydration drains your energy,
            focus, and workout performance. A few reminders a day keep you on
            track.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.icon} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={ms(15)} color={colors.primary} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onEnable}
            activeOpacity={0.9}
          >
            <Ionicons name="water" size={ms(18)} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Set Water Reminder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
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
    paddingTop: ms(24),
    paddingBottom: ms(18),
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconCircle: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(14),
  },
  iconEmoji: { fontSize: ms(38) },
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
    marginBottom: ms(18),
  },
  benefits: {
    alignSelf: "stretch",
    gap: ms(10),
    marginBottom: ms(20),
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
  },
  benefitIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.text,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    alignSelf: "stretch",
    height: ms(52),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: "#FFFFFF",
  },
  secondaryBtn: {
    paddingVertical: ms(12),
    marginTop: ms(4),
  },
  secondaryBtnText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.textLight,
  },
});
