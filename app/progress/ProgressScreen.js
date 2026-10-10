import { Ionicons } from "@expo/vector-icons";
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
import Animated, { FadeIn } from "react-native-reanimated";

import { Image } from "expo-image";
import {
  attendanceNudge,
  bubbleScrollFade,
  sayOncePerSession,
} from "../../constants/bubbleMessage";
import { colors } from "../../constants/colors";
import { useUser } from "../../constants/UserContext";
import { localDayKey, partCode } from "../../constants/bodyPartCodes";
import { bodyParts, workoutListGlobal } from "../../constants/Constants";
import { Logger } from "../../constants/Logger";
import { switchToTab } from "../../constants/tabNavigation";
import { EXPRESSION_IMAGES } from "../../constants/widgetPromo";
import { scaling } from "../../constants/useScaling";
import {
  getAllWorkouts,
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

// One exercise from the selected day: its illustration, name and level —
// calories on the right. The body part is already the
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
        <Text style={[cardStyles.levelText, { color: lc }]}>{item.level}</Text>
      </View>

      <View style={cardStyles.calBox}>
        <Text style={cardStyles.calNum}>{kcal}</Text>
        <Text style={cardStyles.calUnit}>kcal</Text>
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

  const hasWorkoutOnSelectedDate = allWorkouts.length > 0;
  const selectedParts = partsByDate[selectedDate] || [];

  // The headline of the summary card: what was trained, not just "a date".
  const summaryHeadline = selectedParts.length
    ? selectedParts.join(" + ")
    : isToday(selectedDate)
      ? "Nothing logged yet"
      : "Rest day";

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

      const history = await getAllWorkouts();

      Logger.log("All workout history--->", history?.length);

      setAllWorkoutHistory(history || []);

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

  // Distinct workout days in the current calendar month — the one number an
  // attendance screen should lead with.
  const monthDays = useMemo(
    () => workoutDates.filter((k) => k.startsWith(todayKey.slice(0, 7))).length,
    [workoutDates, todayKey],
  );

  const isFutureDay = selectedDate > todayKey;

  const HeaderContent = useCallback(
    () => (
      <>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Attendance</Text>
          {monthDays > 0 ? (
            <View style={styles.monthChip}>
              <Text style={styles.monthChipText}>
                🔥 {monthDays} day{monthDays === 1 ? "" : "s"} this month
              </Text>
            </View>
          ) : null}
        </View>

        {/* Calendar first — it's what you interact with. The month name is
            the only title it needs. */}
        <View style={styles.calendarCard}>
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
                  name={direction === "left" ? "chevron-back" : "chevron-forward"}
                  size={18}
                  color={colors.primary}
                />
              </View>
            )}
            renderHeader={(date) => {
              const d = new Date(date);
              return (
                <Text style={styles.calendarMonthTitle}>
                  {MONTHS[d.getMonth()]} {d.getFullYear()}
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
              // Default week rows carry 7dp of margin top AND bottom; over six
              // rows that's ~60dp of dead space.
              "stylesheet.calendar.main": {
                week: {
                  marginTop: 1,
                  marginBottom: 1,
                  flexDirection: "row",
                  justifyContent: "space-around",
                },
              },
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              textSectionTitleColor: colors.textLight,
              textDayHeaderFontFamily: "OpenSans_700Bold",
              textDayHeaderFontSize: scaleWidth(11),
              textDisabledColor: "#CBD5E1",
              backgroundColor: "#FFFFFF",
            }}
            style={styles.calendar}
          />

          {/* Decode the letters under the dates in one quiet line. */}
          {legendParts.length ? (
            <Text style={styles.codeLegend}>
              {legendParts.map((p, i) => (
                <Text key={p}>
                  {i > 0 ? "  ·  " : ""}
                  <Text style={styles.codeLegendCode}>{partCode(p)}</Text> {p}
                </Text>
              ))}
            </Text>
          ) : null}
        </View>

        {/* The selected day, said once, right under where it was tapped. When
            the day is empty this card is the empty state too. */}
        <Animated.View
          key={`day-${summaryChangeKey}`}
          entering={valueEnterAnimation}
          style={styles.dayCard}
        >
          {hasWorkoutOnSelectedDate ? (
            <View style={styles.dayRow}>
              <View style={{ flex: 1, paddingRight: scaleWidth(10) }}>
                <Text style={styles.dayDate}>
                  {isToday(selectedDate) ? "Today · " : ""}
                  {formatShortDate(selectedDate)}
                </Text>
                <Text style={styles.dayHeadline} numberOfLines={2}>
                  {summaryHeadline}
                </Text>
              </View>
              <View style={styles.dayNumbers}>
                <Text style={styles.dayNumber}>
                  {allWorkouts.length}
                  <Text style={styles.dayUnit}> exercise{allWorkouts.length !== 1 ? "s" : ""}</Text>
                </Text>
                {dayCalories > 0 ? (
                  <Text style={styles.dayNumber}>
                    {dayCalories}
                    <Text style={styles.dayUnit}> kcal</Text>
                  </Text>
                ) : null}
              </View>
            </View>
          ) : loading ? (
            <View style={styles.dayLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.dayEmpty}>
              <Image
                source={
                  isToday(selectedDate)
                    ? EXPRESSION_IMAGES.hi
                    : isFutureDay
                      ? EXPRESSION_IMAGES.think
                      : EXPRESSION_IMAGES.sleepy
                }
                style={styles.dayEmptyMascot}
                contentFit="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.dayDate}>
                  {isToday(selectedDate) ? "Today · " : ""}
                  {formatShortDate(selectedDate)}
                </Text>
                <Text style={styles.dayHeadline}>
                  {isToday(selectedDate)
                    ? "Nothing yet today"
                    : isFutureDay
                      ? "Still ahead"
                      : "Rest day 😴"}
                </Text>
                <Text style={styles.dayEmptySub}>
                  {isToday(selectedDate)
                    ? "One session keeps the streak alive."
                    : isFutureDay
                      ? "Come back after your workout 💪"
                      : "Recovery is part of training."}
                </Text>
                {isToday(selectedDate) ? (
                  <Pressable
                    style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => switchToTab("Workouts")}
                    accessibilityRole="button"
                  >
                    <Ionicons name="play" size={scaleWidth(13)} color="#FFFFFF" />
                    <Text style={styles.startBtnText}>Start a workout</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </Animated.View>
      </>
    ),
    [
      selectedDate,
      summaryChangeKey,
      hasWorkoutOnSelectedDate,
      allWorkouts.length,
      dayCalories,
      handleDayPress,
      markedDates,
      summaryHeadline,
      legendParts,
      loading,
      monthDays,
      isFutureDay,
    ],
  );

  return (
    <View style={styles.screen}>
      <SectionList
        {...bubbleScrollFade}
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
              <Text style={styles.workoutSectionTitle}>{section.title}</Text>
            </View>

            {/* Plain grey text — no pills. */}
            <Text style={styles.workoutSectionMeta}>
              {section.data.length}
              {section.kcal > 0 ? ` · ${section.kcal} kcal` : ""}
            </Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <WorkoutCard item={item} index={index} />
        )}
        // The day card above doubles as the empty state.
        ListEmptyComponent={null}
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
    paddingBottom: scaleHeight(12),
  },

  monthChip: {
    backgroundColor: "#FFF1E8",
    borderRadius: 999,
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(5),
  },

  monthChipText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(11.5),
    color: colors.primary,
  },

  screenTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaling().moderateScale(18),
    color: colors.text,
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

  calendar: {
    borderRadius: scaleWidth(18),
    overflow: "hidden",
  },

  // One quiet line under the calendar: "C Chest · B Back · L Legs"
  codeLegend: {
    paddingHorizontal: scaleWidth(6),
    paddingTop: scaleHeight(8),
    marginTop: scaleHeight(2),
    borderTopWidth: 1,
    borderTopColor: "#F1F3F6",
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(11),
    lineHeight: scaleWidth(17),
    color: colors.textLight,
  },

  codeLegendCode: {
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.green,
  },

  // ── Selected day ──
  dayCard: {
    marginTop: scaleHeight(12),
    marginBottom: scaleHeight(14),
    backgroundColor: "#FFFFFF",
    borderRadius: scaleWidth(18),
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(14),
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },

  dayRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dayDate: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(11.5),
    color: colors.textLight,
  },

  dayHeadline: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(17),
    lineHeight: scaleWidth(23),
    color: colors.text,
    marginTop: 1,
  },

  dayNumbers: {
    alignItems: "flex-end",
    gap: 2,
  },

  dayNumber: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(15),
    color: colors.text,
  },

  dayUnit: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: scaleWidth(11),
    color: colors.textLight,
  },

  dayLoading: {
    paddingVertical: scaleHeight(10),
    alignItems: "center",
  },

  dayEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(12),
  },

  dayEmptyMascot: {
    width: scaleWidth(64),
    height: scaleWidth(64),
  },

  dayEmptySub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: scaleWidth(12),
    color: colors.textLight,
    marginTop: 2,
  },

  startBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: scaleWidth(6),
    marginTop: scaleHeight(10),
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleHeight(8),
  },

  startBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: scaleWidth(12.5),
    color: "#FFFFFF",
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
    fontSize: scaleWidth(12),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
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

  levelText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: scaleWidth(11),
    marginTop: 2,
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
