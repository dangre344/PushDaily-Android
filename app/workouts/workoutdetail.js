import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import CongratsScreen from "./Componenets/CongratsScreen";
import CurrentWorkout from "./Componenets/CurrentWorkout";
import NextWorkoutInfo from "./Componenets/NextWorkoutInfo";

export default function WorkoutDetail() {
  const { id, name, level } = useLocalSearchParams();
  const router = useRouter();
  const [quitModalVisible, setQuitModalVisible] = useState(false);
  const { user } = useUser();

  const bodyPartObj = { id: Number(id), name, level };

  const workoutsListForBodyPart = workoutListGlobal.find(
    (item) =>
      Number(item.workoutId) === Number(bodyPartObj.id) &&
      item.bodyPart === bodyPartObj.name &&
      item.level === bodyPartObj.level,
  );

  const workouts = workoutsListForBodyPart;
  const totalCount = workouts?.workoutList?.length || 0;

  const [index, setIndex] = useState(0);

  // FIX: Track completed exercises by their LIST INDEX (a Set of numbers).
  // Object-identity comparison (item.id) breaks because workout objects
  // often have no id field — undefined === undefined always passes the filter,
  // so nothing ever gets removed. Index-based tracking is always reliable.
  const [completedIndices, setCompletedIndices] = useState(new Set());

  // Start on CurrentWorkout as requested.
  const [loadingPage, setLoadingPage] = useState("play_workout");

  const completedCount = completedIndices.size;

  // Build the array CongratsScreen expects (list of workout objects that were done)
  const workoutCompletedWorkouts =
    workouts?.workoutList?.filter((_, i) => completedIndices.has(i)) ?? [];

  // ─── Mark an index as completed ──────────────────────────────────────────
  const markCompleted = (idx) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  // ─── Remove an index from completed ──────────────────────────────────────
  const markIncomplete = (idx) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  // ─── Called by CurrentWorkout "Next Exercise" button ─────────────────────
  // FIX: capture nextIndex as a local variable — never rely on `index` from
  // closure after setState, which is async and may return the old value.
  const onNextWorkout = () => {
    const nextIndex = index + 1; // capture before any setState

    markCompleted(index); // record current exercise as done

    setIndex(nextIndex);

    if (nextIndex >= totalCount) {
      // All exercises done — congrats condition triggers in render
      // loadingPage value doesn't matter here; the index guard wins
      setLoadingPage("play_workout");
    } else {
      setLoadingPage("next_workout");
    }
  };

  // ─── Previous button (shown on NextWorkoutInfo rest screen) ──────────────
  // FIX: go back to index-1, remove THAT index from completed (the user is
  // replaying it), and stay on next_workout so NextWorkoutInfo renders for
  // the previous exercise.
  const handlePrev = () => {
    if (index <= 0) return;

    const prevIndex = index - 1;

    markIncomplete(prevIndex); // un-complete the exercise we're going back to
    setIndex(prevIndex);
    setLoadingPage("next_workout"); // show rest/info screen for that exercise
  };

  // ─── Skip button ─────────────────────────────────────────────────────────
  // FIX: skipping an exercise should still count it as completed so the
  // congrats screen shows the correct total.
  const handleSkip = () => {
    const nextIndex = index + 1;
    // Don't markCompleted — skipped exercises are NOT counted
    setIndex(nextIndex);
    if (nextIndex >= totalCount) {
      setLoadingPage("play_workout");
    } else {
      setLoadingPage("next_workout");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.header}>
        <TouchableOpacity
          onPress={() => setQuitModalVisible(true)}
          activeOpacity={0.8}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={scaling().moderateScale(24)}
            color={colors.primary}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{workouts.bodyPart} Workout</Text>
          <Text style={styles.headerSubtitle}>
            {workouts.level} Level • {workouts.calories} kcal
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Congrats: index has moved past the last item */}
        {index >= totalCount ? (
          <CongratsScreen
            workouts={workouts}
            workoutCompletedWorkouts={workoutCompletedWorkouts}
            userId={user?._id}
          />
        ) : loadingPage === "next_workout" ? (
          <NextWorkoutInfo
            workouts={workouts}
            index={index}
            setIndex={setIndex}
            setLoadingPage={setLoadingPage}
          />
        ) : (
          <CurrentWorkout
            workout={workouts.workoutList[index]}
            index={index}
            setIndex={setIndex}
            setLoadingPage={setLoadingPage}
            onNext={onNextWorkout}
          />
        )}
      </ScrollView>

      {/* Skip button — only while there are more exercises left */}
      {index < totalCount && (
        <View
          style={{
            flexDirection: "row",
            alignSelf: "flex-end",
            marginEnd: 15,
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.skipText}>
              Skip {workouts.workoutList[index]?.name}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Prev / Skip-Rest footer — only on the rest screen */}
      {loadingPage === "next_workout" && index < totalCount && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.navButton,
              styles.prevButton,
              index === 0 && styles.disabledButton,
            ]}
            onPress={handlePrev}
            disabled={index === 0}
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={index === 0 ? "#CBD5E1" : colors.primary}
            />
            <Text
              style={[
                styles.navButtonText,
                index === 0 && styles.disabledButtonText,
              ]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, styles.nextButton]}
            onPress={() => setLoadingPage("play_workout")}
          >
            <Text style={styles.nextButtonText}>Skip Rest</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Next Exercise button — only on the play screen */}
      {loadingPage === "play_workout" && index < totalCount && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={onNextWorkout}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Next Exercise</Text>
            <Ionicons name="arrow-forward" size={22} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Quit modal */}
      <Modal
        visible={quitModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setQuitModalVisible(false)}
      >
        <View style={styles.quitOverlay}>
          <View style={styles.quitCard}>
            <View style={styles.quitIconWrap}>
              <Ionicons
                name="fitness-outline"
                size={scaling().moderateScale(30)}
                color={colors.primary}
              />
            </View>
            <Text style={styles.quitTitle}>You&apos;re doing great!</Text>
            <Text style={styles.quitMessage}>
              You have completed {completedCount} workout
              {completedCount !== 1 ? "s" : ""} out of {totalCount}.
            </Text>
            <Text style={styles.quitQuestion}>
              Are you sure you want to quit this workout?
            </Text>
            <View style={styles.quitActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.quitButton, styles.quitYesButton]}
                onPress={() => {
                  setQuitModalVisible(false);
                  router.back();
                }}
              >
                <Text style={styles.quitYesText}>Yes, quit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.quitButton, styles.quitNoButton]}
                onPress={() => setQuitModalVisible(false)}
              >
                <Text style={styles.quitNoText}>No, I&apos;m continuing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightColor,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: colors.lightColor,
  },

  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
  },

  headerCenter: {
    alignItems: "center",
    marginStart: 10,
  },

  headerTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(18),
    color: colors.secondary,
  },

  headerSubtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(12),

    color: "#718096",
    marginTop: 2,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  progressText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(14),
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

  skipButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  skipText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(14),
    color: colors.secondary,
  },

  progressDotActive: {
    backgroundColor: colors.primary,
    width: scaling().moderateScale(14),
  },

  progressDotCompleted: {
    backgroundColor: "#48BB78",
  },

  progressBar: {
    height: scaling().moderateScale(4),
    backgroundColor: "#E2E8F0",
    borderRadius: scaling().moderateScale(2),
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: scaling().moderateScale(2),
  },

  // Image Card
  imageCard: {
    height: 200,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
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
    height: scaling().moderateScale(120),
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
    fontSize: scaling().moderateScale(12),
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
    fontSize: scaling().moderateScale(18),
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
    fontSize: scaling().moderateScale(12),
    color: colors.secondary,
    marginTop: 5,
  },

  exerciseDescription: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(12),

    color: "#4A5568",
    marginBottom: 15,
  },

  // Muscle Focus
  muscleFocus: {
    marginBottom: 15,
  },

  sectionTitle: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(20),
    color: colors.text,
    marginBottom: 12,
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
    fontSize: scaling().moderateScale(10),
    color: colors.secondary,
  },

  // Steps
  stepsToggle: {
    marginBottom: 20,
    marginTop: 15,
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
    fontSize: scaling().moderateScale(16),
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
    width: scaling().moderateScale(14),
    height: scaling().moderateScale(30),
    borderRadius: scaling().moderateScale(15),
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },

  stepNumberText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(14),
    color: "#FFFFFF",
  },

  stepText: {
    flex: 1,
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(16),
    color: "#4A5568",
    lineHeight: scaling().moderateScale(24),
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
    fontSize: scaling().moderateScale(16),
    color: colors.primary,
  },

  // Timer
  timerSection: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 25,
    borderRadius: 20,
    marginTop: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  timerTitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 14,
    color: "#718096",
    marginBottom: 5,
  },

  timer: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(48),
    color: colors.primary,
    marginBottom: 20,
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
    fontSize: scaling().moderateScale(14),
    color: colors.secondary,
  },

  // Footer Navigation
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.lightColor,
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

  nextButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },

  nextBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  nextButton: {
    backgroundColor: colors.primary,
  },

  disabledButton: {
    opacity: 0.5,
  },

  navButtonText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(16),
    paddingVertical: 10,
    color: colors.secondary,
  },

  nextButtonText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(16),
    color: "#FFFFFF",
  },

  disabledButtonText: {
    color: "#CBD5E1",
  },

  quitOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scaling().moderateScale(20),
  },

  quitCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(24),
    paddingHorizontal: scaling().moderateScale(20),
    paddingVertical: scaling().moderateScale(24),
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 8,
  },

  quitIconWrap: {
    width: scaling().moderateScale(64),
    height: scaling().moderateScale(64),
    borderRadius: scaling().moderateScale(32),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaling().moderateScale(14),
  },

  quitTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(20),
    color: colors.text,
    textAlign: "center",
  },

  quitMessage: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(14),
    color: colors.primary,
    textAlign: "center",
    marginTop: scaling().moderateScale(8),
    lineHeight: scaling().moderateScale(20),
  },

  quitQuestion: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(13),
    color: colors.textLight || "#64748B",
    textAlign: "center",
    marginTop: scaling().moderateScale(8),
    lineHeight: scaling().moderateScale(19),
  },

  quitActions: {
    width: "100%",
    marginTop: scaling().moderateScale(22),
    gap: scaling().moderateScale(10),
  },

  quitButton: {
    width: "100%",
    height: scaling().moderateScale(48),
    borderRadius: scaling().moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
  },

  quitYesButton: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  quitNoButton: {
    backgroundColor: colors.primary,
  },

  quitYesText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(14),
    color: "#DC2626",
  },

  quitNoText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(14),
    color: "#FFFFFF",
  },
});
