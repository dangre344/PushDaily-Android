import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "toastify-react-native";
import { RewardedAdManager } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { bodyParts } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { trackEvent } from "../../constants/mixpanel";
import {
  analyzeWorkoutsAI,
  askTrainer,
  grantRewardQuestions,
} from "../../constants/trainerAI";
import {
  QUICK_QUESTIONS,
  TRAINER_GREETING,
  TRAINER_NAME,
} from "../../constants/trainerChat";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkouts,
  getProfileStats,
  initDB,
} from "../../offlinedb/workoutdb";
import WorkoutLevelModal from "../workouts/Componenets/WorkoutLevelModal";

const ANALYSIS_AD_COUNT = 1; // rewarded ads required to unlock the analysis

// Push/Pull/Legs split used to suggest today's focus.
const PPL_GROUPS = {
  Push: ["Chest", "Shoulder"],
  Pull: ["Back", "Arms"],
  Legs: ["Legs"],
};

const groupOf = (bodyPart) => {
  for (const [g, parts] of Object.entries(PPL_GROUPS)) {
    if (parts.includes(bodyPart)) return g;
  }
  return null; // e.g. Abs sits outside the rotation
};

// Rotate Push → Pull → Legs based on the most recently trained group.
const suggestTodayGroup = (all) => {
  const order = ["Push", "Pull", "Legs"];
  const sorted = [...all].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime),
  );
  let last = null;
  for (const w of sorted) {
    const g = groupOf(w.bodyPart);
    if (g) {
      last = g;
      break;
    }
  }
  if (!last) return "Push";
  return order[(order.indexOf(last) + 1) % order.length];
};

const buildPlanMessage = (all, group) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = all.filter((w) => new Date(w.dateTime).getTime() >= weekAgo);
  const parts = [...new Set(recent.map((w) => w.bodyPart).filter(Boolean))];
  const intro = recent.length
    ? `This week you trained ${parts.join(", ")} across ${recent.length} session${recent.length > 1 ? "s" : ""}.`
    : `You haven't logged a workout this week yet — let's change that today!`;
  return (
    `${intro}\n\n` +
    `Following a push / pull / legs split, today I suggest a ${group} day ` +
    `(${PPL_GROUPS[group].join(" & ")}) so your other muscles keep recovering.\n\n` +
    `Pick a body part below to start 👇`
  );
};

const ms = (n) => scaling().moderateScale(n);

// Jack's avatar — bundled local photo.
const TRAINER_AVATAR = require("../../assets/images/trainer.png");

