import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
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
import BrandGradient from "../../components/ui/BrandGradient";
import { colors } from "../../constants/colors";
import { useUser } from "../../constants/UserContext";
import { localDayKey, partCode } from "../../constants/bodyPartCodes";
import { bodyParts, workoutListGlobal } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkouts,
  getTotalCalories,
  initDB,
} from "../../offlinedb/workoutdb";

const scaleWidth = (n) => scaling().moderateScale(n);
const scaleHeight = (n) => scaling().moderateScale(n);

// Exercise name → its illustration, for the history rows. Built once, lazily.
let exercisePhotos = null;
const exercisePhoto = (name) => {
  if (!exercisePhotos) {
    exercisePhotos = new Map();
    for (const program of workoutListGlobal) {
      for (const ex of program.workoutList || []) {
        if (ex?.name && ex.photo && !exercisePhotos.has(ex.name)) {
          exercisePhotos.set(ex.name, ex.photo);
        }
      }
    }
  }
  return exercisePhotos.get(name) || null;
};

const valueEnterAnimation = FadeIn.duration(180)
  .springify()
  .damping(18)
  .stiffness(160);

const iconEnterAnimation = ZoomIn.duration(180)
  .springify()
  .damping(16)
  .stiffness(180);

// LOCAL calendar day. Workouts are stored as UTC ISO strings; grouping by the
// UTC date put an early-morning (IST) session on the previous day here while
// the Workouts week strip showed it on the right one.
const getWorkoutDateKey = (dateTime) => (dateTime ? localDayKey(dateTime) : null);

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

const isToday = (dateKey) => dateKey === localDayKey(new Date());

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatShortDate = (dateKey) => {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]}, ${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

// Up to two body-part codes for a calendar cell: "C", "C+B", "C+B+1".
const cellCodes = (parts) => {
  const shown = parts.slice(0, 2).map(partCode).join("+");
  return parts.length > 2 ? `${shown}+${parts.length - 2}` : shown;
};

/**
 * Calendar cell: the date, and under it what was trained that day. Selected
 * = filled orange, trained = soft green, today = orange ring.
 */
const CalendarDay = memo(function CalendarDay({ date, state, marking, onPress }) {
  const parts = marking?.parts || [];
  const selected = !!marking?.selected;
  const done = parts.length > 0;
  const outside = state === "disabled";
  const today = state === "today";

  return (
    <Pressable
      onPress={() => onPress?.(date)}
      style={dayStyles.cell}
      accessibilityRole="button"
      accessibilityLabel={`${date?.day}${done ? `, trained ${parts.join(", ")}` : ""}`}
    >
      <View
        style={[
          dayStyles.circle,
          done && dayStyles.circleDone,
          today && !selected && dayStyles.circleToday,
          selected && dayStyles.circleSelected,
        ]}
      >
        <Text
          style={[
            dayStyles.num,
            outside && dayStyles.numOutside,
            done && dayStyles.numDone,
            today && !selected && dayStyles.numToday,
            selected && dayStyles.numSelected,
          ]}
        >
          {date?.day}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[dayStyles.code, outside && dayStyles.numOutside, selected && dayStyles.codeSelected]}
      >
        {done ? cellCodes(parts) : " "}
      </Text>
    </Pressable>
  );
});

