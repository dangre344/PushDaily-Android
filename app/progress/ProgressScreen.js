import { AntDesign, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Animated, {
  FadeIn,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";

import { Image } from "expo-image";
import {
  attendanceNudge,
  sayOncePerSession,
} from "../../constants/bubbleMessage";
import { colors } from "../../constants/colors";
import { useUser } from "../../constants/UserContext";
import { bodyParts } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkoutDates,
  getAllWorkouts,
  getTotalCalories,
  initDB,
} from "../../offlinedb/workoutdb";

const scaleWidth = (n) => scaling().moderateScale(n);
const scaleHeight = (n) => scaling().moderateScale(n);

const toDateKey = (iso) => iso.slice(0, 10);

const valueEnterAnimation = FadeIn.duration(180)
  .springify()
  .damping(18)
  .stiffness(160);

const iconEnterAnimation = ZoomIn.duration(180)
  .springify()
  .damping(16)
  .stiffness(180);

const getWorkoutDateKey = (dateTime) => {
  if (!dateTime) return null;

  try {
    return toDateKey(new Date(dateTime).toISOString());
  } catch (error) {
    return null;
  }
};

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
      return "#22C55E";
    case "intermediate":
      return "#F59E0B";
    case "advanced":
      return "#EF4444";
    default:
      return colors.primary;
  }
};

// Body-part photo (same images as the Workout screen grid). Returns null for
// parts without one (e.g. HIIT/Full Body) — we fall back to the icon then.
const bodyPartImage = (bodyPart) => {
  const found = bodyParts.find(
    (b) => b.bodyPart.toLowerCase() === String(bodyPart || "").toLowerCase(),
  );
  return found?.image || null;
};

const bodyPartIcon = (bodyPart) => {
  switch (bodyPart?.toLowerCase()) {
    case "chest":
      return "body-outline";
    case "shoulder":
    case "shoulders":
      return "fitness-outline";
    case "legs":
    case "lower body":
      return "walk-outline";
    case "back":
      return "man-outline";
    case "abs":
      return "ellipse-outline";
    case "hiit":
      return "flash-outline";
    default:
      return "barbell-outline";
  }
};

