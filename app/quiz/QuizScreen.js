import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";
import { InterstitialAdManager } from "../../ads/Admobmanager";
import QuizFeedback from "./QuizFeedback";
import { praiseQuiz, sayFromJack } from "../../constants/bubbleMessage";
import { Image } from "expo-image";

import BrandGradient from "../../components/ui/BrandGradient";
import { colors } from "../../constants/colors";
import {
  successHaptic,
  tapHaptic,
  warningHaptic,
} from "../../constants/haptics";
import { trackEvent, trackScreen } from "../../constants/mixpanel";
import { getSessionQuestions } from "../../constants/quizDaily";
import { scheduleQuizReminder } from "../../constants/quizNotifications";
import { msUntilUtcReset } from "../../constants/leaderboard";
import { getCategoryMeta } from "../../constants/quizQuestions";
import {
  getQuizSummary,
  getRank,
  markDayReported,
  QUESTIONS_PER_QUIZ,
  submitQuizResult,
  XP_PER_CORRECT,
} from "../../constants/quizStore";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import { EXPRESSION_IMAGES } from "../../constants/widgetPromo";

const ms = (n) => scaling().moderateScale(n);
const { width: SCREEN_W } = Dimensions.get("window");
const LETTERS = ["A", "B", "C", "D"];
const SKIPPED = -1;

// Bonus XP per correct answer once a 3-in-a-row combo is running.
const COMBO_BONUS_XP = 5;

