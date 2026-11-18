import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
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
import BrandGradient from "../../../components/ui/BrandGradient";
import { praiseWorkout, sayFromJack } from "../../../constants/bubbleMessage";
import { maybeAskForReview } from "../../../constants/appReview";
import { colors, isDark } from "../../../constants/colors";
import { useUser } from "../../../constants/UserContext";
import { Logger } from "../../../constants/Logger";
import { trackEvent } from "../../../constants/mixpanel";
import { markMotherhoodWorkout } from "../../../constants/motherhood";
import { scaling } from "../../../constants/useScaling";
import {
  EXPRESSION_IMAGES,
  getWidgetPromoState,
  trackWidgetGuideOpened,
} from "../../../constants/widgetPromo";
import WidgetGuideModal from "../../profile/WidgetGuideModal";
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
  startTime,
}) => {
  const { user } = useUser();
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
  const [widgetGuideVisible, setWidgetGuideVisible] = useState(false);
  // The widget is Android-only; hidden once they say they've added it.
  const [showWidgetPromo, setShowWidgetPromo] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let alive = true;
    getWidgetPromoState()
      .then((st) => alive && setShowWidgetPromo(!st?.markedAdded))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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

  // Jack's one-liner in the hero — proud, a little cheeky.
  const [cheer] = useState(() => {
    const lines =
      progressPercent >= 100
        ? [
            "Look at you, sweaty and proud. I'm proud too 🥹",
            "Full session done. You may now flex at strangers 💪",
            "That was elite. Even I'm impressed 😎",
            "Your couch just lost a loyal customer 🛋️",
          ]
        : [
            "Half a workout still beats zero. Respect 🙌",
            "You showed up — that's the hard part done 💪",
            "Not every set, but every bit counts 🔥",
          ];
    return lines[Math.floor(Math.random() * lines.length)];
  });

  // Minutes from opening the workout to finishing it (at least 1).
  const [minutes] = useState(() =>
    startTime ? Math.max(1, Math.round((Date.now() - startTime) / 60000)) : null,
  );

  // ─── Track event + show interstitial ad ─────────────────────────────────
  // DB insertion is handled by the parent (WorkoutDetail) BEFORE this
  // screen mounts. By the time we're here, the data is already saved, so
  // it's safe to show the interstitial without risking an unmount mid-write.
  useEffect(() => {
    // Total time from entering the workout to reaching this screen.
    const durationSec = startTime
      ? Math.max(0, Math.round((Date.now() - startTime) / 1000))
      : 0;

    trackEvent("Exercise Completed", {
      userId: userId || "",
      bodyPart: workouts?.bodyPart || "",
      level: workouts?.level || "",
      totalExercises: totalWorkoutCount,
      completedCount,
      durationSec,
      durationMinutes: Math.round((durationSec / 60) * 10) / 10,
    });

    // Lets Jack tailor chat advice for moms (stored on the device only).
    markMotherhoodWorkout(workouts?.bodyPart, user?.gender);

    InterstitialAdManager.getInstance().show();

    // Jack reacts from the floating bubble once the interstitial is out of the
    // way, so the praise isn't buried under an ad.
    const t = setTimeout(() => sayFromJack(praiseWorkout(user?.name)), 2600);
    return () => clearTimeout(t);
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

    const pulse = Animated.loop(
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
    );
    pulse.start();

    const confetti = setTimeout(() => {
      confettiAnim.current?.play();
    }, 350);

    // Leaving Congrats must leave nothing running: the endless pulse would keep
    // animating, and the confetti timer could fire on an unmounted screen.
    return () => {
      pulse.stop();
      clearTimeout(confetti);
    };
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
    { id: "tired", label: "Tired 😓", color: colors.textMuted },
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
            <Ionicons name="flame" size={22} color={colors.primary} />
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
        {/* ─── Workout complete: Jack, the numbers and Share, in one card ─── */}
        <Animated.View
          style={[
            styles.doneCard,
            { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] },
          ]}
        >
          <Animated.View
            style={{ transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] }}
          >
            <Image source={EXPRESSION_IMAGES.proud} style={styles.doneMascot} contentFit="contain" />
          </Animated.View>
          <Text style={styles.doneTitle}>Workout complete!</Text>
          <Text style={styles.doneCheer}>{cheer}</Text>
          <View style={styles.donePill}>
            <Icon name="fitness-outline" size={13} color={colors.primary} />
            <Text style={styles.donePillText}>
              {workouts?.bodyPart || "Workout"} · {workouts?.level || "Level"}
            </Text>
          </View>

          <View style={styles.statsCard}>
            <TouchableOpacity
              style={styles.statCol}
              activeOpacity={0.7}
              onPress={() => setShowCaloriesDetails(true)}
            >
              <Animated.Text style={styles.statValue}>
                {animatedCalories.interpolate({
                  inputRange: [0, Math.max(safeCalories, 1)],
                  outputRange: ["0", String(safeCalories)],
                })}
              </Animated.Text>
              <View style={styles.statLabelRow}>
                <Text style={styles.statLabel}>kcal</Text>
                <Icon name="information-circle-outline" size={12} color={colors.textLight} />
              </View>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Animated.Text style={styles.statValue}>
                {animatedWorkouts.interpolate({
                  inputRange: [0, Math.max(completedCount, 1)],
                  outputRange: ["0", String(completedCount)],
                })}
              </Animated.Text>
              <Text style={styles.statLabel}>exercises</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{minutes ?? "–"}</Text>
              <Text style={styles.statLabel}>minutes</Text>
            </View>
          </View>

          {progressPercent < 100 ? (
            <Text style={styles.donePartial}>
              {completedCount} of {totalWorkoutCount} exercises done
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.doneShare}
            activeOpacity={0.85}
            onPress={() => setShowShareCard(true)}
          >
            <Icon name="share-social-outline" size={17} color={colors.primary} />
            <Text style={styles.doneShareText}>Share achievement</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ─── Badge: one compact row + bar ─── */}
        {badge ? (
          <Animated.View
            style={[
              styles.badgeRowCard,
              { opacity: fadeAnim, transform: [{ translateY: cardSlideAnim }] },
            ]}
          >
            <View style={styles.badgeRowTop}>
              <Text style={styles.badgeRowEmoji}>{badge.emoji || "🏅"}</Text>
              <Text style={styles.badgeRowTitle} numberOfLines={1}>
                {badge.title} · {badge.score} pts
              </Text>
              {pointsEarned > 0 ? (
                <View style={styles.badgeRowPill}>
                  <Text style={styles.badgeRowPillText}>+{pointsEarned} pts</Text>
                </View>
              ) : null}
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
            <Text style={styles.badgeRowHint}>
              {badgeProgress.remainingPoints > 0
                ? `${badgeProgress.remainingPoints} pts to ${badgeProgress.nextTitle}`
                : "Highest badge reached"}
            </Text>
          </Animated.View>
        ) : null}

        {/* ─── Widget: Jack asks for a spot on the home screen (Android) ─── */}
        {showWidgetPromo ? (
          <Animated.View
            style={[
              styles.widgetCard,
              { opacity: fadeAnim, transform: [{ translateY: cardSlideAnim }] },
            ]}
          >
            <Image source={EXPRESSION_IMAGES.phone} style={styles.widgetMascot} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetTitle}>Keep me on your home screen</Text>
              <Text style={styles.widgetSub}>
                Seeing your streak every time you unlock your phone makes skipping harder.
              </Text>
              <TouchableOpacity
                style={styles.widgetBtn}
                activeOpacity={0.85}
                onPress={() => {
                  trackWidgetGuideOpened("congrats");
                  setWidgetGuideVisible(true);
                }}
              >
                <Text style={styles.widgetBtnText}>Add widget</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

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
              <Text style={styles.ratingTitle}>Rate this workout</Text>

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

              {ratingStars > 0 ? (
                <>
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
              ) : null}
            </>
          )}
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
            Logger.log("[AdMob] Banner loaded");
          }}
          onAdFailedToLoad={(error) => {
            console.warn("[AdMob] Banner failed:", error);
          }}
        />
      </View>

      {showCaloriesDetails && <CaloriesDetailsModal />}

      {widgetGuideVisible ? (
        <WidgetGuideModal
          visible={widgetGuideVisible}
          setVisible={(v) => {
            setWidgetGuideVisible(v);
            // Re-check: hide the card once they mark it added.
            if (!v) {
              getWidgetPromoState()
                .then((st) => setShowWidgetPromo(!st?.markedAdded))
                .catch(() => {});
            }
          }}
          name={user?.name}
        />
      ) : null}

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

