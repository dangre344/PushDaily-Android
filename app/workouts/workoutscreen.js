import { Logger } from "@/constants/Logger";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MotiView } from "moti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { maybeAskForReview } from "../../constants/appReview";
import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { bodyParts, workoutListGlobal } from "../../constants/Constants";
import { registerLevelPicker } from "../../constants/levelPicker";
import { SESSION_QUOTE } from "../../constants/quotes";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  markWaterPromptDismissed,
  markWaterPromptShown,
  pickWellnessPrompt,
} from "../../constants/waterReminder";
import {
  getAllWorkouts,
  getCurrentStreak,
  getDaysSinceLastWorkout,
  getProfileStats,
  initDB,
} from "../../offlinedb/workoutdb";
import BadgeLevelUpModal from "../home/BadgeLevelUpModal";
import WorkoutBadgeInfo, { BADGE_DETAILS, BADGE_ORDER, getUserBadge } from "../home/WorkoutBadgeInfo";
import BodyPartGrid from "./Componenets/BodyPartGrid";
import HIITCard from "./Componenets/HIITCard";
import ScanButton from "./Componenets/ScanButton";
import TodayCard from "./Componenets/TodayCard";
import WaterPromptModal from "./Componenets/WaterPromptModal";
import WorkoutLevelModal from "./Componenets/WorkoutLevelModal";

const { scaleHeight, scaleWidth, moderateScale: ms } = scaling();

// Shown in the same order people tend to think about training.
const BODY_PART_ORDER = ["Chest", "Abs", "Legs", "Arms", "Shoulder", "Back"];
const orderedBodyParts = [...bodyParts].sort(
  (a, b) => BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart),
);

const greetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 17) return "goodAfternoon";
  return "goodEvening";
};

