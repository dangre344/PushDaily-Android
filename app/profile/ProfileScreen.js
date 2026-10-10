import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { maybeAskForReview } from "../../constants/appReview";
import { bubbleScrollFade } from "../../constants/bubbleMessage";
import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { Logger } from "../../constants/Logger";
import { isPartnerMode } from "../../constants/periodReminders";
import { trackEvent } from "../../constants/mixpanel";
import { useUser } from "../../constants/UserContext";
import { syncWidget, trackWidgetGuideOpened } from "../../constants/widgetPromo";
import { scaling } from "../../constants/useScaling";
import { saveUserBadge } from "../../constants/utils";
import {
  getAllWorkouts,
  getCurrentStreak,
  getDaysSinceLastWorkout,
  getProfileStats,
  initDB,
} from "../../offlinedb/workoutdb";
import WorkoutBadgeInfo, { getUserBadge } from "../home/WorkoutBadgeInfo";
import MilestonesModal from "./MilestonesModal";
import StatsModal from "./StatsModal";
import SupportSheet from "./SupportSheet";
import WidgetGuideModal from "./WidgetGuideModal";
import { AboutModal } from "./privacy/AboutModal";
import { PrivacyPolicyModal } from "./privacy/PrivacyPolicyModal";

const ms = (n) => scaling().moderateScale(n);

const appVersion = nativeApplicationVersion ?? "1.0.0";
const buildVersion = nativeBuildVersion ?? "1";

// One icon style for every menu row (Instagram keeps its brand gradient).
const ROW_TINT = colors.primary;
const ROW_TINT_BG = "#FFF1E8";

