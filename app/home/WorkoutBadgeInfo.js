import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../constants/colors.js";
import { Logger } from "../../constants/Logger.js";

// ─── Ordered list — used anywhere a "next tier" lookup is needed ────────────
export const BADGE_ORDER = {
  Rabbit: 1,
  Fox: 2,
  Wolf: 3,
  Leopard: 4,
  Tiger: 5,
  Lion: 6,
  Rhino: 7,
  Dragon: 8,
};

export const BADGE_DETAILS = {
  Rabbit: { title: "Rabbit", subtitle: "Getting Started", emoji: "🐰" },
  Fox: { title: "Fox", subtitle: "Building Habit", emoji: "🦊" },
  Wolf: { title: "Wolf", subtitle: "Consistent", emoji: "🐺" },
  Leopard: { title: "Leopard", subtitle: "Athletic", emoji: "🐆" },
  Tiger: { title: "Tiger", subtitle: "Powerful", emoji: "🐯" },
  Lion: { title: "Lion", subtitle: "Dominant", emoji: "🦁" },
  Rhino: { title: "Rhino", subtitle: "Unstoppable", emoji: "🦏" },
  Dragon: { title: "Dragon", subtitle: "Legendary", emoji: "🐉" },
};

// ─── Tier thresholds — single source of truth ───────────────────────────────
// Change values here and the entire badge system updates.
const BADGE_TIERS = [
  {
    title: "Rabbit",
    subtitle: "Getting Started",
    emoji: "🐰",
    min: 0,
    max: 24,
    description:
      "You have started your fitness journey. Keep going to level up.",
  },
  {
    title: "Fox",
    subtitle: "Building Habit",
    emoji: "🦊",
    min: 25,
    max: 74,
    description:
      "You are building a habit and getting into a rhythm with regular workouts.",
  },
  {
    title: "Wolf",
    subtitle: "Consistent",
    emoji: "🐺",
    min: 75,
    max: 149,
    description:
      "Pack-level consistency. You are showing up regularly and putting in work.",
  },
  {
    title: "Leopard",
    subtitle: "Athletic",
    emoji: "🐆",
    min: 150,
    max: 249,
    description:
      "Your speed and strength are growing. You are becoming athletic.",
  },
  {
    title: "Tiger",
    subtitle: "Powerful",
    emoji: "🐯",
    min: 250,
    max: 399,
    description:
      "Powerful and disciplined. You are completing serious training volume.",
  },
  {
    title: "Lion",
    subtitle: "Dominant",
    emoji: "🦁",
    min: 400,
    max: 599,
    description: "You dominate your training. Your dedication is exceptional.",
  },
  {
    title: "Rhino",
    subtitle: "Unstoppable",
    emoji: "🦏",
    min: 600,
    max: 849,
    description: "Unstoppable force. Few reach this level of consistency.",
  },
  {
    title: "Dragon",
    subtitle: "Legendary",
    emoji: "🐉",
    min: 850,
    max: Infinity,
    description:
      "You have reached legendary status. The strongest badge in the system.",
  },
];

// Used by the modal to render the full list of levels
export const BADGE_LEVELS = BADGE_TIERS.map((t) => ({
  title: t.title,
  subtitle: t.subtitle,
  emoji: t.emoji,
  range: t.max === Infinity ? `${t.min}+ points` : `${t.min}–${t.max} points`,
  description: t.description,
}));

// ─── Point weights per workout level ────────────────────────────────────────
export const LEVEL_POINTS = {
  Beginner: 2,
  Intermediate: 5,
  Advanced: 10,
};

