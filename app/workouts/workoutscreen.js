import { Logger } from "@/constants/Logger";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { maybeAskForReview } from "../../constants/appReview";
import { bubbleScrollFade } from "../../constants/bubbleMessage";
import { colors } from "../../constants/colors";
import { bodyParts, workoutListGlobal } from "../../constants/Constants";
import { tapHaptic } from "../../constants/haptics";
import {
  badgeForSnapshot,
  getHomeSnapshot,
  peekHomeSnapshot,
  readHomeSnapshot,
} from "../../constants/homeSnapshot";
import { registerLevelPicker } from "../../constants/levelPicker";
import {
  getQuickStartOrder,
  sortByQuickStartOrder,
} from "../../constants/quickStartOrder";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  markWaterPromptDismissed,
  markWaterPromptShown,
  pickWellnessPrompt,
} from "../../constants/waterReminder";
import BadgeLevelUpModal from "../home/BadgeLevelUpModal";
import WorkoutBadgeInfo, {
  BADGE_DETAILS,
  BADGE_ORDER,
} from "../home/WorkoutBadgeInfo";
import BodyPartGrid from "./Componenets/BodyPartGrid";
import HIITCard, {
  HIIT_CARD_GAP,
  HIIT_CARD_WIDTH,
} from "./Componenets/HIITCard";
import ScanButton from "./Componenets/ScanButton";
import TodayCard from "./Componenets/TodayCard";
import WaterPromptModal from "./Componenets/WaterPromptModal";
import WorkoutLevelModal from "./Componenets/WorkoutLevelModal";

const { scaleHeight, moderateScale: ms } = scaling();

// Shown in the same order people tend to think about training.
const BODY_PART_ORDER = ["Chest", "Abs", "Legs", "Arms", "Shoulder", "Back"];
const orderedBodyParts = [...bodyParts].sort(
  (a, b) =>
    BODY_PART_ORDER.indexOf(a.bodyPart) - BODY_PART_ORDER.indexOf(b.bodyPart),
);

const greetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return "goodMorning";
  if (h < 17) return "goodAfternoon";
  return "goodEvening";
};