export default function QuizScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState("home"); // home | playing | result
  const [summary, setSummary] = useState(null);

  // ── session state ──
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState([]); // index | SKIPPED | undefined
  const [tipOpen, setTipOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lastBonus, setLastBonus] = useState(0);
  // Live mirrors — choose() runs from a callback and must not read stale state.
  const streakRef = useRef(0);
  const comboRef = useRef(0);
  const [gainedXp, setGainedXp] = useState(0);
  const [loadingSet, setLoadingSet] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Feedback is asked at most once per app session, never repeatedly.
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Questions reset at UTC midnight (quizStore's day key), same as the board.
  const [resetIn, setResetIn] = useState(msUntilUtcReset());
  useEffect(() => {
    const id = setInterval(() => setResetIn(msUntilUtcReset()), 30000);
    return () => clearInterval(id);
  }, []);
  const resetLabel = (() => {
    const h = Math.floor(resetIn / 3600000);
    const m = Math.floor((resetIn % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const advanceTimer = useRef(null);
  const adTimer = useRef(null);
  const advancingRef = useRef(false);
  // The quiz opens straight into the questions — no "Start Quiz" tap. This
  // guards against re-firing when the user taps "Home" from the result screen
  // (same focus), while still auto-starting each time the tab is re-entered.
  const autoStartedRef = useRef(false);
  // Holds the latest startQuiz. Listing it as a focus-effect dependency would
  // re-run the effect on every render and restart the quiz mid-play.
  const startQuizRef = useRef(null);
  // finishQuiz() runs from an animation callback, so it must not rely on the
  // `selected` state captured in that closure — keep a live mirror in a ref.
  const selectedRef = useRef([]);

  const setPick = (i, value) => {
    const next = [...selectedRef.current];
    next[i] = value;
    selectedRef.current = next;
    setSelected(next);
  };

  // ── animation values ──
  // A SINGLE card view stays mounted for the whole quiz, so these values are
  // never detached/re-attached mid-flight (doing that with the native driver
  // left the next card stuck off-screen and unclickable).
  const cardX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const streakPulse = useRef(new Animated.Value(1)).current;
  const xpPop = useRef(new Animated.Value(0)).current;
  const [xpPopVisible, setXpPopVisible] = useState(false);

  const confetti = useRef(null);
  const xpAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const achieveAnim = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    const s = await getQuizSummary();
    setSummary(s);
    return s;
  }, []);

  useFocusEffect(
    useCallback(() => {
      trackScreen("Quiz");
      scheduleQuizReminder();

      refresh().then((s) => {
        // Jump straight into the questions. The home screen is now only shown
        // when there is nothing to play (daily limit reached) or the set
        // failed to load, so the user never taps through an extra step.
        if (!autoStartedRef.current && s?.remaining > 0) {
          autoStartedRef.current = true;
          startQuizRef.current?.({ auto: true });
        }
      });

      return () => {
        autoStartedRef.current = false; // re-arm for the next visit
      };
    }, [refresh]),
  );

  useEffect(() => {
    StatusBar.setBarStyle(phase === "home" ? "light-content" : "dark-content");
  }, [phase]);

  // Never let a pending interstitial fire after the user has left the screen.
  useEffect(
    () => () => {
      clearTimeout(advanceTimer.current);
      clearTimeout(adTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!summary) return;
    Animated.timing(xpAnim, {
      toValue: summary.totalXp,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [summary?.totalXp]);

  const correctCount = questions.reduce(
    (n, q, i) => n + (selected[i] === q.correct ? 1 : 0),
    0,
  );
  const skippedCount = selected.filter((v) => v === SKIPPED).length;

  const startQuiz = async ({ auto = false } = {}) => {
    const s = await refresh();
    if (s.remaining <= 0) return;

    if (!auto) tapHaptic(); // no buzz when the screen opens on its own
    clearTimeout(advanceTimer.current);
    advancingRef.current = false;

    // Questions come only from the AI set — show a retry state if we can't
    // reach it (offline, or today's set hasn't been generated yet).
    setLoadError(false);
    setLoadingSet(true);
    const sessionQs = await getSessionQuestions(s.todayCount, QUESTIONS_PER_QUIZ);
    setLoadingSet(false);

    if (!sessionQs.length) {
      setLoadError(true);
      trackEvent("Quiz Unavailable", { todayCount: s.todayCount });
      return;
    }

    setQuestions(sessionQs);
    setQIndex(0);
    selectedRef.current = [];
    setSelected([]);
    setTipOpen(false);
    setStreak(0);
    streakRef.current = 0;
    comboRef.current = 0;
    setLastBonus(0);
    setGainedXp(0);
    cardX.setValue(0);
    cardOpacity.setValue(1);
    shake.setValue(0);
    setPhase("playing");
    trackEvent("Quiz Started", { remainingToday: s.remaining, auto });
  };
  startQuizRef.current = startQuiz;

  /** Slides the card off to the LEFT, then brings the next one in from the right. */
  const goNext = (fromIndex) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    clearTimeout(advanceTimer.current);

    Animated.parallel([
      Animated.timing(cardX, {
        toValue: -SCREEN_W,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const next = fromIndex + 1;
      if (next >= questions.length) {
        finishQuiz();
        return;
      }
      setQIndex(next);
      setTipOpen(false);
      // Reposition off-screen right, then slide in.
      shake.setValue(0);
      cardX.setValue(SCREEN_W);
      cardOpacity.setValue(1);
      Animated.timing(cardX, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        advancingRef.current = false;
      });
    });
  };

  const choose = (optionIndex) => {
    const i = qIndex;
    const q = questions[i];
    if (!q || selected[i] !== undefined || advancingRef.current) return;

    const right = optionIndex === q.correct;
    setPick(i, optionIndex);

    if (right) {
      successHaptic();
      // Combo: every correct answer from the 3rd in a row onward earns bonus
      // XP, so a clean run is worth noticeably more than the same score with
      // misses scattered through it.
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);

      const bonus = newStreak >= 3 ? COMBO_BONUS_XP : 0;
      if (bonus) comboRef.current += bonus;
      setLastBonus(bonus);

      streakPulse.setValue(0.6);
      Animated.spring(streakPulse, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }).start();

      setXpPopVisible(true);
      xpPop.setValue(0);
      Animated.timing(xpPop, {
        toValue: 1,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setXpPopVisible(false));

      // Correct → move on shortly; the answer is already obvious.
      advanceTimer.current = setTimeout(() => goNext(i), 1400);
    } else {
      warningHaptic();
      streakRef.current = 0;
      setStreak(0);
      setLastBonus(0);
      setTipOpen(true); // surface the hint so they can learn from the miss

      Animated.sequence([
        Animated.timing(shake, { toValue: 12, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -12, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 9, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -9, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
      // Wrong → NO auto-advance. The user reads the correct answer + tip and
      // taps Next when they're ready.
    }
  };

  const skipQuestion = () => {
    const i = qIndex;
    if (selected[i] !== undefined || advancingRef.current) return;
    tapHaptic();
    setPick(i, SKIPPED);
    setStreak(0);
    goNext(i);
  };

  const finishQuiz = async () => {
    const picks = selectedRef.current;
    const total = questions.length;
    const correct = questions.reduce(
      (n, q, i) => n + (picks[i] === q.correct ? 1 : 0),
      0,
    );
    const skipped = picks.filter((v) => v === SKIPPED).length;

    const res = await submitQuizResult({
      correct,
      total,
      skipped,
      comboBonus: comboRef.current,
    });
    setGainedXp(res.gainedXp);
    setSummary(res);

    trackEvent("Quiz Completed", {
      correct,
      wrong: total - correct - skipped,
      skipped,
      total,
      xpEarned: res.gainedXp,
      totalXp: res.totalXp,
    });

    if (res.remaining <= 0 && !res.dayReported) {
      trackEvent("Quiz Daily Report", {
        userId: user?._id || "",
        name: user?.name || "",
        date: new Date().toISOString().slice(0, 10),
        quizzesCompleted: res.todayCount,
        totalCorrect: res.todayCorrect,
        totalWrong: res.todayWrong,
        totalSkipped: res.todaySkipped,
        accuracy:
          res.todayCorrect + res.todayWrong > 0
            ? Math.round(
                (res.todayCorrect / (res.todayCorrect + res.todayWrong)) * 100,
              )
            : 0,
        xpTotal: res.totalXp,
      });
      markDayReported();
    }

    setPhase("result");
    setReviewOpen(false);
    advancingRef.current = false;
    scoreAnim.setValue(0);
    Animated.spring(scoreAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();

    if (correct === total && total > 0) {
      achieveAnim.setValue(0);
      Animated.spring(achieveAnim, {
        toValue: 1,
        friction: 5,
        tension: 70,
        delay: 320,
        useNativeDriver: true,
      }).start();
    }
    if (total > 0 && correct / total >= 0.6) {
      successHaptic();
      setTimeout(() => confetti.current?.play(), 250);
    }

    // ── Day complete: congratulate first, monetise second ──
    // The toast lands on the result screen; the interstitial waits until the
    // score animation and confetti have had their moment, so the reward never
    // feels interrupted by the ad.
    if (res.remaining <= 0) {
      Toast.success("All quizzes done for today! 🎉 See you tomorrow", "top");
      // Jack reacts from the floating bubble a beat later.
      setTimeout(() => sayFromJack(praiseQuiz(user?.name), 12000), 1200);

      adTimer.current = setTimeout(async () => {
        const mgr = InterstitialAdManager.getInstance();
        if (mgr.isLoaded()) {
          trackEvent("Quiz Interstitial Shown", { todayCount: res.todayCount });
          // Resolves when the ad is closed, so the dialog lands as the user
          // returns to the screen rather than fighting the ad for attention.
          await mgr.show();
        } else {
          mgr.load(); // warm it for tomorrow rather than blocking today
        }
        if (!feedbackDone) setFeedbackVisible(true);
      }, 3200);
    }
  };

  const rank = getRank(summary?.totalXp || 0);

  // ═══════════════════════════ HOME + QUESTIONS ═════════════════════════════
  // One screen: the hero always stays on top, and the questions play out
  // directly beneath it. Only the result takes over the full screen.
  if (phase === "home") {
    const locked = (summary?.remaining ?? 1) <= 0;
    const dayAcc =
      (summary?.todayCorrect ?? 0) + (summary?.todayWrong ?? 0) > 0
        ? Math.round(
            ((summary?.todayCorrect ?? 0) /
              ((summary?.todayCorrect ?? 0) + (summary?.todayWrong ?? 0))) *
              100,
          )
        : 0;

    return (
      <View style={styles.screen}>
        <BrandGradient style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>Fitness Quiz</Text>
            <View style={styles.rankPill}>
              <Text style={styles.rankText}>
                {rank.emoji} {rank.title}
              </Text>
            </View>
          </View>

          {/* Slim XP bar with a single caption. */}
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${rank.progress * 100}%` }]} />
          </View>
          <View style={styles.xpCaptionRow}>
            <Text style={styles.xpCaption}>
              <Animated.Text>
                {xpAnim.interpolate({
                  inputRange: [0, Math.max(summary?.totalXp || 1, 1)],
                  outputRange: ["0", String(summary?.totalXp || 0)],
                })}
              </Animated.Text>
              {" XP"}
              {rank.next ? ` · ${rank.toNext} to ${rank.next.title}` : " · Max rank"}
            </Text>
            {summary?.dayStreak > 0 ? (
              <Text style={styles.xpCaption}>
                🔥 {summary.dayStreak}-day streak
              </Text>
            ) : null}
          </View>
        </BrandGradient>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {loadingSet ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                Loading today&apos;s questions…
              </Text>
            </View>
          ) : locked ? (
            <View style={[styles.card, styles.doneCard]}>
              <Image
                source={EXPRESSION_IMAGES.proud}
                style={styles.doneMascot}
                contentFit="contain"
              />
              <Text style={styles.doneTitle}>All done for today</Text>

              <View style={styles.dayReport}>
                <View style={styles.dayStat}>
                  <Text style={[styles.dayValue, { color: "#16A34A" }]}>
                    {summary?.todayCorrect ?? 0}
                  </Text>
                  <Text style={styles.dayLabel}>Correct</Text>
                </View>
                <View style={styles.dayDivider} />
                <View style={styles.dayStat}>
                  <Text style={[styles.dayValue, { color: "#DC2626" }]}>
                    {summary?.todayWrong ?? 0}
                  </Text>
                  <Text style={styles.dayLabel}>Wrong</Text>
                </View>
                <View style={styles.dayDivider} />
                <View style={styles.dayStat}>
                  <Text style={[styles.dayValue, { color: colors.primary }]}>
                    {dayAcc}%
                  </Text>
                  <Text style={styles.dayLabel}>Accuracy</Text>
                </View>
              </View>
            </View>
          ) : null}

        </ScrollView>

        {/* Only shown when there is nothing to play: a load failure to retry,
            or the day's quizzes finished. Never a "Start Quiz" button — the
            questions above open on their own. */}
        {!loadingSet ? (
          <View style={styles.ctaWrap}>
            {loadError ? (
              <>
                <Text style={styles.loadErrorText}>
                  Couldn&apos;t load today&apos;s questions. Check your
                  connection and try again.
                </Text>
                <TouchableOpacity
                  style={styles.startBtn}
                  activeOpacity={0.9}
                  onPress={() => startQuiz()}
                >
                  <Ionicons name="refresh" size={ms(18)} color="#FFFFFF" />
                  <Text style={styles.startText}>Retry</Text>
                </TouchableOpacity>
              </>
            ) : locked ? (
              <View style={styles.tomorrowWrap}>
                <Ionicons name="hourglass-outline" size={ms(16)} color={colors.primary} />
                <Text style={styles.tomorrowText}>New questions in {resetLabel}</Text>
              </View>
            ) : (
              // Reachable only after the user leaves a session early.
              <TouchableOpacity
                style={styles.startBtn}
                activeOpacity={0.9}
                onPress={() => startQuiz()}
              >
                <Ionicons name="play" size={ms(18)} color="#FFFFFF" />
                <Text style={styles.startText}>Continue quiz</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  }

  // ═════════════════════════════════ RESULT ═════════════════════════════════
  if (phase === "result") {
    const total = questions.length || QUESTIONS_PER_QUIZ;
    const perfect = correctCount === total && total > 0;
    const pct = Math.round((correctCount / total) * 100);
    const tier = perfect
      ? { jack: "proud", title: "Perfect score!" }
      : pct >= 80
        ? { jack: "cheer", title: "Excellent!" }
        : pct >= 60
          ? { jack: "wink", title: "Well done!" }
          : { jack: "think", title: pct >= 40 ? "Good start!" : "Keep learning!" };
    const wrongCount = total - correctCount - skippedCount;
    // Wrong answers first when the review is opened.
    const reviewOrder = questions
      .map((q, i) => ({ q, i, pick: selected[i] }))
      .sort((a, b) => {
        const order = (r) => (r.pick === r.q.correct ? 2 : r.pick === SKIPPED ? 1 : 0);
        return order(a) - order(b);
      });

    return (
      <View style={styles.screen}>
        <LottieView
          ref={confetti}
          source={require("../../assets/animations/congrats.json")}
          autoPlay={false}
          loop={false}
          style={styles.confetti}
          pointerEvents="none"
        />

        <ScrollView
          contentContainerStyle={styles.resultBody}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.resultCard,
              { opacity: scoreAnim, transform: [{ scale: scoreAnim }] },
            ]}
          >
            <Image
              source={EXPRESSION_IMAGES[tier.jack]}
              style={styles.resultMascot}
              contentFit="contain"
            />
            <Text style={styles.resultTitle}>{tier.title}</Text>

            <Text style={styles.scoreValue}>
              {correctCount}
              <Text style={styles.scoreTotal}>/{total}</Text>
            </Text>
            <Text style={styles.resultLine}>
              {pct}% · <Text style={styles.resultXp}>+{gainedXp} XP</Text>
              {skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}
            </Text>

            {/* A perfect run earns its badge right here, not in a second card. */}
            {perfect ? (
              <Animated.View
                style={[
                  styles.flawlessBadge,
                  { opacity: achieveAnim, transform: [{ scale: achieveAnim }] },
                ]}
              >
                <Text style={styles.flawlessText}>🧠 Flawless Mind unlocked</Text>
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* Review stays folded until asked for; wrong answers come first. */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.reviewHead}
              activeOpacity={0.7}
              onPress={() => {
                tapHaptic();
                setReviewOpen((v) => !v);
              }}
            >
              <Text style={styles.cardTitle}>Review answers</Text>
              <Text style={styles.reviewCount}>
                {wrongCount > 0 ? `${wrongCount} wrong` : "all correct"}
              </Text>
              <Ionicons
                name={reviewOpen ? "chevron-up" : "chevron-down"}
                size={ms(16)}
                color={colors.textLight}
              />
            </TouchableOpacity>
            {reviewOpen && reviewOrder.map(({ q, pick }) => {
              const isSkipped = pick === SKIPPED;
              const right = pick === q.correct;
              return (
                <View key={q.id} style={styles.reviewRow}>
                  <Ionicons
                    name={
                      isSkipped
                        ? "play-skip-forward-circle"
                        : right
                          ? "checkmark-circle"
                          : "close-circle"
                    }
                    size={ms(17)}
                    color={isSkipped ? "#94A3B8" : right ? "#16A34A" : "#DC2626"}
                  />
                  <Text style={styles.reviewText} numberOfLines={2}>
                    {q.question}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.resultActions}>
          <TouchableOpacity
            style={[
              styles.againBtn,
              (summary?.remaining ?? 0) <= 0 && styles.startBtnLocked,
            ]}
            activeOpacity={0.9}
            onPress={() => startQuiz()}
            disabled={(summary?.remaining ?? 0) <= 0}
          >
            <Ionicons
              name={(summary?.remaining ?? 0) > 0 ? "refresh" : "moon"}
              size={ms(17)}
              color="#FFFFFF"
            />
            <Text style={styles.againText}>
              {(summary?.remaining ?? 0) > 0
                ? "Answer more questions"
                : "New questions tomorrow"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeLink}
            activeOpacity={0.6}
            hitSlop={8}
            onPress={() => {
              tapHaptic();
              setPhase("home");
            }}
          >
            <Text style={styles.homeText}>Back to quiz home</Text>
          </TouchableOpacity>
        </View>

        {/* Asked once the interstitial closes — the user is on this screen by
            then. "Maybe later" dismisses without sending. */}
        <QuizFeedback
          visible={feedbackVisible}
          dayStats={{
            quizzesToday: summary?.todayCount ?? 0,
            correctToday: summary?.todayCorrect ?? 0,
            wrongToday: summary?.todayWrong ?? 0,
            accuracyToday:
              (summary?.todayCorrect ?? 0) + (summary?.todayWrong ?? 0) > 0
                ? Math.round(
                    ((summary?.todayCorrect ?? 0) /
                      ((summary?.todayCorrect ?? 0) +
                        (summary?.todayWrong ?? 0))) *
                      100,
                  )
                : 0,
          }}
          onClose={() => {
            setFeedbackVisible(false);
            setFeedbackDone(true); // never ask twice in one session
          }}
        />
      </View>
    );
  }

  // ════════════════════════════════ PLAYING ════════════════════════════════
  const q = questions[qIndex];
  const pick = selected[qIndex];
  const answered = pick !== undefined;
  const meta = getCategoryMeta(q?.category);
  const isLast = qIndex === questions.length - 1;

  return (
    <View style={styles.screen}>
      {/* One compact bar instead of hero + status row, so the whole question
          card fits on screen without scrolling. */}
      {/* One compact bar: a segment per card (done · current · upcoming) and,
          only while it's running, the answer combo. */}
      <BrandGradient style={styles.playHero}>
        <View style={styles.playHeroRow}>
          <View
            style={styles.segments}
            accessibilityLabel={`Card ${qIndex + 1} of ${questions.length}`}
          >
            {questions.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segment,
                  i < qIndex || (i === qIndex && answered)
                    ? styles.segmentDone
                    : i === qIndex
                      ? styles.segmentCurrent
                      : null,
                ]}
              />
            ))}
          </View>

          {streak >= 2 ? (
            <Animated.View
              style={[styles.comboPill, { transform: [{ scale: streakPulse }] }]}
            >
              <Text style={styles.comboText}>🔥 {streak} in a row</Text>
            </Animated.View>
          ) : null}
        </View>
      </BrandGradient>

      {/* ── One always-mounted card: slides out left, next slides in right ── */}
      <View style={styles.deckWrap}>
        <Animated.View
          style={[
            styles.qCard,
            {
              opacity: cardOpacity,
              transform: [{ translateX: Animated.add(cardX, shake) }],
            },
          ]}
        >
          <Text style={styles.qMeta}>
            <Text style={{ color: meta.color }}>{meta.label}</Text>
            {q?.difficulty ? ` · ${q.difficulty}` : ""}
          </Text>

          <View style={styles.qScroll}>
            <Text style={styles.qEmoji}>{q?.emoji}</Text>
            <Text style={styles.qText}>{q?.question}</Text>

            <View style={styles.options}>
              {q?.options?.map((opt, oi) => {
                const showCorrect =
                  answered && pick !== SKIPPED && oi === q.correct;
                const showWrong = answered && oi === pick && pick !== q.correct;
                return (
                  <TouchableOpacity
                    key={oi}
                    style={[
                      styles.option,
                      showCorrect && styles.optionCorrect,
                      showWrong && styles.optionWrong,
                      answered && !showCorrect && !showWrong && styles.optionDim,
                    ]}
                    activeOpacity={answered ? 1 : 0.85}
                    disabled={answered}
                    onPress={() => choose(oi)}
                  >
                    <View
                      style={[
                        styles.optionLetter,
                        showCorrect && styles.optionLetterCorrect,
                        showWrong && styles.optionLetterWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLetterText,
                          (showCorrect || showWrong) && { color: "#FFFFFF" },
                        ]}
                      >
                        {LETTERS[oi]}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.optionText,
                        showCorrect && styles.optionTextCorrect,
                        showWrong && styles.optionTextWrong,
                      ]}
                    >
                      {opt}
                    </Text>

                    {showCorrect && (
                      <Ionicons
                        name="checkmark-circle"
                        size={ms(20)}
                        color="#16A34A"
                      />
                    )}
                    {showWrong && (
                      <Ionicons name="close-circle" size={ms(20)} color="#DC2626" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Tip lives inside the card ── */}
            {tipOpen ? (
              <View style={styles.tipCard}>
                <View style={styles.tipHead}>
                  <Ionicons name="bulb" size={ms(14)} color="#B45309" />
                  <Text style={styles.tipTitle}>Hint</Text>
                  <TouchableOpacity
                    onPress={() => setTipOpen(false)}
                    hitSlop={10}
                    style={{ marginLeft: "auto" }}
                  >
                    <Ionicons name="chevron-up" size={ms(15)} color="#B45309" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.tipText}>{q?.tip}</Text>

                {q?.category === "water" && (
                  <TouchableOpacity
                    style={styles.waterCta}
                    activeOpacity={0.9}
                    onPress={() => {
                      tapHaptic();
                      trackEvent("Quiz Water CTA", { questionId: q.id });
                      router.push("/profile/water");
                    }}
                  >
                    <Ionicons name="water" size={ms(14)} color="#FFFFFF" />
                    <Text style={styles.waterCtaText}>Set a Water Reminder</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Hint + Skip share one row so the card never needs scrolling. */}
            {!answered ? (
              <View style={styles.actionRow}>
                {!tipOpen ? (
                  <TouchableOpacity
                    style={styles.linkBtn}
                    activeOpacity={0.6}
                    hitSlop={8}
                    onPress={() => {
                      tapHaptic();
                      setTipOpen(true);
                    }}
                  >
                    <Ionicons name="bulb-outline" size={ms(15)} color="#B45309" />
                    <Text style={styles.hintLink}>Hint</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  style={styles.linkBtn}
                  activeOpacity={0.6}
                  hitSlop={8}
                  onPress={skipQuestion}
                >
                  <Text style={styles.skipLink}>Skip</Text>
                  <Ionicons name="chevron-forward" size={ms(14)} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nextBtn}
                activeOpacity={0.9}
                onPress={() => goNext(qIndex)}
              >
                <Text style={styles.nextText}>
                  {isLast ? "See result" : "Next card"}
                </Text>
                <Ionicons
                  name={isLast ? "checkmark-done" : "arrow-forward"}
                  size={ms(16)}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>

      {xpPopVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.xpPop,
            {
              opacity: xpPop.interpolate({
                inputRange: [0, 0.15, 0.7, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: xpPop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -ms(70)],
                  }),
                },
                {
                  scale: xpPop.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0.7, 1.15, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="flash" size={ms(16)} color="#FFFFFF" />
          <Text style={styles.xpPopText}>
            +{XP_PER_CORRECT + lastBonus} XP{lastBonus ? "  🔥COMBO" : ""}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },

  inlineLoading: { alignItems: "center", paddingVertical: ms(48), gap: ms(12) },
  loadingText: { fontSize: ms(13), color: "#64748B", fontWeight: "600" },

  // ── Hero ──
  hero: {
    paddingTop: ms(18),
    paddingHorizontal: ms(18),
    paddingBottom: ms(18),
    borderBottomLeftRadius: ms(26),
    borderBottomRightRadius: ms(26),
  },
  // Same hero, trimmed of the XP card so the question card gets the height.
  playHero: {
    paddingTop: ms(12),
    paddingHorizontal: ms(16),
    paddingBottom: ms(12),
    borderBottomLeftRadius: ms(18),
    borderBottomRightRadius: ms(18),
  },
  playHeroRow: { flexDirection: "row", alignItems: "center", gap: ms(8) },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(21),
    color: "#FFFFFF",
  },
  rankPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
  },
  rankText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(12), color: "#FFFFFF" },
  xpTrack: {
    height: ms(6),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
    marginTop: ms(14),
  },
  xpCaptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: ms(6),
  },
  xpCaption: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11.5),
    color: "rgba(255,255,255,0.92)",
  },
  xpFill: { height: "100%", borderRadius: 999, backgroundColor: "#FDE047" },

  // ── Home body ──
  body: { padding: ms(16), paddingBottom: ms(170) },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    padding: ms(16),
    marginBottom: ms(14),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  doneCard: { alignItems: "center", paddingVertical: ms(20) },
  doneMascot: { width: ms(96), height: ms(96) },
  doneTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: colors.text,
    marginTop: ms(6),
  },
  dayReport: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: ms(18),
    backgroundColor: "#F8FAFC",
    borderRadius: ms(16),
    paddingVertical: ms(14),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  dayStat: { flex: 1, alignItems: "center" },
  dayValue: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(20) },
  dayLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10),
    color: colors.textLight,
    marginTop: ms(2),
  },
  dayDivider: { width: 1, height: ms(30), backgroundColor: "#E2E8F0" },

  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ms(86),
    paddingHorizontal: ms(18),
  },
  tomorrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    paddingVertical: ms(16),
    paddingHorizontal: ms(16),
    borderRadius: ms(18),
    backgroundColor: "#EEF2FF",
  },
  tomorrowText: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.primary,
    lineHeight: ms(18),
  },
  loadErrorText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: "#DC2626",
    textAlign: "center",
    lineHeight: ms(18),
    marginBottom: ms(10),
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(54),
    borderRadius: ms(18),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  startBtnLocked: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  startText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
  },

  // ── Playing ──

  deckWrap: {
    flex: 1,
    justifyContent: "center", // card hugs its content and sits centred
    paddingHorizontal: ms(18),
    paddingTop: ms(12),
    paddingBottom: ms(88), // clears the floating tab bar
  },
  qCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(22),
    paddingHorizontal: ms(16),
    paddingVertical: ms(18),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  qScroll: { paddingBottom: ms(8) },
  qEmoji: { fontSize: ms(28), textAlign: "center", marginTop: ms(4) },
  qText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14.5),
    color: colors.text,
    textAlign: "center",
    lineHeight: ms(20),
    marginTop: ms(6),
  },

  options: { marginTop: ms(14), gap: ms(9) },
  // Hint (left) and Skip (right) as plain text links.
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: ms(14),
    paddingHorizontal: ms(2),
  },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: ms(6) },
  hintLink: { fontFamily: "OpenSans_700Bold", fontSize: ms(13), color: "#B45309" },
  skipLink: { fontFamily: "OpenSans_700Bold", fontSize: ms(13), color: colors.textLight },

  // Playing header: one segment per card, plus the combo while it runs.
  segments: { flex: 1, flexDirection: "row", gap: ms(5) },
  segment: {
    flex: 1,
    height: ms(6),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  segmentCurrent: { backgroundColor: "rgba(255,255,255,0.6)" },
  segmentDone: { backgroundColor: "#FFFFFF" },
  comboPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: ms(9),
    paddingVertical: ms(4),
  },
  comboText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(11.5), color: "#EA580C" },
  qMeta: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.textLight,
    marginBottom: ms(4),
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(11),
    backgroundColor: "#FBFCFD",
    borderRadius: ms(14),
    paddingHorizontal: ms(11),
    paddingVertical: ms(9),
    borderWidth: 1.5,
    borderColor: "#E6EAF0",
  },
  optionCorrect: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" },
  optionWrong: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
  optionDim: { opacity: 0.5 },
  optionLetter: {
    width: ms(25),
    height: ms(25),
    borderRadius: ms(9),
    backgroundColor: "#EEF1F5",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterCorrect: { backgroundColor: "#16A34A" },
  optionLetterWrong: { backgroundColor: "#DC2626" },
  optionLetterText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.textLight,
  },
  optionText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.text,
    lineHeight: ms(18),
  },
  optionTextCorrect: { color: "#15803D", fontFamily: "OpenSans_800ExtraBold" },
  optionTextWrong: { color: "#B91C1C", fontFamily: "OpenSans_800ExtraBold" },

  tipCard: {
    marginTop: ms(12),
    backgroundColor: "#FFFBEB",
    borderRadius: ms(14),
    padding: ms(12),
    borderWidth: 1.5,
    borderColor: "#FDE68A",
  },
  tipHead: { flexDirection: "row", alignItems: "center", gap: ms(6) },
  tipTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: "#B45309",
  },
  tipText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "#78350F",
    lineHeight: ms(18),
    marginTop: ms(5),
  },
  waterCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(7),
    marginTop: ms(10),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: "#2E90FA",
  },
  waterCtaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: "#FFFFFF",
  },

  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    marginTop: ms(10),
    height: ms(46),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
  },
  nextText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },

  xpPop: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    flexDirection: "row",
    alignItems: "center",
    gap: ms(6),
    backgroundColor: "#16A34A",
    borderRadius: 999,
    paddingHorizontal: ms(18),
    paddingVertical: ms(10),
    zIndex: 30,
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  xpPopText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
  },

  // ── Result ──
  confetti: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ms(420),
    zIndex: 20,
  },
  resultBody: { padding: ms(16), paddingTop: ms(24), paddingBottom: ms(190) },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(24),
    padding: ms(22),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF0F4",
    marginBottom: ms(14),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  resultTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(20),
    color: colors.text,
    marginTop: ms(6),
  },
  scoreValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(44),
    color: colors.primary,
    marginTop: ms(2),
  },
  resultMascot: { width: ms(110), height: ms(110), marginBottom: ms(2) },
  resultLine: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.textLight,
  },
  resultXp: { fontFamily: "OpenSans_800ExtraBold", color: "#B45309" },
  flawlessBadge: {
    marginTop: ms(12),
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE3C4",
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
  },
  flawlessText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(12.5), color: "#B45309" },
  cardTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(14.5), color: colors.text },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: ms(8) },
  reviewCount: {
    flex: 1,
    textAlign: "right",
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.textLight,
  },
  homeLink: { alignItems: "center", paddingVertical: ms(12) },
  scoreTotal: { fontSize: ms(20), color: colors.textLight },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(9),
    marginTop: ms(11),
  },
  reviewText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.text,
    lineHeight: ms(17),
  },

  resultActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ms(78),
    paddingHorizontal: ms(18),
  },
  againBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(52),
    borderRadius: ms(18),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  againText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: "#FFFFFF",
  },
  homeText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.textLight,
  },
});