const formatDisplayDate = (dateKey) => {
  if (!dateKey) return "";

  const [y, m, d] = dateKey.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

const isToday = (dateKey) => {
  return dateKey === toDateKey(new Date().toISOString());
};

const WorkoutCard = ({ item, index }) => {
  const currentLevelColor = levelColor(item.level);

  return (
    <View style={cardStyles.card}>
      <View
        style={[
          cardStyles.indexCircle,
          { backgroundColor: currentLevelColor + "18" },
        ]}
      >
        <Text style={[cardStyles.indexText, { color: currentLevelColor }]}>
          {index + 1}
        </Text>
      </View>

      <View style={cardStyles.iconWrap}>
        <Ionicons
          name={bodyPartIcon(item.bodyPart)}
          size={scaleWidth(20)}
          color={colors.primary}
        />
      </View>

      <View style={cardStyles.info}>
        <Text style={cardStyles.name} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={cardStyles.tags}>
          <View
            style={[
              cardStyles.badge,
              {
                backgroundColor: currentLevelColor + "12",
                borderColor: currentLevelColor + "30",
              },
            ]}
          >
            <View
              style={[
                cardStyles.dotSmall,
                { backgroundColor: currentLevelColor },
              ]}
            />

            <Text style={[cardStyles.badgeText, { color: currentLevelColor }]}>
              {item.level}
            </Text>
          </View>

          <View style={cardStyles.badge}>
            <Text style={cardStyles.badgeText} numberOfLines={1}>
              {item.bodyPart}
            </Text>
          </View>
        </View>
      </View>

      <View style={cardStyles.calBox}>
        <AntDesign name="fire" size={13} color={colors.primary} />
        <Text style={cardStyles.calNum}>{parseCalories(item.calories)}</Text>
        <Text style={cardStyles.calUnit}>kcal</Text>
      </View>
    </View>
  );
};

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { user } = useUser();

  const todayKey = toDateKey(new Date().toISOString());

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [allWorkoutHistory, setAllWorkoutHistory] = useState([]);
  const [workoutDates, setWorkoutDates] = useState([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const allWorkouts = useMemo(() => {
    return allWorkoutHistory.filter((workout) => {
      const workoutDateKey = getWorkoutDateKey(workout?.dateTime);
      return workoutDateKey === selectedDate;
    });
  }, [allWorkoutHistory, selectedDate]);

  const dayCalories = useMemo(() => {
    return allWorkouts.reduce((s, w) => s + parseCalories(w.calories), 0);
  }, [allWorkouts]);

  const displayDate = useMemo(() => {
    return formatDisplayDate(selectedDate);
  }, [selectedDate]);

  const hasWorkoutOnSelectedDate = allWorkouts.length > 0;

  const selectedStatus = useMemo(() => {
    if (isToday(selectedDate)) return "Today";
    if (workoutDates.includes(selectedDate)) return "Done";
    return "Rest";
  }, [selectedDate, workoutDates]);

  const selectedIconName = hasWorkoutOnSelectedDate
    ? "checkmark-done"
    : "calendar-outline";

  const summaryChangeKey = selectedDate;

  const workoutSections = useMemo(() => {
    return Object.values(
      allWorkouts.reduce((acc, item) => {
        const title = item.bodyPart || "Other";

        if (!acc[title]) {
          acc[title] = {
            title,
            data: [],
          };
        }

        acc[title].data.push(item);
        return acc;
      }, {}),
    );
  }, [allWorkouts]);

  const buildMarkedDates = (selectedDateValue, dates) => {
    const marked = {};

    dates.forEach((dateKey) => {
      const selected = dateKey === selectedDateValue;

      marked[dateKey] = {
        marked: true,
        dotColor: selected ? "#FFFFFF" : colors.green,
        selected,
        selectedColor: selected ? colors.primary : undefined,
        customStyles: {
          container: {
            backgroundColor: selected ? colors.primary : colors.green + "16",
            borderRadius: scaleWidth(18),
            borderWidth: selected ? 0 : 1,
            borderColor: colors.green + "30",
          },
          text: {
            color: selected ? "#FFFFFF" : colors.green,
            fontFamily: "OpenSans_700Bold",
          },
        },
      };
    });

    if (selectedDateValue && !dates.includes(selectedDateValue)) {
      marked[selectedDateValue] = {
        selected: true,
        customStyles: {
          container: {
            backgroundColor: colors.primary,
            borderRadius: scaleWidth(18),
          },
          text: {
            color: "#FFFFFF",
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

  const loadData = async () => {
    try {
      setLoading(true);
      await initDB();

      const [history, cal, dates] = await Promise.all([
        getAllWorkouts(),
        getTotalCalories(),
        getAllWorkoutDates(),
      ]);

      Logger.log("All workout history--->", history);
      Logger.log("Total calories--->", cal);
      Logger.log("Workout dates for calendar--->", dates);

      setAllWorkoutHistory(history || []);
      setTotalCalories(cal || 0);
      setWorkoutDates(dates || []);

      // Nudge only when today is genuinely empty, and only once per session.
      if (!(dates || []).includes(toDateKey(new Date().toISOString()))) {
        setTimeout(
          () => sayOncePerSession("attendance", attendanceNudge(user?.name)),
          800,
        );
      }
    } catch (error) {
      Logger.log("Error loading progress screen:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const handleDayPress = useCallback((day) => {
    if (!day?.dateString) return;
    setSelectedDate(day.dateString);
  }, []);

  const HeaderContent = useCallback(
    () => (
      <>
        <View style={styles.header}>
          <View>
            <Text style={styles.screenTitle}>Attendance</Text>
            <Text style={styles.screenSubtitle}>
              Tap a date to view completed workouts
            </Text>
          </View>

          <View style={styles.totalCaloriePill}>
            <AntDesign name="fire" size={16} color={colors.primary} />
            <View>
              <Text style={styles.totalCalorieValue}>{totalCalories || 0}</Text>
              <Text style={styles.totalCalorieLabel}>total kcal</Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={[colors.primary, "#7C3AED"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>Selected date</Text>

              <Animated.Text
                key={`date-${summaryChangeKey}`}
                entering={valueEnterAnimation}
                layout={LinearTransition.duration(160)}
                style={styles.summaryDate}
              >
                {displayDate}
              </Animated.Text>
            </View>

            <Animated.View
              key={`icon-${summaryChangeKey}`}
              entering={iconEnterAnimation}
              layout={LinearTransition.duration(160)}
              style={styles.summaryIcon}
            >
              <Ionicons name={selectedIconName} size={24} color="#FFFFFF" />
            </Animated.View>
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStat}>
              <Animated.Text
                key={`workouts-${summaryChangeKey}`}
                entering={valueEnterAnimation}
                layout={LinearTransition.duration(160)}
                style={styles.summaryValue}
              >
                {allWorkouts.length}
              </Animated.Text>

              <Text style={styles.summaryText}>
                workout{allWorkouts.length !== 1 ? "s" : ""}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryStat}>
              <Animated.Text
                key={`calories-${summaryChangeKey}`}
                entering={valueEnterAnimation}
                layout={LinearTransition.duration(160)}
                style={styles.summaryValue}
              >
                {dayCalories}
              </Animated.Text>

              <Text style={styles.summaryText}>kcal burned</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryStat}>
              <Animated.Text
                key={`status-${summaryChangeKey}`}
                entering={valueEnterAnimation}
                layout={LinearTransition.duration(160)}
                style={styles.summaryValue}
              >
                {selectedStatus}
              </Animated.Text>

              <Text style={styles.summaryText}>status</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <Text style={styles.cardTitle}>Workout calendar</Text>

            <View style={styles.legendPill}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
          </View>

          <Calendar
            current={selectedDate}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            markingType="custom"
            enableSwipeMonths
            hideExtraDays={false}
            firstDay={1}
            renderArrow={(direction) => (
              <View style={styles.arrowButton}>
                <Ionicons
                  name={
                    direction === "left" ? "chevron-back" : "chevron-forward"
                  }
                  size={18}
                  color={colors.primary}
                />
              </View>
            )}
            renderHeader={(date) => {
              const d = new Date(date);
              const month = MONTHS[d.getMonth()];
              const year = d.getFullYear();

              return (
                <Text style={styles.calendarMonthTitle}>
                  {month} {year}
                </Text>
              );
            }}
            theme={{
              calendarBackground: "#FFFFFF",
              monthTextColor: colors.text,
              textMonthFontFamily: "OpenSans_700Bold",
              textMonthFontSize: scaleWidth(14),
              dayTextColor: colors.text,
              textDayFontFamily: "OpenSans_600SemiBold",
              textDayFontSize: scaleWidth(12),
              // Default week rows carry 7dp of margin top AND bottom. Over six
              // rows that is ~60dp of dead space, which pushed the workout
              // list below the fold.
              "stylesheet.calendar.main": {
                week: {
                  marginTop: 1,
                  marginBottom: 1,
                  flexDirection: "row",
                  justifyContent: "space-around",
                },
              },
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: "#FFFFFF",
              arrowColor: colors.primary,
              textSectionTitleColor: colors.textLight,
              textDayHeaderFontFamily: "OpenSans_700Bold",
              textDayHeaderFontSize: scaleWidth(11),
              textDisabledColor: "#CBD5E1",
              dotColor: colors.green,
              selectedDotColor: "#FFFFFF",
              backgroundColor: "#FFFFFF",
            }}
            style={styles.calendar}
          />
        </View>

        {/* Only worth showing once the day actually has something in it — an
            empty summary above an empty list is just noise. */}
        {hasWorkoutOnSelectedDate ? (
          <View style={styles.daySummary}>
            <View>
              <Text style={styles.dateLabel}>Completed workouts</Text>

              <Text style={styles.workoutCount}>
                {`${allWorkouts.length} exercise${
                  allWorkouts.length !== 1 ? "s" : ""
                } on ${displayDate}`}
              </Text>
            </View>

            {dayCalories > 0 ? (
              <View style={styles.dayCalBadge}>
                <AntDesign name="fire" size={12} color={colors.primary} />
                <Text style={styles.dayCalText}>{dayCalories} kcal</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading workouts...</Text>
          </View>
        ) : null}
      </>
    ),
    [
      totalCalories,
      displayDate,
      selectedDate,
      summaryChangeKey,
      selectedIconName,
      selectedStatus,
      hasWorkoutOnSelectedDate,
      allWorkouts.length,
      dayCalories,
      handleDayPress,
      markedDates,
      loading,
    ],
  );

  return (
    <View style={styles.screen}>
      <SectionList
        sections={workoutSections}
        keyExtractor={(item, index) => `${item.id || item.name}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: scaleHeight(10) }} />
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={HeaderContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.workoutSectionHeader}>
            <View style={styles.sectionTitleRow}>
              {bodyPartImage(section.title) ? (
                <Image
                  source={bodyPartImage(section.title)}
                  style={styles.sectionImage}
                  contentFit="cover"
                />
              ) : (
                <Ionicons
                  name={bodyPartIcon(section.title)}
                  size={18}
                  color={colors.primary}
                />
              )}

              <Text style={styles.workoutSectionTitle}>{section.title}</Text>
            </View>

            <Text style={styles.workoutSectionCount}>
              {section.data.length} exercise
              {section.data.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <WorkoutCard item={item} index={index} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={38}
                  color={colors.textLight}
                />
              </View>

              <Text style={styles.emptyText}>No workouts on this day</Text>

              <Text style={styles.emptySubText}>
                Select a green date to view your completed workouts.
              </Text>
            </View>
          ) : null
        }
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  listContent: {
    paddingHorizontal: scaleWidth(16),
    paddingBottom: scaleHeight(110),
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: scaleHeight(12),
    paddingBottom: scaleHeight(14),
  },

  screenTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(18),
    color: colors.text,
  },

  screenSubtitle: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaling().moderateScale(12),
    color: colors.textLight,
    marginTop: scaleHeight(3),
  },

  totalCaloriePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(7),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(999),
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  totalCalorieValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(13),
    color: colors.text,
  },

  totalCalorieLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaleWidth(9),
    color: colors.textLight,
  },

  summaryCard: {
    borderRadius: scaleWidth(24),
    padding: scaleWidth(18),
    marginBottom: scaleHeight(14),
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },

  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  summaryLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(12),
    color: "rgba(255,255,255,0.76)",
  },

  summaryDate: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(20),
    color: "#FFFFFF",
    marginTop: scaleHeight(3),
  },

  summaryIcon: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    borderRadius: scaleWidth(24),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryStatsRow: {
    marginTop: scaleHeight(18),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: scaleWidth(18),
    paddingVertical: scaleHeight(12),
  },

  summaryStat: {
    flex: 1,
    alignItems: "center",
  },

  summaryValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(17),
    color: "#FFFFFF",
  },

  summaryText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(10),
    color: "rgba(255,255,255,0.75)",
    marginTop: scaleHeight(2),
  },

  summaryDivider: {
    width: 1,
    height: scaleHeight(32),
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(20),
    padding: scaleWidth(10),
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

  calendarHeaderRow: {
    paddingHorizontal: scaleWidth(4),
    paddingBottom: scaleHeight(6),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(16),
    color: colors.text,
  },


  legendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(5),
    backgroundColor: colors.green + "12",
    borderRadius: scaleWidth(999),
    paddingHorizontal: scaleWidth(9),
    paddingVertical: scaleHeight(6),
  },

  legendDot: {
    width: scaleWidth(7),
    height: scaleWidth(7),
    borderRadius: scaleWidth(4),
    backgroundColor: colors.green,
  },

  legendText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(10),
    color: colors.green,
  },

  calendar: {
    borderRadius: scaleWidth(18),
    overflow: "hidden",
  },

  calendarMonthTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(15),
    color: colors.text,
  },

  arrowButton: {
    width: scaleWidth(30),
    height: scaleWidth(30),
    borderRadius: scaleWidth(15),
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
  },

  daySummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: scaleHeight(10),
    marginBottom: scaleHeight(10),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(16),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(12),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  dateLabel: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(13),
    color: colors.text,
  },

  workoutCount: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaleWidth(11),
    color: colors.textLight,
    marginTop: scaleHeight(3),
    maxWidth: scaleWidth(220),
  },

  dayCalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(5),
    backgroundColor: colors.primary + "12",
    borderRadius: scaleWidth(999),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(7),
  },

  dayCalText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(12),
    color: colors.primary,
  },

  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(10),
  },

  loadingText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaleWidth(12),
    color: colors.textLight,
  },

  workoutSectionHeader: {
    marginTop: scaleHeight(4),
    marginBottom: scaleHeight(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(8),
  },

  sectionImage: {
    width: scaleWidth(30),
    height: scaleWidth(30),
    borderRadius: scaleWidth(15),
    borderWidth: 1.5,
    borderColor: colors.primary + "40",
    backgroundColor: "#F7F8FA",
  },

  workoutSectionTitle: {
    fontSize: scaleWidth(17),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  workoutSectionCount: {
    fontSize: scaleWidth(12),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },

  empty: {
    alignItems: "center",
    paddingVertical: scaleHeight(42),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(22),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  emptyIcon: {
    width: scaleWidth(72),
    height: scaleWidth(72),
    borderRadius: scaleWidth(36),
    backgroundColor: "#F7F8FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaleHeight(14),
  },

  emptyText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(15),
    color: colors.text,
    marginBottom: scaleHeight(4),
  },

  emptySubText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaleWidth(12),
    color: colors.textLight,
    textAlign: "center",
    maxWidth: scaleWidth(240),
    lineHeight: scaleHeight(18),
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(18),
    padding: scaleWidth(12),
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

  indexCircle: {
    width: scaleWidth(28),
    height: scaleWidth(28),
    borderRadius: scaleWidth(14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaleWidth(10),
  },

  indexText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(12),
  },

  iconWrap: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(14),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scaleWidth(10),
  },

  info: {
    flex: 1,
  },

  name: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(14),
    color: colors.text,
    marginBottom: scaleHeight(6),
  },

  tags: {
    flexDirection: "row",
    gap: scaleWidth(6),
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(4),
    backgroundColor: "#F7F8FA",
    borderRadius: scaleWidth(999),
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(4),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    maxWidth: scaleWidth(105),
  },

  dotSmall: {
    width: scaleWidth(5),
    height: scaleWidth(5),
    borderRadius: scaleWidth(3),
  },

  badgeText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(11),
    color: colors.textLight,
  },

  calBox: {
    alignItems: "center",
    marginLeft: scaleWidth(8),
    minWidth: scaleWidth(42),
  },

  calNum: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(14),
    color: colors.text,
    marginTop: scaleHeight(1),
  },

  calUnit: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(9),
    color: colors.textLight,
  },
});
