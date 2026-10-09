import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useRef } from "react";
import { useWatch } from "react-hook-form";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { tapHaptic, warningHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

/** One segment per step; filled segments grow in from the left. */
export function SignupProgress({ step, total }) {
  return (
    <View style={styles.segments}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={styles.segment}>
          <MotiView
            animate={{ scaleX: i < step ? 1 : 0 }}
            transition={{ type: "timing", duration: 380 }}
            style={styles.segmentFill}
          />
        </View>
      ))}
    </View>
  );
}

/** Top bar: back, title, "2 / 6", progress. */
export function SignupHeader({ step, total, title, subtitle, onBack }) {
  const canGoBack = step > 1;
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <MotiView
          animate={{ opacity: canGoBack ? 1 : 0, scale: canGoBack ? 1 : 0.6 }}
          transition={{ type: "timing", duration: 200 }}
          pointerEvents={canGoBack ? "auto" : "none"}
        >
          <Pressable
            onPress={() => {
              tapHaptic();
              onBack();
            }}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={ms(20)} color={colors.text} />
          </Pressable>
        </MotiView>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSub}>{subtitle}</Text>
        </View>

        <View style={styles.counter}>
          <Text style={styles.counterText}>
            <Text style={styles.counterNow}>{step}</Text> / {total}
          </Text>
        </View>
      </View>

      <SignupProgress step={step} total={total} />
    </View>
  );
}

// Which fields each step needs — mirrors the checks in signup's nextStep().
const isStepComplete = (step, v) => {
  const [name, gender, age, experience, goal, days, time] = v;
  switch (step) {
    case 1:
      return !!gender && !!String(name || "").trim() && Number(age) > 0;
    case 3:
      return !!experience;
    case 4:
      return !!goal;
    case 5:
      return Array.isArray(days) && days.length > 0;
    case 6:
      return !!time;
    default:
      return true;
  }
};

/**
 * The one primary action. Looks ready only when the step is complete; tapping
 * it while incomplete still calls onNext (which shows the existing toast) and
 * shakes the button, so the reason is obvious without guessing.
 *
 * Lives in its own component so watching the form re-renders only this
 * button, not the whole signup screen.
 */
export function SignupFooter({ form, step, total, onNext, continueLabel, finishLabel }) {
  const values = useWatch({
    control: form.control,
    name: ["name", "gender", "age", "experience", "goal", "days", "time"],
  });
  const ready = isStepComplete(step, values);
  const last = step === total;

  const shake = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    if (!ready) {
      warningHaptic();
      Animated.sequence(
        [9, -9, 6, -6, 0].map((x) =>
          Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true }),
        ),
      ).start();
    } else {
      tapHaptic();
    }
    onNext();
  };

  return (
    <View style={styles.footer}>
      <Animated.View style={{ transform: [{ translateX: shake }, { scale: press }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() =>
            Animated.spring(press, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
          }
          onPressOut={() =>
            Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()
          }
        >
          <MotiView
            animate={{ backgroundColor: ready ? colors.primary : "#FFC8B2" }}
            transition={{ type: "timing", duration: 220 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{last ? finishLabel : continueLabel}</Text>
            <MotiView
              animate={{ translateX: ready ? 0 : -4, opacity: ready ? 1 : 0.7 }}
              transition={{ type: "timing", duration: 220 }}
            >
              <Ionicons name={last ? "checkmark" : "arrow-forward"} size={ms(19)} color="#FFFFFF" />
            </MotiView>
          </MotiView>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: ms(17), fontFamily: "OpenSans_800ExtraBold", color: colors.text },
  headerSub: { fontSize: ms(12), fontFamily: "OpenSans_500Medium", color: colors.textLight, marginTop: 1 },
  counter: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primary + "12",
  },
  counterText: { fontSize: ms(12), fontFamily: "OpenSans_700Bold", color: colors.textLight },
  counterNow: { color: colors.primary, fontFamily: "OpenSans_800ExtraBold" },

  segments: { flexDirection: "row", gap: 6, marginTop: 14 },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ECEFF3",
    overflow: "hidden",
  },
  segmentFill: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: colors.primary,
    transformOrigin: "left",
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F3F6",
  },
  cta: {
    height: ms(54),
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: { fontSize: ms(16), fontFamily: "OpenSans_800ExtraBold", color: "#FFFFFF" },
});
