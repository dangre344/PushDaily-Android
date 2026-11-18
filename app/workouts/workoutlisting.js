import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";

import { AD_UNIT_IDS } from "../../ads/Admobmanager.js";
import { Button } from "../../components/ui/Button.js";
import IconWithText from "../../components/ui/IconWithText";
import { sayFromJack } from "../../constants/bubbleMessage";
import { colors, isDark } from "../../constants/colors";
import { workoutListGlobal } from "../../constants/Constants.js";
import { Logger } from "../../constants/Logger.js";
import { scaling } from "../../constants/useScaling.js";
import { EXPRESSION_IMAGES } from "../../constants/widgetPromo";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

// Rotating nudges above the Start button — the last push past procrastination.
// Jack's expression changes with each line.
const MOTIVATIONS = [
  { text: "Let's go — your body is ready 💪", expression: "dumbbell" },
  { text: "Staring won't burn calories. Tap Start 😏", expression: "wink" },
  { text: "Come on, let's defeat procrastination 🚀", expression: "flex" },
  { text: "Still thinking? I'm already sweating 🤔", expression: "think" },
  { text: "Future you is already saying thank you 🙌", expression: "cheer" },
  { text: "The hardest part is pressing Start 👇", expression: "hi" },
];

// Warm lines for moms on the Pregnancy and Post Pregnancy plans.
const MOM_MOTIVATIONS = {
  Pregnancy: [
    { text: "Strong mama, healthy baby — let's move gently 🤰", expression: "cheer" },
    { text: "Every breath you take here is for two 💗", expression: "hi" },
    { text: "You're growing a whole human. You've got this 🌸", expression: "flex" },
    { text: "A few gentle minutes now, an easier delivery later 🙌", expression: "dumbbell" },
    { text: "Listen to your body — slow is perfect today 🌿", expression: "think" },
  ],
  "Post Pregnancy": [
    { text: "You did something amazing. Now a little time for you 💗", expression: "cheer" },
    { text: "Rebuild slowly, mama — every rep counts 🌸", expression: "flex" },
    { text: "A stronger you is a happier you for your baby 👶", expression: "hi" },
    { text: "Small steps, big comeback. Let's begin 🙌", expression: "dumbbell" },
    { text: "Be proud of your body — it made a miracle ✨", expression: "wink" },
  ],
};
const MOM_HELLO = {
  Pregnancy: "Hi mama! A gentle workout for you and baby 🤰💗",
  "Post Pregnancy": "Welcome back, mama! Let's rebuild your strength 💗",
};

// Long enough to actually read a two-line bubble, then a short breather.
const MOTIVATION_MS = 6500; // time each line stays on screen
const MOTIVATION_GAP_MS = 350; // empty beat between lines

/**
 * Jack's rotating nudge + the pulsing Start button. Its own component so the
 * line changing every few seconds re-renders only this, not the whole screen
 * and its list (which caused hitches mid-scroll).
 */
function CoachStart({ label, onStart, bodyPart }) {
  const lines = MOM_MOTIVATIONS[bodyPart] || MOTIVATIONS;
  const [motivationIndex, setMotivationIndex] = useState(0);
  const motivationOpacity = useRef(new Animated.Value(0)).current;
  const motivationY = useRef(new Animated.Value(8)).current;
  const startPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;

    const showNext = () => {
      // Fade + slide the current line in, hold, then take it back out.
      Animated.parallel([
        Animated.timing(motivationOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(motivationY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          if (cancelled) return;
          Animated.parallel([
            Animated.timing(motivationOpacity, {
              toValue: 0,
              duration: 350,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(motivationY, {
              toValue: -8,
              duration: 350,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (cancelled) return;
            motivationY.setValue(8);
            setMotivationIndex((i) => (i + 1) % lines.length);
            setTimeout(() => !cancelled && showNext(), MOTIVATION_GAP_MS);
          });
        }, MOTIVATION_MS);
      });
    };

    showNext();

    // Jack nudges from the floating bubble once the list has settled.
    const hello = setTimeout(
      () => sayFromJack(MOM_HELLO[bodyPart] || "Let's go — time to start this workout 💪", 7000),
      900,
    );

    // Gentle breathing pulse on the button so it reads as "tap me".
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(startPulse, {
          toValue: 1.035,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(startPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      cancelled = true;
      clearTimeout(hello);
      pulse.stop();
      motivationOpacity.stopAnimation();
      motivationY.stopAnimation();
    };
  }, []);

  return (
    <>
      {/* Jack + a speech bubble, nudging towards Start. */}
      <View style={styles.coachRow}>
        {/* Jack dims and settles while the line swaps, and the new pose
              cross-dissolves in, so the change never pops. */}
        <Animated.View
          style={{
            opacity: motivationOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0.45, 1],
            }),
            transform: [
              {
                translateY: startPulse.interpolate({
                  inputRange: [1, 1.035],
                  outputRange: [0, -3],
                }),
              },
              {
                scale: motivationOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ],
          }}
        >
          <ExpoImage
            source={EXPRESSION_IMAGES[lines[motivationIndex % lines.length].expression]}
            style={styles.coachMascot}
            contentFit="contain"
            transition={{ duration: 420, effect: "cross-dissolve" }}
          />
        </Animated.View>

        <View style={styles.coachBubble}>
          <View style={styles.coachTail} />
          <Animated.Text
            style={[
              styles.motivationText,
              {
                opacity: motivationOpacity,
                transform: [{ translateY: motivationY }],
              },
            ]}
            numberOfLines={2}
          >
            {lines[motivationIndex % lines.length].text}
          </Animated.Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ scale: startPulse }] }}>
        <Button title={label} style={styles.startButton} onPress={onStart} />
      </Animated.View>
    </>
  );
}

