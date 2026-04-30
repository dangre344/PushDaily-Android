import { Logger } from "@/constants/Logger";
import { AntDesign, Entypo, Ionicons, Octicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { StatusBar } from "expo-status-bar";
import { FemaleIcon, ManIconSVG } from "../../assets/AllSvgs";
import CircularImage from "../../components/ui/CircularImage";
import IconWithText from "../../components/ui/IconWithText";
import { colors } from "../../constants/colors";
import {
  bodyParts,
  DAY_LABELS,
  useWeeklyWorkouts,
  workoutListGlobal,
} from "../../constants/Constants";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";
import { getShortBodyPartName } from "../../constants/utils";
import {
  getAllWorkouts,
  getProfileStats,
  getWorkoutsForCurrentWeek,
  initDB,
} from "../../offlinedb/workoutdb";
import HIITCard from "./Componenets/HIITCard";
import WorkoutLevelModal from "./Componenets/WorkoutLevelModal";

const { width } = Dimensions.get("window");

const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function WorkoutScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [openModal, setOpenModal] = useState(false);
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);

  const [allWorkouts, setAllHistoryWorkouts] = useState([]);

  const [weekWorkouts, setWeekWorkouts] = useState([]);

  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalCalories: 0,
    activeDays: 0,
  });

  const loadData = async () => {
    try {
      await initDB();

      const [week, data] = await Promise.all([
        getWorkoutsForCurrentWeek(),
        getProfileStats(),
      ]);

      Logger.log("Profile stats--->", data);
      Logger.log("Current week workouts--->", week);

      setStats(data);
      setWeekWorkouts(week);
    } catch (error) {
      Logger.log("Error loading screen data:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const { weeklyWorkouts, attendedDays } = useWeeklyWorkouts(weekWorkouts);

  Logger.log("Weekly workouts for display--->", weeklyWorkouts);

  const { hiitWorkouts } = useMemo(() => {
    const targetMuscles = ["Upper Body", "Full Body", "Lower Body"];

    const hiitSet = new Set();

    const result = {
      hiitWorkouts: [],
    };

    workoutListGlobal.forEach((item) => {
      // Only Beginner workouts
      if (item.level !== "Beginner") return;

      // ---------- HIIT SECTION ----------
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
  }, [workoutListGlobal]);

  const router = useRouter();

  useEffect(() => {
    const setup = async () => {
      await initDB();
      let allWorkouts = await getAllWorkouts();
      Logger.log("All workouts after insertion--->", allWorkouts);

      setAllHistoryWorkouts(allWorkouts);
    };
    setup();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          {user?.gender === "Female" ? (
            <FemaleIcon
              width={scaling().scaleWidth(40)}
              height={scaling().scaleHeight(40)}
              color={colors.primary}
            />
          ) : user?.gender === "Male" ? (
            <ManIconSVG
              width={scaling().scaleWidth(40)}
              height={scaling().scaleHeight(40)}
              color={colors.primary}
            />
          ) : (
            <FemaleIcon
              width={scaling().scaleWidth(40)}
              height={scaling().scaleHeight(40)}
              color={colors.primary}
            />
          )}

          <View>
            <Text style={styles.headerTitle}>
              {t("welcome", { name: user?.name || "" })}
            </Text>

            <Text style={styles.subTitle}>Sore today, strong tomorrow.</Text>
          </View>
        </View>

        <View style={styles.calorieContainer}>
          <AntDesign name="fire" size={16} color={colors.primary} />
          <Text style={styles.streakTitle}>{stats.totalCalories}</Text>
        </View>
      </View>

      <View
        style={{
          width: "100%",
          height: 0.2,
          backgroundColor: colors.textLight,
        }}
      />

      <ScrollView
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.workoutContainer}
      >
        <View>
          <View style={styles.weeklyAttContainerMain}>
            <View style={styles.weeklyAttTitles}>
              <Text style={styles.headerTitle}>{t("weeklyAttendance")}</Text>

              <IconWithText
                icon={<Octicons name="dot-fill" size={scaleHeight(20)} />}
                label={`${attendedDays} Day${attendedDays !== 1 ? "s" : ""}`}
                size={16}
                textStyle={{ fontSize: scaling().moderateScale(10) }}
                color={colors.green}
                orientation="horizontal"
              />
            </View>

            <View style={styles.weeklyAttContainer}>
              <View style={styles.weekContainer}>
                {weeklyWorkouts.map((item) => (
                  <View style={styles.weekItem} key={item.day}>
                    <Text style={styles.weekTitle}>{DAY_LABELS[item.day]}</Text>

                    {item.isWorkout === true ? (
                      <Octicons
                        name="check-circle-fill"
                        size={20}
                        color={colors.green}
                      />
                    ) : item.isWorkout === false ? (
                      <Entypo
                        name="circle-with-cross"
                        size={20}
                        color={colors.errorRed}
                      />
                    ) : (
                      <Entypo
                        name="circle"
                        size={20}
                        color={colors.textLight} // ⚪ future days
                      />
                    )}

                    <Text style={styles.workoutNameSub} numberOfLines={1}>
                      {item.isWorkout
                        ? getShortBodyPartName(item.bodyPart)
                        : "--"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.quickWorkoutContainer}>
            <Text style={styles.headerTitle}>{t("quickWorkouts")}</Text>

            <View style={styles.gridContainer}>
              {bodyParts.map((item, index) => (
                <Pressable
                  key={index}
                  style={styles.gridItem}
                  onPress={() => {
                    setSelectedBodyPart(item);
                    setOpenModal(true);
                  }}
                >
                  <View style={styles.item}>
                    <CircularImage source={item.image} size={scaleHeight(80)} />
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

          <View style={{ flexDirection: "row", paddingHorizontal: 20 }}>
            <Text style={styles.popularTitle}>{t("popularWorkouts")}</Text>

            <Ionicons name="trending-up" size={24} color={colors.green} />
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={hiitWorkouts}
            keyExtractor={(item, index) => `hiit-${item.id || index}`}
            renderItem={({ item }) => (
              <HIITCard
                item={item}
                onClick={(item) => {
                  Logger.log("Selected HIIT workout--->", item);
                  setSelectedBodyPart(item);
                  setOpenModal(true);
                }}
              />
            )}
            contentContainerStyle={{ marginStart: 20, marginBottom: 30 }}
            snapToInterval={scaleWidth(300)} // Card width + margin
            snapToAlignment="center"
            decelerationRate="fast"
            bounces={false}
            pagingEnabled={false} // Use snapToInterval instead
            getItemLayout={(data, index) => ({
              length: scaleWidth(300) + 20,
              offset: (scaleWidth(300) + 20) * index,
              index,
            })}
          />
        </View>
      </ScrollView>

      {openModal ? (
        <WorkoutLevelModal
          visible={openModal}
          selectedBodyPart={selectedBodyPart}
          setOpenModal={setOpenModal}
          t={t}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  bodyPartName: {
    fontSize: moderateScale(12),
    textAlign: "center",
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    marginTop: 5,
  },

  attendanceContainer: {
    borderRadius: 10,
    borderWidth: 0.2,
    marginTop: 5,
    flexDirection: "row",

    paddingVertical: 10,
  },

  weeklyAttTitles: {
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  weeklyAttContainer: {
    marginTop: 5,
    alignContent: "center",
    justifyContent: "space-between",
  },

  weeklyAttContainerMain: {
    marginTop: 5,
    alignContent: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },

  quickWorkoutContainer: {
    marginTop: 10,
    gap: 10,
    paddingHorizontal: 20,
    alignContent: "center",
    justifyContent: "space-between",
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  gridItem: {
    width: "33.33%", // 3 items per row (approx)
    marginBottom: 16,
    alignItems: "center",
  },

  nameContainer: {
    flexDirection: "row",
    gap: 10,
  },

  calorieContainer: {
    gap: 5,
    borderRadius: 20,
    borderWidth: 0.2,
    paddingVertical: 2,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,

    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: moderateScale(14),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  streakTitle: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_400Regular",
    color: colors.text,
    paddingVertical: 5,
  },

  weekContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    borderWidth: 0.2,
    borderRadius: 10,
    paddingVertical: 10,

    marginTop: 10,
  },

  workoutContainer: {
    flexDirection: "row",

    paddingBottom: 60,
  },

  weekItem: {
    flex: 1,
    alignItems: "center",
  },

  weekTitle: {
    fontSize: scaling().moderateScale(12),
    fontFamily: "OpenSans_600SemiBold",
    color: "#222",
    marginBottom: 4,
  },

  workoutNameSub: {
    fontSize: scaling().moderateScale(11),
    fontFamily: "OpenSans_600SemiBold",
    marginTop: 5,
    color: "#222",
  },
  subTitle: {
    fontSize: moderateScale(12),
    fontFamily: "OpenSans_400Regular",
    color: "#666",
    marginTop: 4,
  },

  item: {
    marginEnd: 15,
  },

  hiitTitle: {
    marginTop: 15,
    fontSize: moderateScale(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  popularTitle: {
    fontSize: moderateScale(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginEnd: 10,
  },
});
