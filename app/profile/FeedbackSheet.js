import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";

import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { trackEvent } from "../../constants/mixpanel";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const MAX_LEN = 500;
const MIN_LEN = 5;

// What the feedback is about. The key is what lands in Mixpanel.
const TOPICS = [
  { key: "feature", label: "New feature", icon: "bulb-outline" },
  { key: "workout", label: "Workout idea", icon: "barbell-outline" },
  { key: "improve", label: "Improvement", icon: "sparkles-outline" },
  { key: "bug", label: "Something's broken", icon: "bug-outline" },
];

/**
 * "Request a feature" bottom sheet. What the user writes is sent to Mixpanel as
 * a "Feature Feedback Submitted" event, so it can be read and filtered there.
 */
export default function FeedbackSheet({ visible, setVisible, user }) {
  const [topic, setTopic] = useState("feature");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const trimmed = text.trim();
  const canSend = trimmed.length >= MIN_LEN && !sending;

  const close = () => {
    Keyboard.dismiss();
    setVisible(false);
  };

  const send = async () => {
    if (!canSend) return;
    tapHaptic();
    Keyboard.dismiss();
    setSending(true);
    try {
      await trackEvent("Feature Feedback Submitted", {
        topic,
        message: trimmed,
        length: trimmed.length,
        userId: user?._id || "",
        name: user?.name || "",
        platform: Platform.OS,
      });
      Toast.success("Thanks! Your feedback was sent 🙌", "top");
      setText("");
      setVisible(false);
    } catch {
      Toast.info("Couldn't send right now — please try again.", "top");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={{ flex: 1 }} onPress={close} />

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [ms(420), 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.grabber} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            <View style={styles.headRow}>
              <View style={styles.logoWrap}>
                <Ionicons name="chatbubbles" size={ms(22)} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Request a feature</Text>
                <Text style={styles.subtitle}>
                  Tell us what you&apos;d like next. We read every message.
                </Text>
              </View>
              <TouchableOpacity onPress={close} hitSlop={10} style={styles.x}>
                <Ionicons name="close" size={ms(20)} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>What is it about?</Text>
            <View style={styles.chips}>
              {TOPICS.map((t) => {
                const on = t.key === topic;
                return (
                  <TouchableOpacity
                    key={t.key}
                    activeOpacity={0.8}
                    onPress={() => {
                      tapHaptic();
                      setTopic(t.key);
                    }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Ionicons
                      name={t.icon}
                      size={ms(14)}
                      color={on ? "#FFFFFF" : colors.text}
                    />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Your idea</Text>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="e.g. A yoga series, dark mode, Hindi voice coach…"
              placeholderTextColor="#9AA3AF"
              multiline
              maxLength={MAX_LEN}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>
              {text.length}/{MAX_LEN}
            </Text>

            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
              activeOpacity={0.9}
              onPress={send}
              disabled={!canSend}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={ms(16)} color="#FFFFFF" />
                  <Text style={styles.sendText}>Send feedback</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Please don&apos;t include personal details like phone numbers or
              passwords.
            </Text>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    paddingHorizontal: ms(18),
    paddingBottom: ms(18),
    maxHeight: "90%",
  },
  grabber: {
    alignSelf: "center",
    width: ms(42),
    height: ms(4),
    borderRadius: 999,
    backgroundColor: "#D7DDE5",
    marginTop: ms(10),
    marginBottom: ms(14),
  },
  body: { paddingBottom: ms(6) },
  headRow: { flexDirection: "row", alignItems: "center", gap: ms(12) },
  logoWrap: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(16),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(17),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.textLight,
    lineHeight: ms(16),
    marginTop: ms(2),
  },
  x: { alignSelf: "flex-start", padding: 2 },
  label: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.text,
    marginTop: ms(18),
    marginBottom: ms(8),
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: ms(8) },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(6),
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
    borderRadius: 999,
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.text,
  },
  chipTextOn: { color: "#FFFFFF" },
  input: {
    minHeight: ms(120),
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#FAFBFC",
    padding: ms(12),
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(13.5),
    color: colors.text,
  },
  counter: {
    alignSelf: "flex-end",
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    marginTop: ms(4),
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(50),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    marginTop: ms(12),
  },
  sendBtnOff: { opacity: 0.45 },
  sendText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },
  note: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(12),
  },
});
