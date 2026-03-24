import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";
import { colors } from "../../constants/colors";
import { useWeeklyWorkouts } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { scaling } from "../../constants/useScaling"; // adjust path as needed
import {
  getAllWorkoutDates,
  getAllWorkoutsBydate,
  getTotalCalories,
  initDB,
} from "../../offlinedb/workoutdb";

const scaleWidth = (n) => scaling().moderateScale(n);
const scaleHeight = (n) => scaling().moderateScale(n);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toDateKey = (iso) => iso.slice(0, 10);

const parseCalories = (cal) => {
  const n = parseInt(String(cal).replace(/^0+/, "") || "0", 10);
  return isNaN(n) ? 0 : n;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const levelColor = (level) => {
  switch (level?.toLowerCase()) {
    case "beginner":
      return "#4CAF82";
    case "intermediate":
      return colors.secondary;
    case "advanced":
      return "#E74C3C";
    default:
      return colors.textMuted;
  }
};

const bodyPartIcon = (bp) => {
  switch (bp?.toLowerCase()) {
    case "chest":
      return "body-outline";
    case "shoulder":
      return "fitness-outline";
    case "legs":
      return "walk-outline";
    case "back":
      return "man-outline";
    default:
      return "barbell-outline";
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// WORKOUT CARD
// ═════════════════════════════════════════════════════════════════════════════
const WorkoutCard = ({ item }) => (
  <View style={cardStyles.card}>
    {/* Left accent bar */}
    <View
      style={[cardStyles.accent, { backgroundColor: levelColor(item.level) }]}
    />

    {/* <View style={cardStyles.iconWrap}>
      <Ionicons
        name={bodyPartIcon(item.bodyPart)}
        size={scaling().moderateScale(20)}
        color={colors.primary}
      />
    </View> */}

    <View style={cardStyles.info}>
      <Text style={cardStyles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={cardStyles.tags}>
        {/* Level badge */}
        <View
          style={[
            cardStyles.badge,
            { borderColor: levelColor(item.level) + "55" },
          ]}
        >
          <View
            style={[
              cardStyles.dotSmall,
              { backgroundColor: levelColor(item.level) },
            ]}
          />
          <Text
            style={[cardStyles.badgeText, { color: levelColor(item.level) }]}
          >
            {item.level}
          </Text>
        </View>
        {/* Body part badge */}
        <View style={cardStyles.badge}>
          <Text style={cardStyles.badgeText}>{item.bodyPart}</Text>
        </View>
      </View>
    </View>

    {/* Calories */}
    <View style={cardStyles.calBox}>
      <AntDesign name="fire" size={13} color={colors.primary} />
      <Text style={cardStyles.calNum}>{parseCalories(item.calories)}</Text>
      <Text style={cardStyles.calUnit}>kcal</Text>
    </View>
  </View>
);

export default function ProgressScreen() {
  const { t } = useTranslation();

  const [allWorkouts, setAllHistoryWorkouts] = useState([]);
  const [workoutDates, setWorkoutDates] = useState([]);

  const [totalCalories, setTotalCalories] = useState(0);

  const { weeklyWorkouts, attendedDays } = useWeeklyWorkouts(allWorkouts);

  Logger.log("ProgressScreen rendered---->", weeklyWorkouts);

  const todayKey = toDateKey(new Date().toISOString());
  const [selectedDate, setSelectedDate] = useState(todayKey);

  Logger.log("filtered--workouts-->", allWorkouts);

  const dayCalories = allWorkouts.reduce(
    (s, w) => s + parseCalories(w.calories),
    0,
  );

  const buildMarkedDates = (selectedDate, dates) => {
    const marked = {};

    dates.forEach((dateKey) => {
      const isSelected = dateKey === selectedDate;
      marked[dateKey] = {
        marked: true,
        dotColor: isSelected ? "#fff" : colors.green,
        customStyles: {
          container: {
            backgroundColor: isSelected ? colors.green : colors.green + "28",
            borderRadius: scaling().moderateScale(20),
          },
          text: {
            color: isSelected ? "#fff" : colors.green,
            fontFamily: "OpenSans_700Bold",
          },
        },
      };
    });

    // Selected date with no workout
    if (selectedDate && !dates.includes(selectedDate)) {
      marked[selectedDate] = {
        selected: true,
        customStyles: {
          container: {
            backgroundColor: colors.primary,
            borderRadius: scaling().moderateScale(20),
          },
          text: {
            color: "#fff",
            fontFamily: "OpenSans_700Bold",
          },
        },
      };
    }

    return marked;
  };

  const markedDates = useMemo(
    () => buildMarkedDates(selectedDate, workoutDates),
    [selectedDate, workoutDates],
  );

  const displayDate = (() => {
    const [y, m, d] = selectedDate.split("-");
    return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  })();

  useEffect(() => {
    Logger.log("ProgressScreen selectedDate---->", selectedDate);
    const setup = async () => {
      await initDB();

      const dateWorkouts = await getAllWorkoutsBydate(selectedDate);
      Logger.log("Workouts for date--->", dateWorkouts);
      setAllHistoryWorkouts(dateWorkouts);

      const cal = await getTotalCalories();
      Logger.log("Total calories--->", cal);
      setTotalCalories(cal);

      const dates = await getAllWorkoutDates();
      Logger.log("Workout dates for calendar--->", dates);
      setWorkoutDates(dates);
    };

    setup();
  }, [selectedDate]); // ← re-runs every time selectedDate changes

  return (
    <View style={styles.screen}>
      <FlatList
        data={allWorkouts}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.nameContainer}>
                <View style={{ marginLeft: scaleWidth(10) }}>
                  <Text style={styles.sectionTitle}>Progress</Text>
                  <Text style={styles.subTitle}>Stronger than yesterday</Text>
                </View>
              </View>

              <View style={styles.calorieContainer}>
                <AntDesign name="fire" size={16} color={colors.primary} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={styles.streakTitle}>{totalCalories}</Text>
                  <Text style={styles.streakLabel}>total kcal</Text>
                </View>
              </View>
            </View>

            <Calendar
              current={todayKey}
              onDayPress={(day) => setSelectedDate(day.dateString)}
              markedDates={markedDates}
              markingType="custom"
              enableSwipeMonths
              renderHeader={(date) => {
                const d = new Date(date);
                const day = d.getDate();
                const month = MONTHS[d.getMonth()];
                const year = d.getFullYear();
                return (
                  <Text
                    style={{
                      fontFamily: "OpenSans_700Bold",
                      fontSize: scaling().moderateScale(15),
                      color: colors.text,
                    }}
                  >
                    {day} {month} {year}
                  </Text>
                );
              }}
              theme={{
                calendarBackground: colors.surface,
                monthTextColor: colors.text,
                textMonthFontFamily: "OpenSans_700Bold",
                textMonthFontSize: scaling().moderateScale(15),
                dayTextColor: colors.textMuted,
                textDayFontFamily: "OpenSans_500Medium",
                textDayFontSize: scaling().moderateScale(13),
                todayTextColor: colors.primary,
                todayBackgroundColor: "transparent",
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: "#FFFFFF",
                arrowColor: colors.primary,
                textSectionTitleColor: colors.textDim,
                textDayHeaderFontFamily: "OpenSans_600SemiBold",
                textDayHeaderFontSize: scaling().moderateScale(11),
                textDisabledColor: colors.textDim,
                dotColor: colors.primary,
                selectedDotColor: "#FFFFFF",
                backgroundColor: colors.surface,
              }}
              style={styles.calendar}
            />

            <View style={styles.daySummary}>
              <View>
                {allWorkouts.length !== 0 ? (
                  <Text style={styles.workoutLabel}>
                    {allWorkouts[0].bodyPart}{" "}
                  </Text>
                ) : null}
                <Text style={styles.dateLabel}>{displayDate}</Text>
                <Text style={styles.workoutCount}>
                  {allWorkouts.length > 0
                    ? `${allWorkouts.length} workout${allWorkouts.length !== 1 ? "s" : ""} logged`
                    : "No workouts logged"}
                </Text>
              </View>
              {dayCalories > 0 && (
                <View style={styles.dayCalBadge}>
                  <AntDesign name="fire" size={12} color={colors.primary} />
                  <Text style={styles.dayCalText}>{dayCalories} kcal</Text>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => <WorkoutCard item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="barbell-outline"
                size={38}
                color={colors.textDim}
              />
            </View>
            <Text style={styles.emptyText}>No workouts on this day</Text>
            <Text style={styles.emptySubText}>Keep showing up 💪</Text>
          </View>
        }
      />
    </View>
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
  listContent: {
    paddingHorizontal: scaleWidth(16),
    paddingBottom: scaleHeight(40),
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingBottom: scaleHeight(20),
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarRing: {
    width: scaleWidth(50),
    height: scaleWidth(50),
    borderRadius: scaleWidth(25),
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(12),

    color: colors.text,
  },

  weeklyAttContainer: {
    alignContent: "center",
    justifyContent: "space-between",
    marginBottom: scaleHeight(20),
    marginHorizontal: 10,
  },

  weeklyAttTitles: {
    marginTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subTitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(11),
    color: colors.textMuted,
  },
  calorieContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: scaleWidth(15),
    paddingVertical: scaleHeight(3),
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(15),
    color: colors.text,
  },
  streakLabel: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(9),
    color: colors.textMuted,
  },

  // Section
  sectionTitle: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(20),
    color: colors.text,
    marginBottom: scaleHeight(5),
  },

  // Legend
  legend: {
    flexDirection: "row",
    marginBottom: scaleHeight(10),
    marginHorizontal: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendSwatch: {
    width: scaleWidth(26),
    height: scaleHeight(26),
    borderRadius: scaleHeight(13),
    borderWidth: scaleHeight(1),
    alignItems: "center",
    justifyContent: "center",
  },
  legendDot: {
    width: scaleWidth(7),
    height: scaleHeight(7),
    borderRadius: scaleHeight(4),
  },
  legendText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(11),
    color: colors.textMuted,
  },

  // Calendar
  calendar: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    marginHorizontal: 10,
    borderColor: colors.border,
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
    paddingHorizontal: 20,
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

  // Day summary
  daySummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: scaleHeight(18),
    marginHorizontal: 10,
    marginBottom: scaleHeight(14),
  },

  workoutLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(16),
    color: colors.primary,
    marginBottom: 2,
  },
  dateLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(14),
    color: colors.text,
  },
  workoutCount: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(12),
    color: colors.textMuted,
    marginTop: 2,
  },
  dayCalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary + "18",
    borderRadius: 20,
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(5),
  },
  dayCalText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(12),
    color: colors.primary,
  },

  // Empty
  empty: {
    alignItems: "center",
    paddingVertical: scaleHeight(48),
  },
  emptyIcon: {
    width: scaleWidth(72),
    height: scaleWidth(72),
    borderRadius: scaleWidth(36),
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaleHeight(14),
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(15),
    color: colors.textMuted,
    marginBottom: 4,
  },
  emptySubText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(12),
    color: colors.textDim,
  },
});

// ─── Card styles ──────────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    // paddingVertical: scaleHeight(12),
    paddingRight: scaleWidth(14),
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  accent: {
    width: scaleWidth(3),
    alignSelf: "stretch",
    borderRadius: 2,

    marginRight: scaleWidth(12),
  },
  iconWrap: {
    width: scaleWidth(42),
    height: scaleWidth(42),
    borderRadius: 12,
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaleWidth(10),
  },
  info: {
    flex: 1,
    paddingVertical: scaleHeight(12),
  },
  name: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaling().moderateScale(14),
    color: colors.text,
    marginBottom: 5,
  },
  tags: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(10),
    color: colors.textMuted,
  },
  calBox: {
    alignItems: "center",
    marginLeft: scaleWidth(8),
    minWidth: scaleWidth(42),
  },
  calNum: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaling().moderateScale(15),
    color: colors.text,
    marginTop: 1,
  },
  calUnit: {
    fontFamily: "OpenSans_400Regular",
    fontSize: scaling().moderateScale(9),
    color: colors.textMuted,
  },
});
