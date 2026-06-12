import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
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
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { AD_UNIT_IDS } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { trackEvent } from "../../constants/mixpanel";
import {
  getTrainerReply,
  QUICK_QUESTIONS,
  TRAINER_GREETING,
  TRAINER_NAME,
} from "../../constants/trainerChat";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

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
        <View style={styles.trainerAvatarSmall}>
          <Text style={styles.trainerAvatarSmallText}>🏋️</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleTrainer,
        ]}
      >
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextTrainer}>
          {text}
          {message.streaming ? " ▍" : ""}
        </Text>
        {!message.streaming && (
          <Text style={isUser ? styles.timeUser : styles.timeTrainer}>
            {message.time}
          </Text>
        )}
      </View>
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
  const streamTimer = useRef(null);
  const idRef = useRef(0);

  const busy = thinking || !!streamTimer.current;
  const showQuickQuestions = !messages.some((m) => m.role === "user");

  useEffect(() => {
    return () => clearInterval(streamTimer.current);
  }, []);

  const streamReply = (fullText) => {
    const words = fullText.split(" ");
    const msgId = `t-${++idRef.current}`;
    let i = 0;

    setStreamingText("");
    setMessages((prev) => [
      { id: msgId, role: "trainer", text: "", streaming: true, time: timeNow() },
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
    const reply = await getTrainerReply(text, user);
    const thinkMs = 700 + Math.random() * 600;
    setTimeout(() => {
      setThinking(false);
      streamReply(reply);
    }, thinkMs);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
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
          <Text style={styles.trainerAvatarEmoji}>🏋️</Text>
          <View style={styles.onlineDot} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{TRAINER_NAME}</Text>
          <Text style={styles.headerSubtitle}>
            Personal Trainer • {busy ? "typing…" : "Online"}
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons name="barbell-outline" size={ms(18)} color={colors.primary} />
        </View>
      </View>

      {/* Edge-to-edge Android doesn't auto-resize for the keyboard, so use
          "padding" on both platforms to keep the input bar above it. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
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
                <View style={styles.trainerAvatarSmall}>
                  <Text style={styles.trainerAvatarSmallText}>🏋️</Text>
                </View>
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
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        />
      </View>
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
  trainerAvatarEmoji: { fontSize: ms(22) },
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
    paddingVertical: ms(10),
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
    lineHeight: ms(20),
  },
  bubbleTextTrainer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13.5),
    color: colors.text,
    lineHeight: ms(20),
  },
  timeUser: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9.5),
    color: "rgba(255,255,255,0.75)",
    alignSelf: "flex-end",
    marginTop: ms(4),
  },
  timeTrainer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9.5),
    color: colors.textLight,
    alignSelf: "flex-end",
    marginTop: ms(4),
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
