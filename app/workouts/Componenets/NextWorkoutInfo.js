import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { exercisePhoto } from "../../../components/workout/exercisePhotos";
import { preloadExerciseVideo } from "../../../components/workout/ExerciseVideoPlayer";
import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";

const REST_SECONDS = 30;
const MAX_REST_SECONDS = 600;
const ADD_OPTIONS = [20, 30, 45];

const RING = scaling().moderateScale(84);
const STROKE = scaling().moderateScale(6);
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Rest between exercises: a countdown on top, the exercise that's up next
// below. Laid out to fit the screen without scrolling.
export default function NextWorkoutInfo({ workouts, index, setLoadingPage }) {
  const upNext = workouts.workoutList[index];

  const [showSteps, setShowSteps] = useState(false);
  const [timeLeft, setTimeLeft] = useState(REST_SECONDS);
  // The ring empties over the whole rest, including any time the user added.
  const [totalTime, setTotalTime] = useState(REST_SECONDS);
  const [addedLabel, setAddedLabel] = useState("");
  const timerRef = useRef(null);
  const finishedRef = useRef(false);
  const addedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only counts down — an updater must stay pure, so finishing is handled
    // by the effect below. (Calling the parent's setLoadingPage from inside
    // this updater was the "Cannot update a component while rendering a
    // different component" error.)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    // This screen appears between every exercise: leave nothing running.
    return () => clearInterval(timerRef.current);
  }, []);

  // Rest is over: stop the clock and go to the next exercise.
  useEffect(() => {
    if (timeLeft > 0 || finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    setLoadingPage("play_workout");
  }, [timeLeft]);

  // Have the next clip ready by the time the rest ends.
  useEffect(() => {
    preloadExerciseVideo(upNext?.video);
  }, [upNext?.video]);

  const addTime = (seconds) => {
    const next = Math.min(MAX_REST_SECONDS, timeLeft + seconds);
    setTimeLeft(next);
    setTotalTime((total) => Math.max(total, next));

    setAddedLabel(`+${seconds}s added`);
    addedAnim.setValue(0);
    Animated.timing(addedAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  };

  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const amount = upNext.reps ? `${upNext.reps} reps` : `${upNext.time}`;

  return (
    <View style={styles.root}>
      {/* ── Rest countdown ───────────────────────────────────────────── */}
      <View style={[styles.card, styles.restCard]}>
        <View style={styles.ring}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke="#FFE7DD"
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={colors.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              // Start at 12 o'clock.
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        <View style={styles.restSide}>
          <View style={styles.restHeading}>
            <Text style={[styles.eyebrow, styles.eyebrowLeft]}>REST</Text>
            <Animated.Text
              style={[
                styles.addedFeedback,
                {
                  opacity: addedAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                },
              ]}
            >
              {addedLabel}
            </Animated.Text>
          </View>
          <Text style={styles.timerHint}>Next set starts automatically</Text>

          <View style={styles.addRow}>
            {ADD_OPTIONS.map((seconds) => (
              <TouchableOpacity
                key={seconds}
                style={styles.addPill}
                onPress={() => addTime(seconds)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Add ${seconds} seconds of rest`}
              >
                <Text style={styles.addPillText}>+{seconds}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Up next ──────────────────────────────────────────────────── */}
      <View style={[styles.card, styles.nextCard]}>
        <View style={styles.photoWrap}>
          <ExpoImage
            source={exercisePhoto(upNext.photo)}
            style={styles.photo}
            contentFit="contain"
            transition={0}
          />
        </View>

        <View style={styles.nextBody}>
          <Text style={[styles.eyebrow, styles.eyebrowLeft]}>UP NEXT</Text>
          <View style={styles.nextTitleRow}>
            <Text style={styles.nextName} numberOfLines={2}>
              {upNext.name}
            </Text>
            <View style={styles.amountBadge}>
              <Ionicons
                name={upNext.reps ? "repeat" : "time-outline"}
                size={scaling().moderateScale(13)}
                color={colors.primary}
              />
              <Text style={styles.amountText}>{amount}</Text>
            </View>
          </View>
          {upNext.focus?.length ? (
            <Text style={styles.focus} numberOfLines={1}>
              {upNext.focus.join(" · ")}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.stepsToggle}
            onPress={() => setShowSteps((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepsToggleText}>How to do it</Text>
            <Ionicons
              name={showSteps ? "chevron-up" : "chevron-down"}
              size={scaling().moderateScale(16)}
              color={colors.primary}
            />
          </TouchableOpacity>

          {showSteps &&
            upNext.steps?.map((step, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow (not flex): fills the screen, yet can grow past it — and scroll —
  // when the steps are opened.
  root: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EEF1F4",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },

  eyebrow: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(11),
    letterSpacing: 1.2,
    color: colors.primary,
  },
  eyebrowLeft: {
    alignSelf: "flex-start",
  },

  // Countdown: one compact row, so the photo below gets the height.
  restCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  restSide: {
    flex: 1,
  },
  restHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(22),
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  timerHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(12),
    color: colors.muted,
    marginTop: 2,
  },
  addedFeedback: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(11),
    color: colors.success,
  },
  addRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  addPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFF3EE",
    borderWidth: 1,
    borderColor: "#FFD9C9",
  },
  addPillText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(13),
    color: colors.primary,
  },

  // Up next
  nextCard: {
    flexGrow: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    overflow: "hidden",
    alignItems: "stretch",
  },
  // Takes whatever height is left, so the whole screen fits without a scroll.
  photoWrap: {
    flexGrow: 1,
    minHeight: scaling().scaleHeight(200),
    backgroundColor: colors.lightColor,
  },
  photo: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
  },
  nextBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  nextTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  nextName: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(17),
    color: colors.text,
  },
  amountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFF3EE",
  },
  amountText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(12),
    color: colors.primary,
  },
  focus: {
    marginTop: 4,
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(12),
    color: colors.muted,
  },
  stepsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF1F4",
  },
  stepsToggleText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(13),
    color: colors.primary,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  stepNumber: {
    width: scaling().moderateScale(22),
    height: scaling().moderateScale(22),
    borderRadius: 999,
    backgroundColor: "#FFF3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(11),
    color: colors.primary,
  },
  stepText: {
    flex: 1,
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(13),
    lineHeight: scaling().moderateScale(19),
    color: colors.text,
  },
});
