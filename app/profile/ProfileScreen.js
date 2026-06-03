import { Ionicons, MaterialCommunityIcons, Octicons } from "@expo/vector-icons";
import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BannerAd } from "react-native-google-mobile-ads";
import { SafeAreaView } from "react-native-safe-area-context";
import { AD_UNIT_IDS, BannerAdSize } from "../../ads/Admobmanager";
import { FemaleIcon, ManIconSVG } from "../../assets/AllSvgs";
import NotificationDialog from "../../components/ui/NotificationDialog";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import { getStoredUserBadge } from "../../constants/utils";
import {
  getCurrentStreak,
  getProfileStats,
  initDB,
} from "../../offlinedb/workoutdb";
import WorkoutBadgeInfo from "../home/WorkoutBadgeInfo";
import { AboutModal } from "./privacy/AboutModal";
import { PrivacyPolicyModal } from "./privacy/PrivacyPolicyModal";

const { width } = Dimensions.get("window");
const ms = (n) => scaling().moderateScale(n);

const appVersion = nativeApplicationVersion ?? "1.0.0";
const buildVersion = nativeBuildVersion ?? "1";

const STATS = [
  {
    label: "Workouts",
    value: "124",
    icon: "barbell-outline",
    color: colors.primary,
  },
  {
    label: "Total Calories",
    value: "18.4k",
    icon: "flame-outline",
    color: colors.secondary,
  },
  {
    label: "Active Days",
    value: "47",
    icon: "calendar-outline",
    color: colors.green,
  },
];

// ── Rate the App
const handleRateApp = () => {
  const androidPackage = "com.pushdaily.homeworkout.fit"; // replace with your package
  const iosAppId = "123456789"; // replace with your App Store ID

  const url = Platform.select({
    ios: `itms-apps://itunes.apple.com/app/id${iosAppId}?action=write-review`,
    android: `market://details?id=${androidPackage}`,
  });

  const webFallback = Platform.select({
    ios: `https://apps.apple.com/app/id${iosAppId}?action=write-review`,
    android: `https://play.google.com/store/apps/details?id=${androidPackage}`,
  });

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) return Linking.openURL(url);
      return Linking.openURL(webFallback);
    })
    .catch(() => Linking.openURL(webFallback));
};

// ── Share App
const handleShareApp = async () => {
  const androidPackage = "com.pushdaily.homeworkout.fit";
  const iosAppId = "123456789";

  const url = Platform.select({
    ios: `https://apps.apple.com/app/id${iosAppId}`,
    android: `https://play.google.com/store/apps/details?id=${androidPackage}`,
  });

  const message = `🏋️ Push harder every day with Push Daily! Your all-in-one fitness tracking companion 💯 ${url}`;

  try {
    await Share.share({
      message,
      url,
    });
  } catch (error) {
    Logger.log("Share error:", error);
  }
};