// One exercise from the selected day: its illustration, name, when it was
// done and at what level — calories on the right. The body part is already the
// section header, so it isn't repeated on every row.
const WorkoutCard = memo(function WorkoutCard({ item }) {
  const lc = levelColor(item.level);
  const photo = exercisePhoto(item.name);
  const kcal = parseCalories(item.calories);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.thumb}>
        {photo ? (
          <Image source={photo} style={cardStyles.thumbImg} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name={bodyPartIcon(item.bodyPart)} size={scaleWidth(22)} color={colors.primary} />
        )}
      </View>

      <View style={cardStyles.info}>
        <Text style={cardStyles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={cardStyles.metaRow}>
          <View style={[cardStyles.levelChip, { backgroundColor: lc + "14" }]}>
            <View style={[cardStyles.dotSmall, { backgroundColor: lc }]} />
            <Text style={[cardStyles.levelText, { color: lc }]}>{item.level}</Text>
          </View>
        </View>
      </View>

      <View style={cardStyles.calBox}>
        <Text style={cardStyles.calNum}>{kcal}</Text>
        <View style={cardStyles.calUnitRow}>
          <AntDesign name="fire" size={scaleWidth(10)} color={colors.primary} />
          <Text style={cardStyles.calUnit}>kcal</Text>
        </View>
      </View>
    </View>
  );
});

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const route = useRoute();

  const todayKey = localDayKey(new Date());

  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [allWorkoutHistory, setAllWorkoutHistory] = useState([]);
  const [totalCalories, setTotalCalories] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Opened from a day on the Workouts week strip → jump straight to it.
  useEffect(() => {
    const date = route?.params?.date;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelectedDate(date);
    }
  }, [route?.params?.date, route?.params?.at]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Local day → body parts trained that day (in the order they were done).
  const partsByDate = useMemo(() => {
    const map = {};
    const sorted = [...allWorkoutHistory].sort(
      (a, b) => new Date(a?.dateTime) - new Date(b?.dateTime),
    );
    for (const w of sorted) {
      const key = getWorkoutDateKey(w?.dateTime);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      if (w.bodyPart && !map[key].includes(w.bodyPart)) map[key].push(w.bodyPart);
    }
    return map;
  }, [allWorkoutHistory]);

  const workoutDates = useMemo(() => Object.keys(partsByDate), [partsByDate]);

  // Every body part that appears anywhere in the history, for the code legend.
  const legendParts = useMemo(
    () => [...new Set(Object.values(partsByDate).flat())],
    [partsByDate],
  );

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
  const selectedParts = partsByDate[selectedDate] || [];

  // The headline of the summary card: what was trained, not just "a date".
  const summaryHeadline = selectedParts.length
    ? selectedParts.join(" + ")
    : isToday(selectedDate)
      ? "Nothing logged yet"
      : "Rest day";

  const selectedStatus = useMemo(() => {
    if (workoutDates.includes(selectedDate)) return "Done";
    if (isToday(selectedDate)) return "Today";
    return "Rest";
  }, [selectedDate, workoutDates]);

  const selectedIconName = hasWorkoutOnSelectedDate
    ? "checkmark-done"
    : isToday(selectedDate)
      ? "hourglass-outline"
      : "moon-outline";

  const summaryChangeKey = selectedDate;

  const workoutSections = useMemo(() => {
    return Object.values(
      allWorkouts.reduce((acc, item) => {
        const title = item.bodyPart || "Other";

        if (!acc[title]) {
          acc[title] = {
            title,
            data: [],
            kcal: 0,
            level: item.level,
          };
        }

        acc[title].data.push(item);
        acc[title].kcal += parseCalories(item.calories);
        return acc;
      }, {}),
    ).map((s, i) => ({ ...s, first: i === 0 }));
  }, [allWorkouts]);

  // Calendar marks carry the day's body parts; CalendarDay draws them.
  const markedDates = useMemo(() => {
    const marked = {};
    for (const key of workoutDates) {
      marked[key] = { parts: partsByDate[key], selected: key === selectedDate };
    }
    if (selectedDate && !marked[selectedDate]) {
      marked[selectedDate] = { parts: [], selected: true };
    }
    return marked;
  }, [partsByDate, workoutDates, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      await initDB();

      const [history, cal] = await Promise.all([
        getAllWorkouts(),
        getTotalCalories(),
      ]);

      Logger.log("All workout history--->", history?.length);
      Logger.log("Total calories--->", cal);

      setAllWorkoutHistory(history || []);
      setTotalCalories(cal || 0);

      // Nudge only when today is genuinely empty, and only once per session.
      const today = localDayKey(new Date());
      if (!(history || []).some((w) => getWorkoutDateKey(w?.dateTime) === today)) {
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

        <BrandGradient style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            {/* What was trained leads; the date sits above it, smaller. */}
            <View style={{ flex: 1, paddingRight: scaleWidth(10) }}>
              <Text style={styles.summaryLabel}>
                {isToday(selectedDate) ? "TODAY · " : ""}
                {formatShortDate(selectedDate).toUpperCase()}
              </Text>

              <Animated.Text
                key={`date-${summaryChangeKey}`}
                entering={valueEnterAnimation}
                layout={LinearTransition.duration(160)}
                style={styles.summaryDate}
                numberOfLines={2}
              >
                {summaryHeadline}
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
        </BrandGradient>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <Text style={styles.cardTitle}>Workout calendar</Text>

            <View style={styles.legendPill}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Completed</Text>
            </View>
          </View>

          <Calendar
            // Remount when jumping to another month from outside (a tap on the
            // Workouts week strip), so the calendar actually shows that month.
            key={selectedDate.slice(0, 7)}
            current={selectedDate}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            dayComponent={CalendarDay}
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

          {/* Decode the letters under the dates — only parts actually logged. */}
          {legendParts.length ? (
            <View style={styles.codeLegend}>
              {legendParts.map((p) => (
                <View key={p} style={styles.codeLegendItem}>
                  <Text style={styles.codeLegendCode}>{partCode(p)}</Text>
                  <Text style={styles.codeLegendName}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Only worth showing once the day actually has something in it — an
            empty summary above an empty list is just noise. */}
        {hasWorkoutOnSelectedDate ? (
          <View style={styles.daySummary}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dateLabel}>Workout history</Text>

              <Text style={styles.workoutCount}>
                {`${allWorkouts.length} exercise${
                  allWorkouts.length !== 1 ? "s" : ""
                } · ${displayDate}`}
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
      summaryHeadline,
      legendParts,
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
          // Every group after the first gets clear space above it, so where one
          // body part ends and the next begins is obvious at a glance.
          <View
            style={[
              styles.workoutSectionHeader,
              !section.first && styles.workoutSectionHeaderNext,
            ]}
          >
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

              <View>
                <Text style={styles.workoutSectionTitle}>{section.title}</Text>
                {section.level ? (
                  <Text style={styles.workoutSectionMeta}>{section.level}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.sectionPills}>
              <Text style={styles.workoutSectionCount}>
                {section.data.length} ex
              </Text>
              {section.kcal > 0 ? (
                <View style={styles.sectionKcal}>
                  <AntDesign name="fire" size={scaleWidth(10)} color={colors.primary} />
                  <Text style={styles.sectionKcalText}>{section.kcal}</Text>
                </View>
              ) : null}
            </View>
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
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(10.5),
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.85)",
  },

  summaryDate: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(21),
    lineHeight: scaleWidth(27),
    color: "#FFFFFF",
    marginTop: scaleHeight(3),
    letterSpacing: -0.3,
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

  codeLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scaleWidth(6),
    paddingHorizontal: scaleWidth(4),
    paddingTop: scaleHeight(8),
    marginTop: scaleHeight(4),
    borderTopWidth: 1,
    borderTopColor: "#F1F3F6",
  },

  codeLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(4),
    backgroundColor: "#F7F8FA",
    borderRadius: 999,
    paddingLeft: scaleWidth(3),
    paddingRight: scaleWidth(8),
    paddingVertical: scaleHeight(2),
  },

  codeLegendCode: {
    minWidth: scaleWidth(18),
    textAlign: "center",
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(9),
    color: "#FFFFFF",
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingHorizontal: scaleWidth(4),
    paddingVertical: 1,
    overflow: "hidden",
  },

  codeLegendName: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(10.5),
    color: colors.textLight,
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

  // Second group onwards: a clear gap plus a hairline above the header.
  workoutSectionHeaderNext: {
    marginTop: scaleHeight(22),
    paddingTop: scaleHeight(14),
    borderTopWidth: 1,
    borderTopColor: "#E9ECF1",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(8),
  },

  sectionImage: {
    width: scaleWidth(38),
    height: scaleWidth(38),
    borderRadius: scaleWidth(12),
    backgroundColor: "#F7F8FA",
  },

  workoutSectionTitle: {
    fontSize: scaleWidth(15.5),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },

  workoutSectionMeta: {
    fontSize: scaleWidth(11),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginTop: 1,
  },

  sectionPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(6),
  },

  workoutSectionCount: {
    fontSize: scaleWidth(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
    backgroundColor: "#EEF0F4",
    borderRadius: 999,
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(3),
    overflow: "hidden",
  },

  sectionKcal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primary + "14",
    borderRadius: 999,
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(3),
  },

  sectionKcalText: {
    fontSize: scaleWidth(11),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
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
    borderRadius: scaleWidth(16),
    paddingVertical: scaleWidth(9),
    paddingLeft: scaleWidth(9),
    paddingRight: scaleWidth(12),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  thumb: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(12),
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: scaleWidth(11),
  },

  thumbImg: {
    width: "92%",
    height: "92%",
  },

  info: {
    flex: 1,
  },

  name: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(13.5),
    color: colors.text,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(8),
    marginTop: scaleHeight(5),
  },

  levelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(4),
    borderRadius: 999,
    paddingHorizontal: scaleWidth(7),
    paddingVertical: scaleHeight(2),
  },

  dotSmall: {
    width: scaleWidth(5),
    height: scaleWidth(5),
    borderRadius: scaleWidth(3),
  },

  levelText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(10.5),
  },

  calBox: {
    alignItems: "flex-end",
    marginLeft: scaleWidth(8),
    minWidth: scaleWidth(40),
  },

  calNum: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(16),
    color: colors.text,
  },

  calUnitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  calUnit: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(9.5),
    color: colors.textLight,
  },
});

// Calendar cell (CalendarDay). ~44pt tall: date circle + one line of codes.
const dayStyles = StyleSheet.create({
  cell: {
    width: scaleWidth(42),
    alignItems: "center",
    paddingVertical: 2,
  },
  circle: {
    width: scaleWidth(30),
    height: scaleWidth(30),
    borderRadius: scaleWidth(15),
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    backgroundColor: colors.green + "16",
    borderWidth: 1,
    borderColor: colors.green + "30",
  },
  circleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  circleSelected: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  num: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(12.5),
    color: colors.text,
  },
  numOutside: {
    color: "#CBD5E1",
  },
  numDone: {
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.green,
  },
  numToday: {
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
  },
  numSelected: {
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
  },
  code: {
    marginTop: 1,
    height: scaleWidth(12),
    lineHeight: scaleWidth(12),
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(8.5),
    color: colors.green,
  },
  codeSelected: {
    color: colors.primary,
  },
});
