import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Image } from "expo-image";

import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";
import {
  EXPRESSION_IMAGES,
  markWidgetAdded,
  resolveWidget,
  trackWidgetGuideCompleted,
  trackWidgetGuideDismissed,
  WIDGET_SOCIAL_PROOF,
} from "../../constants/widgetPromo";

const ms = (n) => scaling().moderateScale(n);

/**
 * Hours chosen to walk through the day so the preview shows Jack in several
 * moods rather than implying the widget says one thing forever.
 */
const PREVIEW_HOURS = [8, 11, 14, 17, 20];

const STEPS = [
  {
    emoji: "👆",
    title: "Long-press your home screen",
    text: "Press and hold any empty space until the menu appears.",
  },
  {
    emoji: "🧩",
    title: "Tap Widgets",
    text: "Then scroll to find Push Daily in the list.",
  },
  {
    emoji: "🤏",
    title: "Drag it into place",
    text: "Hold the Push Daily widget and drop it where you'll see it.",
  },
];

/**
 * Explains how to add the home-screen widget. Android has no API to add a
 * widget on the user's behalf on older versions and no reliable way to check
 * whether one exists — so this is a guide, not an installer.
 */
export default function WidgetGuideModal({
  visible,
  setVisible,
  name,
  streak = 0,
}) {
  const [preview, setPreview] = useState(0);
  const [added, setAdded] = useState(false);

  // Show it with their own name and streak — it is the same call the widget
  // makes, so what they see here is exactly what lands on the home screen.
  const shown = resolveWidget({
    hour: PREVIEW_HOURS[preview],
    streak,
    everTrained: streak > 0,
    rotation: preview,
    name,
  });

  const enter = useRef(new Animated.Value(0)).current;
  const swap = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    setAdded(false);
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, enter]);

  // Cycle the preview so users see it is not one static nag.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      Animated.timing(swap, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setPreview((i) => (i + 1) % PREVIEW_HOURS.length);
        Animated.timing(swap, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, 2600);
    return () => clearInterval(id);
  }, [visible, swap]);

  const close = (reason) => {
    trackWidgetGuideDismissed(reason);
    setVisible(false);
  };

  const confirmAdded = async () => {
    tapHaptic();
    setAdded(true);
    await markWidgetAdded();
    trackWidgetGuideCompleted();
    setTimeout(() => setVisible(false), 1200);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => close("back")}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => close("close")}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Home screen widget</Text>
            <Text style={styles.subtitle}>
              A nudge where you&apos;ll see it
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            {/* Live preview of what lands on their home screen */}
            <View style={styles.phone}>
              <View style={styles.phoneNotch} />
              <Animated.View style={[styles.widget, { opacity: swap }]}>
                <Image
                  source={EXPRESSION_IMAGES[shown.expression]}
                  style={styles.widgetChar}
                  contentFit="contain"
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.widgetTop}>
                    <Text style={styles.widgetBrand}>PUSH DAILY</Text>
                    {streak > 0 ? (
                      <View style={styles.widgetStreak}>
                        <Text style={styles.widgetStreakFire}>🔥</Text>
                        <Text style={styles.widgetStreakText}>{streak}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.widgetText} numberOfLines={2}>
                    {shown.text}
                  </Text>
                </View>
              </Animated.View>
              <Text style={styles.phoneHint}>Preview</Text>
            </View>

            <View style={styles.proof}>
              <Text style={styles.proofEmoji}>📈</Text>
              <Text style={styles.proofText}>{WIDGET_SOCIAL_PROOF}</Text>
            </View>

            <Text style={styles.sectionTitle}>How to add it</Text>

            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>
                    {s.emoji}  {s.title}
                  </Text>
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              </View>
            ))}

            <View style={styles.note}>
              <Ionicons
                name="information-circle"
                size={ms(15)}
                color={colors.textLight}
              />
              <Text style={styles.noteText}>
                The exact wording differs by phone — some call it
                &quot;Widgets&quot;, others &quot;Add widget&quot;. Tapping the
                widget opens the app straight to your workouts.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, added && styles.ctaDone]}
            activeOpacity={0.9}
            onPress={confirmAdded}
            disabled={added}
          >
            <Ionicons
              name={added ? "checkmark-circle" : "add-circle-outline"}
              size={ms(17)}
              color={added ? "#0F766E" : "#FFFFFF"}
            />
            <Text style={[styles.ctaText, added && styles.ctaTextDone]}>
              {added ? "Nice — you're all set!" : "I've added it"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.later}
            activeOpacity={0.7}
            onPress={() => close("maybe_later")}
          >
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  backBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
  },

  body: { padding: ms(18), paddingBottom: ms(10) },

  // ── Fake home screen so the widget is shown in context ──
  phone: {
    backgroundColor: "#1F2937",
    borderRadius: ms(22),
    padding: ms(14),
    paddingTop: ms(10),
    alignItems: "center",
    marginBottom: ms(16),
  },
  phoneNotch: {
    width: ms(54),
    height: ms(4),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: ms(12),
  },
  widget: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(11),
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(16),
    padding: ms(12),
  },
  widgetChar: { width: ms(52), height: ms(52) },
  widgetTop: { flexDirection: "row", alignItems: "center" },
  widgetStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(2),
    backgroundColor: "#FFEDD5",
    borderRadius: 999,
    paddingHorizontal: ms(7),
    paddingVertical: ms(1),
  },
  widgetStreakFire: { fontSize: ms(9) },
  widgetStreakText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(10),
    color: "#C2410C",
  },
  widgetBrand: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(8.5),
    letterSpacing: 1.1,
    color: colors.primary,
  },
  widgetText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.text,
    lineHeight: ms(17),
    marginTop: ms(2),
  },
  phoneHint: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(9),
    color: "rgba(255,255,255,0.55)",
    marginTop: ms(9),
  },

  proof: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(9),
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: ms(14),
    padding: ms(12),
    marginBottom: ms(18),
  },
  proofEmoji: { fontSize: ms(16) },
  proofText: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11.5),
    color: "#166534",
    lineHeight: ms(16),
  },

  sectionTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.text,
    marginBottom: ms(10),
  },

  step: {
    flexDirection: "row",
    gap: ms(11),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(14),
    padding: ms(12),
    marginBottom: ms(9),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  stepNum: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(11),
    color: "#FFFFFF",
  },
  stepTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
  },
  stepText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    lineHeight: ms(16),
    marginTop: ms(2),
  },

  note: {
    flexDirection: "row",
    gap: ms(8),
    alignItems: "flex-start",
    marginTop: ms(8),
    paddingHorizontal: ms(4),
  },
  noteText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    lineHeight: ms(15),
  },

  footer: {
    padding: ms(16),
    paddingTop: ms(8),
    backgroundColor: "#F7F8FA",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(50),
    borderRadius: ms(15),
    backgroundColor: colors.primary,
  },
  ctaDone: {
    backgroundColor: "#CCFBF1",
    borderWidth: 1,
    borderColor: "#5EEAD4",
  },
  ctaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13.5),
    color: "#FFFFFF",
  },
  ctaTextDone: { color: "#0F766E" },
  later: { alignItems: "center", paddingVertical: ms(11) },
  laterText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
  },
});
