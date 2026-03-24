import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Icon from "react-native-vector-icons/Ionicons";
import { colors } from "../../../constants/colors";
import { Logger } from "../../../constants/Logger";
import { scaling } from "../../../constants/useScaling";
import {
  getAllWorkouts,
  initDB,
  insertMultipleWorkouts,
} from "../../../offlinedb/workoutdb";

const { width, height } = Dimensions.get("window");

const CongratsScreen = ({ workouts, navigation, workoutCompletedWorkouts }) => {
  // Animation values
  const confettiAnim = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  Logger.log(
    "CongratsScreen workoutCompletedWorkouts--->",
    workoutCompletedWorkouts,
  );

  Logger.log("CongratsScreen workoutId--->", workouts.workoutId);

  // State for calories details
  const [showCaloriesDetails, setShowCaloriesDetails] = useState(false);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.elastic(1.2),
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue:
          (workoutCompletedWorkouts.length + 1) /
          (workouts.workoutList?.length || 1),
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();

    // Play confetti animation
    setTimeout(() => {
      if (confettiAnim.current) {
        confettiAnim.current.play();
      }
    }, 500);
  }, []);

  // Animated progress value for stats
  const animatedCalories = useRef(new Animated.Value(0)).current;
  const animatedDuration = useRef(new Animated.Value(0)).current;
  const animatedWorkouts = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedCalories, {
      toValue: workouts.calories || 0,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedWorkouts, {
      toValue: workoutCompletedWorkouts.length + 1 || 0,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  useEffect(() => {
    const setup = async () => {
      await initDB(); // Initialize DB

      let completedWorkouts = workoutCompletedWorkouts.map((workoutItem) => {
        return {
          workoutId: workouts.workoutId,
          calories: workoutItem.calories,
          name: workoutItem.name,
          bodyPart: workouts.bodyPart,
          level: workouts.level,
        };
      });

      Logger.log("CompletedWorkouts to Insert--->", completedWorkouts);

      await insertMultipleWorkouts(completedWorkouts);

      let allWorkouts = await getAllWorkouts();
      Logger.log("All workouts after insertion--->", allWorkouts);
    };
    setup();
  }, []);

  const CaloriesDetailsModal = () => (
    <Animated.View
      style={[styles.caloriesDetailsContainer, { opacity: fadeAnim }]}
    >
      <View style={styles.caloriesDetailsCard}>
        <View style={styles.caloriesHeader}>
          <FontAwesome5 name="fire" size={24} color={colors.primary} />
          <Text style={styles.caloriesDetailsTitle}>Calories Burnt</Text>
        </View>

        <View style={styles.caloriesStats}>
          <View style={styles.caloriesStatItem}>
            <Text style={styles.caloriesStatLabel}>Total Calories</Text>
            <Animated.Text style={styles.caloriesStatValue}>
              {animatedCalories.interpolate({
                inputRange: [0, workouts.calories || 0],
                outputRange: ["0", (workouts.calories || 0).toString()],
              })}
            </Animated.Text>
            <Text style={styles.caloriesStatUnit}>kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.caloriesStatItem}>
            <Text style={styles.caloriesStatLabel}>Equivalent to</Text>
            <View style={styles.equivalentItems}>
              <View style={styles.equivalentItem}>
                <Icon name="fast-food-outline" size={24} color="#4F46E5" />
                <Text style={styles.equivalentText}>
                  {(workouts.calories / 250).toFixed(1)} slices of pizza
                </Text>
              </View>
              <View style={styles.equivalentItem}>
                <Icon name="water-outline" size={24} color="#4F46E5" />
                <Text style={styles.equivalentText}>
                  {(workouts.calories / 50).toFixed(0)} glasses of soda
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeCaloriesButton}
          onPress={() => setShowCaloriesDetails(false)}
        >
          <Text style={styles.closeCaloriesButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LottieView
        ref={confettiAnim}
        source={require("../../../assets/animations/congrats.json")}
        autoPlay={true}
        loop={false}
        style={styles.confetti}
        speed={1.5}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.badgeContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.badgeOuterRing}>
            <View style={styles.badgeInnerRing}>
              <LinearGradient
                colors={["#FFF", "#FFF", "#FFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badgeGradient}
              >
                <LottieView
                  source={require("../../../assets/animations/trophy.json")}
                  autoPlay
                  loop
                  style={styles.trophyAnimation}
                />
              </LinearGradient>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Text style={styles.congratsTitle}>🎉 Congratulations! 🎉</Text>
          <Text style={styles.congratsSubtitle}>
            You've Crushed Your Workout!
          </Text>

          <View style={styles.workoutNameContainer}>
            <Icon name="fitness-outline" size={20} color={colors.textLight} />
            <Text style={styles.workoutName}>
              {workouts.bodyPart || "Workout"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.statsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          {/* <View style={styles.statCard}>
            <TouchableOpacity
              onPress={() => {
                setShowCaloriesDetails(true);
              }}
            >
              <LinearGradient
                colors={["#F59E0B", "#FBBF24"]}
                style={styles.statCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon name="flame-outline" size={32} color="white" />
                <Text style={styles.statCardTitle}>Calories Burnt</Text>
                <Animated.Text style={styles.statCardValue}>
                  {animatedCalories.interpolate({
                    inputRange: [0, workouts.calories || 0],
                    outputRange: ["0", (workouts.calories || 0).toString()],
                  })}
                </Animated.Text>
                <Text style={styles.statCardUnit}>kcal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View> */}

          <View style={styles.statCard}>
            <LinearGradient
              colors={["#4F46E5", "#7C3AED"]}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="checkmark-done" size={32} color="white" />
              <Text style={styles.statCardTitle}>Workouts Completed</Text>
              <Animated.Text style={styles.statCardValue}>
                {animatedWorkouts.interpolate({
                  inputRange: [0, workoutCompletedWorkouts.length || 0],
                  outputRange: [
                    "0",
                    (workoutCompletedWorkouts.length || 0).toString(),
                  ],
                })}
              </Animated.Text>
              <Text style={styles.statCardUnit}>exercises</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.progressContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <Text style={styles.progressTitle}>Your Progress</Text>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {workoutCompletedWorkouts.length > 0
              ? `${(((workoutCompletedWorkouts.length + 1) / workouts.workoutList?.length) * 100).toFixed(0)}% `
              : "0%"}
            Complete! 🎯
          </Text>
        </Animated.View>

        {/* <TouchableOpacity
          onPress={() => {}}
          style={styles.shareButton}
          activeOpacity={0.9}
        >
          <Icon name="share-social" size={24} color="#4F46E5" />
          <Text style={styles.shareButtonText}>Share Achievement</Text>
        </TouchableOpacity> */}
      </ScrollView>

      {showCaloriesDetails && <CaloriesDetailsModal />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: scaling().scaleHeight(50),
  },
  confetti: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height,
    zIndex: 1,
  },
  badgeContainer: {
    marginTop: scaling().scaleHeight(10),
    marginBottom: 20,
    position: "relative",
  },
  badgeOuterRing: {
    width: scaling().scaleWidth(70),
    height: scaling().scaleHeight(110),
    borderRadius: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeInnerRing: {
    width: scaling().scaleWidth(150),
    height: scaling().scaleHeight(150),
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 2,
  },
  trophyAnimation: {
    width: scaling().scaleWidth(80),
    height: scaling().scaleHeight(80),
    zIndex: 3,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: scaling().scaleHeight(20),
    paddingHorizontal: 20,
  },
  congratsTitle: {
    fontSize: scaling().moderateScale(18),
    fontFamily: "OpenSans_700Bold",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  congratsSubtitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
  },
  workoutNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 25,
    borderWidth: 0.5,
    borderColor: colors.textLight,
    gap: 5,
  },
  workoutName: {
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  statCardGradient: {
    padding: 20,
    alignItems: "center",

    borderRadius: 20,
    marginBottom: 10,
  },
  statCardTitle: {
    fontSize: 12,
    fontFamily: "OpenSans_600SemiBold",
    color: "white",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  statCardValue: {
    fontSize: 28,
    fontFamily: "OpenSans_800ExtraBold",
    color: "white",
  },
  statCardUnit: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  progressContainer: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 25,
    marginHorizontal: 20,
    marginBottom: 20,
    width: width - 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  progressTitle: {
    fontSize: scaling().moderateScale(16),
    fontFamily: "OpenSans_700Bold",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  progressBarContainer: {
    height: scaling().moderateScale(12),
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: "#10B981",
    textAlign: "center",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
    color: "#4F46E5",
  },
  actionButtonsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 20,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 15,
    gap: 10,
    marginHorizontal: 5,
  },
  caloriesButton: {
    backgroundColor: "#4F46E5",
  },
  finishButton: {
    backgroundColor: "#10B981",
  },
  caloriesButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "OpenSans_700Bold",
  },
  finishButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "OpenSans_700Bold",
  },
  // Calories Details Styles
  caloriesDetailsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  caloriesDetailsCard: {
    backgroundColor: "white",
    borderRadius: 25,
    padding: 10,
    width: width - 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  caloriesHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  caloriesLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  caloriesDetailsTitle: {
    fontSize: 22,
    fontFamily: "OpenSans_700Bold",
    color: "#1E293B",
    textAlign: "center",
  },
  caloriesStats: {
    marginBottom: 20,
  },
  caloriesStatItem: {
    alignItems: "center",
    marginVertical: 10,
  },
  caloriesStatLabel: {
    fontSize: 14,
    fontFamily: "OpenSans_500Medium",
    color: "#64748B",
    marginBottom: 5,
  },
  caloriesStatValue: {
    fontSize: 42,
    fontFamily: "OpenSans_800ExtraBold",
    color: "#F59E0B",
  },
  caloriesStatUnit: {
    fontSize: 16,
    fontFamily: "OpenSans_500Medium",
    color: "#64748B",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 15,
  },
  equivalentItems: {
    marginTop: 10,
  },
  equivalentItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 10,
  },
  equivalentText: {
    fontSize: 14,
    fontFamily: "OpenSans_500Medium",
    color: "#1E293B",
    marginLeft: 10,
  },
  closeCaloriesButton: {
    backgroundColor: "#4F46E5",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  closeCaloriesButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
  },
});

export default CongratsScreen;
