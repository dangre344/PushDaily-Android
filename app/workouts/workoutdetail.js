import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { AD_UNIT_IDS } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants";
import { successHaptic, tapHaptic } from "../../constants/haptics";
import { Logger } from "../../constants/Logger";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkouts,
  initDB,
  insertMultipleWorkouts,
} from "../../offlinedb/workoutdb";
import {
  exercisePrefill,
  setChatContext,
} from "../../constants/chatContext";
import CongratsScreen from "./Componenets/CongratsScreen";
import CurrentWorkout from "./Componenets/CurrentWorkout";
import NextWorkoutInfo from "./Componenets/NextWorkoutInfo";

export default function WorkoutDetail() {
  const { id, name, level } = useLocalSearchParams();
  const router = useRouter();
  const [quitModalVisible, setQuitModalVisible] = useState(false);
  const { user } = useUser();

  // ─── Helper: normalize strings for comparison ────────────────────────────
  // Many string-mismatch bugs come from extra whitespace or casing differences
  // ("Shoulder" vs "shoulder", "Full Body" vs " Full Body "). Normalizing both
  // sides before comparing makes the lookup defensive against those.
  const normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .trim();

  const bodyPartObj = { id: Number(id), name, level };

  // ─── BUG FIX 2: Case-insensitive + trimmed lookup ────────────────────────
  // The original strict === comparison silently failed when the navigating
  // screen passed slightly different strings (e.g. "shoulder" vs "Shoulder"),
  // returning undefined and causing the save to be skipped with no UI feedback.
  const workoutsListForBodyPart = workoutListGlobal.find(
    (item) =>
      Number(item.workoutId) === Number(bodyPartObj.id) &&
      normalize(item.bodyPart) === normalize(bodyPartObj.name) &&
      normalize(item.level) === normalize(bodyPartObj.level),
  );

  const workouts = workoutsListForBodyPart;
  const totalCount = workouts?.workoutList?.length || 0;

  // ─── BUG FIX 6: Diagnostic log so we can debug silent failures in prod ───
  useEffect(() => {
    Logger.log("WorkoutDetail mounted with params:", {
      paramId: id,
      paramName: name,
      paramLevel: level,
      found: !!workoutsListForBodyPart,
      workoutId: workoutsListForBodyPart?.workoutId,
      bodyPart: workoutsListForBodyPart?.bodyPart,
      totalExercises: workoutsListForBodyPart?.workoutList?.length,
    });

    if (!workoutsListForBodyPart) {
      Logger.log(
        "WorkoutDetail: NO MATCH FOUND — check params vs workoutListGlobal",
      );
    }
  }, [id, name, level, workoutsListForBodyPart]);

  const [index, setIndex] = useState(0);
  const [completedIndices, setCompletedIndices] = useState(new Set());
  const [loadingPage, setLoadingPage] = useState("play_workout");

  // Tell the floating trainer bubble which exercise is on screen, so tapping
  // Jack opens the chat with a "how do I perform this?" question ready to send.
  const currentExerciseName = workouts?.workoutList?.[index]?.name;
  useEffect(() => {
    if (currentExerciseName) {
      setChatContext({
        kind: "exercise",
        title: currentExerciseName,
        prefill: exercisePrefill(currentExerciseName),
      });
    }
    return () => setChatContext(null); // plain chat everywhere else
  }, [currentExerciseName]);

  // When the user entered the workout — used to report total time on completion.
  const startTimeRef = useRef(Date.now());

  // Controls whether CongratsScreen can render
  // "none"   → not finished yet
  // "saving" → DB insert in progress, show loader
  // "done"   → DB done, render CongratsScreen
  const [finishState, setFinishState] = useState("none");

  // ─── BUG FIX 1: Composite key for the save guard ─────────────────────────
  // The original guard used `workoutId` alone. But workoutId is shared across
  // levels of the same body part (Chest Beginner, Chest Intermediate, and
  // Chest Advanced all have workoutId=4). That meant once any Chest workout
  // was saved, subsequent Chest workouts at different levels would be skipped.
  //
  // We now key by `workoutId + bodyPart + level` so the three Chest levels
  // are treated as three distinct workouts.
  const lastSavedWorkoutKeyRef = useRef(null);

  const getWorkoutKey = () =>
    workouts
      ? `${workouts.workoutId}-${workouts.bodyPart}-${workouts.level}`
      : null;

  const completedCount = completedIndices.size;

  const workoutCompletedWorkouts =
    workouts?.workoutList?.filter((_, i) => completedIndices.has(i)) ?? [];

  const markCompleted = (idx) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  const markIncomplete = (idx) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  };

  // ─── Save completed workouts to DB, then open Congrats ───────────────────
  const finishWorkoutAndSave = async (completedList) => {
    const currentKey = getWorkoutKey();

    // BUG FIX 1 GUARD: skip only if THIS exact (workoutId + bodyPart + level)
    // was already saved. Different workouts always pass through.
    if (
      lastSavedWorkoutKeyRef.current &&
      lastSavedWorkoutKeyRef.current === currentKey
    ) {
      Logger.log(
        "Skipping save: this exact workout already saved →",
        currentKey,
      );
      setFinishState("done");
      return;
    }

    setFinishState("saving");

    try {
      if (!workouts?.workoutId) {
        Logger.log(
          "Skipping save: workoutId missing — likely a param mismatch",
          { params: { id, name, level }, workouts },
        );
        setFinishState("done");
        return;
      }

      if (!completedList || completedList.length === 0) {
        Logger.log("Skipping save: no completed workouts in list");
        setFinishState("done");
        return;
      }

      await initDB();

      const completedWorkouts = completedList
        .filter((w) => w?.name)
        .map((w) => ({
          workoutId: String(workouts.workoutId),
          calories: String(w.calories || 0),
          name: w.name,
          bodyPart: workouts.bodyPart || "",
          level: workouts.level || "",
        }));

      if (completedWorkouts.length === 0) {
        Logger.log("Skipping save: empty after filter");
        setFinishState("done");
        return;
      }

      Logger.log(
        "Inserting workouts:",
        completedWorkouts.length,
        "key:",
        currentKey,
      );

      await insertMultipleWorkouts(completedWorkouts);

      // Remember the composite key so duplicate saves of the SAME workout
      // (e.g. accidental re-trigger) are blocked, while different workouts
      // (different level / body part) still save normally.
      lastSavedWorkoutKeyRef.current = currentKey;

      const allWorkouts = await getAllWorkouts();
      Logger.log(
        "Save successful. Total workouts in DB now:",
        allWorkouts.length,
      );
    } catch (error) {
      Logger.log("Workout save failed:", error);
      // Don't update lastSavedWorkoutKeyRef on failure → allows retry on next attempt
    } finally {
      // Whether success or failure → proceed to Congrats (which shows the ad)
      setFinishState("done");
    }
  };

  // ─── Next Exercise ───────────────────────────────────────────────────────
  const onNextWorkout = () => {
    const nextIndex = index + 1;

    // Build the updated completed-indices set synchronously so we can pass
    // the correct list into the DB save without waiting on setState.
    const updatedCompleted = new Set(completedIndices);
    updatedCompleted.add(index);
    setCompletedIndices(updatedCompleted);

    setIndex(nextIndex);

    if (nextIndex >= totalCount) {
      successHaptic(); // whole workout done
      // Finished — compute completed list and save BEFORE showing congrats
      const completedList =
        workouts?.workoutList?.filter((_, i) => updatedCompleted.has(i)) ?? [];
      finishWorkoutAndSave(completedList);
    } else {
      tapHaptic(); // exercise done → next
      setLoadingPage("next_workout");
    }
  };

  // ─── Previous ────────────────────────────────────────────────────────────
  const handlePrev = () => {
    if (index <= 0) return;
    const prevIndex = index - 1;
    markIncomplete(prevIndex);
    setIndex(prevIndex);
    setLoadingPage("next_workout");
  };

  // ─── Skip (does NOT mark completed) ──────────────────────────────────────
  const handleSkip = () => {
    const nextIndex = index + 1;
    setIndex(nextIndex);

    if (nextIndex >= totalCount) {
      // Finished via skip — save whatever was completed up to now.
      // Note: if the user skipped every exercise, completedIndices is empty
      // and finishWorkoutAndSave will short-circuit (no save). That's intentional.
      const completedList =
        workouts?.workoutList?.filter((_, i) => completedIndices.has(i)) ?? [];
      finishWorkoutAndSave(completedList);
    } else {
      setLoadingPage("next_workout");
    }
  };

  // Helper: are we on the finish flow?
  const isFinishing = index >= totalCount;

  // The workout is already saved by the time Congrats shows, so there is nothing
  // to "quit" — go straight back to the Workouts screen instead of asking.
  const exitToWorkouts = () => {
    router.replace("/home");
  };

  // Android hardware back: mirror the header button in both states.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isFinishing) {
        exitToWorkouts();
      } else {
        setQuitModalVisible(true);
      }
      return true; // we handled it
    });
    return () => sub.remove();
  }, [isFinishing]);

  // ─── Safety: if workout lookup failed entirely, render a fallback ────────
  // Without this, accessing `workouts.bodyPart` below would throw and crash
  // the screen with a red box, which is worse than a friendly message.
  if (!workouts) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={scaling().moderateScale(24)}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.savingContainer}>
          <Text style={styles.savingText}>
            Workout not found. Please go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            isFinishing ? exitToWorkouts() : setQuitModalVisible(true)
          }
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

      {/* Session progress — always visible while working out */}
      {!isFinishing && totalCount > 0 && (
        <View style={styles.sessionProgress}>
          <View style={styles.sessionProgressHeader}>
            <Text style={styles.sessionProgressText}>
              Exercise {Math.min(index + 1, totalCount)} of {totalCount}
            </Text>
            <Text style={styles.sessionProgressPct}>
              {Math.round((Math.min(index + 1, totalCount) / totalCount) * 100)}%
            </Text>
          </View>
          <View style={styles.sessionProgressTrack}>
            <View
              style={[
                styles.sessionProgressFill,
                {
                  width: `${
                    (Math.min(index + 1, totalCount) / totalCount) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {isFinishing ? (
          finishState === "done" ? (
            <CongratsScreen
              workouts={workouts}
              workoutCompletedWorkouts={workoutCompletedWorkouts}
              userId={user?._id}
              startTime={startTimeRef.current}
            />
          ) : (
            // Saving state — small inline loader before Congrats appears
            <View style={styles.savingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.savingText}>Saving your workout…</Text>
            </View>
          )
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

      {/* Skip button — only while not finishing */}
      {!isFinishing && (
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

      {loadingPage === "next_workout" && !isFinishing && (
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

      {loadingPage === "play_workout" && !isFinishing && (
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

      {/* Banner ad — pinned at the very bottom, below the footer; only on the
          rest/next-workout screen */}
      {loadingPage === "next_workout" && !isFinishing && (
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
          />
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

  savingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 14,
  },
  savingText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(14),
    color: colors.secondary,
    textAlign: "center",
    paddingHorizontal: 20,
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

  // Session progress
  sessionProgress: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sessionProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sessionProgressText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(12),
    color: colors.secondary,
  },
  sessionProgressPct: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(12),
    color: colors.primary,
  },
  sessionProgressTrack: {
    height: scaling().moderateScale(7),
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },
  sessionProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
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

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: scaling().moderateScale(52),
    backgroundColor: colors.lightColor,
    flexShrink: 1,
  },
});