// Type scale for this screen: the name is the only ExtraBold text; section
// titles are Bold, card titles SemiBold, supporting copy Regular.
function SectionHeader({ title, subtitle, icon }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        {icon ? (
          <View style={styles.sectionIcon}>
            <Ionicons name={icon} size={ms(13)} color={colors.primary} />
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

const EMPTY = [];
const hiitKey = (item, index) => `hiit-${item.id || index}`;

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const router = useRouter();

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
  // Workouts data for this screen — see constants/homeSnapshot.js. Starts from
  // whatever is already in memory, so coming back to the tab paints at once.
  const [home, setHome] = useState(peekHomeSnapshot);

  // On focus: reuses the snapshot unless a workout was saved or the day
  // changed — then it runs a few small queries instead of reading every row.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        // Last known numbers first (instant after a relaunch)...
        const cached = await readHomeSnapshot();
        if (isActive && cached) setHome((cur) => cur || cached);
        // ...then the up-to-date ones, only if something changed.
        const { snapshot, changed } = await getHomeSnapshot();
        if (!isActive || !snapshot) return;
        setHome(snapshot);
        // Play Store review nudge — only worth checking when the count moved.
        if (changed) maybeAskForReview(snapshot.total);
      })();
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
        const which = await pickWellnessPrompt({
          includePeriods: isFemaleRef.current,
        });
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

  // Quick starts order, worked out once when the profile was submitted; the
  // read is cached after the first time.
  const [quickStartOrder, setQuickStartOrder] = useState(null);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      getQuickStartOrder(user).then((order) => {
        if (active && order) setQuickStartOrder(order);
      });
      return () => {
        active = false;
      };
    }, [user]),
  );

  const { hiitWorkouts: hiitWorkoutsDefault } = useMemo(() => {
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

  const hiitWorkouts = useMemo(
    () => sortByQuickStartOrder(hiitWorkoutsDefault, quickStartOrder),
    [hiitWorkoutsDefault, quickStartOrder],
  );

  const openWorkoutLevelModal = useCallback((item) => {
    setSelectedBodyPart(item);
    setOpenModal(true);
  }, []);

  // Let other screens (Stats empty state) open this picker after navigating
  // here — they unmount before they could route to it themselves.
  useEffect(
    () => registerLevelPicker(openWorkoutLevelModal),
    [openWorkoutLevelModal],
  );

  // Badge from the points total (summed in SQL), not by walking every row.
  const points = home?.points ?? 0;
  const userBadge = useMemo(() => badgeForSnapshot({ points }), [points]);
  const homeLoaded = !!home;

  const checkBadgeUpgrade = async () => {
    // Wait for real data: the 0-point placeholder must never be saved as the
    // "last badge", or the real one would then look like a level-up.
    if (!home || !userBadge?.title) return;

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
    checkBadgeUpgrade().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per badge change
  }, [userBadge?.title, homeLoaded]);

  // Taps queued up while the JS thread is busy (slow phones) used to arrive
  // after the badge sheet had closed and open it again, over and over. Ignore
  // taps while it's open and for a moment after it closes.
  const badgeInfoClosedAt = useRef(0);
  const openBadgeInfo = () => {
    if (badgeInfoVisible || Date.now() - badgeInfoClosedAt.current < 700)
      return;
    tapHaptic();
    setBadgeInfoVisible(true);
  };
  const closeBadgeInfo = () => {
    badgeInfoClosedAt.current = Date.now();
    setBadgeInfoVisible(false);
  };

  const renderHiitCard = useCallback(
    ({ item }) => <HIITCard item={item} onClick={openWorkoutLevelModal} />,
    [openWorkoutLevelModal],
  );

  const firstName = (user?.name || "").trim().split(/\s+/)[0];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#F7F8FA" />

      <View style={styles.animatedContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          // Jack's floating bubble steps aside while the list is moving.
          {...bubbleScrollFade}
        >
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
                <View>
                  <Pressable
                    onPress={openBadgeInfo}
                    style={({ pressed }) => [
                      styles.level,
                      pressed && { opacity: 0.7 },
                    ]}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Your level: ${userBadge.title}. View badges`}
                  >
                    <Text style={styles.levelEmoji}>{userBadge.emoji}</Text>
                    <Text style={styles.levelText}>{userBadge.title}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={ms(11)}
                      color={colors.primary}
                    />
                  </Pressable>
                </View>
              ) : null}

              {/* Food-label scanner — top-right entry point */}
              <ScanButton />
            </View>
          </View>

          {/* One card for today: mascot, the last 7 days, totals and the
              "plan my session" flow — previously three separate cards. */}
          <TodayCard
            name={user?.name}
            gender={user?.gender}
            experience={user?.experience}
            streak={home?.streak ?? 0}
            daysSinceLast={home?.daysSinceLast ?? -1}
            history={home?.recent ?? EMPTY}
            totalCount={home?.total}
            onStart={openWorkoutLevelModal}
          />

          <SectionHeader title={t("quickStarts")} icon="flash" />
          {/* The original banner cards, unchanged — the posters carry their
              own artwork and text, so they're shown whole. */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={hiitWorkouts}
            keyExtractor={hiitKey}
            renderItem={renderHiitCard}
            contentContainerStyle={styles.hiitListContent}
            // Snap card-by-card from the left edge, so the next banner always
            // peeks in on the right — "swipe for more" without any text.
            snapToInterval={HIIT_CARD_WIDTH + HIIT_CARD_GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            bounces={false}
            pagingEnabled={false}
            getItemLayout={(data, index) => ({
              length: HIIT_CARD_WIDTH + HIIT_CARD_GAP,
              offset: (HIIT_CARD_WIDTH + HIIT_CARD_GAP) * index,
              index,
            })}
          />

          <SectionHeader title={t("trainByBodyPart")} />
          <BodyPartGrid
            items={orderedBodyParts}
            onSelect={openWorkoutLevelModal}
          />
        </ScrollView>
      </View>

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
          setVisible={closeBadgeInfo}
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
          router.push(
            tab === "period" ? "/profile/water?tab=period" : "/profile/water",
          );
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
    paddingTop: ms(3),
  },
  headerText: { flex: 1, paddingRight: 10 },
  hello: {
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
  },
  name: {
    fontSize: ms(14),
    lineHeight: ms(26),
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
  levelText: {
    fontSize: ms(11),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.primary,
  },

  // 24 between sections, everywhere on this screen.
  section: { paddingHorizontal: 20, marginTop: ms(18) },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sectionIcon: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: "#FFF1E8",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: ms(16),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: ms(12),
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginTop: 2,
  },

  // Original banner list spacing, plus a little top room under the new header.
  // Same 20 side margin as everything above; the trailing card gap already
  // gives the last banner its right-hand space.
  hiitListContent: {
    paddingLeft: 20,
    paddingRight: 20 - HIIT_CARD_GAP,
    paddingTop: 12,
  },
});
