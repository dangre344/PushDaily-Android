import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../../constants/colors";
import { trackEvent } from "../../constants/mixpanel";
import { scaling } from "../../constants/useScaling";

const { moderateScale: ms } = scaling();

// Kept short and neutral so we aren't leading the answer.
const CHIPS = [
  { key: "too_easy", label: "Too easy 😴" },
  { key: "just_right", label: "Just right 👌" },
  { key: "make_it_harder", label: "Make it harder 🔥" },
  { key: "learned_something", label: "Learned something 🧠" },
  { key: "too_hard", label: "Too hard 😅" },
  { key: "more_questions", label: "Want more questions 📚" },
];

/**
 * Optional end-of-day feedback dialog, opened once the interstitial has been
 * dismissed. Nothing is required — "Maybe later" always closes without
 * sending, and the hardware back button does the same.
 */
export default function QuizFeedback({ visible, dayStats, onClose }) {
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const slide = useRef(new Animated.Value(40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    // Fresh each time it opens.
    setPicked([]);
    setNote("");
    setSent(false);

    slide.setValue(40);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade]);

  const toggle = (key) =>
    setPicked((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const later = () => {
    trackEvent("Quiz Feedback Skipped", { ...dayStats });
    onClose?.();
  };

  const submit = () => {
    trackEvent("Quiz Feedback", {
      tags: picked, // array — Mixpanel handles list properties
      tagCount: picked.length,
      comment: note.trim().slice(0, 300),
      hasComment: !!note.trim(),
      ...dayStats,
    });
    setSent(true);
    setTimeout(() => onClose?.(), 1100);
  };

  const nothingPicked = !picked.length && !note.trim();

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={later}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centerer}
        >
          <Animated.View
            style={[
              styles.card,
              { opacity: fade, transform: [{ translateY: slide }] },
            ]}
          >
            {sent ? (
              <View style={styles.thanksRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={ms(24)}
                  color={colors.primary}
                />
                <Text style={styles.thanksText}>
                  Thanks! This shapes tomorrow&apos;s questions.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.title}>How was today&apos;s quiz?</Text>
                <Text style={styles.sub}>
                  Optional — pick anything that fits.
                </Text>

                <View style={styles.chips}>
                  {CHIPS.map((c) => {
                    const on = picked.includes(c.key);
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.chip, on && styles.chipOn]}
                        activeOpacity={0.85}
                        onPress={() => toggle(c.key)}
                      >
                        <Text
                          style={[styles.chipText, on && styles.chipTextOn]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Anything else? (optional)"
                  placeholderTextColor="#9AA4B2"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={300}
                />

                <TouchableOpacity
                  style={[styles.send, nothingPicked && styles.sendDisabled]}
                  activeOpacity={0.9}
                  onPress={submit}
                  disabled={nothingPicked}
                >
                  <Ionicons name="send" size={ms(14)} color="#FFFFFF" />
                  <Text style={styles.sendText}>Send feedback</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.later}
                  activeOpacity={0.7}
                  onPress={later}
                >
                  <Text style={styles.laterText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  centerer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: ms(20),
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(22),
    padding: ms(18),
  },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15.5),
    color: colors.text,
  },
  sub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.textLight,
    marginTop: ms(3),
    marginBottom: ms(14),
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: ms(8) },
  chip: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
    borderRadius: ms(999),
    backgroundColor: "#F4F6F9",
    borderWidth: 1,
    borderColor: "#E6E9EF",
  },
  chipOn: {
    backgroundColor: colors.primary + "18",
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11.5),
    color: colors.text,
    lineHeight: ms(16),
  },
  chipTextOn: { color: colors.primary },

  input: {
    marginTop: ms(14),
    minHeight: ms(58),
    maxHeight: ms(110),
    borderRadius: ms(12),
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#E6E9EF",
    paddingHorizontal: ms(12),
    paddingTop: ms(10),
    paddingBottom: ms(10),
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.text,
    textAlignVertical: "top",
  },

  send: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(7),
    height: ms(46),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
    marginTop: ms(14),
  },
  sendDisabled: { backgroundColor: "#C7CDD6" },
  sendText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12.5),
    color: "#FFFFFF",
  },

  later: { alignItems: "center", paddingVertical: ms(11) },
  laterText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
  },

  thanksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    paddingVertical: ms(6),
  },
  thanksText: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: colors.text,
    lineHeight: ms(19),
  },
});