const timeNow = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Typing indicator: three bouncing dots ───────────────────────────────────
function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.typingRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -ms(4)],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── A single chat bubble (entrance animation on mount) ─────────────────────
function Bubble({ message, streamingText }) {
  const isUser = message.role === "user";
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // While streaming, show the partial text for this bubble instead.
  const text = message.streaming ? streamingText : message.text;

  // Long-press a finished bubble to copy its text. expo-clipboard is a native
  // module, so lazy-require it and fail gracefully if the app hasn't been
  // rebuilt yet (avoids "Cannot find native module ExpoClipboard" crashing).
  const copyText = async () => {
    if (message.streaming || !text) return;
    try {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(String(text));
      Toast.success("Copied to clipboard", "bottom");
    } catch (e) {
      Toast.info("Rebuild the app to enable copy.", "bottom");
    }
  };

  return (
    <Animated.View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowTrainer,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      {!isUser && (
        <Image
          source={TRAINER_AVATAR}
          style={styles.trainerAvatarSmall}
          contentFit="cover"
        />
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={copyText}
        delayLongPress={250}
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleTrainer,
        ]}
      >
        <Markdown
          style={{
            body: isUser ? styles.bubbleTextUser : styles.bubbleTextTrainer,
            strong: {
              fontFamily: "OpenSans_700Bold",
            },
          }}
        >
          {text + (message.streaming ? " ▍" : "")}
        </Markdown>
        {!message.streaming && (
          <Text style={isUser ? styles.timeUser : styles.timeTrainer}>
            {message.time}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TrainerChat() {
  const router = useRouter();
  const { user } = useUser();

  // Newest message first — the FlatList is inverted so the latest sits at
  // the bottom and the keyboard never hides new messages.
  const [messages, setMessages] = useState([
    {
      id: "greeting",
      role: "trainer",
      text: TRAINER_GREETING,
      time: timeNow(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false); // dots phase
  const [streamingText, setStreamingText] = useState(""); // token phase
  const [analyzing, setAnalyzing] = useState(false); // workout-analysis flow
  const [hasWorkouts, setHasWorkouts] = useState(false); // gate the analyze button
  const [analysisDone, setAnalysisDone] = useState(false); // hide analyze after use
  const [planDone, setPlanDone] = useState(false); // hide plan after use
  const [showBodyPicker, setShowBodyPicker] = useState(false); // plan-today picker
  const [suggestedGroup, setSuggestedGroup] = useState("Push");
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);
  const streamTimer = useRef(null);
  const idRef = useRef(0);
  const { t } = useTranslation();

  const busy = thinking || analyzing || !!streamTimer.current;
  const showQuickQuestions = !messages.some((m) => m.role === "user");

  useEffect(() => {
    return () => clearInterval(streamTimer.current);
  }, []);

  // Know up-front whether there's any history (gates the analyze button).
  useEffect(() => {
    // Warm up the rewarded ad so the first "Watch ad" tap doesn't find it cold.
    try {
      RewardedAdManager.getInstance().load();
    } catch {}
    (async () => {
      try {
        await initDB();
        const all = await getAllWorkouts();
        setHasWorkouts((all?.length || 0) > 0);
      } catch {
        setHasWorkouts(false);
      }
    })();
  }, []);

  const streamReply = (fullText) => {
    const words = fullText.split(" ");
    const msgId = `t-${++idRef.current}`;
    let i = 0;

    setStreamingText("");
    setMessages((prev) => [
      {
        id: msgId,
        role: "trainer",
        text: "",
        streaming: true,
        time: timeNow(),
      },
      ...prev,
    ]);

    streamTimer.current = setInterval(() => {
      i++;
      setStreamingText(words.slice(0, i).join(" "));
      if (i >= words.length) {
        clearInterval(streamTimer.current);
        streamTimer.current = null;
        setStreamingText("");
        // Finalize the bubble with the full text.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, text: fullText, streaming: false, time: timeNow() }
              : m,
          ),
        );
      }
    }, 45);
  };

  const sendMessage = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;

    setInput("");
    setMessages((prev) => [
      { id: `u-${++idRef.current}`, role: "user", text, time: timeNow() },
      ...prev,
    ]);

    trackEvent("Trainer Message Sent", {
      message: text,
      length: text.length,
      isQuickQuestion: typeof raw === "string",
    });

    // Thinking dots, then stream the reply word by word.
    setThinking(true);

    let result = await askTrainer(text, user);

    // Free AI answers used up → offer a rewarded ad to unlock more.
    // (Keep `thinking` true so the input stays disabled while the dialog is up.)
    if (result?.status === "need_reward") {
      const watch = await new Promise((resolve) => {
        Alert.alert(
          "Unlock more AI answers",
          "You've used your free AI answers for today. Watch a short ad to ask 3 more questions?",
          [
            { text: "Not now", style: "cancel", onPress: () => resolve(false) },
            { text: "Watch ad", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });

      if (watch) {
        const mgr = RewardedAdManager.getInstance();
        const ready = await waitForAd(mgr); // wait for the first load
        const { earned } = ready ? await mgr.show() : { earned: false };
        if (earned) {
          await grantRewardQuestions();
          trackEvent("Trainer Ad Reward", { message: text });
          result = await askTrainer(text, user);
        } else {
          result = {
            text: "Couldn't load an ad just now — please try again in a moment. 💪",
          };
        }
      } else {
        result = {
          text: "No worries! Come back tomorrow for more free questions, or watch a quick ad to continue now. 💪",
        };
      }
    }

    const reply =
      result?.text || "Hmm, something went wrong. Please try again.";
    const thinkMs = 500 + Math.random() * 500;
    setTimeout(() => {
      setThinking(false);
      streamReply(reply);
    }, thinkMs);
  };

  // ─── Analyze my workouts (gated behind 4 rewarded ads) ────────────────────
  const askConfirm = (title, message, okText) =>
    new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: okText, onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  // Rewarded ads need time to reload between plays — wait until one is ready.
  // Kick a SINGLE load, then just poll; re-calling load() in a tight loop trips
  // AdMob's "too many recently failed requests" rate limit on a no-fill.
  const waitForAd = async (mgr, timeoutMs = 12000) => {
    if (mgr.isLoaded()) return true;
    mgr.load(); // the manager guards against duplicate concurrent loads
    const start = Date.now();
    while (!mgr.isLoaded() && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 800));
    }
    return mgr.isLoaded();
  };

  const buildSummary = (all, stats) => {
    const byBodyPart = {};
    const byLevel = {};
    const byExercise = {};
    all.forEach((w) => {
      const bp = w.bodyPart || "Other";
      const lv = w.level || "Unknown";
      byBodyPart[bp] = (byBodyPart[bp] || 0) + 1;
      byLevel[lv] = (byLevel[lv] || 0) + 1;
      if (w.name) byExercise[w.name] = (byExercise[w.name] || 0) + 1;
    });
    const dates = all
      .map((w) => new Date(w.dateTime))
      .filter((d) => !isNaN(d))
      .sort((a, b) => a - b);
    const topExercises = Object.entries(byExercise)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n, c]) => `${n} (${c})`);

    return {
      totalWorkouts: stats?.totalWorkouts ?? all.length,
      totalCalories: stats?.totalCalories ?? 0,
      activeDays: stats?.activeDays ?? 0,
      exercisesLogged: all.length,
      byBodyPart,
      byLevel,
      topExercises,
      firstWorkout: dates[0]?.toISOString().slice(0, 10),
      lastWorkout: dates[dates.length - 1]?.toISOString().slice(0, 10),
    };
  };

  const runAnalysis = async () => {
    if (busy || analyzing) return;

    // Don't make the user watch ads if there's nothing to analyze.
    let all = [];
    try {
      await initDB();
      all = await getAllWorkouts();
    } catch (e) {
      Logger.log("[Analysis] load failed:", String(e));
    }
    if (!all || all.length === 0) {
      Alert.alert(
        "No workouts yet",
        "Complete at least one workout and I'll analyze your progress!",
      );
      return;
    }

    const start = await askConfirm(
      "Analyze my workouts 📊",
      `Watch ${ANALYSIS_AD_COUNT} short ads to unlock a full AI review of all your workouts so far — with personalized feedback and a cheer. Ready?`,
      "Start",
    );
    if (!start) return;

    setAnalyzing(true);
    const mgr = RewardedAdManager.getInstance();

    for (let i = 1; i <= ANALYSIS_AD_COUNT; i++) {
      const ready = await waitForAd(mgr);
      if (!ready) {
        setAnalyzing(false);
        Alert.alert(
          "Ads not ready",
          "Couldn't load the ads right now. Check your connection and try again.",
        );
        return;
      }
      const { earned } = await mgr.show();
      if (!earned) {
        setAnalyzing(false);
        Alert.alert(
          "Analysis cancelled",
          `You watched ${i - 1} of ${ANALYSIS_AD_COUNT} ads. Watch all ${ANALYSIS_AD_COUNT} to unlock your full analysis.`,
        );
        return;
      }
    }

    // All ads watched → gather stats and ask Jack to analyze.
    setMessages((prev) => [
      {
        id: `u-${++idRef.current}`,
        role: "user",
        text: "📊 Analyze my workout stats till date",
        time: timeNow(),
      },
      ...prev,
    ]);
    setThinking(true);

    let summary;
    try {
      const stats = await getProfileStats();
      summary = buildSummary(all, stats);
    } catch (e) {
      summary = buildSummary(all, null);
    }

    const result = await analyzeWorkoutsAI(summary, user);
    trackEvent("Workout Analysis", {
      totalWorkouts: summary.totalWorkouts,
      source: result.source,
    });

    setTimeout(() => {
      setThinking(false);
      setAnalyzing(false);
      setAnalysisDone(true); // hide the analyze button now that it's been used
      streamReply(result.text);
    }, 600);
  };

  // ─── Plan today's workout (FREE — no ad, no quota) ────────────────────────
  const runPlanToday = async () => {
    if (busy) return;

    let all = [];
    try {
      await initDB();
      all = await getAllWorkouts();
    } catch (e) {
      Logger.log("[Plan] load failed:", String(e));
    }

    setMessages((prev) => [
      {
        id: `u-${++idRef.current}`,
        role: "user",
        text: "📋 Plan today's workout",
        time: timeNow(),
      },
      ...prev,
    ]);
    setThinking(true);

    const group = suggestTodayGroup(all);
    setSuggestedGroup(group);
    const msg = buildPlanMessage(all, group);

    setTimeout(() => {
      setThinking(false);
      streamReply(msg);
      setShowBodyPicker(true);
      setPlanDone(true); // hide the plan button now that it's been used
    }, 700);
  };

  // Tapping a body-part chip starts the WorkoutScreen flow (level → workout).
  const onPickBodyPart = (bp) => {
    setShowBodyPicker(false);
    setSelectedBodyPart(bp);
    setLevelModalVisible(true);
  };

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.trainerAvatar}>
          <Image
            source={TRAINER_AVATAR}
            style={styles.trainerAvatarImg}
            contentFit="cover"
          />
          <View style={styles.onlineDot} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{TRAINER_NAME}</Text>
          <Text style={styles.headerSubtitle}>
            Personal Trainer • {busy ? "typing…" : "Online"}
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="barbell-outline"
            size={ms(18)}
            color={colors.primary}
          />
        </View>
      </View>

      {/* ─── Top actions: Plan / Analyze (each hides once used) + picker ─── */}
      {(!planDone || (hasWorkouts && !analysisDone) || showBodyPicker) && (
        <View style={styles.topActions}>
          {!planDone && (
            <TouchableOpacity
              style={[styles.planBar, busy && styles.analyzeBarDisabled]}
              onPress={runPlanToday}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Ionicons name="sparkles" size={ms(16)} color="#FFFFFF" />
              <Text style={styles.planText}>Plan today's workout</Text>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>FREE</Text>
              </View>
            </TouchableOpacity>
          )}

          {hasWorkouts && !analysisDone && (
            <TouchableOpacity
              style={[styles.analyzeBar, busy && styles.analyzeBarDisabled]}
              onPress={runAnalysis}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Ionicons
                name="stats-chart"
                size={ms(16)}
                color={colors.primary}
              />
              <Text style={styles.analyzeText}>
                {analyzing
                  ? "Unlocking your analysis…"
                  : "Analyze my workout stats"}
              </Text>
              <View style={styles.analyzeBadge}>
                <Ionicons name="play" size={ms(8)} color="#FFFFFF" />
                <Text style={styles.analyzeBadgeText}>
                  {ANALYSIS_AD_COUNT} ad{ANALYSIS_AD_COUNT > 1 ? "s" : ""}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {showBodyPicker && (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerTitle}>
                Pick a body part to start{" "}
                <Text style={styles.pickerHint}>(⭐ = today's pick)</Text>
              </Text>
              <View style={styles.pickerChips}>
                {bodyParts.map((bp) => {
                  const inGroup = (PPL_GROUPS[suggestedGroup] || []).includes(
                    bp.bodyPart,
                  );
                  return (
                    <TouchableOpacity
                      key={bp.id}
                      style={[
                        styles.pickerChip,
                        inGroup && styles.pickerChipSuggested,
                      ]}
                      onPress={() => onPickBodyPart(bp)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.pickerChipText,
                          inGroup && styles.pickerChipTextSuggested,
                        ]}
                      >
                        {bp.bodyPart}
                        {inGroup ? " ⭐" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Edge-to-edge Android doesn't auto-resize for the keyboard, so use
          "padding" on both platforms to keep the input bar above it. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* ─── Messages ─── */}
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <Bubble message={item} streamingText={streamingText} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Inverted list: header renders at the BOTTOM, right above the input.
          ListHeaderComponent={
            thinking ? (
              <View style={[styles.bubbleRow, styles.bubbleRowTrainer]}>
                <Image
                  source={TRAINER_AVATAR}
                  style={styles.trainerAvatarSmall}
                  contentFit="cover"
                />
                <View style={[styles.bubble, styles.bubbleTrainer]}>
                  <TypingDots />
                </View>
              </View>
            ) : null
          }
        />

        {/* ─── Quick questions (until the first user message) ─── */}
        {showQuickQuestions && (
          <View style={styles.chipsWrap}>
            {QUICK_QUESTIONS.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.chip}
                onPress={() => sendMessage(q)}
                activeOpacity={0.85}
                disabled={busy}
              >
                <Text style={styles.chipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Input bar ─── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Jack about workouts or diet…"
            placeholderTextColor={colors.textLight}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || busy) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || busy}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={ms(18)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Banner pinned at the very bottom — outside the KeyboardAvoidingView
          so it doesn't ride up while typing (keyboard simply covers it). */}
      {/* <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View> */}

      {/* Level picker → navigates into the workout, same as the Workout tab. */}
      {levelModalVisible && selectedBodyPart ? (
        <WorkoutLevelModal
          visible={levelModalVisible}
          selectedBodyPart={selectedBodyPart}
          setOpenModal={setLevelModalVisible}
          t={t}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: colors.primary + "16",
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatarImg: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  headerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
  },
  headerSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: "#22C55E",
    marginTop: ms(1),
  },
  headerIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Messages ──
  listContent: {
    paddingHorizontal: ms(14),
    paddingVertical: ms(14),
    gap: ms(10),
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: ms(8),
  },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubbleRowTrainer: { justifyContent: "flex-start" },
  trainerAvatarSmall: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: colors.primary + "16",
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatarSmallText: { fontSize: ms(14) },
  bubble: {
    maxWidth: "78%",
    borderRadius: ms(18),
    paddingHorizontal: ms(14),
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: ms(6),
  },
  bubbleTrainer: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: ms(6),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  bubbleTextUser: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13.5),
    color: "#FFFFFF",
  },
  bubbleTextTrainer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13.5),
    color: colors.text,
  },
  timeUser: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9.5),
    color: "rgba(255,255,255,0.75)",
    alignSelf: "flex-end",
    marginTop: ms(4),
    marginBottom: ms(4),
  },
  timeTrainer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9.5),
    color: colors.textLight,
    alignSelf: "flex-end",
    marginTop: ms(4),
    marginBottom: ms(10),
  },

  // ── Typing dots ──
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(5),
    paddingVertical: ms(4),
    paddingHorizontal: ms(2),
  },
  typingDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: colors.primary,
  },

  // ── Quick question chips ──
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ms(8),
    paddingHorizontal: ms(14),
    paddingBottom: ms(10),
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(999),
    paddingHorizontal: ms(13),
    paddingVertical: ms(8),
    borderWidth: 1.5,
    borderColor: colors.primary + "55",
  },
  chipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11.5),
    color: colors.primary,
  },

  // ── Analyze my workouts bar ──
  analyzeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    marginHorizontal: ms(14),
    marginBottom: ms(8),
    paddingHorizontal: ms(14),
    paddingVertical: ms(11),
    borderRadius: ms(14),
    backgroundColor: colors.primary + "12",
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  analyzeBarDisabled: {
    opacity: 0.55,
  },
  analyzeText: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.primary,
  },
  analyzeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(3),
    backgroundColor: colors.primary,
    borderRadius: ms(999),
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
  },
  analyzeBadgeText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(10),
    color: "#FFFFFF",
  },

  // ── Top action bar (Plan / Analyze / picker) ──
  topActions: {
    paddingTop: ms(10),
    backgroundColor: "#F7F8FA",
  },

  // ── Plan today's workout (FREE) ──
  planBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    marginHorizontal: ms(14),
    marginBottom: ms(8),
    paddingHorizontal: ms(14),
    paddingVertical: ms(12),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  planText: {
    flex: 1,
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13.5),
    color: "#FFFFFF",
  },
  freeBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: ms(999),
    paddingHorizontal: ms(9),
    paddingVertical: ms(3),
  },
  freeBadgeText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(10),
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  // ── Body-part picker ──
  pickerWrap: {
    marginHorizontal: ms(14),
    marginBottom: ms(8),
    padding: ms(12),
    borderRadius: ms(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  pickerTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.text,
    marginBottom: ms(10),
  },
  pickerHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
  },
  pickerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ms(8),
  },
  pickerChip: {
    paddingHorizontal: ms(13),
    paddingVertical: ms(8),
    borderRadius: ms(999),
    backgroundColor: "#F2F4F7",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  pickerChipSuggested: {
    backgroundColor: colors.primary + "16",
    borderColor: colors.primary,
  },
  pickerChipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.text,
  },
  pickerChipTextSuggested: {
    color: colors.primary,
  },

  // ── Input bar ──
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: ms(10),
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F4",
  },
  input: {
    flex: 1,
    minHeight: ms(46),
    maxHeight: ms(110),
    borderRadius: ms(23),
    backgroundColor: "#F2F4F7",
    paddingHorizontal: ms(16),
    paddingTop: ms(12),
    paddingBottom: ms(12),
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13.5),
    color: colors.text,
  },
  sendBtn: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(23),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: ms(52),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F4",
  },
});
