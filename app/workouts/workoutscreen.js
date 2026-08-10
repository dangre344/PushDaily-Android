import { Logger } from "@/constants/Logger";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { FemaleIcon, ManIconSVG } from "../../assets/AllSvgs";
import CircularImage from "../../components/ui/CircularImage";
import { maybeAskForReview } from "../../constants/appReview";
import { colors } from "../../constants/colors";
import {
  bodyParts,
  workoutListGlobal,
} from "../../constants/Constants";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkouts,
  getProfileStats,
  initDB,
} from "../../offlinedb/workoutdb";
import BadgeLevelUpModal from "../home/BadgeLevelUpModal";
import WorkoutBadgeInfo, {
  BADGE_DETAILS,
  BADGE_ORDER,
  getUserBadge,
} from "../home/WorkoutBadgeInfo";
import {
  markWaterPromptDismissed,
  markWaterPromptShown,
  shouldOfferWaterReminder,
} from "../../constants/waterReminder";
import HIITCard from "./Componenets/HIITCard";
import WaterPromptModal from "./Componenets/WaterPromptModal";
import TrainTodayCard from "./Componenets/TrainTodayCard";
import WorkoutLevelModal from "./Componenets/WorkoutLevelModal";

const { width } = Dimensions.get("window");
const { scaleHeight, scaleWidth, moderateScale } = scaling();

