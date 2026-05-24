import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
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

export const BADGE_ORDER = {
  Rabbit: 1,
  Wolf: 2,
  Tiger: 3,
  Rhino: 4,
};

export const BADGE_DETAILS = {
  Rabbit: {
    title: "Rabbit",
    subtitle: "Getting Started",
    emoji: "🐰",
  },
  Wolf: {
    title: "Wolf",
    subtitle: "Consistent",
    emoji: "🐺",
  },
  Tiger: {
    title: "Tiger",
    subtitle: "Strong",
    emoji: "🐯",
  },
  Rhino: {
    title: "Rhino",
    subtitle: "Strongest",
    emoji: "🦏",
  },
};

export const BADGE_LEVELS = [
  {
    title: "Rabbit",
    subtitle: "Getting Started",
    range: "0–9 points",
    emoji: "🐰",
    description:
      "You have started your fitness journey. Keep completing workouts to level up.",
  },
  {
    title: "Wolf",
    subtitle: "Consistent",
    range: "10–24 points",
    emoji: "🐺",
    description:
      "You are building consistency and showing regular workout effort.",
  },
  {
    title: "Tiger",
    subtitle: "Strong",
    range: "25–49 points",
    emoji: "🐯",
    description:
      "You are getting stronger and completing workouts with good consistency.",
  },
  {
    title: "Rhino",
    subtitle: "Strongest",
    range: "50+ points",
    emoji: "🦏",
    description:
      "You have reached the strongest badge level through high workout effort.",
  },
];

export const LEVEL_WEIGHTS = [
  {
    level: "Beginner",
    points: 1,
    description: "Each beginner workout gives 1 point.",
  },
  {
    level: "Intermediate",
    points: 2,
    description: "Each intermediate workout gives 2 points.",
  },
  {
    level: "Advanced",
    points: 3,
    description: "Each advanced workout gives 3 points.",
  },
];

export const getNextBadgeProgress = (score = 0) => {
  if (score >= 50) {
    return {
      currentMin: 50,
      nextMin: 50,
      nextTitle: "Max Level",
      progress: 1,
      progressText: "You unlocked the strongest badge!",
      remainingPoints: 0,
    };
  }

  if (score >= 25) {
    return {
      currentMin: 25,
      nextMin: 50,
      nextTitle: "Rhino",
      progress: (score - 25) / (50 - 25),
      progressText: `${score} / 50 points to Rhino`,
      remainingPoints: 50 - score,
    };
  }

  if (score >= 10) {
    return {
      currentMin: 10,
      nextMin: 25,
      nextTitle: "Tiger",
      progress: (score - 10) / (25 - 10),
      progressText: `${score} / 25 points to Tiger`,
      remainingPoints: 25 - score,
    };
  }

  return {
    currentMin: 0,
    nextMin: 10,
    nextTitle: "Wolf",
    progress: score / 10,
    progressText: `${score} / 10 points to Wolf`,
    remainingPoints: 10 - score,
  };
};

export const LEVEL_POINTS = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
};

export const getUserBadge = (performedWorkouts = []) => {
  const score = performedWorkouts.reduce((total, workout) => {
    return total + (LEVEL_POINTS[workout.level] || 0);
  }, 0);

  if (score >= 50) {
    return {
      title: "Rhino",
      subtitle: "Strongest",
      score,
      emoji: "🦏",
    };
  }

  if (score >= 25) {
    return {
      title: "Tiger",
      subtitle: "Strong",
      score,
      emoji: "🐯",
      // image: require("../assets/badges/tiger.png"),
    };
  }

  if (score >= 10) {
    return {
      title: "Wolf",
      subtitle: "Consistent",
      score,
      emoji: "🐺",
      // image: require("../assets/badges/wolf.png"),
    };
  }

  return {
    title: "Rabbit",
    subtitle: "Getting Started",
    score,
    emoji: "🐰",
    // image: require("../assets/badges/rabbit.png"),
  };
};

import { useEffect } from "react";
import { Logger } from "../../constants/Logger.js";

export default function WorkoutBadgeInfo({ userBadge, visible, setVisible }) {
  Logger.log(
    "Rendering WorkoutBadgeInfo. User badge:",
    userBadge,
    "Visible:",
    visible,
  );
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const badgeProgress = getNextBadgeProgress(userBadge?.score || 0);
  const progressPercent = Math.min(badgeProgress.progress * 100, 100);

  useEffect(() => {
    if (visible) {
      Logger.log("WorkoutBadgeInfo is visible.");
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.85);

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
      ]).start();
    }
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
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent}%`,
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
                level. Your total points decide your badge level.
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

  modalScrollContent: {
    paddingBottom: 8,
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