// ─── Menu sections ────────────────────────────────────────────────────────────
const MENU_SECTIONS = [
  {
    title: "Account",
    items: [
      {
        label: "Edit Profile",
        icon: "person-outline",
        color: colors.primary,
        key: "edit",
      },

      {
        label: "Levels & Badges",
        icon: "notifications-outline",
        color: colors.lightRed,
        key: "badge",
      },

      {
        label: "Notifications",
        icon: "notifications-outline",
        color: colors.green,
        key: "notifs",
      },
    ],
  },

  {
    title: "Support & Legal",
    items: [
      {
        label: "Privacy Policy",
        icon: "shield-checkmark-outline",
        color: colors.green,
        key: "privacy",
      },

      {
        label: "Rate the App",
        icon: "star-outline",
        color: colors.primary,
        key: "rate",
      },
      {
        label: "Share App",
        icon: "share-social-outline",
        color: colors.primary,
        key: "share",
      },

      {
        label: "About",
        icon: "information-circle-outline",
        color: colors.dim,
        key: "about",
      },
    ],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════════════════════════════════
const StatCard = ({ index, item, delay, stats }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        statStyles.card,
        {
          opacity: anim,
          transform: [
            { scale: anim },
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View
        style={[statStyles.iconWrap, { backgroundColor: item.color + "20" }]}
      >
        <Ionicons name={item.icon} size={ms(18)} color={item.color} />
      </View>
      <Text style={statStyles.value}>
        {index === 0
          ? stats.totalWorkouts
          : index === 1
            ? stats.totalCalories
            : stats.activeDays}
      </Text>
      <Text style={statStyles.label}>{item.label}</Text>
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MENU ROW
// ═════════════════════════════════════════════════════════════════════════════
const MenuRow = ({
  item,
  delay,
  isLast,
  setPrivacyVisible,
  setAboutVisible,
  setOpenBadgeModal,
  setNotificationDialog,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressIn = (item) => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const showNotificationDialog = ({
    type,
    title,
    message,
    primaryText,
    secondaryText,
    onPrimaryPress,
    setNotificationDialog,
  }) => {
    setNotificationDialog({
      visible: true,
      type,
      title,
      message,
      primaryText,
      secondaryText,
      onPrimaryPress,
    });
  };

  const handleNotifications = async (setNotificationDialog) => {
    const { status: existing } = await Notifications.getPermissionsAsync();

    if (existing === "granted") {
      showNotificationDialog({
        type: "warning",
        title: "Notifications Enabled",
        message:
          "Notifications are already enabled for Push Daily. You can manage notification preferences from your device settings.",
        primaryText: "Manage Settings",
        secondaryText: "OK",
        onPrimaryPress: () => Linking.openSettings(),
        setNotificationDialog,
      });
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();

    if (status === "granted") {
      showNotificationDialog({
        type: "success",
        title: "Notifications Enabled 🎉",
        message:
          "You will now receive workout reminders and progress updates to help you stay consistent.",
        primaryText: "Great!",
        setNotificationDialog,
      });
    } else {
      showNotificationDialog({
        type: "denied",
        title: "Permission Denied",
        message:
          "Enable notifications in your device settings to receive workout reminders and progress updates.",
        primaryText: "Open Settings",
        secondaryText: "Cancel",
        onPrimaryPress: () => Linking.openSettings(),
        setNotificationDialog,
      });
    }
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-24, 0],
            }),
          },
          { scale: scaleAnim },
        ],
      }}
    >
      <TouchableOpacity
        style={menuStyles.row}
        onPressIn={onPressIn(item)}
        onPressOut={onPressOut}
        activeOpacity={1}
        onPress={() => {
          Logger.log("Pressed menu item--->", item);

          if (item.key === "edit") {
            router.push({
              pathname: "../signup",
              params: {
                from: "edit",
              },
            });
          } else if (item.key === "badge") {
            setOpenBadgeModal(true);
          } else if (item.key === "notifs") {
            handleNotifications(setNotificationDialog);
          } else if (item.key === "privacy") {
            setPrivacyVisible(true);
          } else if (item.key === "share") {
            handleShareApp();
          } else if (item.key === "rate") {
            handleRateApp();
          } else if (item.key === "about") {
            setAboutVisible(true);
          }
        }}
      >
        <View
          style={[menuStyles.iconWrap, { backgroundColor: item.color + "18" }]}
        >
          <Ionicons name={item.icon} size={ms(18)} color={item.color} />
        </View>
        <Text style={menuStyles.label}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={ms(16)} color={colors.dim} />
      </TouchableOpacity>

      <View style={menuStyles.divider} />
    </Animated.View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  // ── Entrance animations

  const { user } = useUser();
  const [streak, setStreak] = useState(0);

  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalCalories: 0,
    activeDays: 0,
  });

  useFocusEffect(
    useCallback(() => {
      const loadStats = async () => {
        await initDB();

        const [data, currentStreak] = await Promise.all([
          getProfileStats(),
          getCurrentStreak(),
        ]);

        setStats(data);
        setStreak(currentStreak);
      };

      loadStats();
    }, []),
  );

  Logger.log("user--ProfileScreen-->", user);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const avatarAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [openBadgeModal, setOpenBadgeModal] = useState(false);

  const [storedBadge, setStoredBadge] = useState(null);

  const [notificationDialog, setNotificationDialog] = useState({
    visible: false,
    type: "info",
    title: "",
    message: "",
    primaryText: "",
    secondaryText: "",
    onPrimaryPress: null,
  });

  const loadStoredBadge = async () => {
    const badge = await getStoredUserBadge();
    setStoredBadge(badge);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(avatarAnim, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    loadStoredBadge();
  }, []);

  const getBMI = (weightKg, heightCm) => {
    if (!weightKg || !heightCm) return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return bmi.toFixed(1);
  };

  const getBMILabel = (bmi) => {
    if (!bmi) return "";
    const value = parseFloat(bmi);
    if (value < 18.5) return "Underweight";
    if (value < 25) return "Healthy";
    if (value < 30) return "Overweight";
    return "Obese";
  };

  const getBMIColor = (bmi) => {
    if (!bmi) return colors.muted;
    const value = parseFloat(bmi);
    if (value < 18.5) return "#3B8BD4"; // blue  — underweight
    if (value < 25) return "#1D9E75"; // green — healthy
    if (value < 30) return "#EF9F27"; // amber — overweight
    return "#E24B4A"; // red   — obese
  };

  // Avatar parallax on scroll
  const avatarTranslate = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -30],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.3],
    extrapolate: "clamp",
  });

  const bmi = getBMI(user?.weight, user?.height);
  const bmiLabel = getBMILabel(bmi);
  const bmiColor = getBMIColor(bmi);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.glowTop} pointerEvents="none" />

      <View style={styles.glowRight} pointerEvents="none" />

      <View style={styles.glowLeft} pointerEvents="none" />

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        <Animated.View
          style={[
            styles.profileHeader,
            {
              opacity: Animated.multiply(headerAnim, headerOpacity),
              transform: [{ translateY: avatarTranslate }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.avatarContainer,
              { transform: [{ scale: avatarScale }], opacity: avatarAnim },
            ]}
          >
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {user?.gender === "Female" ? (
                  <FemaleIcon
                    width={scaling().scaleWidth(80)}
                    height={scaling().scaleHeight(80)}
                    color={colors.primary}
                  />
                ) : user?.gender === "Male" ? (
                  <ManIconSVG
                    width={scaling().scaleWidth(80)}
                    height={scaling().scaleHeight(80)}
                    color={colors.primary}
                  />
                ) : (
                  <FemaleIcon
                    width={scaling().scaleWidth(80)}
                    height={scaling().scaleHeight(80)}
                    color={colors.primary}
                  />
                )}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: avatarAnim, alignItems: "center" }}>
            <Text style={styles.name}>{user?.name || "User"}</Text>

            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={ms(11)}
                  color={colors.primary}
                />
                <Text style={styles.pillText}>{user?.experience}</Text>
              </View>

              <View style={styles.pill}>
                <Octicons name="goal" size={ms(11)} color={colors.muted} />
                <Text style={styles.pillText}>{user?.goal}</Text>
              </View>

              {bmi && (
                <View style={[styles.pill, { borderColor: bmiColor }]}>
                  <MaterialCommunityIcons
                    name="scale-bathroom"
                    size={ms(11)}
                    color={bmiColor}
                  />
                  <Text style={[styles.pillText, { color: bmiColor }]}>
                    BMI {bmi} · {bmiLabel}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Stats Grid ── */}
        <View style={styles.statsGrid}>
          {STATS.map((s, i) => (
            <StatCard
              index={i}
              key={s.label}
              item={s}
              delay={300 + i * 80}
              stats={stats}
            />
          ))}
        </View>

        {streak != 0 && (
          <Animated.View
            style={[
              styles.streakBanner,
              {
                opacity: headerAnim,
                transform: [
                  {
                    translateY: headerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.streakLeft}>
              <Text style={styles.streakFire}>🔥</Text>
              <View>
                <Text style={styles.streakTitle}>{streak} Day Streak</Text>
                <Text style={styles.streakSub}>
                  {streak === 7
                    ? "Amazing! You hit a 7 day streak! 🎉"
                    : `${streak} day${streak !== 1 ? "s" : ""} strong — keep showing up!`}
                </Text>
              </View>
            </View>

            <View style={styles.streakBar}>
              {Array.from({ length: 7 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.streakDot,
                    i < Math.min(streak, 7) && styles.streakDotActive,
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {MENU_SECTIONS.map((section, sIdx) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, iIdx) => (
                <MenuRow
                  key={item.key}
                  item={item}
                  delay={500 + sIdx * 100 + iIdx * 50}
                  isLast={iIdx === section.items.length - 1}
                  setPrivacyVisible={setPrivacyVisible}
                  setAboutVisible={setAboutVisible}
                  setOpenBadgeModal={setOpenBadgeModal}
                  setNotificationDialog={setNotificationDialog}
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>
          Push Daily v{appVersion} ({buildVersion})
        </Text>
      </Animated.ScrollView>

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

      {privacyVisible ? (
        <PrivacyPolicyModal
          privacyVisible={privacyVisible}
          setPrivacyVisible={setPrivacyVisible}
        />
      ) : null}

      {aboutVisible ? (
        <AboutModal
          aboutVisible={aboutVisible}
          setAboutVisible={setAboutVisible}
          handleRateApp={() => {
            Logger.log("Rate app from About modal");

            handleRateApp();
          }}
          handleShareApp={() => {
            handleShareApp();
          }}
        />
      ) : null}

      {openBadgeModal ? (
        <WorkoutBadgeInfo
          userBadge={storedBadge}
          visible={openBadgeModal}
          setVisible={setOpenBadgeModal}
        />
      ) : null}

      <NotificationDialog
        visible={notificationDialog.visible}
        type={notificationDialog.type}
        title={notificationDialog.title}
        message={notificationDialog.message}
        primaryText={notificationDialog.primaryText}
        secondaryText={notificationDialog.secondaryText}
        onClose={() =>
          setNotificationDialog((prev) => ({
            ...prev,
            visible: false,
          }))
        }
        onPrimaryPress={() => {
          setNotificationDialog((prev) => ({
            ...prev,
            visible: false,
          }));

          notificationDialog.onPrimaryPress?.();
        }}
        onSecondaryPress={() =>
          setNotificationDialog((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      />
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "white",
  },

  // Bound the scroll area so the pinned banner below it always stays on screen.
  scrollView: {
    flex: 1,
  },

  bannerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: ms(52),
  },

  glowRight: {
    position: "absolute",
    right: ms(-200),
    top: ms(110),
    alignSelf: "center",
    width: width * 0.7,
    height: ms(180),
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.07,
  },

  glowLeft: {
    position: "absolute",
    left: ms(-200),
    top: ms(30),
    alignSelf: "center",
    width: width * 0.7,
    height: ms(180),
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.07,
  },
  glowTop: {
    position: "absolute",
    top: ms(-100),
    alignSelf: "center",
    width: width * 0.7,
    height: ms(180),
    borderRadius: 999,
    backgroundColor: colors.primary,
    opacity: 0.07,
    // blur not available in RN without library — glow via opacity is sufficient
  },
  scroll: {
    paddingBottom: ms(48),
  },

  // ── Profile header
  profileHeader: {
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: ms(10),
  },
  avatarRing: {
    width: ms(90),
    height: ms(90),
    borderRadius: ms(45),
    borderWidth: 2.5,
    borderColor: colors.primary,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    // Double ring effect
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  avatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: ms(55),
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(18),
    color: colors.text,
    letterSpacing: 0.3,
  },
  handle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(12),
    color: colors.muted,
    marginTop: 3,
    marginBottom: ms(12),
  },
  pillRow: {
    flexDirection: "row",
    gap: ms(8),
    marginTop: ms(8),
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderWidth: 0.5,
    borderColor: colors.grey,
  },
  pillText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10),
    color: colors.muted,
  },

  // ── Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: ms(16),
    gap: ms(10),
    marginTop: ms(12),
    marginBottom: ms(14),
  },

  // ── Streak banner
  streakBanner: {
    marginHorizontal: ms(16),
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: ms(14),
    borderWidth: 0.5,
    borderColor: colors.grey,
    marginBottom: ms(24),
    marginTop: ms(8),
  },
  streakLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginBottom: ms(12),
  },
  streakFire: {
    fontSize: ms(28),
  },
  streakTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(15),
    color: colors.text,
  },
  streakSub: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11),
    color: colors.muted,
    marginTop: 2,
  },
  streakBar: {
    flexDirection: "row",
    gap: ms(6),
  },
  streakDot: {
    flex: 1,
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: colors.grey,
  },
  streakDotActive: {
    backgroundColor: colors.primary,
  },

  // ── Menu sections
  section: {
    marginBottom: ms(20),
    paddingHorizontal: ms(16),
  },
  sectionTitle: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: ms(10),
    marginLeft: ms(4),
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.grey,
    overflow: "hidden",
  },

  // ── Sign out
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    marginHorizontal: ms(16),
    marginTop: ms(8),
    marginBottom: ms(20),
    paddingVertical: ms(14),
    borderRadius: 14,
    backgroundColor: "#EF444412",
    borderWidth: 1,
    borderColor: "#EF444430",
  },
  signOutText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(14),
    color: "#EF4444",
  },

  // ── Version
  version: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11),
    color: colors.dim,
    textAlign: "center",
  },
});

// ── Stat card styles ──────────────────────────────────────────────────────────
const statStyles = StyleSheet.create({
  card: {
    width: (width - ms(16) * 2 - ms(10) * 2) / 3, // 2 gaps between 3 cards
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: ms(12),
    borderWidth: 0.5,
    borderColor: colors.grey,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(10),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(10),
  },
  value: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(20),
    color: colors.text,
    lineHeight: ms(26),
  },
  label: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(10),
    color: colors.muted,
    marginTop: ms(2),
  },
});

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ms(14),
    paddingVertical: ms(13),
  },
  rowLast: {
    // no special style needed, divider handled separately
  },
  iconWrap: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    alignItems: "center",
    justifyContent: "center",
    marginRight: ms(12),
  },
  label: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(14),
    color: colors.text,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.grey,
  },
});
