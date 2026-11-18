import Ionicons from "@expo/vector-icons/Ionicons";
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

// Three short tips instead of Do / Don't lists.
const TIPS = [
  { icon: "scan-outline", text: "Fill the frame" },
  { icon: "sunny-outline", text: "Good light" },
  { icon: "hand-left-outline", text: "Hold steady" },
];

/**
 * Explainer for the scanner. Shown once before the camera on first run, and
 * again on demand from the Scanned tab's help button.
 */
export default function ScanIntro({ onStart, ctaLabel = "Got it — start scanning" }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

  }, [enter]);

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
          <View style={styles.iconWrap}>
            <Text style={styles.bigEmoji}>🔍</Text>
          </View>

          <Text style={styles.title}>Scan a food packet</Text>
          <Text style={styles.sub}>We&apos;ll tell you if it&apos;s healthy.</Text>

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
              <Text style={styles.refText}>Scan this first</Text>
            </View>

            <View style={styles.refCard}>
              <View style={styles.mockBox}>
                <NutritionTableMock />
              </View>
              <Text style={styles.refTitle}>Nutrition table</Text>
              <Text style={styles.refText}>No barcode? Snap this</Text>
            </View>
          </View>

          <View style={styles.tipsRow}>
            {TIPS.map((t) => (
              <View key={t.text} style={styles.tipChip}>
                <Ionicons name={t.icon} size={ms(14)} color={colors.primary} />
                <Text style={styles.tipChipText}>{t.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={ms(15)} color="#B45309" />
            <Text style={styles.warnText}>
              Allergies? Always check the packet.
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
  tipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: ms(8),
    marginTop: ms(16),
  },
  tipChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(5),
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  tipChipText: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(12), color: colors.text },
  screen: { flex: 1, backgroundColor: colors.screen },
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
    backgroundColor: colors.card,
    borderRadius: ms(16),
    padding: ms(13),
    marginBottom: ms(10),
    borderWidth: 1,
    borderColor: colors.hairline,
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
    backgroundColor: colors.card,
    borderRadius: ms(16),
    padding: ms(12),
    borderWidth: 1,
    borderColor: colors.hairline,
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