// Rotating prompts shown next to the chat icon on the trainer FAB.
const FAB_TEXTS = [
  "Chat with trainer",
  "Ask diet queries 🥗",
  "Plan your workout 💪",
];

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  // Cross-fade for the rotating FAB label next to the chat icon.
  const fabTextAnim = useRef(new Animated.Value(1)).current;
  const [fabTextIndex, setFabTextIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fabTextAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setFabTextIndex((i) => (i + 1) % FAB_TEXTS.length);
        Animated.timing(fabTextAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const [openModal, setOpenModal] = useState(false);
  const [openBadgeModal, setOpenBadgeModal] = useState(false);
  const [badgeLevelUpVisible, setBadgeLevelUpVisible] = useState(false);
  const [waterPromptVisible, setWaterPromptVisible] = useState(false);

  const [badgeUpgradeData, setBadgeUpgradeData] = useState({
    oldBadge: null,
    newBadge: null,
  });
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);
  const [allWorkouts, setAllHistoryWorkouts] = useState([]);

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

        const allWorkoutsData = await getAllWorkouts();

        Logger.log("All workouts after insertion--->", allWorkoutsData);

        if (isActive) {
          setAllHistoryWorkouts(allWorkoutsData);
        }
      };

      setup();

      return () => {
        isActive = false;
      };
    }, []),
  );

  // Occasionally nudge the user to set up water reminders. Gating lives in
  // waterReminder.js (never right after sign-in, has a cooldown, only sometimes).
  // Delayed so it doesn't collide with the startup interstitial / badge modal.
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        if ((await shouldOfferWaterReminder()) && active) {
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

  const renderGenderIcon = () => {
    if (user?.gender === "Male") {
      return (
        <ManIconSVG
          width={scaleWidth(42)}
          height={scaleHeight(42)}
          color={colors.primary}
        />
      );
    }

    return (
      <FemaleIcon
        width={scaleWidth(42)}
        height={scaleHeight(42)}
        color={colors.primary}
      />
    );
  };

  const performedWorkouts = allWorkouts || [];
  const userBadge = getUserBadge(performedWorkouts);

  const checkBadgeUpgrade = async () => {
    if (!userBadge?.title) return;

    const savedBadgeTitle = await AsyncStorage.getItem("lastUserBadgeTitle");

    // const savedBadgeTitle = {
    //   title: "Rabbit",
    //   subtitle: "Getting Started",
    //   emoji: "🐰",
    // };

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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor={colors.white} />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.nameContainer}>
              <View style={styles.avatarCircle}>{renderGenderIcon()}</View>

              <View style={styles.headerTextBlock}>
                <Text style={styles.greetingText} numberOfLines={1}>
                  {t("welcome", { name: user?.name || "" })}
                </Text>

                <Text style={styles.subTitle} numberOfLines={1}>
                  Sore today, strong tomorrow.
                </Text>
              </View>
            </View>

            {/* Compact badge pill — tap for the full badge breakdown */}
            <TouchableOpacity
              style={styles.badgePill}
              activeOpacity={0.85}
              onPress={() => setOpenBadgeModal(true)}
            >
              {userBadge?.image ? (
                <Image source={userBadge.image} style={styles.badgePillImage} />
              ) : (
                <Text style={styles.badgePillEmoji}>
                  {userBadge?.emoji || "🏅"}
                </Text>
              )}
              <Text style={styles.badgePillText} numberOfLines={1}>
                {userBadge?.title || "Badge"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* HERO CARD — hidden entirely until the user has workout records */}
          {stats.totalWorkouts > 0 && (
            <LinearGradient
              colors={[colors.primary, "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroSmallText}>Your progress</Text>
                  <Text style={styles.heroTitle}>Keep the streak alive</Text>
                </View>

                <View style={styles.heroIconCircle}>
                  <Ionicons name="barbell-outline" size={24} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Ionicons name="barbell-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.heroStatValue}>
                    {stats.totalWorkouts || 0}
                  </Text>
                  <Text style={styles.heroStatLabel}>Completed</Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroStatItem}>
                  <Ionicons name="flame-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.heroStatValue}>
                    {stats.totalCalories || 0}
                  </Text>
                  <Text style={styles.heroStatLabel}>Kcal Burned</Text>
                </View>

                <View style={styles.heroDivider} />

                <View style={styles.heroStatItem}>
                  <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.heroStatValue}>
                    {stats.activeDays || 0}
                  </Text>
                  <Text style={styles.heroStatLabel}>Active Days</Text>
                </View>
              </View>
            </LinearGradient>
          )}

          {/* WEEKLY ATTENDANCE */}

          {/* QUICK WORKOUTS */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{t("quickWorkouts")}</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose where you want to train
                </Text>
              </View>

              <View style={styles.smallIconBadge}>
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
            </View>

            <View style={styles.gridContainer}>
              {bodyParts.map((item, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.gridItem,
                    pressed && styles.gridItemPressed,
                  ]}
                  onPress={() => openWorkoutLevelModal(item)}
                >
                  <View style={styles.quickCard}>
                    <View style={styles.quickImageCircle}>
                      <CircularImage
                        source={item.image}
                        size={scaleHeight(68)}
                      />
                    </View>

                    <Text
                      style={styles.bodyPartName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.bodyPart}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Replaces the weekly attendance card — the same week data, but
              turned into an action instead of a report. Attendance itself
              still lives on its own tab. */}
          <TrainTodayCard history={allWorkouts} onStart={openWorkoutLevelModal} />

          {/* POPULAR WORKOUTS */}
          <View style={styles.popularHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t("popularWorkouts")}</Text>
              <Text style={styles.sectionSubtitle}>
                Beginner friendly picks
              </Text>
            </View>

            <View style={styles.trendingBadge}>
              <Ionicons name="trending-up" size={20} color={colors.green} />
            </View>
          </View>

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

      {/* Floating trainer chat button — icon + rotating label */}
      <TouchableOpacity
        style={styles.trainerFab}
        activeOpacity={0.85}
        onPress={() => router.push("/trainer/chat")}
      >
        <Ionicons
          name="chatbubble-ellipses"
          size={moderateScale(20)}
          color="#FFFFFF"
        />
        <Animated.Text
          style={[styles.trainerFabText, { opacity: fabTextAnim }]}
          numberOfLines={1}
        >
          {FAB_TEXTS[fabTextIndex]}
        </Animated.Text>
      </TouchableOpacity>

      {openModal ? (
        <WorkoutLevelModal
          visible={openModal}
          selectedBodyPart={selectedBodyPart}
          setOpenModal={setOpenModal}
          t={t}
        />
      ) : null}

      {openBadgeModal ? (
        <WorkoutBadgeInfo
          userBadge={userBadge}
          visible={openBadgeModal}
          setVisible={setOpenBadgeModal}
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

      <WaterPromptModal
        visible={waterPromptVisible}
        onClose={() => {
          setWaterPromptVisible(false);
          markWaterPromptDismissed();
        }}
        onEnable={() => {
          setWaterPromptVisible(false);
          router.push("/profile/water");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  trainerFab: {
    position: "absolute",
    right: moderateScale(16),
    // The custom bottom tab bar is absolutely positioned (~70 high, elevation
    // 20), so the FAB must sit above it or it gets covered.
    bottom: moderateScale(84),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(8),
    borderRadius: moderateScale(999),
    paddingVertical: moderateScale(11),
    paddingHorizontal: moderateScale(16),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  trainerFabText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: moderateScale(13),
    color: "#FFFFFF",
  },

  animatedContainer: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: scaleHeight(70),
  },

  header: {
    flexDirection: "row",
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(16),
    alignItems: "center",
    justifyContent: "space-between",
    gap: moderateScale(14),
    backgroundColor: colors.white,
  },

  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(12),
    flex: 1,
  },

  avatarCircle: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextBlock: {
    flex: 1,
  },

  greetingText: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  subTitle: {
    fontSize: moderateScale(10.5),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: moderateScale(3),
  },

  // Compact badge pill — replaces the wide badge card that crowded the header.
  badgePill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: moderateScale(62),
    paddingHorizontal: moderateScale(9),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(14),
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  badgePillImage: {
    width: moderateScale(24),
    height: moderateScale(24),
    resizeMode: "contain",
  },

  badgePillEmoji: {
    fontSize: moderateScale(19),
  },

  badgePillText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: moderateScale(9.5),
    color: colors.primary,
    marginTop: moderateScale(2),
  },

  calorieContainer: {
    gap: moderateScale(5),
    borderRadius: moderateScale(999),
    borderWidth: 1,
    borderColor: colors.primary + "22",
    backgroundColor: colors.primary + "10",
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
  },

  calorieContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },

  streakTitle: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
  },

  heroCard: {
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(10),
    borderRadius: moderateScale(24),
    padding: moderateScale(18),
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  heroSmallText: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: "rgba(255,255,255,0.76)",
  },

  heroTitle: {
    fontSize: moderateScale(20),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    marginTop: moderateScale(2),
  },

  heroIconCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroDescription: {
    fontSize: moderateScale(13),
    fontFamily: "OpenSans_500Medium",
    color: "rgba(255,255,255,0.86)",
    lineHeight: moderateScale(20),
    marginTop: moderateScale(10),
    maxWidth: "92%",
  },

  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: moderateScale(18),
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: moderateScale(18),
    paddingVertical: moderateScale(12),
  },

  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },

  heroStatValue: {
    fontSize: moderateScale(18),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
  },

  heroStatLabel: {
    fontSize: moderateScale(10),
    fontFamily: "OpenSans_600SemiBold",
    color: "rgba(255,255,255,0.78)",
    marginTop: moderateScale(2),
  },

  heroDivider: {
    width: 1,
    height: moderateScale(32),
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  sectionCard: {
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(10),
    backgroundColor: colors.white,
    borderRadius: moderateScale(22),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },

  sectionBlock: {
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(15),
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    fontSize: moderateScale(17),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  sectionSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: moderateScale(3),
  },

  attendedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(4),
    backgroundColor: colors.green + "14",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(7),
    borderRadius: moderateScale(999),
  },

  attendedPillText: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.green,
  },

  progressTrack: {
    height: moderateScale(8),
    backgroundColor: "#EEF1F5",
    borderRadius: moderateScale(999),
    overflow: "hidden",
    marginTop: moderateScale(14),
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.green,
    borderRadius: moderateScale(999),
  },

  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: moderateScale(14),
  },

  weekItem: {
    flex: 1,
    alignItems: "center",
  },

  weekTitle: {
    fontSize: moderateScale(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: moderateScale(7),
  },

  weekIconCircle: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    alignItems: "center",
    justifyContent: "center",
  },

  weekDoneCircle: {
    backgroundColor: colors.green,
  },

  weekMissedCircle: {
    backgroundColor: colors.errorRed,
  },

  weekPendingCircle: {
    backgroundColor: "#F1F3F7",
    borderWidth: 1,
    borderColor: "#E4E7EC",
  },

  workoutNameSub: {
    fontSize: moderateScale(10),
    fontFamily: "OpenSans_600SemiBold",
    marginTop: moderateScale(6),
    color: colors.textLight,
    maxWidth: scaleWidth(42),
    textAlign: "center",
  },

  smallIconBadge: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: moderateScale(14),
  },

  gridItem: {
    width: "31.5%",
    marginBottom: moderateScale(12),
  },

  gridItemPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },

  quickCard: {
    backgroundColor: colors.white,
    borderRadius: moderateScale(18),
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(6),
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },

  quickImageCircle: {
    width: moderateScale(76),
    height: moderateScale(76),
    borderRadius: moderateScale(38),
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
  },

  bodyPartName: {
    fontSize: moderateScale(11),
    textAlign: "center",
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    marginTop: moderateScale(9),
    maxWidth: "90%",
  },

  popularHeader: {
    marginHorizontal: moderateScale(20),
    marginTop: moderateScale(15),
    marginBottom: moderateScale(12),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  trendingBadge: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
    backgroundColor: colors.green + "14",
    alignItems: "center",
    justifyContent: "center",
  },

  hiitListContent: {
    paddingLeft: moderateScale(20),
    paddingRight: moderateScale(20),
    paddingBottom: moderateScale(30),
  },
});
