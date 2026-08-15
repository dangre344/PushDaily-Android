import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";
import { BarcodeMock, NutritionTableMock } from "./LabelMocks";

const ms = (n) => scaling().moderateScale(n);

const DO = ["Fill the frame", "Good light", "Hold flat & steady"];
const DONT = ["No angles", "Don't crop rows", "Not through wrap"];

/**
 * Explainer for the scanner. Shown once before the camera on first run, and
 * again on demand from the Scanned tab's help button.
 */
export default function ScanIntro({ onStart, ctaLabel = "Got it — start scanning" }) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, pulse]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <Animated.View
            style={[
              styles.iconWrap,
              {
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.bigEmoji}>🔍</Text>
          </Animated.View>

          <Text style={styles.title}>Packet food scanner</Text>
          <Text style={styles.sub}>
            Point at one of these and we&apos;ll tell you if it&apos;s healthy.
          </Text>

          {/* What to actually point at — drawn, not described. */}
          <View style={styles.refRow}>
            <View style={styles.refCard}>
              <View style={styles.refBadge}>
                <Text style={styles.refBadgeText}>BEST</Text>
              </View>

              <View style={styles.mockBox}>
                <BarcodeMock />
              </View>
              <Text style={styles.refTitle}>Barcode</Text>
              <Text style={styles.refText}>Fastest &amp; most accurate</Text>
            </View>

            <View style={styles.refCard}>
              <View style={styles.mockBox}>
                <NutritionTableMock />
              </View>
              <Text style={styles.refTitle}>Nutrition table</Text>
              <Text style={styles.refText}>Use if no barcode</Text>
            </View>
          </View>

          <View style={styles.fallbackNote}>
            <Text style={styles.fallbackEmoji}>📸</Text>
            <Text style={styles.fallbackText}>
              <Text style={styles.fallbackStrong}>Barcode didn&apos;t work?</Text>{" "}
              Photograph the nutrition table instead — that&apos;s the small
              grid of Energy, Sugar, Fat and Salt values.
            </Text>
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.tipCard, styles.doCard]}>
              <Text style={styles.tipHead}>✅ Do</Text>
              {DO.map((d) => (
                <Text key={d} style={styles.tipLine}>
                  • {d}
                </Text>
              ))}
            </View>

            <View style={[styles.tipCard, styles.dontCard]}>
              <Text style={styles.tipHead}>❌ Don&apos;t</Text>
              {DONT.map((d) => (
                <Text key={d} style={styles.tipLine}>
                  • {d}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={ms(15)} color="#B45309" />
            <Text style={styles.warnText}>
              Never rely on this for a serious allergy — always check the packet.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onStart}>
        <Ionicons name="scan" size={ms(18)} color="#FFFFFF" />
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8FA" },
  body: { padding: ms(20), paddingBottom: ms(10) },

  iconWrap: {
    alignSelf: "center",
    width: ms(76),
    height: ms(76),
    borderRadius: ms(38),
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(12),
  },
  bigEmoji: { fontSize: ms(38) },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(19),
    color: colors.text,
    textAlign: "center",
  },
  sub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: ms(6),
    marginBottom: ms(20),
  },

  step: {
    flexDirection: "row",
    gap: ms(11),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(16),
    padding: ms(13),
    marginBottom: ms(10),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  stepEmoji: { fontSize: ms(18) },
  stepTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12.5),
    color: colors.text,
  },
  stepText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    lineHeight: ms(16),
    marginTop: ms(2),
  },

  refRow: { flexDirection: "row", gap: ms(10), marginBottom: ms(14) },
  refCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: ms(16),
    padding: ms(12),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    alignItems: "center",
  },
  refBadge: {
    position: "absolute",
    top: ms(8),
    right: ms(8),
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
  },
  refBadgeText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(7.5),
    color: "#FFFFFF",
  },
  mockBox: {
    height: ms(52),
    justifyContent: "center",
    marginTop: ms(10),
    marginBottom: ms(10),
    width: "100%",
  },
  fallbackNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ms(9),
    backgroundColor: "#EFF6FF",
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: ms(12),
    marginBottom: ms(12),
  },
  fallbackEmoji: { fontSize: ms(16) },
  fallbackText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: "#1E40AF",
    lineHeight: ms(16),
  },
  fallbackStrong: { fontFamily: "OpenSans_800ExtraBold" },

  refTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(11.5),
    color: colors.text,
  },
  refText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9.5),
    color: colors.textLight,
    marginTop: ms(1),
  },

  twoCol: { flexDirection: "row", gap: ms(10), marginTop: ms(6) },
  tipCard: { flex: 1, borderRadius: ms(16), padding: ms(12), borderWidth: 1 },
  doCard: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  dontCard: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  tipHead: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(11.5),
    color: colors.text,
    marginBottom: ms(6),
  },
  tipLine: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.text,
    lineHeight: ms(16),
  },

  warn: {
    flexDirection: "row",
    gap: ms(8),
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: ms(12),
    marginTop: ms(14),
  },
  warnText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10.5),
    color: "#92400E",
    lineHeight: ms(16),
  },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(9),
    height: ms(52),
    marginHorizontal: ms(20),
    marginBottom: ms(12),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },
});
