import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";

import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { Logger } from "../../constants/Logger";
import { trackEvent } from "../../constants/mixpanel";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const UPI_ID = "pushdaily@upi";
const UPI_QR = require("../../assets/images/support/upi-qr.png");

/**
 * Deep link that opens the user's UPI app with our details prefilled.
 * No amount is set — the user decides, which also keeps this squarely a
 * voluntary contribution rather than a priced purchase.
 */
const upiLink = () =>
  `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(
    "Push Daily",
  )}&cu=INR`;

// Rotates so the reason for this section is always on screen somewhere.
const REASONS = [
  "Keeps the app ad-light and free ☕",
  "Funds new workouts & features 🏋️",
  "Pays for the food scanner's AI 🔍",
  "Built by one person, not a company 👋",
  "Every rupee goes back into the app 💯",
];

export default function SupportSheet({ visible, setVisible }) {
  const [reason, setReason] = useState(0);
  const [showQR, setShowQR] = useState(false);

  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    setShowQR(false);
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  // Rolling "why this exists" line.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setReason((i) => (i + 1) % REASONS.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, 2600);
    return () => clearInterval(id);
  }, [visible, fade]);

  const close = () => {
    trackEvent("Support Sheet Closed");
    setVisible(false);
  };

  const copyUpiId = async () => {
    try {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(UPI_ID);
      trackEvent("Support UPI Copied");
      Toast.success(`UPI ID copied — ${UPI_ID}`, "top");
    } catch (e) {
      Logger.log("[Support] clipboard unavailable:", String(e));
      Toast.info("Rebuild the app to enable copy.", "top");
    }
  };

  /** Opens a UPI app if one is installed; falls back to showing the QR. */
  const payViaUpi = async () => {
    tapHaptic();
    const url = upiLink();
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error("no UPI handler");
      trackEvent("Support UPI Opened", { method: "deeplink" });
      await Linking.openURL(url);
    } catch (e) {
      Logger.log("[Support] UPI link failed:", String(e));
      trackEvent("Support UPI Fallback", { reason: "no_upi_app" });
      setShowQR(true);
      Toast.info("No UPI app found — scan the QR instead", "top");
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
      <View style={styles.backdrop}>
        {/* Tap outside to dismiss, standard for a bottom sheet. */}
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
            contentContainerStyle={styles.body}
          >
            <View style={styles.headRow}>
              <View style={styles.logoWrap}>
                <Text style={styles.logoEmoji}>☕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Buy me a coffee</Text>
                <Text style={styles.subtitle}>
                  Support helps improve app quality and build new features.
                </Text>
              </View>
            </View>

            {/* Why this section exists — rotates. */}
            <View style={styles.reasonBox}>
              <Animated.Text
                style={[styles.reasonText, { opacity: fade }]}
                numberOfLines={1}
              >
                {REASONS[reason]}
              </Animated.Text>
            </View>

            <TouchableOpacity
              style={styles.upiBtn}
              activeOpacity={0.9}
              onPress={payViaUpi}
            >
              <Ionicons name="wallet" size={ms(17)} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.upiBtnText}>Pay with any UPI app</Text>
                <Text style={styles.upiBtnSub}>{UPI_ID}</Text>
              </View>
              <Ionicons name="open-outline" size={ms(15)} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Separate tap target — copying and paying are different
                intents, and one row doing both would fight itself. */}
            <TouchableOpacity
              style={styles.copyRow}
              activeOpacity={0.75}
              onPress={() => {
                tapHaptic();
                copyUpiId();
              }}
            >
              <Ionicons
                name="copy-outline"
                size={ms(14)}
                color={colors.textLight}
              />
              <Text style={styles.copyLabel}>Copy UPI ID</Text>
              <Text style={styles.copyValue}>{UPI_ID}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.qrToggle}
              activeOpacity={0.7}
              onPress={() => {
                tapHaptic();
                setShowQR((v) => {
                  if (!v) trackEvent("Support QR Shown");
                  return !v;
                });
              }}
            >
              <Ionicons
                name={showQR ? "chevron-up" : "qr-code-outline"}
                size={ms(14)}
                color={colors.primary}
              />
              <Text style={styles.qrToggleText}>
                {showQR ? "Hide QR code" : "Or scan the QR code"}
              </Text>
            </TouchableOpacity>

            {showQR ? (
              <View style={styles.qrCard}>
                <Image source={UPI_QR} style={styles.qr} contentFit="contain" />
                <Text style={styles.qrHint}>
                  Scan from another device with any UPI app
                </Text>
              </View>
            ) : null}

            {/* Makes the peer-to-peer nature explicit — for users and for
                anyone reviewing the app. */}
            <Text style={styles.disclaimer}>
              Completely optional. Nothing is unlocked and no features change —
              it just helps keep Push Daily going. Thank you 🙏
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.close}
            activeOpacity={0.7}
            onPress={close}
          >
            <Text style={styles.closeText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
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
    paddingBottom: ms(14),
    maxHeight: "86%",
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
    width: ms(50),
    height: ms(50),
    borderRadius: ms(16),
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: ms(24) },
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
    marginTop: ms(3),
  },

  reasonBox: {
    height: ms(38),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: ms(12),
    backgroundColor: colors.primary + "10",
    marginTop: ms(16),
    marginBottom: ms(16),
    paddingHorizontal: ms(12),
  },
  reasonText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.primary,
  },

  upiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(11),
    backgroundColor: colors.primary,
    borderRadius: ms(16),
    paddingVertical: ms(13),
    paddingHorizontal: ms(15),
  },
  upiBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13.5),
    color: "#FFFFFF",
  },
  upiBtnSub: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: "rgba(255,255,255,0.85)",
    marginTop: ms(1),
  },

  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    marginTop: ms(10),
    paddingVertical: ms(11),
    paddingHorizontal: ms(13),
    borderRadius: ms(14),
    backgroundColor: "#F7F8FA",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  copyLabel: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
  },
  copyValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
  },

  qrToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(6),
    paddingVertical: ms(12),
  },
  qrToggleText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.primary,
  },
  qrCard: {
    alignItems: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: ms(18),
    padding: ms(14),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  qr: { width: ms(190), height: ms(190) },
  qrHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    marginTop: ms(8),
  },

  disclaimer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(16),
    marginTop: ms(16),
  },

  close: { alignItems: "center", paddingVertical: ms(12) },
  closeText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
  },
});
