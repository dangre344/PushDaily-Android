import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_UNIT_IDS } from "../../ads/Admobmanager.js";
import { colors } from "../../constants/colors.js";
import { scaling } from "../../constants/useScaling.js";

export default function BadgeLevelUpModal({
  visible,
  setVisible,
  oldBadge,
  newBadge,
}) {
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const oldBadgeAnim = useRef(new Animated.Value(1)).current;
  const newBadgeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.75);
      opacityAnim.setValue(0);
      slideAnim.setValue(30);
      progressAnim.setValue(0);
      oldBadgeAnim.setValue(1);
      newBadgeAnim.setValue(0);
      glowAnim.setValue(0);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 7,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),

        Animated.parallel([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(oldBadgeAnim, {
              toValue: 0.55,
              duration: 450,
              useNativeDriver: true,
            }),
            Animated.timing(newBadgeAnim, {
              toValue: 1,
              duration: 450,
              useNativeDriver: true,
            }),
          ]),
        ]),

        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 },
        ),
      ]).start();
    }
  }, [visible]);

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.38],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.topIconWrap}>
            <Ionicons name="trophy" size={34} color={colors.primary} />
          </View>

          <Text style={styles.title}>Badge Upgraded!</Text>

          <Text style={styles.subtitle}>
            Great job! Your consistency and workout effort helped you unlock a
            stronger badge.
          </Text>

          <View style={styles.transitionBox}>
            <Animated.View
              style={[
                styles.badgeBox,
                {
                  opacity: oldBadgeAnim,
                  transform: [{ scale: oldBadgeAnim }],
                },
              ]}
            >
              <Text style={styles.badgeEmoji}>{oldBadge?.emoji || "🐺"}</Text>
              <Text style={styles.badgeName}>{oldBadge?.title || "Wolf"}</Text>
              <Text style={styles.badgeLabel}>
                {oldBadge?.subtitle || "Consistent"}
              </Text>
            </Animated.View>

            <View style={styles.arrowBox}>
              <Ionicons name="arrow-forward" size={24} color={colors.primary} />
            </View>

            <Animated.View
              style={[
                styles.badgeBox,
                styles.newBadgeBox,
                {
                  opacity: newBadgeAnim,
                  transform: [
                    {
                      scale: newBadgeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.glowCircle,
                  {
                    opacity: glowOpacity,
                    transform: [{ scale: glowScale }],
                  },
                ]}
              />

              <Text style={styles.badgeEmoji}>{newBadge?.emoji || "🐯"}</Text>
              <Text style={styles.badgeName}>{newBadge?.title || "Tiger"}</Text>
              <Text style={styles.badgeLabel}>
                {newBadge?.subtitle || "Strong"}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Level Progress</Text>
              <Text style={styles.progressPercent}>100%</Text>
            </View>

            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressWidth,
                  },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              You moved from {oldBadge?.title || "Wolf"} to{" "}
              {newBadge?.title || "Tiger"}.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.infoText}>
              Keep completing workouts to move closer to the next badge.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.okButton}
            onPress={closeModal}
          >
            <Text style={styles.okButtonText}>Awesome</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={AD_UNIT_IDS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: false,
            }}
            onAdLoaded={() => {
              console.log("[AdMob] Banner loaded");
            }}
            onAdFailedToLoad={(error) => {
              console.warn("[AdMob] Banner failed:", error);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    height: scaling().scaleHeight(40),
  },

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 12,
  },

  topIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 22,
    color: colors.text,
    textAlign: "center",
  },

  subtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    paddingHorizontal: 8,
  },

  transitionBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },

  badgeBox: {
    flex: 1,
    minHeight: 128,
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },

  newBadgeBox: {
    backgroundColor: colors.primary + "10",
    borderColor: colors.primary,
    overflow: "hidden",
  },

  glowCircle: {
    position: "absolute",
    width: 95,
    height: 95,
    borderRadius: 48,
    backgroundColor: colors.primary,
  },

  badgeEmoji: {
    fontSize: 42,
  },

  badgeName: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 15,
    color: colors.text,
    marginTop: 8,
  },

  badgeLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    textAlign: "center",
  },

  arrowBox: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  progressSection: {
    width: "100%",
    marginTop: 24,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  progressTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 14,
    color: colors.text,
  },

  progressPercent: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 12,
    color: colors.primary,
  },

  progressTrack: {
    height: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 20,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 20,
  },

  progressText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
  },

  infoBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "10",
    borderRadius: 16,
    padding: 12,
    marginTop: 14,
  },

  infoText: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
    marginStart: 8,
  },

  okButton: {
    width: "100%",
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  okButtonText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
