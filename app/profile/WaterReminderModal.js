import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "toastify-react-native";
import { AD_UNIT_IDS } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import {
  sayOncePerSession,
  waterNudge,
} from "../../constants/bubbleMessage";
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
  { icon: "flash-outline", text: "Boosts energy and beats afternoon fatigue." },
  { icon: "bulb-outline", text: "Sharpens focus and concentration." },
  { icon: "flame-outline", text: "Supports metabolism and fat burning." },
  { icon: "sparkles-outline", text: "Keeps skin clear and joints healthy." },
];

const getPlant = (ratio) => {
  if (ratio >= 1)
    return { emoji: "🌳", label: "Fully hydrated! Your plant is thriving 🎉", color: colors.green };
  if (ratio >= 0.66)
    return { emoji: "🪴", label: "Almost there — keep sipping!", color: colors.green };
  if (ratio > 0)
    return { emoji: "🌱", label: "Good start! Your plant is growing.", color: "#F59E0B" };
  return { emoji: "🥀", label: "Thirsty! Let's drink some water.", color: "#EF4444" };
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

export default function WaterReminderModal({ visible, setVisible }) {
  const { user } = useUser();
  const goal = calculateWaterGoal(user?.weight, user?.height);

  const [enabled, setEnabled] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [loading, setLoading] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const plantScale = useRef(new Animated.Value(1)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;

  const ratio = goal.glasses > 0 ? Math.min(consumed / goal.glasses, 1) : 0;
  const percent = Math.round(ratio * 100);
  const plant = getPlant(ratio);

  // Explain why hydration matters — once per app session.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => sayOncePerSession("water", waterNudge()), 700);
    return () => clearTimeout(t);
  }, [visible]);

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
    return () => { active = false; };
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
      Animated.timing(btnPulse, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(btnPulse, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start();
  };

  const handleStart = async () => {
    setLoading(true);
    const res = await startWaterTracking(goal.glasses);
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setVisible(false)}
            style={styles.closeBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Water Reminder</Text>
            <Text style={styles.headerSubtitle}>Stay hydrated, stay strong</Text>
          </View>
          <View style={styles.dropWrap}>
            <Ionicons name="water" size={ms(20)} color={colors.primary} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Why hydration matters */}
          <AnimCard delay={60} style={styles.card}>
            <Text style={styles.cardTitle}>Why hydration matters</Text>
            <Text style={styles.cardLead}>
              Even mild dehydration drains your energy and focus. Drinking
              enough water every day helps your body perform and recover better.
            </Text>
            {IMPORTANCE.map((item) => (
              <View key={item.icon} style={styles.impRow}>
                <View style={styles.impIcon}>
                  <Ionicons name={item.icon} size={ms(15)} color={colors.primary} />
                </View>
                <Text style={styles.impText}>{item.text}</Text>
              </View>
            ))}
          </AnimCard>

          {/* Daily goal */}
          <AnimCard delay={140} style={[styles.card, styles.goalCard]}>
            <Text style={styles.goalLabel}>Your daily water goal</Text>
            <Text style={styles.goalValue}>{fmt(goal.ml)} ml</Text>
            <Text style={styles.goalGlasses}>
              ≈ {goal.glasses} glasses ({WATER_GLASS_ML} ml each)
            </Text>
            <Text style={styles.goalNote}>
              Based on your weight ({user?.weight || "—"} kg) and height ({user?.height || "—"} cm).
            </Text>
          </AnimCard>

          {/* Plant + progress */}
          <AnimCard delay={220} style={styles.card}>
            <Animated.Text style={[styles.plant, { transform: [{ scale: plantScale }] }]}>
              {plant.emoji}
            </Animated.Text>
            <Text style={[styles.plantLabel, { color: plant.color }]}>
              {plant.label}
            </Text>

            <View style={styles.progressHeader}>
              <Text style={styles.progressGlasses}>
                {consumed} / {goal.glasses} glasses
              </Text>
              <Text style={styles.progressPercent}>{percent}%</Text>
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

            {/* "I drank a glass" is always visible — tracking just enables reminders */}
            <View style={styles.logRow}>
              <TouchableOpacity
                style={styles.minusBtn}
                onPress={handleRemoveGlass}
                activeOpacity={0.85}
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

          {/* Start / Stop */}
          <AnimCard delay={300}>
            {!enabled ? (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStart}
                activeOpacity={0.9}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="notifications" size={ms(18)} color="#FFFFFF" />
                    <Text style={styles.startBtnText}>Start Tracking Water</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.trackingPill}>
                  <Ionicons name="checkmark-circle" size={ms(16)} color={colors.green} />
                  <Text style={styles.trackingText}>
                    Reminders on — every ~1.5 hrs, 8 AM to 10 PM
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={handleStop}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="stop-circle" size={ms(18)} color="#EF4444" />
                      <Text style={styles.stopBtnText}>Stop Tracking</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </AnimCard>
        </ScrollView>

        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdFailedToLoad={(e) => Logger.log("[AdMob] Banner failed:", String(e))}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8F5" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(12),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0E6E0",
  },
  closeBtn: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: "#FFF0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
  },
  headerSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(2),
  },
  dropWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  scrollContent: { padding: ms(16), paddingBottom: ms(24) },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    padding: ms(18),
    marginBottom: ms(14),
    borderWidth: 1,
    borderColor: "#F0E6E0",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
    marginBottom: ms(6),
  },
  cardLead: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(12),
    color: colors.textLight,
    lineHeight: ms(18),
    marginBottom: ms(12),
  },
  impRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginBottom: ms(10),
  },
  impIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  impText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12.5),
    color: colors.text,
  },

  goalCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    alignItems: "center",
  },
  goalLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.85)",
  },
  goalValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(34),
    color: "#FFFFFF",
    marginTop: ms(4),
  },
  goalGlasses: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: "#FFFFFF",
    marginTop: ms(2),
  },
  goalNote: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: "rgba(255,255,255,0.8)",
    marginTop: ms(8),
    textAlign: "center",
  },

  plant: { fontSize: ms(64), textAlign: "center" },
  plantLabel: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    textAlign: "center",
    marginTop: ms(6),
    marginBottom: ms(16),
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: ms(8),
  },
  progressGlasses: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: colors.text,
  },
  progressPercent: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: colors.primary,
  },
  progressTrack: {
    height: ms(12),
    backgroundColor: "#F0E6E0",
    borderRadius: ms(999),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: ms(999),
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginTop: ms(16),
  },
  minusBtn: {
    width: ms(50),
    height: ms(50),
    borderRadius: ms(15),
    backgroundColor: "#FFF0EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0E6E0",
  },
  addBtn: {
    height: ms(50),
    borderRadius: ms(15),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },

  startBtn: {
    height: ms(54),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  startBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: "#FFFFFF",
  },
  trackingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    backgroundColor: colors.green + "14",
    borderRadius: ms(14),
    paddingHorizontal: ms(14),
    paddingVertical: ms(12),
    marginBottom: ms(10),
  },
  trackingText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.text,
  },
  stopBtn: {
    height: ms(50),
    borderRadius: ms(16),
    backgroundColor: "#FEECEC",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
  },
  stopBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#EF4444",
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: ms(52),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0E6E0",
  },
});