export const LEVEL_WEIGHTS = [
  {
    level: "Beginner",
    points: 2,
    description: "Each beginner workout gives 2 points.",
  },
  {
    level: "Intermediate",
    points: 5,
    description: "Each intermediate workout gives 5 points.",
  },
  {
    level: "Advanced",
    points: 10,
    description: "Each advanced workout gives 10 points.",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

// Normalizes a stored level string to a canonical LEVEL_POINTS key.
// Workout rows can drift in casing / whitespace ("beginner", " Advanced ");
// a strict `LEVEL_POINTS[workout.level]` lookup would silently return
// undefined → 0 points, which is why the badge progress appeared frozen.
const normalizeLevel = (level) => {
  const key = String(level ?? "")
    .trim()
    .toLowerCase();
  if (key === "beginner") return "Beginner";
  if (key === "intermediate") return "Intermediate";
  if (key === "advanced") return "Advanced";
  return null;
};

// Points earned for a single workout level (0 if unrecognised).
export const getPointsForLevel = (level) => {
  const canonical = normalizeLevel(level);
  return canonical ? LEVEL_POINTS[canonical] : 0;
};

// Total points across a list of performed workout rows.
export const getTotalPoints = (performedWorkouts = []) =>
  performedWorkouts.reduce(
    (total, workout) => total + getPointsForLevel(workout?.level),
    0,
  );

const findTier = (score) =>
  BADGE_TIERS.find((t) => score >= t.min && score <= t.max) ?? BADGE_TIERS[0];

export const getUserBadge = (performedWorkouts = []) => {
  const score = getTotalPoints(performedWorkouts);

  const tier = findTier(score);
  return {
    title: tier.title,
    subtitle: tier.subtitle,
    emoji: tier.emoji,
    score,
  };
};

export const getNextBadgeProgress = (score = 0) => {
  const currentTier = findTier(score);
  const currentIndex = BADGE_TIERS.indexOf(currentTier);
  const nextTier = BADGE_TIERS[currentIndex + 1];

  // Max tier reached
  if (!nextTier) {
    return {
      currentMin: currentTier.min,
      nextMin: currentTier.min,
      nextTitle: "Max Level",
      progress: 1,
      progressText: `You unlocked ${currentTier.title}, the strongest badge!`,
      remainingPoints: 0,
    };
  }

  const span = nextTier.min - currentTier.min;
  const progress = span > 0 ? (score - currentTier.min) / span : 0;

  return {
    currentMin: currentTier.min,
    nextMin: nextTier.min,
    nextTitle: nextTier.title,
    progress: Math.max(0, Math.min(progress, 1)),
    progressText: `${score} / ${nextTier.min} points to ${nextTier.title}`,
    remainingPoints: Math.max(nextTier.min - score, 0),
  };
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function WorkoutBadgeInfo({ userBadge, visible, setVisible }) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const badgeProgress = getNextBadgeProgress(userBadge?.score || 0);
  const progressPercent = Math.min(badgeProgress.progress * 100, 100);

  // Capture the progress value at open-time so the bar animates to the correct
  // target without re-running the effect every time the parent refreshes data.
  const progressPercentRef = useRef(progressPercent);

  useEffect(() => {
    if (visible) {
      // Snapshot the current progress so closing/reopening always reflects
      // the latest score while mid-session re-renders don't restart the anim.
      progressPercentRef.current = progressPercent;

      opacityAnim.setValue(0);
      scaleAnim.setValue(0.85);
      progressAnim.setValue(0);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: progressPercentRef.current,
          duration: 900,
          delay: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
    // ⚠️ Intentionally omitting progressPercent from deps — we only want to
    // animate when the modal opens, not on every parent data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Workout Badge System</Text>
              <Text style={styles.modalSubtitle}>
                Complete workouts to earn points and unlock stronger badges.
                There are 8 tiers — can you reach Dragon?
              </Text>
            </View>

            <TouchableOpacity
              onPress={closeModal}
              style={styles.closeButton}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
            nestedScrollEnabled
          >
            <View style={styles.currentBadgeCard}>
              {userBadge?.image ? (
                <Image source={userBadge.image} style={styles.currentImage} />
              ) : (
                <Text style={styles.currentEmoji}>
                  {userBadge?.emoji || "🏅"}
                </Text>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.currentTitle}>
                  Your current badge: {userBadge?.title || "Rabbit"}
                </Text>
                <Text style={styles.currentSubtitle}>
                  {userBadge?.subtitle || "Getting Started"}
                  {userBadge?.score !== undefined
                    ? ` • ${userBadge.score} points`
                    : ""}
                </Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.progressTitle}>Next Badge Progress</Text>
                  <Text style={styles.progressSubtitle}>
                    {badgeProgress.progressText}
                  </Text>
                </View>

                <View style={styles.progressPercentPill}>
                  <Text style={styles.progressPercentText}>
                    {Math.round(progressPercent)}%
                  </Text>
                </View>
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

              {badgeProgress.remainingPoints > 0 ? (
                <Text style={styles.remainingText}>
                  Complete more workouts to earn {badgeProgress.remainingPoints}{" "}
                  more point{badgeProgress.remainingPoints > 1 ? "s" : ""} and
                  unlock {badgeProgress.nextTitle}.
                </Text>
              ) : (
                <Text style={styles.remainingText}>
                  You reached the highest badge level. Keep going to maintain
                  your streak!
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Badge levels</Text>

            {BADGE_LEVELS.map((item) => {
              const isCurrent = userBadge?.title === item.title;

              return (
                <View
                  key={item.title}
                  style={[
                    styles.levelCard,
                    isCurrent && styles.activeLevelCard,
                  ]}
                >
                  <View style={styles.levelEmojiWrap}>
                    <Text style={styles.levelEmoji}>{item.emoji}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.levelTitleRow}>
                      <Text style={styles.levelTitle}>{item.title}</Text>

                      {isCurrent && (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentPillText}>Current</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.levelSubtitle}>
                      {item.subtitle} • {item.range}
                    </Text>

                    <Text style={styles.levelDescription}>
                      {item.description}
                    </Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.sectionTitle}>How points work</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Every completed workout gives points based on its difficulty
                level. Harder workouts earn more points — push your level up to
                unlock badges faster.
              </Text>
            </View>

            {LEVEL_WEIGHTS.map((item) => (
              <View key={item.level} style={styles.weightRow}>
                <View style={styles.weightIcon}>
                  <AntDesign name="star" size={15} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.weightTitle}>
                    {item.level} = {item.points} point
                    {item.points > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.weightDesc}>{item.description}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.okButton}
              onPress={closeModal}
            >
              <Text style={styles.okButtonText}>Got it</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  modalCard: {
    width: "100%",
    maxHeight: "84%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 10,
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalScrollContent: {
    paddingBottom: 8,
  },

  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flex: 1,
  },

  badgeImage: {
    width: 46,
    height: 46,
    resizeMode: "contain",
  },

  badgeEmojiWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeEmoji: {
    fontSize: 25,
  },

  badgeTextBox: {
    flex: 1,
    marginStart: 12,
  },

  badgeTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 15,
    color: colors.text,
  },

  badgeSubtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  miniProgressContainer: {
    marginTop: 8,
  },

  miniProgressTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden",
  },

  miniProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 10,
  },

  miniProgressText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 10,
    color: "#64748B",
    marginTop: 4,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  modalTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 20,
    color: colors.text,
  },

  modalSubtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 280,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginStart: 10,
  },

  currentBadgeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "12",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  currentEmoji: {
    fontSize: 36,
    marginEnd: 12,
  },

  currentImage: {
    width: 48,
    height: 48,
    resizeMode: "contain",
    marginEnd: 12,
  },

  currentTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 15,
    color: colors.text,
  },

  currentSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 12,
    color: colors.primary,
    marginTop: 3,
  },

  progressCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  progressTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 15,
    color: colors.text,
  },

  progressSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  progressPercentPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginStart: 10,
  },

  progressPercentText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 11,
    color: "#FFFFFF",
  },

  progressTrack: {
    height: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 20,
  },

  remainingText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    marginTop: 10,
  },

  sectionTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 16,
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },

  infoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  infoText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },

  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  weightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 10,
  },

  weightTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 13,
    color: colors.text,
  },

  weightDesc: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  levelCard: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  activeLevelCard: {
    backgroundColor: colors.primary + "10",
    borderColor: colors.primary,
  },

  levelEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 12,
  },

  levelEmoji: {
    fontSize: 25,
  },

  levelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  levelTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 14,
    color: colors.text,
  },

  levelSubtitle: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },

  levelDescription: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 11,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 4,
  },

  currentPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginStart: 8,
  },

  currentPillText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 9,
    color: "#FFFFFF",
  },

  okButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  okButtonText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
