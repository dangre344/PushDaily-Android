import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
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

import { BannerAd } from "react-native-google-mobile-ads";
import Icon from "react-native-vector-icons/Ionicons";
import {
  AD_UNIT_IDS,
  BannerAdSize,
  InterstitialAdManager,
} from "../../../ads/Admobmanager";
import { maybeAskForReview } from "../../../constants/appReview";
import { colors } from "../../../constants/colors";
import { Logger } from "../../../constants/Logger";
import { trackEvent } from "../../../constants/mixpanel";
import { scaling } from "../../../constants/useScaling";
import { getAllWorkouts, initDB } from "../../../offlinedb/workoutdb";
import {
  getNextBadgeProgress,
  getPointsForLevel,
  getUserBadge,
} from "../../home/WorkoutBadgeInfo";
import ShareAchievementModal from "./ShareAchievementCard";

const { width, height } = Dimensions.get("window");

const CongratsScreen = ({
  workouts,
  navigation,
  workoutCompletedWorkouts = [],
  userId,
}) => {
  const confettiAnim = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.82)).current;
  const slideUpAnim = useRef(new Animated.Value(34)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardSlideAnim = useRef(new Animated.Value(24)).current;
  const animatedCalories = useRef(new Animated.Value(0)).current;
  const animatedWorkouts = useRef(new Animated.Value(0)).current;
  const badgeProgressAnim = useRef(new Animated.Value(0)).current;
  const animatedPoints = useRef(new Animated.Value(0)).current;

  const [showCaloriesDetails, setShowCaloriesDetails] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  // ─── Workout rating ──────────────────────────────────────────────────────
  const [ratingStars, setRatingStars] = useState(0);
  const [selectedFeeling, setSelectedFeeling] = useState(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const ratingCardAnim = useRef(new Animated.Value(0)).current;
  const thankYouScale = useRef(new Animated.Value(0.7)).current;
  const starAnims = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  // ─── Badge / level progress earned from this session ────────────────────
  // Each completed exercise of this session earns points based on the
  // session difficulty (Beginner 2 / Intermediate 5 / Advanced 10).
  const [badge, setBadge] = useState(null);

  const completedCount = workoutCompletedWorkouts?.length || 0;

  const pointsPerExercise = getPointsForLevel(workouts?.level);
  const pointsEarned = completedCount * pointsPerExercise;

  const badgeProgress = getNextBadgeProgress(badge?.score || 0);
  const badgeProgressPercent = Math.round(
    Math.min(badgeProgress.progress * 100, 100),
  );

  Logger.log("CongratsScreen Rendered with completedCount:", completedCount);

  const totalWorkoutCount =
    workouts?.workoutList?.length || completedCount || 1;
  const progressValue = Math.min(completedCount / totalWorkoutCount, 1);
  const progressPercent = Math.round(progressValue * 100);

  const totalCalories = useMemo(() => {
    return workoutCompletedWorkouts.reduce((sum, item) => {
      const calories = Number(item?.calories || 0);
      return sum + (Number.isFinite(calories) ? calories : 0);
    }, 0);
  }, [workoutCompletedWorkouts]);

  const safeCalories = totalCalories || Number(workouts?.calories || 0) || 0;

  const motivationText =
    progressPercent >= 100
      ? "You completed the full session. That’s consistency in action."
      : "Great progress. Keep showing up and finish strong next time.";

  // ─── Track event + show interstitial ad ─────────────────────────────────
  // DB insertion is handled by the parent (WorkoutDetail) BEFORE this
  // screen mounts. By the time we're here, the data is already saved, so
  // it's safe to show the interstitial without risking an unmount mid-write.
  useEffect(() => {
    trackEvent("Exercise Completed", {
      userId: userId || "",
      bodyPart: workouts?.bodyPart || "",
      level: workouts?.level || "",
    });

    InterstitialAdManager.getInstance().show();
  }, []);

  // ─── Entry animations ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: progressValue,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    setTimeout(() => {
      confettiAnim.current?.play();
    }, 350);
  }, []);

  // ─── Animated number counters ───────────────────────────────────────────
  useEffect(() => {
    Animated.timing(animatedCalories, {
      toValue: safeCalories,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedWorkouts, {
      toValue: completedCount,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [safeCalories, completedCount]);

  // ─── Load total badge progress (data is already saved before we mount) ───
  useEffect(() => {
    let isActive = true;
    let reviewTimer;

    (async () => {
      try {
        await initDB();
        const all = await getAllWorkouts();
        if (!isActive) return;
        setBadge(getUserBadge(all));

        // Best moment to ask for a review — right after a completed workout.
        // Delay so it doesn't collide with the interstitial ad. Reuses the
        // already-fetched workouts list (all.length) — no extra query.
        reviewTimer = setTimeout(() => maybeAskForReview(all.length), 3500);
      } catch (e) {
        Logger.log("CongratsScreen: failed to load badge", String(e));
      }
    })();

    return () => {
      isActive = false;
      if (reviewTimer) clearTimeout(reviewTimer);
    };
  }, []);

  // ─── Animate the badge bar + earned-points counter once badge is known ───
  useEffect(() => {
    if (!badge) return;

    Animated.timing(animatedPoints, {
      toValue: pointsEarned,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    Animated.timing(badgeProgressAnim, {
      toValue: badgeProgressPercent,
      duration: 1100,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [badge, pointsEarned, badgeProgressPercent]);

  const FEELINGS = [
    { id: "good", label: "Good 👍", color: "#4F46E5" },
    { id: "energetic", label: "Felt Energetic ⚡", color: "#F59E0B" },
    { id: "challenging", label: "Challenging 🔥", color: colors.primary },
    { id: "easy", label: "Too Easy 😅", color: "#10B981" },
    { id: "tired", label: "Tired 😓", color: "#64748B" },
    { id: "amazing", label: "Amazing 🚀", color: "#7C3AED" },
  ];

  const handleStarPress = (star) => {
    setRatingStars(star);
    // Pop the selected star
    const anim = starAnims[star - 1];
    anim.setValue(0.6);
    Animated.spring(anim, {
      toValue: 1,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleSubmitRating = () => {
    if (ratingStars === 0) return;
    trackEvent("Workout Rated", {
      stars: ratingStars,
      feeling: selectedFeeling || "not_selected",
      bodyPart: workouts?.bodyPart || "",
      level: workouts?.level || "",
    });
    setRatingSubmitted(true);
    Animated.spring(thankYouScale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const CaloriesDetailsModal = () => (
    <Animated.View
      style={[
        styles.caloriesDetailsContainer,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.caloriesDetailsCard,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.caloriesHeader}>
          <View style={styles.modalIconCircle}>
            <FontAwesome5 name="fire" size={22} color={colors.primary} />
          </View>

          <Text style={styles.caloriesDetailsTitle}>Calories Burned</Text>
          <Text style={styles.caloriesDetailsSubTitle}>
            Every rep counts toward a stronger you.
          </Text>
        </View>

        <View style={styles.caloriesStats}>
          <View style={styles.caloriesStatItem}>
            <Text style={styles.caloriesStatLabel}>Total Calories</Text>

            <Animated.Text style={styles.caloriesStatValue}>
              {animatedCalories.interpolate({
                inputRange: [0, Math.max(safeCalories, 1)],
                outputRange: ["0", String(safeCalories)],
              })}
            </Animated.Text>

            <Text style={styles.caloriesStatUnit}>kcal</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.equivalentItems}>
            <View style={styles.equivalentItem}>
              <Icon name="fast-food-outline" size={22} color={colors.primary} />
              <Text style={styles.equivalentText}>
                Around {(safeCalories / 250).toFixed(1)} pizza slices burned
              </Text>
            </View>

            <View style={styles.equivalentItem}>
              <Icon name="water-outline" size={22} color={colors.primary} />
              <Text style={styles.equivalentText}>
                Around {(safeCalories / 50).toFixed(0)} soda glasses burned
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeCaloriesButton}
          activeOpacity={0.85}
          onPress={() => setShowCaloriesDetails(false)}
        >
          <Text style={styles.closeCaloriesButtonText}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LottieView
        ref={confettiAnim}
        source={require("../../../assets/animations/congrats.json")}
        autoPlay={false}
        loop={false}
        style={styles.confetti}
        speed={1.35}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideUpAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Animated.View
              style={[
                styles.badgeContainer,
                {
                  transform: [
                    { scale: Animated.multiply(scaleAnim, pulseAnim) },
                  ],
                },
              ]}
            >
              <View style={styles.badgeGlow}>
                <View style={styles.badgeWhiteCircle}>
                  <LottieView
                    source={require("../../../assets/animations/trophy.json")}
                    autoPlay
                    loop
                    style={styles.trophyAnimation}
                  />
                </View>
              </View>
            </Animated.View>

            <Text style={styles.congratsTitle}>Workout Complete!</Text>

            <Text style={styles.congratsSubtitle}>
              You crushed your {workouts?.bodyPart || "workout"} session.
            </Text>

            <View style={styles.workoutNameContainer}>
              <Icon name="fitness-outline" size={17} color="#FFFFFF" />
              <Text style={styles.workoutName}>
                {workouts?.bodyPart || "Workout"} • {workouts?.level || "Level"}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={[
            styles.messageCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <View style={styles.messageIcon}>
            <Icon name="sparkles-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.messageContent}>
            <Text style={styles.messageTitle}>Great job showing up today</Text>
            <Text style={styles.messageText}>{motivationText}</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.statsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.9}
            onPress={() => setShowCaloriesDetails(true)}
          >
            <LinearGradient
              colors={["#F97316", "#FBBF24"]}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="flame-outline" size={28} color="white" />

              <Text style={styles.statCardTitle}>Calories</Text>

              <Animated.Text style={styles.statCardValue}>
                {animatedCalories.interpolate({
                  inputRange: [0, Math.max(safeCalories, 1)],
                  outputRange: ["0", String(safeCalories)],
                })}
              </Animated.Text>

              <Text style={styles.statCardUnit}>kcal burned</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.statCard}>
            <LinearGradient
              colors={["#4F46E5", "#7C3AED"]}
              style={styles.statCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="checkmark-done" size={28} color="white" />

              <Text style={styles.statCardTitle}>Completed</Text>

              <Animated.Text style={styles.statCardValue}>
                {animatedWorkouts.interpolate({
                  inputRange: [0, Math.max(completedCount, 1)],
                  outputRange: ["0", String(completedCount)],
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
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Session Progress</Text>
              <Text style={styles.progressSubTitle}>
                {completedCount} of {totalWorkoutCount} exercises completed
              </Text>
            </View>

            <View style={styles.progressPercentBadge}>
              <Text style={styles.progressPercentText}>{progressPercent}%</Text>
            </View>
          </View>

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
            Small wins repeated daily become real results. Come back tomorrow 💪
          </Text>
        </Animated.View>

        {badge && (
          <Animated.View
            style={[
              styles.badgeCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: cardSlideAnim }],
              },
            ]}
          >
            <View style={styles.badgeCardHeader}>
              <View style={styles.badgeEmojiCircle}>
                <Text style={styles.badgeEmoji}>{badge.emoji || "🏅"}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.badgeCardTitle}>{badge.title}</Text>
                <Text style={styles.badgeCardSubtitle}>
                  {badge.subtitle} • {badge.score} pts
                </Text>
              </View>

              {pointsEarned > 0 && (
                <View style={styles.pointsPill}>
                  <Icon name="add" size={13} color="#FFFFFF" />
                  <Animated.Text style={styles.pointsPillText}>
                    {animatedPoints.interpolate({
                      inputRange: [0, Math.max(pointsEarned, 1)],
                      outputRange: ["0", String(pointsEarned)],
                    })}
                  </Animated.Text>
                  <Text style={styles.pointsPillText}> pts</Text>
                </View>
              )}
            </View>

            <View style={styles.badgeProgressHeader}>
              <Text style={styles.badgeProgressLabel}>
                {badgeProgress.nextTitle === "Max Level"
                  ? "Highest badge reached"
                  : `Next badge: ${badgeProgress.nextTitle}`}
              </Text>
              <Text style={styles.badgeProgressPercent}>
                {badgeProgressPercent}%
              </Text>
            </View>

            <View style={styles.badgeProgressTrack}>
              <Animated.View
                style={[
                  styles.badgeProgressFill,
                  {
                    width: badgeProgressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            <Text style={styles.badgeProgressText}>
              {badgeProgress.remainingPoints > 0
                ? `${pointsPerExercise} pts per ${
                    workouts?.level || "workout"
                  } exercise • ${
                    badgeProgress.remainingPoints
                  } pts to ${badgeProgress.nextTitle}`
                : "You've unlocked the strongest badge. Keep the streak alive!"}
            </Text>
          </Animated.View>
        )}

        <Animated.View
          style={[
            styles.consistencyCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <View style={styles.consistencyIcon}>
            <Icon name="calendar-outline" size={22} color={colors.green} />
          </View>

          <View style={styles.consistencyContent}>
            <Text style={styles.consistencyTitle}>Build the habit</Text>
            <Text style={styles.consistencyText}>
              Try to complete one workout every day this week. Consistency beats
              intensity.
            </Text>
          </View>
        </Animated.View>

        {/* ─── Workout rating ─── */}
        <Animated.View
          style={[
            styles.ratingCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          {ratingSubmitted ? (
            <Animated.View
              style={[styles.thankYouWrap, { transform: [{ scale: thankYouScale }] }]}
            >
              <Text style={styles.thankYouEmoji}>🎉</Text>
              <Text style={styles.thankYouTitle}>Thanks for your feedback!</Text>
              <Text style={styles.thankYouSub}>
                It helps us build a better experience for you.
              </Text>
            </Animated.View>
          ) : (
            <>
              <Text style={styles.ratingTitle}>How was your workout?</Text>
              <Text style={styles.ratingSubtitle}>
                Rate your session and tell us how you felt
              </Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleStarPress(star)}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={{ transform: [{ scale: starAnims[star - 1] }] }}>
                      <Ionicons
                        name={star <= ratingStars ? "star" : "star-outline"}
                        size={scaling().moderateScale(34)}
                        color={star <= ratingStars ? "#F59E0B" : "#CBD5E1"}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Feeling chips */}
              <View style={styles.feelingsWrap}>
                {FEELINGS.map((f) => {
                  const active = selectedFeeling === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() =>
                        setSelectedFeeling(active ? null : f.id)
                      }
                      activeOpacity={0.85}
                      style={[
                        styles.feelingChip,
                        active && {
                          backgroundColor: f.color,
                          borderColor: f.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.feelingChipText,
                          active && styles.feelingChipTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.ratingSubmitBtn,
                  ratingStars === 0 && styles.ratingSubmitBtnDisabled,
                ]}
                onPress={handleSubmitRating}
                activeOpacity={0.9}
                disabled={ratingStars === 0}
              >
                <Text style={styles.ratingSubmitText}>Submit Rating</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* ─── Share achievement ─── */}
        <Animated.View
          style={[
            styles.shareCta,
            {
              opacity: fadeAnim,
              transform: [{ translateY: cardSlideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.shareCtaBtn}
            activeOpacity={0.9}
            onPress={() => setShowShareCard(true)}
          >
            <Icon name="share-social" size={20} color="#FFFFFF" />
            <Text style={styles.shareCtaText}>Share Achievement</Text>
          </TouchableOpacity>

          <Text style={styles.shareCtaHint}>
            Inspire a friend to start their journey 💪
          </Text>
        </Animated.View>
      </ScrollView>

      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={() => {
            console.log("[AdMob] Banner loaded");
          }}
          onAdFailedToLoad={(error) => {
            console.warn("[AdMob] Banner failed:", error);
          }}
        />
      </View>

      {showCaloriesDetails && <CaloriesDetailsModal />}

      <ShareAchievementModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        badge={badge}
        completedCount={completedCount}
        calories={safeCalories}
        pointsEarned={pointsEarned}
        bodyPart={workouts?.bodyPart || "Workout"}
        level={workouts?.level || ""}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  // Bound the scroll area so the pinned banner below it always stays on screen.
  scrollView: {
    flex: 1,
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: scaling().moderateScale(52),
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: scaling().moderateScale(18),
    paddingTop: scaling().scaleHeight(18),
    paddingBottom: scaling().scaleHeight(60),
  },

  confetti: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height,
    zIndex: 20,
  },

  heroCard: {
    width: "100%",
    borderRadius: scaling().moderateScale(30),
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 8,
  },

  heroGradient: {
    alignItems: "center",
    paddingHorizontal: scaling().moderateScale(20),
    paddingTop: scaling().scaleHeight(28),
    paddingBottom: scaling().scaleHeight(26),
  },

  badgeContainer: {
    marginBottom: scaling().scaleHeight(14),
  },

  badgeGlow: {
    width: scaling().scaleWidth(138),
    height: scaling().scaleWidth(138),
    borderRadius: scaling().scaleWidth(69),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeWhiteCircle: {
    width: scaling().scaleWidth(112),
    height: scaling().scaleWidth(112),
    borderRadius: scaling().scaleWidth(56),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  trophyAnimation: {
    width: scaling().scaleWidth(82),
    height: scaling().scaleHeight(82),
  },

  congratsTitle: {
    fontSize: scaling().moderateScale(20),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    textAlign: "center",
  },

  congratsSubtitle: {
    fontSize: scaling().moderateScale(14),
    fontFamily: "OpenSans_600SemiBold",
    color: "rgba(255,255,255,0.86)",
    textAlign: "center",
    marginTop: scaling().scaleHeight(8),
  },

  workoutNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scaling().scaleHeight(16),
    paddingHorizontal: scaling().scaleWidth(14),
    paddingVertical: scaling().scaleHeight(8),
    borderRadius: scaling().moderateScale(999),
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    gap: scaling().scaleWidth(6),
  },

  workoutName: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "#FFFFFF",
  },

  messageCard: {
    width: "100%",
    marginTop: scaling().scaleHeight(18),
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(22),
    padding: scaling().moderateScale(16),
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  messageIcon: {
    width: scaling().scaleWidth(44),
    height: scaling().scaleWidth(44),
    borderRadius: scaling().scaleWidth(22),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaling().scaleWidth(12),
  },

  messageContent: {
    flex: 1,
  },

  messageTitle: {
    fontSize: scaling().moderateScale(15),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  messageText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    lineHeight: scaling().moderateScale(18),
    marginTop: scaling().scaleHeight(4),
  },

  statsContainer: {
    width: "100%",
    flexDirection: "row",
    gap: scaling().moderateScale(12),
    marginTop: scaling().scaleHeight(16),
  },

  statCard: {
    flex: 1,
    borderRadius: scaling().moderateScale(22),
    overflow: "hidden",
  },

  statCardGradient: {
    minHeight: scaling().scaleHeight(100),
    padding: scaling().moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: scaling().moderateScale(22),
  },

  statCardTitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "rgba(255,255,255,0.86)",
    marginTop: scaling().scaleHeight(8),
  },

  statCardValue: {
    fontSize: scaling().moderateScale(30),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    marginTop: scaling().scaleHeight(2),
  },

  statCardUnit: {
    fontSize: scaling().moderateScale(11),
    fontFamily: "OpenSans_600SemiBold",
    color: "rgba(255,255,255,0.78)",
  },

  progressContainer: {
    backgroundColor: "#FFFFFF",
    padding: scaling().moderateScale(18),
    borderRadius: scaling().moderateScale(24),
    marginTop: scaling().scaleHeight(16),
    width: "100%",
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressTitle: {
    fontSize: scaling().moderateScale(16),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  progressSubTitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: scaling().scaleHeight(3),
  },

  progressPercentBadge: {
    backgroundColor: colors.green + "14",
    paddingHorizontal: scaling().scaleWidth(12),
    paddingVertical: scaling().scaleHeight(7),
    borderRadius: scaling().moderateScale(999),
  },

  progressPercentText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.green,
  },

  progressBarContainer: {
    height: scaling().moderateScale(12),
    backgroundColor: "#E9EDF3",
    borderRadius: scaling().moderateScale(999),
    overflow: "hidden",
    marginTop: scaling().scaleHeight(16),
    marginBottom: scaling().scaleHeight(12),
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.green,
    borderRadius: scaling().moderateScale(999),
  },

  progressText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    textAlign: "center",
    lineHeight: scaling().moderateScale(18),
  },

  badgeCard: {
    width: "100%",
    marginTop: scaling().scaleHeight(16),
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(24),
    padding: scaling().moderateScale(18),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  badgeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scaling().scaleHeight(16),
  },

  badgeEmojiCircle: {
    width: scaling().scaleWidth(48),
    height: scaling().scaleWidth(48),
    borderRadius: scaling().scaleWidth(24),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaling().scaleWidth(12),
  },

  badgeEmoji: {
    fontSize: scaling().moderateScale(26),
  },

  badgeCardTitle: {
    fontSize: scaling().moderateScale(16),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  badgeCardSubtitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginTop: scaling().scaleHeight(2),
  },

  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.green,
    paddingHorizontal: scaling().scaleWidth(10),
    paddingVertical: scaling().scaleHeight(6),
    borderRadius: scaling().moderateScale(999),
  },

  pointsPillText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
  },

  badgeProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scaling().scaleHeight(8),
  },

  badgeProgressLabel: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  badgeProgressPercent: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
  },

  badgeProgressTrack: {
    height: scaling().moderateScale(10),
    backgroundColor: "#E9EDF3",
    borderRadius: scaling().moderateScale(999),
    overflow: "hidden",
  },

  badgeProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: scaling().moderateScale(999),
  },

  badgeProgressText: {
    fontSize: scaling().moderateScale(11),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: scaling().scaleHeight(8),
    lineHeight: scaling().moderateScale(16),
  },

  consistencyCard: {
    width: "100%",
    marginTop: scaling().scaleHeight(16),
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(22),
    padding: scaling().moderateScale(16),
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  consistencyIcon: {
    width: scaling().scaleWidth(44),
    height: scaling().scaleWidth(44),
    borderRadius: scaling().scaleWidth(22),
    backgroundColor: colors.green + "12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaling().scaleWidth(12),
  },

  consistencyContent: {
    flex: 1,
  },

  shareCta: {
    width: "100%",
    marginTop: scaling().scaleHeight(16),
    alignItems: "center",
  },
  shareCtaBtn: {
    width: "100%",
    height: scaling().scaleHeight(54),
    borderRadius: scaling().moderateScale(18),
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scaling().moderateScale(8),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  shareCtaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(15),
    color: "#FFFFFF",
  },
  shareCtaHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(11),
    color: colors.textLight,
    marginTop: scaling().scaleHeight(8),
    textAlign: "center",
  },

  consistencyTitle: {
    fontSize: scaling().moderateScale(15),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  consistencyText: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    lineHeight: scaling().moderateScale(18),
    marginTop: scaling().scaleHeight(4),
  },

  caloriesDetailsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.72)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    paddingHorizontal: scaling().moderateScale(20),
  },

  caloriesDetailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(28),
    padding: scaling().moderateScale(20),
    width: width - scaling().moderateScale(40),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },

  caloriesHeader: {
    alignItems: "center",
    marginBottom: scaling().scaleHeight(18),
  },

  modalIconCircle: {
    width: scaling().scaleWidth(54),
    height: scaling().scaleWidth(54),
    borderRadius: scaling().scaleWidth(27),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaling().scaleHeight(10),
  },

  caloriesDetailsTitle: {
    fontSize: scaling().moderateScale(22),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    textAlign: "center",
  },

  caloriesDetailsSubTitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    textAlign: "center",
    marginTop: scaling().scaleHeight(4),
  },

  caloriesStats: {
    marginBottom: scaling().scaleHeight(16),
  },

  caloriesStatItem: {
    alignItems: "center",
    marginVertical: scaling().scaleHeight(8),
  },

  caloriesStatLabel: {
    fontSize: scaling().moderateScale(13),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginBottom: scaling().scaleHeight(4),
  },

  caloriesStatValue: {
    fontSize: scaling().moderateScale(44),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#F97316",
  },

  caloriesStatUnit: {
    fontSize: scaling().moderateScale(14),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },

  divider: {
    height: 1,
    backgroundColor: "#E9EDF3",
    marginVertical: scaling().scaleHeight(14),
  },

  equivalentItems: {
    gap: scaling().scaleHeight(10),
  },

  equivalentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: scaling().moderateScale(16),
    paddingHorizontal: scaling().scaleWidth(12),
    paddingVertical: scaling().scaleHeight(11),
  },

  equivalentText: {
    flex: 1,
    fontSize: scaling().moderateScale(13),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    marginLeft: scaling().scaleWidth(10),
  },

  closeCaloriesButton: {
    backgroundColor: colors.primary,
    paddingVertical: scaling().scaleHeight(15),
    borderRadius: scaling().moderateScale(16),
    alignItems: "center",
    marginTop: scaling().scaleHeight(4),
  },

  closeCaloriesButtonText: {
    color: "#FFFFFF",
    fontSize: scaling().moderateScale(15),
    fontFamily: "OpenSans_700Bold",
  },

  // ─── Workout rating card ─────────────────────────────────────────────────
  ratingCard: {
    width: "100%",
    marginTop: scaling().scaleHeight(16),
    backgroundColor: "#FFFFFF",
    borderRadius: scaling().moderateScale(24),
    padding: scaling().moderateScale(18),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: scaling().moderateScale(17),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    textAlign: "center",
  },
  ratingSubtitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    textAlign: "center",
    marginTop: scaling().scaleHeight(4),
    marginBottom: scaling().scaleHeight(18),
  },
  starsRow: {
    flexDirection: "row",
    gap: scaling().moderateScale(10),
    marginBottom: scaling().scaleHeight(18),
  },
  feelingsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scaling().moderateScale(8),
    justifyContent: "center",
    marginBottom: scaling().scaleHeight(18),
  },
  feelingChip: {
    paddingHorizontal: scaling().scaleWidth(14),
    paddingVertical: scaling().scaleHeight(8),
    borderRadius: scaling().moderateScale(999),
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F7F8FA",
  },
  feelingChipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(12),
    color: colors.text,
  },
  feelingChipTextActive: {
    color: "#FFFFFF",
  },
  ratingSubmitBtn: {
    width: "100%",
    height: scaling().scaleHeight(48),
    borderRadius: scaling().moderateScale(16),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  ratingSubmitBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },
  ratingSubmitText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(14),
    color: "#FFFFFF",
  },
  thankYouWrap: {
    alignItems: "center",
    paddingVertical: scaling().scaleHeight(8),
  },
  thankYouEmoji: {
    fontSize: scaling().moderateScale(44),
    marginBottom: scaling().scaleHeight(8),
  },
  thankYouTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(16),
    color: colors.text,
    textAlign: "center",
  },
  thankYouSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(12),
    color: colors.textLight,
    textAlign: "center",
    marginTop: scaling().scaleHeight(6),
    lineHeight: scaling().moderateScale(18),
  },
});

export default CongratsScreen;
