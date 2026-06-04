import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { colors } from "../../../constants/colors";
import { Logger } from "../../../constants/Logger";
import { trackEvent } from "../../../constants/mixpanel";
import { scaling } from "../../../constants/useScaling";

const { width } = Dimensions.get("window");
const ms = (n) => scaling().moderateScale(n);
const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Branded, shareable achievement card shown after a workout.
 * The card itself (cardRef) is captured to a PNG and shared via the OS sheet.
 */
export default function ShareAchievementModal({
  visible,
  onClose,
  badge,
  completedCount = 0,
  calories = 0,
  pointsEarned = 0,
  bodyPart = "Workout",
  level = "",
}) {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleShare = async () => {
    try {
      setSharing(true);

      // Render → bitmap. tmpfile gives a path the OS share sheet can attach.
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Logger.log("[Share] Sharing not available on this device");
        setSharing(false);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your achievement",
      });

      trackEvent("Achievement Shared", {
        bodyPart,
        level,
        badge: badge?.title || "",
        points: pointsEarned,
      });
    } catch (e) {
      Logger.log("[Share] failed:", String(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[styles.sheet, { opacity, transform: [{ scale }] }]}
        >
          <Text style={styles.sheetTitle}>Share your achievement</Text>
          <Text style={styles.sheetSubtitle}>
            Show off your progress and inspire others 💪
          </Text>

          {/* ─── The capturable branded card ─── */}
          <View style={styles.cardShadow}>
            <View ref={cardRef} collapsable={false} style={styles.card}>
              <LinearGradient
                colors={[colors.primary, "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                {/* Brand */}
                <View style={styles.brandRow}>
                  <View style={styles.brandIcon}>
                    <Ionicons name="barbell" size={ms(14)} color="#FFFFFF" />
                  </View>
                  <Text style={styles.brandText}>PUSH DAILY</Text>
                </View>

                {/* Badge emoji */}
                <View style={styles.badgeCircle}>
                  <Text style={styles.badgeEmoji}>{badge?.emoji || "🏆"}</Text>
                </View>

                <Text style={styles.cardTitle}>Workout Complete!</Text>
                <Text style={styles.cardSubtitle}>
                  {bodyPart}
                  {level ? ` • ${level}` : ""}
                </Text>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Text style={styles.statValue}>{completedCount}</Text>
                    <Text style={styles.statLabel}>Exercises</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statValue}>{fmt(calories)}</Text>
                    <Text style={styles.statLabel}>Kcal</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={styles.statValue}>+{fmt(pointsEarned)}</Text>
                    <Text style={styles.statLabel}>Points</Text>
                  </View>
                </View>

                {/* Badge chip */}
                <View style={styles.badgeChip}>
                  <Text style={styles.badgeChipText}>
                    {badge?.emoji || "🏅"} {badge?.title || "Rabbit"}
                    {typeof badge?.score === "number"
                      ? ` • ${fmt(badge.score)} pts`
                      : ""}
                  </Text>
                </View>

                <Text style={styles.cardFooter}>
                  Your only competition is who you were yesterday.
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.shareBtn, sharing && { opacity: 0.7 }]}
            onPress={handleShare}
            activeOpacity={0.9}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="share-social" size={ms(18)} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const CARD_W = Math.min(width - ms(72), ms(300));

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(20),
  },
  sheet: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(26),
    paddingVertical: ms(22),
    paddingHorizontal: ms(20),
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  sheetTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: colors.text,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(4),
    marginBottom: ms(18),
  },

  // ── Capturable card ──
  cardShadow: {
    borderRadius: ms(24),
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  card: {
    width: CARD_W,
    borderRadius: ms(24),
    overflow: "hidden",
  },
  cardGradient: {
    alignItems: "center",
    paddingVertical: ms(24),
    paddingHorizontal: ms(20),
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(6),
    marginBottom: ms(18),
  },
  brandIcon: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    letterSpacing: 2,
    color: "#FFFFFF",
  },
  badgeCircle: {
    width: ms(82),
    height: ms(82),
    borderRadius: ms(41),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(14),
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeEmoji: {
    fontSize: ms(44),
  },
  cardTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(22),
    color: "#FFFFFF",
    textAlign: "center",
  },
  cardSubtitle: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: ms(4),
    marginBottom: ms(18),
  },
  statsRow: {
    flexDirection: "row",
    gap: ms(8),
    marginBottom: ms(16),
  },
  statPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: ms(14),
    paddingVertical: ms(10),
    paddingHorizontal: ms(6),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  statValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: "#FFFFFF",
  },
  statLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(9),
    color: "rgba(255,255,255,0.8)",
    marginTop: ms(2),
  },
  badgeChip: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: ms(999),
    paddingHorizontal: ms(14),
    paddingVertical: ms(7),
    marginBottom: ms(14),
  },
  badgeChipText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.primary,
  },
  cardFooter: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: ms(16),
    paddingHorizontal: ms(8),
  },

  // ── Actions ──
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    width: "100%",
    height: ms(52),
    borderRadius: ms(16),
    backgroundColor: colors.primary,
    marginTop: ms(20),
  },
  shareBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: "#FFFFFF",
  },
  closeBtn: {
    paddingVertical: ms(12),
    marginTop: ms(4),
  },
  closeBtnText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.textLight,
  },
});
