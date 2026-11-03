import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  calculateWaterGoal,
  getConsumedGlasses,
  isWaterTrackingEnabled,
  logGlass,
  removeGlass,
  startWaterTracking,
  stopWaterTracking,
  WATER_GLASS_ML,
} from "../../constants/waterReminder";

const ms = (n) => scaling().moderateScale(n);
const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const IMPORTANCE = [
  { icon: "flash-outline", text: "More energy, less afternoon fatigue" },
  { icon: "bulb-outline", text: "Sharper focus" },
  { icon: "flame-outline", text: "Supports metabolism" },
  { icon: "sparkles-outline", text: "Healthier skin and joints" },
];

const getPlant = (ratio) => {
  if (ratio >= 1)
    return {
      emoji: "🌳",
      label: "Fully hydrated! Your plant is thriving 🎉",
      color: colors.green,
    };
  if (ratio >= 0.66)
    return {
      emoji: "🪴",
      label: "Almost there — keep sipping!",
      color: colors.green,
    };
  if (ratio > 0)
    return {
      emoji: "🌱",
      label: "Good start! Your plant is growing.",
      color: "#F59E0B",
    };
  return {
    emoji: "🥀",
    label: "Thirsty! Let's drink some water.",
    color: "#EF4444",
  };
};

// Animated card wrapper — fades + slides in with a stagger delay.
function AnimCard({ delay = 0, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Water tab of the Water & Periods screen (app/profile/water.js).
 * Formerly a full-screen modal; the header, back button and banner now belong
 * to the screen that hosts both tabs.
 */
export default function WaterPanel({ visible = true }) {
  const { user } = useUser();
  const goal = calculateWaterGoal(user?.weight, user?.height);

  const [enabled, setEnabled] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const plantScale = useRef(new Animated.Value(1)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;

  const ratio = goal.glasses > 0 ? Math.min(consumed / goal.glasses, 1) : 0;
  const percent = Math.round(ratio * 100);
  const plant = getPlant(ratio);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      try {
        const [on, glasses] = await Promise.all([
          isWaterTrackingEnabled(),
          getConsumedGlasses(),
        ]);
        if (!active) return;
        setEnabled(on);
        setConsumed(glasses);
      } catch (e) {
        Logger.log("[Water] load failed:", String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  // A glass can be logged from the notification's action button while the app
  // is backgrounded — re-read the count when the user returns to the foreground.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        getConsumedGlasses()
          .then(setConsumed)
          .catch((e) => Logger.log("[Water] refresh failed:", String(e)));
      }
    });
    return () => sub.remove();
  }, [visible]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: percent,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const popPlant = () => {
    plantScale.setValue(0.75);
    Animated.spring(plantScale, {
      toValue: 1,
      friction: 4,
      tension: 130,
      useNativeDriver: true,
    }).start();
  };

  const pulsBtn = () => {
    Animated.sequence([
      Animated.timing(btnPulse, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(btnPulse, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleStart = async () => {
    setLoading(true);
    const res = await startWaterTracking(goal.glasses, user?.name);
    setLoading(false);
    if (res.ok) {
      setEnabled(true);
      Toast.success("Water reminders turned on 💧", "top");
    } else if (res.reason === "permission") {
      Alert.alert(
        "Enable notifications",
        "Allow notifications so we can remind you to drink water throughout the day.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleStop = async () => {
    setLoading(true);
    await stopWaterTracking();
    setLoading(false);
    setEnabled(false);
    Toast.info("Water reminders turned off.", "top");
  };

  const handleAddGlass = async () => {
    pulsBtn();
    const next = await logGlass(goal.glasses);
    setConsumed(next);
    popPlant();
    if (next >= goal.glasses) {
      Toast.success("Goal reached! Amazing 🎉", "top");
    }
  };

  const handleRemoveGlass = async () => {
    const next = await removeGlass();
    setConsumed(next);
  };

  // Two cards and a quiet link: today's progress (with the one action) and a
  // reminders switch. The explainer opens on tap.
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Today ── */}
      <AnimCard delay={60} style={styles.card}>
        <View style={styles.todayTop}>
          <Animated.Text style={[styles.plant, { transform: [{ scale: plantScale }] }]}>
            {plant.emoji}
          </Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.todayTitle}>
              {consumed} of {goal.glasses} glasses
            </Text>
            <Text style={styles.todaySub}>
              {fmt(consumed * WATER_GLASS_ML)} / {fmt(goal.ml)} ml today
            </Text>
          </View>
          <Text style={styles.todayPercent}>{percent}%</Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.logRow}>
          <TouchableOpacity
            style={styles.minusBtn}
            onPress={handleRemoveGlass}
            activeOpacity={0.85}
            accessibilityLabel="Remove a glass"
          >
            <Ionicons name="remove" size={ms(20)} color={colors.text} />
          </TouchableOpacity>

          <Animated.View style={{ flex: 1, transform: [{ scale: btnPulse }] }}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddGlass}
              activeOpacity={0.9}
            >
              <Ionicons name="water" size={ms(18)} color="#FFFFFF" />
              <Text style={styles.addBtnText}>I drank a glass</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </AnimCard>

      {/* ── Reminders: one row, one switch ── */}
      <AnimCard delay={120} style={[styles.card, styles.reminderRow]}>
        <View style={styles.reminderIcon}>
          <Ionicons
            name={enabled ? "notifications" : "notifications-outline"}
            size={ms(17)}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderTitle}>Drink reminders</Text>
          <Text style={styles.reminderSub}>
            {enabled ? "Every ~1.5 hrs, 8 AM–10 PM" : "Off"}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={(on) => (on ? handleStart() : handleStop())}
            trackColor={{ true: colors.primary + "88", false: "#E5E7EB" }}
            thumbColor={enabled ? colors.primary : "#FFFFFF"}
            accessibilityLabel="Drink reminders"
          />
        )}
      </AnimCard>

      {/* ── Why it matters: a quiet link, details on tap ── */}
      <TouchableOpacity
        style={styles.whyHead}
        activeOpacity={0.7}
        onPress={() => setWhyOpen((v) => !v)}
        hitSlop={6}
      >
        <Ionicons name="information-circle-outline" size={ms(16)} color={colors.textLight} />
        <Text style={styles.whyTitle}>Why hydration matters</Text>
        <Ionicons
          name={whyOpen ? "chevron-up" : "chevron-down"}
          size={ms(15)}
          color={colors.textLight}
        />
      </TouchableOpacity>
      {whyOpen ? (
        <View style={styles.whyBody}>
          <Text style={styles.whyNote}>
            Your goal is based on your weight ({user?.weight || "—"} kg).
          </Text>
          {IMPORTANCE.map((item) => (
            <View key={item.icon} style={styles.impRow}>
              <View style={styles.impIcon}>
                <Ionicons name={item.icon} size={ms(15)} color={colors.primary} />
              </View>
              <Text style={styles.impText}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: ms(16), paddingBottom: ms(24), gap: ms(12) },

  // Flat white cards with a hairline border (no tinted shadows).
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    padding: ms(16),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  // ── Today ──
  todayTop: { flexDirection: "row", alignItems: "center", gap: ms(12), marginBottom: ms(12) },
  plant: { fontSize: ms(38) },
  todayTitle: { fontFamily: "OpenSans_700Bold", fontSize: ms(18), color: colors.text },
  todaySub: { fontFamily: "OpenSans_500Medium", fontSize: ms(12), color: colors.textLight, marginTop: 1 },
  todayPercent: { fontFamily: "OpenSans_700Bold", fontSize: ms(15), color: colors.primary },
  progressTrack: {
    height: ms(10),
    backgroundColor: "#F1EDEA",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: ms(999) },
  logRow: { flexDirection: "row", alignItems: "center", gap: ms(10), marginTop: ms(14) },
  minusBtn: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(14),
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    height: ms(48),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
  },
  addBtnText: { fontFamily: "OpenSans_700Bold", fontSize: ms(14), color: "#FFFFFF" },

  // ── Reminders ──
  reminderRow: { flexDirection: "row", alignItems: "center", gap: ms(12), paddingVertical: ms(12) },
  reminderIcon: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: "#FFF1EA",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(14), color: colors.text },
  reminderSub: { fontFamily: "OpenSans_400Regular", fontSize: ms(12), color: colors.textLight, marginTop: 1 },

  // ── Why it matters ──
  whyHead: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: ms(6),
    paddingVertical: ms(6),
    paddingHorizontal: ms(8),
  },
  whyTitle: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(12.5), color: colors.textLight },
  whyBody: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    padding: ms(14),
    gap: ms(10),
  },
  whyNote: { fontFamily: "OpenSans_500Medium", fontSize: ms(12), color: colors.textLight },
  impRow: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  impIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  impText: { flex: 1, fontFamily: "OpenSans_500Medium", fontSize: ms(12.5), color: colors.text },
});