// Soft brand tint (same as the home plan card).
const TINT = colors.primarySoft;
const TINT_BORDER = isDark ? "#4A2E20" : "#FFE0D3";

const styles = StyleSheet.create({
  // ── Workout complete card ──
  doneCard: {
    backgroundColor: TINT,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: TINT_BORDER,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
    alignSelf: "stretch",
  },
  doneMascot: { width: 84, height: 84 },
  doneTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: 20, color: colors.text, marginTop: 2 },
  doneCheer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 13,
    color: colors.textLight,
    textAlign: "center",
    marginTop: 2,
  },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  donePillText: { fontFamily: "OpenSans_600SemiBold", fontSize: 12, color: colors.primary },
  donePartial: { fontFamily: "OpenSans_500Medium", fontSize: 12, color: colors.textLight, marginTop: 8 },
  doneShare: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
    marginTop: 12,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: TINT_BORDER,
  },
  doneShareText: { fontFamily: "OpenSans_700Bold", fontSize: 14, color: colors.primary },

  // ── Badge row ──
  badgeRowCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 14,
    marginBottom: 12,
    alignSelf: "stretch",
  },
  badgeRowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  badgeRowEmoji: { fontSize: 20 },
  badgeRowTitle: { flex: 1, fontFamily: "OpenSans_600SemiBold", fontSize: 14, color: colors.text },
  badgeRowPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E9F7EF",
  },
  badgeRowPillText: { fontFamily: "OpenSans_700Bold", fontSize: 11.5, color: "#15803D" },
  badgeRowHint: { fontFamily: "OpenSans_400Regular", fontSize: 12, color: colors.textLight, marginTop: 6 },

  // ── Widget promo ──
  widgetCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEA",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginBottom: 12,
    alignSelf: "stretch",
  },
  widgetMascot: { width: 64, height: 64 },
  widgetTitle: { fontFamily: "OpenSans_700Bold", fontSize: 14, color: colors.text },
  widgetSub: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
    lineHeight: 17,
  },
  widgetBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  widgetBtnText: { fontFamily: "OpenSans_700Bold", fontSize: 12.5, color: "#FFFFFF" },

  container: {
    flex: 1,
    backgroundColor: colors.screen,
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
    borderRadius: scaling().moderateScale(26),
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
    paddingTop: scaling().scaleHeight(18),
    paddingBottom: scaling().scaleHeight(20),
  },

  mascotWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaling().scaleHeight(6),
  },

  mascotHalo: {
    position: "absolute",
    width: scaling().moderateScale(132),
    height: scaling().moderateScale(132),
    borderRadius: scaling().moderateScale(66),
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  mascot: {
    width: scaling().moderateScale(150),
    height: scaling().moderateScale(150),
  },

  // ─── Stats card ──────────────────────────────────────────────────────────
  statsCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: scaling().moderateScale(14),
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  statCol: {
    flex: 1,
    alignItems: "center",
  },

  statIcon: {
    width: scaling().moderateScale(34),
    height: scaling().moderateScale(34),
    borderRadius: scaling().moderateScale(17),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaling().moderateScale(6),
  },

  statValue: {
    fontSize: scaling().moderateScale(20),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  statLabel: {
    fontSize: scaling().moderateScale(11.5),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },

  statDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: scaling().moderateScale(6),
    backgroundColor: colors.track,
  },

  congratsTitle: {
    fontSize: scaling().moderateScale(22),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
  },

  congratsSubtitle: {
    fontSize: scaling().moderateScale(13.5),
    lineHeight: scaling().moderateScale(19),
    fontFamily: "OpenSans_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginTop: scaling().scaleHeight(6),
    paddingHorizontal: scaling().moderateScale(8),
  },

  workoutNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: scaling().scaleHeight(12),
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

  progressContainer: {
    backgroundColor: colors.card,
    padding: scaling().moderateScale(16),
    borderRadius: scaling().moderateScale(22),
    marginTop: scaling().scaleHeight(14),
    width: "100%",
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.track,
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
    backgroundColor: colors.card,
    borderRadius: scaling().moderateScale(24),
    padding: scaling().moderateScale(18),
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.track,
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
    backgroundColor: colors.card,
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
    backgroundColor: colors.track,
    marginVertical: scaling().scaleHeight(14),
  },

  equivalentItems: {
    gap: scaling().scaleHeight(10),
  },

  equivalentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screen,
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
    marginTop: 0,
    backgroundColor: colors.card,
    borderRadius: scaling().moderateScale(24),
    padding: scaling().moderateScale(18),
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: scaling().moderateScale(15),
    fontFamily: "OpenSans_700Bold",
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
    borderColor: colors.hairline,
    backgroundColor: colors.screen,
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
