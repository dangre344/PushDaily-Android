import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import CongratsScreen from "./Componenets/CongratsScreen";
import CurrentWorkout from "./Componenets/CurrentWorkout";
import NextWorkoutInfo from "./Componenets/NextWorkoutInfo";

export default function WorkoutDetail() {
  const { id, name, level } = useLocalSearchParams();

  const { user, updateUser } = useUser();

  const bodyPartObj = {
    id: Number(id),
    name,
    level,
  };

  Logger.log("Received WorkoutDetail bodyPart:", bodyPartObj);

  const [index, setIndex] = useState(0);
  const [workoutCompletedWorkouts, setWorkoutCompletedWorkouts] = useState([]);

  const workoutsListForBodyPart = workoutListGlobal.find(
    (item) =>
      Number(item.workoutId) === Number(bodyPartObj.id) &&
      item.bodyPart == bodyPartObj.name &&
      item.level == bodyPartObj.level,
  );

  Logger.log("Received workoutsListForBodyPart:", workoutsListForBodyPart);

  const workouts = workoutsListForBodyPart;

  Logger.log("FilteredWorkouts:---->", workouts);

  const [loadingPage, setLoadingPage] = useState("play_workout");

  console.log("Loading Page:", loadingPage);
  console.log("workoutCompletedWorkouts----->", workoutCompletedWorkouts);
  console.log("index------->", index);

  const handlePrev = () => {
    Logger.log("handlePrev called. Current index:", index);
    if (index > 0) {
      setWorkoutCompletedWorkouts((prev) => {
        const id = workouts.workoutList[index].id;
        if (prev.includes(id)) {
          return prev.filter((item) => item !== id);
        } else {
          return [...prev, id];
        }
      });

      setIndex(index - 1);
    } else {
      setWorkoutCompletedWorkouts([]);
    }
  };

  const onNextWorkout = () => {
    setWorkoutCompletedWorkouts((prev) => [
      ...prev,
      workouts.workoutList[index],
    ]);
    setLoadingPage("next_workout");
    setIndex(index + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
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
        {index === workouts.workoutList.length - 1 ? (
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
        ) : loadingPage && loadingPage === "play_workout" ? (
          <CurrentWorkout
            workout={workouts.workoutList[index]}
            index={index}
            setIndex={setIndex}
            setLoadingPage={setLoadingPage}
            onNext={onNextWorkout}
          />
        ) : null}
      </ScrollView>
      {index !== workouts.workoutList.length - 1 ? (
        <View
          style={{
            flexDirection: "row",

            flexWrap: "wrap",
            alignSelf: "flex-end", // ✅ KEY FIX
            marginEnd: 15,
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              setLoadingPage("next_workout");
              setIndex(index + 1);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.skipText}>
              Skip {workouts.workoutList[index]?.name}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loadingPage &&
      loadingPage === "next_workout" &&
      index !== workouts.workoutList.length - 1 ? (
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
            onPress={() => {
              if (index < workouts.workoutList.length - 1) {
                setLoadingPage("play_workout");
                // setIndex(index + 1);
              }
            }}
          >
            <Text style={styles.nextButtonText}>
              {index === workouts.workoutList.length - 1
                ? "Finish"
                : "Skip Rest"}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
      {loadingPage && loadingPage === "play_workout" ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => {
              onNextWorkout();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Next Exercise</Text>
            <Ionicons name="arrow-forward" size={22} color="white" />
          </TouchableOpacity>
        </View>
      ) : null}
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
});