// 18400 → "18.4k", so four numbers fit side by side.
const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/.0$/, "")}k`;
  return String(v);
};

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

// ── Follow on Instagram ──
const INSTAGRAM_URL = "https://www.instagram.com/pushdaily_workouts/";

// Instagram has no single brand colour, so the row uses the brand gradient.
const INSTAGRAM_GRADIENT = ["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"];

const handleOpenInstagram = async () => {
  trackEvent("Instagram Opened", { from: "profile" });
  try {
    // instagram:// jumps straight into the app when it is installed; the https
    // link is the fallback and also what a browser needs.
    const deepLink = "instagram://user?username=pushdaily_workouts";
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
    await Linking.openURL(INSTAGRAM_URL);
  } catch (error) {
    Logger.log("Instagram open error:", error);
    try {
      await Linking.openURL(INSTAGRAM_URL);
    } catch {}
  }
};

// ─── Menu sections ────────────────────────────────────────────────────────────
const MENU_SECTIONS = [
  {
    title: "Progress",
    items: [{ label: "Milestones", icon: "trophy-outline", key: "milestones" }],
  },
  {
    title: "Health & reminders",
    items: [
      {
        label: "Water Reminder & Period Tracking",
        subtitle: "Hydration reminders & track your period cycle",
        icon: "water-outline",
        key: "water",
      },
      { label: "Notifications", icon: "notifications-outline", key: "notifs" },
    ],
  },
  {
    title: "More",
    items: [
      { label: "Home-screen widget", icon: "grid-outline", key: "widget" },
      {
        label: "Follow on Instagram",
        icon: "logo-instagram",
        gradient: INSTAGRAM_GRADIENT,
        key: "instagram",
      },
    ],
  },
];
// Stats → the stats strip. Rate / Share → one two-button card. Buy me a
// coffee → its own card. Privacy / About → footer links. See ProfileScreen.

// ═════════════════════════════════════════════════════════════════════════════
// STATS STRIP — one card, four numbers. Tapping it opens the Stats sheet
// (which is why there is no separate "Stats" menu row any more).
// ═════════════════════════════════════════════════════════════════════════════
const StatsStrip = ({ stats, bmi, bmiColor, onPress }) => {
  const cols = [
    { value: compact(stats.totalWorkouts), label: "Workouts" },
    { value: compact(stats.totalCalories), label: "kcal" },
    { value: compact(stats.activeDays), label: "Active days" },
    { value: bmi || "—", label: "BMI", dot: bmi ? bmiColor : null },
  ];
  return (
    <TouchableOpacity
      style={statStyles.strip}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open detailed stats"
    >
      {cols.map((c, i) => (
        <View key={c.label} style={statStyles.colWrap}>
          {i > 0 ? <View style={statStyles.divider} /> : null}
          <View style={statStyles.col}>
            <Text style={statStyles.value} numberOfLines={1} adjustsFontSizeToFit>
              {c.value}
            </Text>
            <View style={statStyles.labelRow}>
              {c.dot ? <View style={[statStyles.dot, { backgroundColor: c.dot }]} /> : null}
              <Text style={statStyles.label} numberOfLines={1}>
                {c.label}
              </Text>
            </View>
          </View>
        </View>
      ))}
      <Ionicons name="chevron-forward" size={ms(14)} color={colors.dim} style={statStyles.chevron} />
    </TouchableOpacity>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MENU ROW
// ═════════════════════════════════════════════════════════════════════════════
const MenuRow = ({
  item,
  isLast,
  setPrivacyVisible,
  setAboutVisible,
  setOpenBadgeModal,
  setMilestonesVisible,
  setStatsVisible,
  setWidgetGuideVisible,
  setSupportVisible,
  setNotificationDialog,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
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
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={menuStyles.row}
        onPressIn={onPressIn}
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
          } else if (item.key === "scanfood") {
            router.push("/scan/food");
          } else if (item.key === "support") {
            trackEvent("Support Sheet Opened", { from: "profile" });
            setSupportVisible(true);
          } else if (item.key === "widget") {
            trackWidgetGuideOpened("profile");
            setWidgetGuideVisible(true);
          } else if (item.key === "milestones") {
            setMilestonesVisible(true);
          } else if (item.key === "stats") {
            setStatsVisible(true);
          } else if (item.key === "water") {
            router.push("/profile/water");
          } else if (item.key === "notifs") {
            handleNotifications(setNotificationDialog);
          } else if (item.key === "instagram") {
            handleOpenInstagram();
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
        {/* A gradient item (Instagram) gets the real brand mark — a flat tint
            would not read as the logo. Everything else keeps the tinted puck. */}
        {item.gradient ? (
          <LinearGradient
            colors={item.gradient}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={menuStyles.iconWrap}
          >
            <Ionicons name={item.icon} size={ms(18)} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View style={[menuStyles.iconWrap, { backgroundColor: ROW_TINT_BG }]}>
            <Ionicons name={item.icon} size={ms(18)} color={ROW_TINT} />
          </View>
        )}
        <View style={menuStyles.labelWrap}>
          <Text style={menuStyles.label}>{item.label}</Text>
          {item.subtitle ? (
            <Text style={menuStyles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={ms(16)} color={colors.dim} />
      </TouchableOpacity>

      {/* No divider under the last row — it overlapped the card edge. */}
      {!isLast && <View style={menuStyles.divider} />}
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

  const openEditProfile = () => {
    tapHaptic();
    router.push({ pathname: "../signup", params: { from: "edit" } });
  };

  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalCalories: 0,
    activeDays: 0,
  });

  useFocusEffect(
    useCallback(() => {
      const loadStats = async () => {
        await initDB();

        const [data, currentStreak, daysSinceLast] = await Promise.all([
          getProfileStats(),
          getCurrentStreak(),
          getDaysSinceLastWorkout(),
        ]);

        setStats(data);
        setStreak(currentStreak);

        // Hand the home-screen widget what it cannot work out on its own. This
        // screen is the natural place: the values are already loaded here and
        // refetched on every focus.
        syncWidget({
          name: user?.name,
          streak: currentStreak,
          daysSinceLast: daysSinceLast ?? -1,
        });

        // Nudge for a Play Store in-app review (uses already-fetched count).
        maybeAskForReview(data?.totalWorkouts);
      };

      loadStats();
      loadStoredBadgeRef.current?.(); // refresh the level after each workout
    }, [user?.name]),
  );

  Logger.log("user--ProfileScreen-->", user);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const avatarAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [openBadgeModal, setOpenBadgeModal] = useState(false);
  const [milestonesVisible, setMilestonesVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [widgetGuideVisible, setWidgetGuideVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);

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

  // The cached "userBadge" key was never actually written by anything, so
  // getStoredUserBadge() always returned null and the badge stayed hidden.
  // Derive it from workout history instead — getUserBadge([]) still returns
  // the first tier, so there is always something to show — and persist it so
  // the stored copy is finally real.
  const loadStoredBadgeRef = useRef(null);

  const loadStoredBadge = async () => {
    try {
      await initDB();
      const workouts = await getAllWorkouts();
      const badge = getUserBadge(workouts || []);
      setStoredBadge(badge);
      saveUserBadge(badge);
    } catch (e) {
      Logger.log("[Profile] badge load failed:", String(e));
      setStoredBadge(getUserBadge([])); // never leave the header empty
    }
  };
  loadStoredBadgeRef.current = loadStoredBadge;

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

  }, []);

  const getBMI = (weightKg, heightCm) => {
    if (!weightKg || !heightCm) return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return bmi.toFixed(1);
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
  const bmiColor = getBMIColor(bmi);
  const profileLine = [user?.experience, user?.goal].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Animated.ScrollView
        {...bubbleScrollFade}
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
            {/* Tapping the avatar (or its pencil) opens Edit Profile. */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openEditProfile}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <View style={styles.avatarRing}>
                <View style={styles.avatarInner}>
                  {user?.gender === "Male" ? (
                    <ManIconSVG
                      width={scaling().scaleWidth(66)}
                      height={scaling().scaleHeight(66)}
                      color={colors.primary}
                    />
                  ) : (
                    <FemaleIcon
                      width={scaling().scaleWidth(66)}
                      height={scaling().scaleHeight(66)}
                      color={colors.primary}
                    />
                  )}
                </View>
              </View>
              <View style={styles.editBadge}>
                <MaterialCommunityIcons name="pencil" size={ms(13)} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: avatarAnim, alignItems: "center" }}>
            <Text style={styles.name}>{user?.name || "User"}</Text>
            {/* One quiet line instead of three coloured pills; BMI moved into
                the stats strip, where it reads as a number. */}
            {profileLine ? <Text style={styles.subline}>{profileLine}</Text> : null}
          </Animated.View>
        </Animated.View>

        {/* Everything below fades in once, together — no per-row slide-ins. */}
        <Animated.View style={{ opacity: headerAnim }}>
          <StatsStrip
            stats={stats}
            bmi={bmi}
            bmiColor={bmiColor}
            onPress={() => {
              tapHaptic();
              setStatsVisible(true);
            }}
          />

          {MENU_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, iIdx) => (
                  <MenuRow
                    key={item.key}
                    item={
                      // Anyone who isn't Female tracks a partner's cycle.
                      item.key === "water" && isPartnerMode(user?.gender)
                        ? { ...item, subtitle: "Hydration reminders & track your partner's period cycle" }
                        : item
                    }
                    isLast={iIdx === section.items.length - 1}
                    setPrivacyVisible={setPrivacyVisible}
                    setAboutVisible={setAboutVisible}
                    setOpenBadgeModal={setOpenBadgeModal}
                    setMilestonesVisible={setMilestonesVisible}
                    setStatsVisible={setStatsVisible}
                    setWidgetGuideVisible={setWidgetGuideVisible}
                    setSupportVisible={setSupportVisible}
                    setNotificationDialog={setNotificationDialog}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* Rate + Share: two small actions, one card. */}
          <View style={styles.duoCard}>
            <TouchableOpacity
              style={styles.duoBtn}
              activeOpacity={0.7}
              onPress={() => {
                tapHaptic();
                handleRateApp();
              }}
            >
              <Ionicons name="star" size={ms(16)} color="#F59E0B" />
              <Text style={styles.duoText}>Rate app</Text>
            </TouchableOpacity>
            <View style={styles.duoDivider} />
            <TouchableOpacity
              style={styles.duoBtn}
              activeOpacity={0.7}
              onPress={() => {
                tapHaptic();
                handleShareApp();
              }}
            >
              <Ionicons name="share-social" size={ms(16)} color={colors.primary} />
              <Text style={styles.duoText}>Share app</Text>
            </TouchableOpacity>
          </View>

          {/* Support lives in its own friendly card, not among the settings. */}
          <TouchableOpacity
            style={styles.coffeeCard}
            activeOpacity={0.85}
            onPress={() => {
              tapHaptic();
              trackEvent("Support Sheet Opened", { from: "profile" });
              setSupportVisible(true);
            }}
          >
            <Text style={styles.coffeeEmoji}>☕</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.coffeeTitle}>Enjoying Push Daily?</Text>
              <Text style={styles.coffeeSub}>Buy me a coffee — it funds new features</Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color="#B45309" />
          </TouchableOpacity>

          {/* Footer: the legal bits, as quiet links. */}
          <View style={styles.footer}>
            <Text style={styles.footerLink} onPress={() => setPrivacyVisible(true)}>
              Privacy
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => setAboutVisible(true)}>
              About
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.version}>
              v{appVersion} ({buildVersion})
            </Text>
          </View>
        </Animated.View>
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

      {milestonesVisible ? (
        <MilestonesModal
          visible={milestonesVisible}
          setVisible={setMilestonesVisible}
        />
      ) : null}

      {statsVisible ? (
        <StatsModal visible={statsVisible} setVisible={setStatsVisible} />
      ) : null}

      {supportVisible ? (
        <SupportSheet visible={supportVisible} setVisible={setSupportVisible} />
      ) : null}

      {widgetGuideVisible ? (
        <WidgetGuideModal
          visible={widgetGuideVisible}
          setVisible={setWidgetGuideVisible}
          name={user?.name}
          streak={streak}
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

  scroll: {
    paddingBottom: ms(48),
  },

  // ── Profile header
  profileHeader: {
    alignItems: "center",
    marginTop: ms(14),
  },
  avatarContainer: {
    marginBottom: ms(10),
  },
  // ~15% smaller than before and no glow — a clean ring is enough.
  avatarRing: {
    width: ms(76),
    height: ms(76),
    borderRadius: ms(38),
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
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
    bottom: 0,
    right: -2,
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    // On Android, elevation decides draw order: the avatar ring is at 12, so
    // anything lower is painted underneath it. 16 keeps the pencil on top.
    elevation: 16,
    zIndex: 2,
  },
  name: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: colors.text,
  },
  subline: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.textLight,
    marginTop: 2,
  },

  // ── Stats

  // ── Menu sections
  section: {
    marginTop: ms(20),
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
    borderWidth: 1,
    borderColor: "#EEF0F4",
    overflow: "hidden",
  },

  // ── Rate / Share
  duoCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: ms(16),
    marginTop: ms(20),
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  duoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(7),
    paddingVertical: ms(14),
  },
  duoDivider: { width: 1, height: ms(22), backgroundColor: "#EEF0F4" },
  duoText: { fontFamily: "OpenSans_700Bold", fontSize: ms(13.5), color: colors.text },

  // ── Buy me a coffee
  coffeeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    marginHorizontal: ms(16),
    marginTop: ms(12),
    paddingHorizontal: ms(14),
    paddingVertical: ms(12),
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDE3C4",
  },
  coffeeEmoji: { fontSize: ms(24) },
  coffeeTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(13.5), color: colors.text },
  coffeeSub: { fontFamily: "OpenSans_500Medium", fontSize: ms(11.5), color: "#92400E", marginTop: 1 },

  // ── Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(6),
    marginTop: ms(22),
  },
  footerLink: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11.5),
    color: colors.textLight,
    paddingVertical: 4,
  },
  footerDot: { fontSize: ms(11.5), color: colors.dim },

  // ── Sign out

  // ── Version
  version: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11.5),
    color: colors.dim,
  },
});

// ── Stats strip ───────────────────────────────────────────────────────────────
const statStyles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: ms(16),
    marginTop: ms(18),
    paddingVertical: ms(14),
    paddingRight: ms(14),
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  colWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: ms(28), backgroundColor: "#EEF0F4" },
  col: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  value: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(17), color: colors.text },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(10.5), color: colors.textLight },
  chevron: { position: "absolute", right: ms(8) },
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
  labelWrap: {
    flex: 1,
  },
  label: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(14),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(2),
    lineHeight: ms(15),
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.grey,
  },
});
