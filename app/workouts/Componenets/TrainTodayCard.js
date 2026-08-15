import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";

import { RewardedAdManager } from "../../../ads/Admobmanager";
import { colors } from "../../../constants/colors";
import { trackEvent } from "../../../constants/mixpanel";
import {
  isRecommendationFree,
  markRecommendationUsed,
  recommendToday,
} from "../../../constants/trainRecommendation";
import { scaling } from "../../../constants/useScaling";

const { moderateScale: ms } = scaling();

/**
 * "What to train today" — analyses the last 7 days on device and suggests the
 * body part that has recovered longest, with the reasoning shown.
 * First analysis each day is free; after that it costs a rewarded ad.
 */
export default function TrainTodayCard({ history = [], onStart }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(14)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Breathing pulse on the CTA until it has been used.
  useEffect(() => {
    if (result) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.03,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [result]);

  const reveal = () => {
    fade.setValue(0);
    slide.setValue(14);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const analyze = async () => {
    if (busy) return;
    setBusy(true);

    const isFree = await isRecommendationFree();

    if (!isFree) {
      const mgr = RewardedAdManager.getInstance();
      if (!mgr.isLoaded()) {
        mgr.load();
        Toast.info("Ad is loading, try again in a moment", "top");
        setBusy(false);
        return;
      }
      const { earned } = await mgr.show();
      if (!earned) {
        Toast.info("Watch the full ad to unlock another plan", "top");
        setBusy(false);
        return;
      }
    }

    // A beat of "thinking" so the analysis reads as deliberate, not instant.
    setTimeout(async () => {
      const rec = recommendToday(history);
      await markRecommendationUsed();
      setResult(rec);
      setBusy(false);
      reveal();
      trackEvent("Train Today Analyzed", {
        bodyPart: rec.bodyPart,
        group: rec.group || "none",
        restAdvised: rec.restAdvised,
        wasFree: isFree,
        historyCount: history.length,
      });
    }, 700);
  };

  // ── Result ──
  if (result) {
    return (
      <Animated.View
        style={[
          styles.card,
          { opacity: fade, transform: [{ translateY: slide }] },
        ]}
      >
        <View style={styles.resultHead}>
          <View
            style={[
              styles.badge,
              result.restAdvised && { backgroundColor: "#EEF2FF" },
            ]}
          >
            <Ionicons
              name={result.restAdvised ? "moon" : "barbell"}
              size={ms(16)}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {result.restAdvised ? "GO EASY TODAY" : "TODAY'S FOCUS"}
            </Text>
            <Text style={styles.resultTitle}>{result.bodyPart}</Text>
          </View>
        </View>

        <Text style={styles.summary}>{result.weekSummary}</Text>

        <View style={styles.whyBox}>
          {result.why.map((line, i) => (
            <View key={i} style={styles.whyRow}>
              <Ionicons
                name="checkmark-circle"
                size={ms(13)}
                color={colors.primary}
              />
              <Text style={styles.whyText}>{line}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.9}
          onPress={() => onStart?.({ id: result.id, bodyPart: result.bodyPart })}
        >
          <Ionicons name="play" size={ms(15)} color="#FFFFFF" />
          <Text style={styles.ctaText}>Start {result.bodyPart} workout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.again}
          activeOpacity={0.7}
          onPress={() => {
            setResult(null);
          }}
          disabled={busy}
        >
          <Ionicons name="refresh" size={ms(12)} color={colors.textLight} />
          <Text style={styles.againText}>Plan again</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Idle ──
  return (
    <View style={styles.card}>
      <Text style={styles.title}>What to train today</Text>
      <Text style={styles.subtitle}>
        Tap below and we&apos;ll review your last 7 days, then pick the muscle
        group that&apos;s had the most rest.
      </Text>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaBusy]}
          activeOpacity={0.9}
          onPress={analyze}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={ms(15)} color="#FFFFFF" />
              <Text style={styles.ctaText}>Plan my session</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    padding: ms(16),
    // Matches the Quick / Popular Workouts headers on this screen (ms 20).
    marginHorizontal: ms(20),
    marginTop: ms(4),
    marginBottom: ms(16),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.textLight,
    lineHeight: ms(17),
    marginTop: ms(4),
    marginBottom: ms(14),
  },

  resultHead: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  badge: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: colors.primary + "16",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(9),
    letterSpacing: 1.1,
    color: colors.textLight,
  },
  resultTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(17),
    color: colors.text,
  },
  summary: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(10),
  },

  whyBox: { gap: ms(7), marginTop: ms(12), marginBottom: ms(14) },
  whyRow: { flexDirection: "row", alignItems: "flex-start", gap: ms(7) },
  whyText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.text,
    lineHeight: ms(17),
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(7),
    height: ms(46),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
  },
  ctaBusy: { opacity: 0.75 },
  ctaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: "#FFFFFF",
  },

  again: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(5),
    marginTop: ms(10),
  },
  againText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: colors.textLight,
  },

});