function SectionHeader({ title, subtitle, delay = 0 }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 300, delay }}
      style={styles.section}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </MotiView>
  );
}

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  const [openModal, setOpenModal] = useState(false);
  const [badgeLevelUpVisible, setBadgeLevelUpVisible] = useState(false);
  const [badgeInfoVisible, setBadgeInfoVisible] = useState(false);
  const [waterPromptVisible, setWaterPromptVisible] = useState(false);
  const [promptTab, setPromptTab] = useState("water");

  const [badgeUpgradeData, setBadgeUpgradeData] = useState({
    oldBadge: null,
    newBadge: null,
  });
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);
  const [allWorkouts, setAllHistoryWorkouts] = useState([]);
  // Same inputs the home-screen widget is given.
  const [mascot, setMascot] = useState({ streak: 0, daysSinceLast: -1 });

  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalCalories: 0,
    activeDays: 0,
  });

  const loadData = async () => {
    try {
      await initDB();

      const data = await getProfileStats();

      Logger.log("Profile stats--->", data);

      setStats(data);

      // Nudge for a Play Store in-app review once the habit is forming
      // (uses the count we just fetched — no extra query).
      maybeAskForReview(data?.totalWorkouts);
    } catch (error) {
      Logger.log("Error loading screen data:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const setup = async () => {
        await initDB();

        const [allWorkoutsData, currentStreak, daysSince] = await Promise.all([
          getAllWorkouts(),
          getCurrentStreak(),
          getDaysSinceLastWorkout(),
        ]);

        Logger.log("All workouts after insertion--->", allWorkoutsData);

        if (isActive) {
          setAllHistoryWorkouts(allWorkoutsData);
          setMascot({ streak: currentStreak, daysSinceLast: daysSince ?? -1 });
        }
      };

      setup();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const isFemaleRef = useRef(false);
  isFemaleRef.current = user?.gender === "Female";

  // Occasionally nudge the user to set up water reminders (and, for women,
  // period tracking). Gating lives in
  // waterReminder.js (never right after sign-in, has a cooldown, only sometimes).
  // Delayed so it doesn't collide with the startup interstitial / badge modal.
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        // Read at fire time: the user profile may load after mount.
        const which = await pickWellnessPrompt({ includePeriods: isFemaleRef.current });
        if (which && active) {
          setPromptTab(which);
          setWaterPromptVisible(true);
          markWaterPromptShown();
        }
      } catch {}
    }, 1800);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, []);

  const { hiitWorkouts } = useMemo(() => {
    const targetMuscles = ["Upper Body", "Full Body", "Lower Body"];
    const hiitSet = new Set();

    const result = {
      hiitWorkouts: [],
    };

    workoutListGlobal.forEach((item) => {
      if (item.level !== "Beginner") return;

      let hiitCategory = null;

      if (item.bodyPart === "HIIT") {
        hiitCategory = "HIIT";
      } else if (targetMuscles.includes(item.bodyPart)) {
        hiitCategory = item.bodyPart;
      } else if (item.bodyPart === "Glutes") {
        hiitCategory = "Glutes";
      } else if (item.bodyPart === "Posture Correction") {
        hiitCategory = "Posture Correction";
      }

      if (hiitCategory && !hiitSet.has(hiitCategory)) {
        hiitSet.add(hiitCategory);
        result.hiitWorkouts.push(item);
      }
    });

    return result;
  }, []);

  const openWorkoutLevelModal = (item) => {
    setSelectedBodyPart(item);
    setOpenModal(true);
  };

  // Let other screens (Stats empty state) open this picker after navigating
  // here — they unmount before they could route to it themselves.
  useEffect(() => registerLevelPicker(openWorkoutLevelModal), []);

  const performedWorkouts = allWorkouts || [];
  const userBadge = getUserBadge(performedWorkouts);

  const checkBadgeUpgrade = async () => {
    if (!userBadge?.title) return;

    const savedBadgeTitle = await AsyncStorage.getItem("lastUserBadgeTitle");

    Logger.log(
      "Checking badge upgrade. Current:",
      userBadge.title,
      "Saved:",
      savedBadgeTitle,
    );

    if (!savedBadgeTitle) {
      await AsyncStorage.setItem("lastUserBadgeTitle", userBadge.title);
      return;
    }

    const oldLevel = BADGE_ORDER[savedBadgeTitle] || 0;
    const newLevel = BADGE_ORDER[userBadge.title] || 0;

    Logger.log("Badge levels - Old:", oldLevel, "New:", newLevel);

    if (newLevel > oldLevel) {
      setBadgeUpgradeData({
        oldBadge: BADGE_DETAILS[savedBadgeTitle],
        newBadge: {
          title: userBadge.title,
          subtitle: userBadge.subtitle,
          emoji: userBadge.emoji,
        },
      });

      setBadgeLevelUpVisible(true);
      await AsyncStorage.setItem("lastUserBadgeTitle", userBadge.title);
    }
  };

  useEffect(() => {
    checkBadgeUpgrade();
  }, [userBadge?.title]);

  const firstName = (user?.name || "").trim().split(/\s+/)[0];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F7F8FA" />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* HEADER — greeting, level, scan. The quote is one quiet line. */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.hello}>{t(greetingKey())}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {firstName ? `${firstName} 👋` : "👋"}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {userBadge?.title ? (
                <MotiView
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", damping: 14, delay: 150 }}
                >
                  <Pressable
                    onPress={() => {
                      tapHaptic();
                      setBadgeInfoVisible(true);
                    }}
                    style={({ pressed }) => [styles.level, pressed && { opacity: 0.7 }]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Your level: ${userBadge.title}. View badges`}
                  >
                    <Text style={styles.levelEmoji}>{userBadge.emoji}</Text>
                    <Text style={styles.levelText}>{userBadge.title}</Text>
                    <Ionicons name="chevron-forward" size={ms(11)} color={colors.primary} />
                  </Pressable>
                </MotiView>
              ) : null}

              {/* Food-label scanner — top-right entry point */}
              <ScanButton />
            </View>
          </View>

          <Text style={styles.quote} numberOfLines={1}>
            “{SESSION_QUOTE}”
          </Text>

          {/* One card for today: mascot, the last 7 days, totals and the
              "plan my session" flow — previously three separate cards. */}
          <TodayCard
            name={user?.name}
            gender={user?.gender}
            experience={user?.experience}
            streak={mascot.streak}
            daysSinceLast={mascot.daysSinceLast}
            history={allWorkouts}
            stats={stats}
            onStart={openWorkoutLevelModal}
          />

          <SectionHeader title={t("trainByBodyPart")} subtitle={t("trainByBodyPartSub")} delay={120} />
          <BodyPartGrid items={orderedBodyParts} onSelect={openWorkoutLevelModal} />

          <SectionHeader title={t("quickStarts")} subtitle={t("quickStartsSub")} delay={200} />
          {/* The original banner cards, unchanged — the posters carry their
              own artwork and text, so they're shown whole. */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={hiitWorkouts}
            keyExtractor={(item, index) => `hiit-${item.id || index}`}
            renderItem={({ item }) => (
              <HIITCard
                item={item}
                onClick={(selectedItem) => {
                  Logger.log("Selected HIIT workout--->", selectedItem);
                  openWorkoutLevelModal(selectedItem);
                }}
              />
            )}
            contentContainerStyle={styles.hiitListContent}
            snapToInterval={scaleWidth(300)}
            snapToAlignment="center"
            decelerationRate="fast"
            bounces={false}
            pagingEnabled={false}
            getItemLayout={(data, index) => ({
              length: scaleWidth(300) + 20,
              offset: (scaleWidth(300) + 20) * index,
              index,
            })}
          />
        </ScrollView>
      </Animated.View>

      {openModal ? (
        <WorkoutLevelModal
          visible={openModal}
          selectedBodyPart={selectedBodyPart}
          setOpenModal={setOpenModal}
          t={t}
        />
      ) : null}

      {/* Always mounted (toggle via `visible`) — conditionally mounting a
          <Modal> flickers/double-animates on Android. */}
      <BadgeLevelUpModal
        visible={badgeLevelUpVisible}
        setVisible={setBadgeLevelUpVisible}
        oldBadge={badgeUpgradeData.oldBadge}
        newBadge={badgeUpgradeData.newBadge}
        score={userBadge?.score}
      />

      {badgeInfoVisible ? (
        <WorkoutBadgeInfo
          userBadge={userBadge}
          visible={badgeInfoVisible}
          setVisible={setBadgeInfoVisible}
        />
      ) : null}

      <WaterPromptModal
        visible={waterPromptVisible}
        showPeriods={user?.gender === "Female"}
        initialTab={promptTab}
        onClose={() => {
          setWaterPromptVisible(false);
          markWaterPromptDismissed();
        }}
        onEnable={(tab) => {
          setWaterPromptVisible(false);
          router.push(tab === "period" ? "/profile/water?tab=period" : "/profile/water");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FA" },
  animatedContainer: { flex: 1 },
  // Room for the tab bar and the floating Jack bubble.
  scrollContent: { paddingBottom: scaleHeight(110) },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: ms(6),
  },
  headerText: { flex: 1, paddingRight: 10 },
  hello: { fontSize: ms(11.5), lineHeight: ms(15), fontFamily: "OpenSans_600SemiBold", color: colors.textLight },
  name: {
    fontSize: ms(19),
    lineHeight: ms(24),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  level: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFF1E8",
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 7,
  },
  levelEmoji: { fontSize: ms(12) },
  levelText: { fontSize: ms(11), fontFamily: "OpenSans_800ExtraBold", color: colors.primary },
  quote: {
    marginTop: ms(2),
    paddingHorizontal: 20,
    fontSize: ms(11.5),
    fontFamily: "OpenSans_600SemiBold",
    fontStyle: "italic",
    color: "#8A939B",
  },

  section: { paddingHorizontal: 20, marginTop: ms(20) },
  sectionTitle: { fontSize: ms(16.5), fontFamily: "OpenSans_800ExtraBold", color: colors.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: ms(11.5), fontFamily: "OpenSans_600SemiBold", color: colors.textLight, marginTop: 1 },

  // Original banner list spacing, plus a little top room under the new header.
  hiitListContent: {
    paddingLeft: ms(20),
    paddingRight: ms(20),
    paddingTop: 12,
    paddingBottom: ms(30),
  },
});
