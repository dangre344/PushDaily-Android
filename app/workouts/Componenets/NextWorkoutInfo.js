import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";

export default function NextWorkoutInfo({
  workouts,
  index,
  setLoadingPage,
  setIndex,
  setWorkoutCompletedCount,
}) {
  const [showSteps, setShowSteps] = useState(false);

  const [timeLeft, setTimeLeft] = useState(30); // Initial 30 seconds
  const [isTimerActive, setIsTimerActive] = useState(true);
  const timerRef = useRef(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const timeAddedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startTimer();

    startPulseAnimation();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = () => {
    setIsTimerActive(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          setIsTimerActive(false);
          playTimerCompleteAnimation();

          setLoadingPage("play_workout");
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  const playButtonPressAnimation = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const playTimeAddedAnimation = () => {
    timeAddedAnim.setValue(0);
    Animated.timing(timeAddedAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      timeAddedAnim.setValue(0);
    });
  };

  const playTimerCompleteAnimation = () => {
    // Reset pulse animation
    pulseAnim.setValue(1);

    // Vibrate animation for timer completion
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const addTime = (seconds) => {
    if (!isTimerActive) {
      startTimer();
    }

    playButtonPressAnimation();
    playTimeAddedAnimation();

    setTimeLeft((prevTime) => prevTime + seconds);

    // Add visual feedback for the added time
    setTimeout(() => {
      // Animation for time addition is handled by playTimeAddedAnimation
    }, 100);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(30);
    setIsTimerActive(true);
    startTimer();
  };

  return (
    <View>
      <View style={styles.imageCard}>
        <Image
          source={workouts.workoutList[index].photo}
          style={styles.exerciseImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.exerciseInfo}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={styles.sectionTitle}
          >{`${workouts.workoutList[index].name} X ${workouts.workoutList[index].reps ? workouts.workoutList[index].reps : workouts.workoutList[index].time}`}</Text>
          {/* <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.statText}>{workout.time}</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="flame-outline" size={20} color={colors.primary} />
                <Text style={styles.statText}>{workout.calories} kcal</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons
                  name="barbell-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.statText}>6-12 reps</Text>
              </View>
            </View> */}
        </View>

        <View style={styles.muscleFocus}>
          <View style={styles.muscleTags}>
            {workouts.workoutList[index].focus.map((muscle, i) => (
              <View key={i} style={styles.muscleTag}>
                <Text style={styles.muscleTagText}>{muscle}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.timerSection}>
          <Text style={styles.timerTitle}>Next Set Starts In</Text>
          <Animated.View
            style={[
              styles.timerContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text
              style={[
                styles.timer,
                timeLeft <= 10 && styles.timerWarning,
                timeLeft === 0 && styles.timerComplete,
              ]}
            >
              {formatTime(timeLeft)}
            </Text>

            <Animated.Text
              style={[
                styles.timeAddedFeedback,
                {
                  opacity: timeAddedAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: timeAddedAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20],
                      }),
                    },
                  ],
                },
              ]}
            >
              + Time Added!
            </Animated.Text>
          </Animated.View>

          <View style={styles.timeButtons}>
            {[20, 30, 45].map((seconds) => (
              <Animated.View
                key={seconds}
                style={{
                  transform: [{ scale: buttonScaleAnim }],
                }}
              >
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => addTime(seconds)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeButtonText}>+{seconds}s</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* <Text style={styles.exerciseDescription}>{workout.description}</Text> */}

        <TouchableOpacity
          style={styles.stepsToggle}
          onPress={() => setShowSteps(!showSteps)}
        >
          <View style={styles.stepsToggleHeader}>
            <Text style={styles.stepsToggleText}>
              {showSteps ? "Hide" : "Show"} Steps & Video
            </Text>
            <Ionicons
              name={showSteps ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.primary}
            />
          </View>
        </TouchableOpacity>

        {showSteps && (
          <View style={styles.stepsContainer}>
            {workouts.workoutList[index].steps.map((step, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <TouchableOpacity style={styles.videoButton}>
              <Ionicons name="play-circle" size={24} color={colors.primary} />
              <Text style={styles.videoButtonText}>
                Watch Video Demonstration
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.textLight,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: colors.textLight,
  },

  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
  },

  headerCenter: {
    alignItems: "center",
  },

  headerTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 18,
    color: colors.secondary,
  },

  headerSubtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 12,
    color: "#718096",
    marginTop: 2,
  },

  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  skipText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 14,
    color: colors.secondary,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    marginTop: 5,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 14,
    color: colors.secondary,
  },

  progressDots: {
    flexDirection: "row",
  },

  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 3,
  },

  progressDotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },

  progressDotCompleted: {
    backgroundColor: "#48BB78",
  },

  progressBar: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  // Image Card
  imageCard: {
    height: scaling().scaleHeight(200),
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    overflow: "hidden",
  },

  exerciseImage: {
    width: "100%",
    height: "100%",
  },

  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    padding: 16,
    justifyContent: "flex-end",
  },

  imageBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  imageBadgeText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // Exercise Info
  exerciseInfo: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
  },

  exerciseName: {
    fontFamily: "opensans_700bold",
    fontSize: 18,
    color: colors.text,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  statItem: {
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 53, 0.08)",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    marginEnd: 10,
  },

  statText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 12,
    color: colors.secondary,
    marginTop: 5,
  },

  exerciseDescription: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 12,

    color: "#4A5568",
    marginBottom: 15,
  },

  // Muscle Focus
  muscleFocus: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(16),
    color: colors.text,
    marginBottom: 5,
  },

  muscleTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  muscleTag: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  muscleTagText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 10,
    color: colors.primary,
  },

  // Steps
  stepsToggle: {
    marginBottom: 20,
    marginTop: 10,
  },

  stepsToggleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  stepsToggleText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 16,
    color: colors.primary,
  },

  stepsContainer: {
    marginBottom: 25,
  },

  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },

  stepNumberText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  stepText: {
    flex: 1,
    fontFamily: "OpenSans_400Regular",
    fontSize: 16,
    color: "#4A5568",
    lineHeight: 24,
  },

  videoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },

  videoButtonText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 16,
    color: colors.primary,
  },

  // Timer
  timerSection: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 25,
    borderRadius: 20,
    marginTop: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  timeButtons: {
    flexDirection: "row",
    gap: 12,
  },

  timeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F7FAFC",
  },

  timeButtonText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 14,
    color: colors.white,
  },

  // Footer Navigation
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.textLight,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
    minWidth: 140,
    justifyContent: "center",
    gap: 8,
  },

  prevButton: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },

  nextButton: {
    backgroundColor: colors.primary,
  },

  disabledButton: {
    opacity: 0.5,
  },

  navButtonText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 16,
    color: colors.secondary,
  },

  nextButtonText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },

  disabledButtonText: {
    color: "#CBD5E1",
  },

  timerTitle: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },

  timerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },

  timer: {
    fontSize: 40,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    textAlign: "center",
  },

  timerWarning: {
    color: "#FF6B35", // Orange color for warning
  },

  timerComplete: {
    color: "#4CAF50", // Green color for complete
  },

  timeAddedFeedback: {
    position: "absolute",
    top: -10,
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
  },

  timeButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },

  timeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 12,
  },

  resetButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  timerStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusActive: {
    backgroundColor: "#4CAF50",
  },

  statusPaused: {
    backgroundColor: "#FF6B35",
  },

  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