export default function WorkoutListingScreen({ route }) {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useTranslation();

  const [previewImage, setPreviewImage] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const imagePreviewOpacity = useRef(new Animated.Value(0)).current;
  const imagePreviewScale = useRef(new Animated.Value(0.85)).current;

  const scrollY = useRef(new Animated.Value(0)).current;

  const { selectedBodyPart } = useLocalSearchParams();
  // The param can arrive from a deep link, so it may not be valid JSON; a null
  // here lands on the "Workout not found" state below.
  let bodyPartObj = null;
  try {
    bodyPartObj = selectedBodyPart ? JSON.parse(selectedBodyPart) : null;
  } catch (e) {
    Logger.warn("[WorkoutListing] Bad selectedBodyPart param:", e?.message);
  }

  Logger.log("Received bodyPart in WorkoutListingScreen:", selectedBodyPart);

  const HEADER_MAX_HEIGHT = moderateScale(250);
  const HEADER_MIN_HEIGHT = moderateScale(96);
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const workouts = workoutListGlobal.find(
    (item) =>
      item.workoutId === bodyPartObj?.id &&
      item.bodyPart === bodyPartObj?.name &&
      item.level === bodyPartObj?.level,
  );

  if (!workouts) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.emptyBackButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.emptyTitle}>Workout not found</Text>
          <Text style={styles.emptySubtitle}>
            Please go back and select a workout again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const workoutCount = workouts?.workoutList?.length || 0;

  const totalReps = workouts?.workoutList?.reduce((sum, item) => {
    const reps = Number(item?.reps || 0);
    return sum + reps;
  }, 0);

  // Everything below runs on the native driver (transform/opacity only), so
  // scrolling never waits on the JS thread. The header used to shrink by
  // animating its height — a layout change every frame, JS-driven. Now it keeps
  // its height and slides up by the same distance, leaving the same
  // HEADER_MIN_HEIGHT strip on screen.
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: "clamp",
  });

  // The top back button rides against the slide, so it stays put until the
  // compact header (with its own back button) fades in.
  const overlayTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, HEADER_SCROLL_DISTANCE],
    extrapolate: "clamp",
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE * 0.65, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-80, 0, HEADER_SCROLL_DISTANCE],
    outputRange: [1.18, 1, 1.04],
    extrapolate: "clamp",
  });

  // Gentle parallax: the photo moves up a little slower than the header.
  const imageTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, HEADER_SCROLL_DISTANCE * 0.35],
    extrapolate: "clamp",
  });

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE * 0.45, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.65, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -55],
    extrapolate: "clamp",
  });

  const fixedHeaderOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE - 55, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const fixedHeaderTranslateY = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE - 60, HEADER_SCROLL_DISTANCE],
    outputRange: [-12, 0],
    extrapolate: "clamp",
  });

  const handleStartWorkout = () => {
    Logger.log(
      "Navigating to WorkoutDetail with selectedBodyPart:",
      bodyPartObj?.id,
    );

    Logger.log(
      "Navigating to WorkoutDetail with bodyPartObj:",
      JSON.stringify({
        id: bodyPartObj?.id,
        name: bodyPartObj?.name,
        level: bodyPartObj?.level,
      }),
    );

    router.replace({
      pathname: "/workouts/workoutdetail",
      params: {
        id: bodyPartObj?.id,
        name: bodyPartObj?.name,
        level: bodyPartObj?.level,
      },
    });
  };

  const openImagePreview = (image, title) => {
    setPreviewImage(image);
    setPreviewTitle(title || "");

    imagePreviewOpacity.setValue(0);
    imagePreviewScale.setValue(0.85);

    Animated.parallel([
      Animated.timing(imagePreviewOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(imagePreviewScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeImagePreview = () => {
    Animated.parallel([
      Animated.timing(imagePreviewOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(imagePreviewScale, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPreviewImage(null);
      setPreviewTitle("");
    });
  };

  // Rows are plain views: no per-row scroll animation to recompute every
  // frame. expo-image decodes each photo at thumbnail size, not full size.
  // Rows form one grouped card (hairline dividers) instead of ten separate
  // shadowed cards: step number, thumbnail, name, then reps/time in grey.
  const renderWorkoutItem = ({ item, index }) => {
    const first = index === 0;
    const last = index === workoutCount - 1;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openImagePreview(item?.photo, item?.name)}
        style={[styles.row, first && styles.rowFirst, last && styles.rowLast]}
      >
        <Text style={styles.rowIndex}>{index + 1}</Text>

        <View style={styles.rowThumb}>
          <ExpoImage style={styles.rowImage} source={item?.photo} contentFit="contain" />
        </View>

        <View style={[styles.rowInfo, !first && styles.rowDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.rowMeta}>
              <Ionicons
                name={item.reps ? "repeat" : "time-outline"}
                size={moderateScale(13)}
                color={colors.textLight}
              />
              <Text style={styles.rowMetaText}>
                {item.reps ? `${item.reps} reps` : item.time}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={moderateScale(16)} color="#C8CDD6" />
        </View>
      </TouchableOpacity>
    );
  };

  // An element, not a component defined in render: a new component type on
  // every render made the list unmount and remount its header each time.
  // Recovery plans carry a safety note above the list. Most have one gentle
  // level, so they say "Gentle" instead of a level; Neck Recovery has three
  // levels and shows its level like other plans.
  const isRecovery = !!workouts.recovery;
  const recoveryLevels = isRecovery
    ? workoutListGlobal.filter((w) => w.recovery && w.bodyPart === workouts.bodyPart).length
    : 0;
  const levelLabel = isRecovery && recoveryLevels < 2 ? "Gentle" : workouts.level;

  const listHeader = (
    <View>
    {isRecovery ? (
      <View style={styles.recoveryNote}>
        <Ionicons name="medkit-outline" size={18} color="#B45309" />
        <Text style={styles.recoveryNoteText}>
          Please take care while performing these exercises. Move slowly and
          stop if anything hurts. If your doctor or physiotherapist has
          recommended rest, avoid the stretches.
        </Text>
      </View>
    ) : null}
    <View style={styles.listHeaderCard}>
      <View>
        <Text style={styles.totalWorkoutTitle}>{`Total Workouts`}</Text>
        <Text style={styles.totalWorkoutCount}>{workoutCount} exercises</Text>
      </View>

      <View style={styles.summaryRight}>
        <View style={styles.summaryPill}>
          <Ionicons name="flame-outline" size={16} color={colors.primary} />
          <Text style={styles.summaryPillText}>{workouts.calories} Kcal</Text>
        </View>

        {totalReps > 0 ? (
          <Text style={styles.totalRepsText}>{totalReps} total reps</Text>
        ) : null}
      </View>
    </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.fixedHeader,
          {
            opacity: fixedHeaderOpacity,
            transform: [{ translateY: fixedHeaderTranslateY }],
          },
        ]}
      >
        <SafeAreaView style={styles.fixedHeaderSafeArea} edges={["top"]}>
          <StatusBar
            barStyle="light-content"
            backgroundColor={colors.background}
          />
          <View style={styles.fixedHeaderContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.fixedBackButton}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.fixedTitleBlock}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {workouts.bodyPart}
              </Text>

              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {levelLabel} • {workoutCount} workouts
              </Text>
            </View>

            <View style={styles.fixedCaloriesBadge}>
              <Ionicons name="flame-outline" size={14} color="#FFFFFF" />
              <Text style={styles.fixedCaloriesText}>{workouts.calories}</Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.View
        style={[
          styles.header,
          {
            height: HEADER_MAX_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <Animated.Image
          source={workouts?.headerImg || workouts?.img}
          style={[
            styles.headerImage,
            {
              opacity: imageOpacity,
              transform: [
                { translateY: imageTranslateY },
                { scale: imageScale },
              ],
            },
          ]}
        />

        <View style={styles.headerGradient} />

        <Animated.View
          style={[
            styles.imageOverlay,
            { transform: [{ translateY: overlayTranslateY }] },
          ]}
        >
          <SafeAreaView edges={["top"]}>
            <StatusBar
              barStyle={isDark ? "light-content" : "dark-content"}
              backgroundColor={colors.background}
            />
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.imageBackButton}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={23} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>

        <Animated.View
          style={[
            styles.titleOverlay,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          {/* Recovery posters carry their own title, so the big one is hidden. */}
          {isRecovery ? null : (
            <Text style={styles.overlayTitle} numberOfLines={2}>
              {workouts.bodyPart}
            </Text>
          )}

          <View style={styles.overlayMeta}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelLabel === "Gentle" ? levelLabel : `Level: ${workouts.level}`}</Text>
            </View>

            <View style={styles.overlayCalories}>
              <Ionicons name="flame-outline" size={14} color="#FFFFFF" />
              <Text style={styles.overlayCaloriesText}>
                {workouts.calories} Kcal
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.FlatList
        data={workouts.workoutList}
        renderItem={renderWorkoutItem}
        ListHeaderComponent={listHeader}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: HEADER_MAX_HEIGHT },
        ]}
        // Native driver: the header follows the scroll on the UI thread.
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.bottomBar}>
        <CoachStart
          label={t("start")}
          onStart={handleStartWorkout}
          bodyPart={bodyPartObj?.name}
        />

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
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="none"
        onRequestClose={closeImagePreview}
      >
        <Animated.View
          style={[
            styles.imagePreviewOverlay,
            {
              opacity: imagePreviewOpacity,
            },
          ]}
        >
          <Pressable
            style={styles.imagePreviewBackdrop}
            onPress={closeImagePreview}
          />

          <Animated.View
            style={[
              styles.imagePreviewCard,
              {
                transform: [{ scale: imagePreviewScale }],
              },
            ]}
          >
            <View style={styles.imagePreviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.imagePreviewTitle} numberOfLines={1}>
                  {previewTitle}
                </Text>
                <Text style={styles.imagePreviewSubtitle}>
                  Exercise preview
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.imagePreviewClose}
                onPress={closeImagePreview}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.imagePreviewImageBox}>
              {previewImage ? (
                <Image
                  source={previewImage}
                  style={styles.imagePreviewImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <Text style={styles.imagePreviewHint}>
              Tap outside or press close to go back
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  recoveryNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  recoveryNoteText: {
    flex: 1,
    fontFamily: "OpenSans_400Regular",
    fontSize: moderateScale(12.5),
    lineHeight: moderateScale(18),
    color: "#7C2D12",
  },
  // ── Exercise rows (one grouped card) ──
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingLeft: moderateScale(12),
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.hairline,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: moderateScale(18),
    borderTopRightRadius: moderateScale(18),
    paddingTop: moderateScale(4),
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: moderateScale(18),
    borderBottomRightRadius: moderateScale(18),
    paddingBottom: moderateScale(4),
  },
  rowIndex: {
    width: moderateScale(18),
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },
  rowThumb: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(12),
    backgroundColor: colors.screen,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginVertical: moderateScale(8),
  },
  rowImage: { width: "92%", height: "92%" },
  // The divider starts after the thumbnail, like an inset list.
  rowInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginLeft: moderateScale(12),
    paddingRight: moderateScale(12),
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E9EF" },
  rowName: { fontSize: moderateScale(14.5), fontFamily: "OpenSans_600SemiBold", color: colors.text },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: moderateScale(4), marginTop: 2 },
  rowMetaText: { fontSize: moderateScale(12.5), fontFamily: "OpenSans_400Regular", color: colors.textLight },

  container: {
    flex: 1,
    backgroundColor: colors.screen,
  },

  zoomBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  imagePreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  imagePreviewCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 20,
  },

  imagePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  imagePreviewTitle: {
    fontSize: 18,
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  imagePreviewSubtitle: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 2,
  },

  imagePreviewClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.screen,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  imagePreviewImageBox: {
    width: "100%",
    height: 360,
    borderRadius: 22,
    backgroundColor: colors.screen,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  imagePreviewImage: {
    width: "100%",
    height: "100%",
  },

  imagePreviewHint: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 12,
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: moderateScale(20),
    justifyContent: "center",
    alignItems: "center",
  },

  emptyBackButton: {
    position: "absolute",
    top: moderateScale(16),
    left: moderateScale(16),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  emptyTitle: {
    fontSize: moderateScale(22),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: moderateScale(8),
  },

  emptySubtitle: {
    fontSize: moderateScale(14),
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    textAlign: "center",
  },

  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 6,
  },

  fixedHeaderSafeArea: {
    backgroundColor: colors.card,
  },

  fixedHeaderContent: {
    minHeight: moderateScale(66),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(10),
    gap: moderateScale(12),
  },

  fixedBackButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    backgroundColor: colors.screen,
    alignItems: "center",
    justifyContent: "center",
  },

  fixedTitleBlock: {
    flex: 1,
  },

  headerTitle: {
    fontSize: moderateScale(17),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  headerSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: moderateScale(2),
  },

  fixedCaloriesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
    backgroundColor: colors.primary,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(999),
  },

  fixedCaloriesText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "#FFFFFF",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 10,
    backgroundColor: colors.primary,
  },

  headerImage: {
    width: "100%",
    height: "100%",
  },

  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },

  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(18),
  },

  imageBackButton: {
    marginTop: moderateScale(10),
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },

  titleOverlay: {
    position: "absolute",
    left: moderateScale(20),
    right: moderateScale(20),
    bottom: moderateScale(24),
  },

  levelBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
    marginBottom: moderateScale(10),
  },

  levelBadgeText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: "#FFFFFF",
  },

  overlayTitle: {
    fontSize: moderateScale(34),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    lineHeight: moderateScale(40),
    marginBottom: moderateScale(14),
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  overlayMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(10),
  },

  overlayMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(999),
  },

  overlayMetaText: {
    fontSize: moderateScale(13),
    color: "#FFFFFF",
    fontFamily: "OpenSans_700Bold",
  },

  overlayCalories: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(6),
    backgroundColor: colors.primary,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
    marginBottom: moderateScale(10),
  },

  overlayCaloriesText: {
    fontSize: moderateScale(12),
    color: "#FFFFFF",
    fontFamily: "OpenSans_700Bold",
  },

  listContent: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(185),
  },

  listHeaderCard: {
    backgroundColor: colors.card,
    marginTop: moderateScale(20),

    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    marginBottom: moderateScale(14),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },

  totalWorkoutTitle: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginBottom: moderateScale(3),
  },

  totalWorkoutCount: {
    fontSize: moderateScale(22),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  summaryRight: {
    alignItems: "flex-end",
    gap: moderateScale(6),
  },

  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(5),
    backgroundColor: colors.primary + "14",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(999),
  },

  summaryPillText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
  },

  totalRepsText: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
  },

  workoutItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    marginBottom: moderateScale(12),
    padding: moderateScale(12),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  workoutImageWrapper: {
    width: moderateScale(76),
    height: moderateScale(76),
    borderRadius: moderateScale(18),
    backgroundColor: colors.screen,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  workoutImage: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(14),
  },

  workoutInfo: {
    flex: 1,
    marginLeft: moderateScale(14),
  },

  workoutTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
  },

  workoutName: {
    flex: 1,
    fontSize: moderateScale(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: moderateScale(6),
  },

  indexBadge: {
    width: moderateScale(25),
    height: moderateScale(25),
    borderRadius: moderateScale(13),
    backgroundColor: "#F1F3F7",
    alignItems: "center",
    justifyContent: "center",
  },

  indexText: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  softChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(5),
    backgroundColor: colors.primary + "12",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
  },

  softChipText: {
    fontSize: moderateScale(13),
    color: colors.primary,
    fontFamily: "OpenSans_700Bold",
  },

  workoutDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(15),
  },

  detailText: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
  },

  chevron: {
    marginLeft: moderateScale(6),
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    paddingTop: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 12,
  },

  startButton: {
    paddingVertical: moderateScale(17),
    borderRadius: moderateScale(16),
    marginBottom: moderateScale(8),
  },

  coachRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: moderateScale(8),
    // Fixed height keeps the Start button from shifting as lines swap.
    height: moderateScale(52),
  },

  coachMascot: {
    width: moderateScale(52),
    height: moderateScale(52),
  },

  coachBubble: {
    flex: 1,
    marginLeft: moderateScale(10),
    backgroundColor: colors.primarySoft,
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(7),
    justifyContent: "center",
    minHeight: moderateScale(40),
  },

  coachTail: {
    position: "absolute",
    left: -moderateScale(5),
    top: "50%",
    marginTop: -moderateScale(5),
    width: moderateScale(10),
    height: moderateScale(10),
    backgroundColor: colors.primarySoft,
    transform: [{ rotate: "45deg" }],
  },

  motivationText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: moderateScale(12.5),
    color: colors.primary,
    lineHeight: moderateScale(17),
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: moderateScale(52),
  },
});
