import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import { scaling } from "../../constants/useScaling";
import { getAllWorkouts, initDB } from "../../offlinedb/workoutdb";

const { width, height } = Dimensions.get("window");
const ms = (n) => scaling().moderateScale(n);
const PADDING = ms(16);
const CHART_WIDTH = width - PADDING * 2;

const BODY_PART_COLORS = {
  Chest: colors.primary,
  Shoulder: colors.secondary,
  Back: colors.blue,
  Legs: colors.green,
  Arms: colors.purple,
  Core: colors.pink,
};

const LEVEL_COLORS = {
  Beginner: colors.green,
  Intermediate: colors.secondary,
  Advanced: "#EF4444",
};

const toLocalDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const parseCalories = (cal) => {
  if (!cal) return 0;
  const n = parseInt(
    String(cal)
      .replace(/undefined/g, "")
      .replace(/[^0-9]/g, "") || "0",
    10,
  );
  return isNaN(n) ? 0 : n;
};

const formatCalories = (cal) => {
  if (cal >= 1000) return `${(cal / 1000).toFixed(1)}k`;
  return String(cal);
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const computeChartData = (workouts) => {
  if (!workouts.length) return null;

  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return toLocalDateKey(d);
  });

  const calByDate = {};
  const countByDate = {};

  workouts.forEach((w) => {
    const key = toLocalDateKey(new Date(w.dateTime));
    calByDate[key] = (calByDate[key] || 0) + parseCalories(w.calories);
    countByDate[key] = (countByDate[key] || 0) + 1;
  });

  const caloriesLast7 = last7.map((dateKey) => ({
    label: DAY_SHORT[new Date(dateKey + "T00:00:00").getDay()],
    value: calByDate[dateKey] || 0,
    dateKey,
  }));

  const workoutsLast7 = last7.map((dateKey) => ({
    label: DAY_SHORT[new Date(dateKey + "T00:00:00").getDay()],
    value: countByDate[dateKey] || 0,
    dateKey,
  }));

  const bodyPartMap = {};
  workouts.forEach((w) => {
    const bp = w.bodyPart || "Other";
    bodyPartMap[bp] = (bodyPartMap[bp] || 0) + 1;
  });

  const totalWorkouts = workouts.length;

  const bodyParts = Object.entries(bodyPartMap)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / totalWorkouts) * 100),
      color: BODY_PART_COLORS[name] || colors.muted,
    }))
    .sort((a, b) => b.count - a.count);

  const levelMap = {};
  workouts.forEach((w) => {
    const lv = w.level || "Unknown";
    levelMap[lv] = (levelMap[lv] || 0) + 1;
  });

  const levels = Object.entries(levelMap).map(([name, count]) => ({
    name,
    count,
    pct: Math.round((count / totalWorkouts) * 100),
    color: LEVEL_COLORS[name] || colors.muted,
  }));

  const exerciseMap = {};
  workouts.forEach((w) => {
    if (!w.name) return;
    exerciseMap[w.name] = (exerciseMap[w.name] || 0) + 1;
  });

  const topExercises = Object.entries(exerciseMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalCalories = workouts.reduce(
    (sum, workout) => sum + parseCalories(workout.calories),
    0,
  );

  const activeDays = new Set(
    workouts.map((w) => toLocalDateKey(new Date(w.dateTime))),
  ).size;

  return {
    caloriesLast7,
    workoutsLast7,
    bodyParts,
    levels,
    topExercises,
    totalCalories,
    totalWorkouts,
    activeDays,
  };
};

const TopExerciseRow = ({ ex, index, maxCount }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay: 500 + index * 70,
      useNativeDriver: false,
    }).start();
  }, []);

  const barColor =
    index === 0
      ? colors.primary
      : index === 1
        ? colors.secondary
        : index === 2
          ? colors.green
          : colors.muted;

  return (
    <Animated.View
      style={[
        topStyles.row,
        {
          opacity: anim,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={topStyles.rank}>#{index + 1}</Text>

      <View style={{ flex: 1 }}>
        <Text style={topStyles.name} numberOfLines={1}>
          {ex.name}
        </Text>

        <View style={topStyles.barTrack}>
          <Animated.View
            style={[
              topStyles.barFill,
              {
                width: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    "0%",
                    `${Math.round((ex.count / maxCount) * 100)}%`,
                  ],
                }),
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
      </View>

      <Text style={topStyles.count}>{ex.count}x</Text>
    </Animated.View>
  );
};

const BarChart = ({ data, color, unit = "", maxOverride }) => {
  const anims = useRef(data.map(() => new Animated.Value(0))).current;
  const maxVal = maxOverride || Math.max(...data.map((d) => d.value), 1);
  const BAR_H = ms(120);

  useEffect(() => {
    Animated.stagger(
      60,
      anims.map((a, i) =>
        Animated.spring(a, {
          toValue: data[i].value / maxVal,
          tension: 55,
          friction: 8,
          useNativeDriver: false,
        }),
      ),
    ).start();
  }, [data]);

  const barW = (CHART_WIDTH - ms(32)) / data.length - ms(6);

  return (
    <View style={barStyles.container}>
      {data.map((item, i) => (
        <View key={item.label + i} style={barStyles.col}>
          <Text style={barStyles.topLabel}>
            {item.value > 0
              ? unit === "kcal"
                ? formatCalories(item.value)
                : item.value
              : ""}
          </Text>

          <View style={[barStyles.track, { height: BAR_H }]}>
            <Animated.View
              style={[
                barStyles.bar,
                {
                  width: barW,
                  height: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, BAR_H],
                  }),
                  backgroundColor: item.value > 0 ? color : colors.dim,
                  opacity: item.value > 0 ? 1 : 0.4,
                },
              ]}
            />
          </View>

          <Text style={barStyles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
};

const HorizBar = ({ item, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: item.pct / 100,
      delay,
      tension: 50,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [item.pct]);

  const barMaxW = CHART_WIDTH - ms(32) - ms(60);

  return (
    <View style={horizStyles.row}>
      <View style={horizStyles.labelWrap}>
        <View style={[horizStyles.dot, { backgroundColor: item.color }]} />
        <Text style={horizStyles.name} numberOfLines={1}>
          {item.name}
        </Text>
      </View>

      <View style={[horizStyles.track, { width: barMaxW }]}>
        <Animated.View
          style={[
            horizStyles.fill,
            {
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, barMaxW],
              }),
              backgroundColor: item.color,
            },
          ]}
        />
      </View>

      <Text style={horizStyles.pct}>{item.pct}%</Text>
    </View>
  );
};

const Card = ({ children, delay = 0, style }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        cardStyles.card,
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const RingChart = ({ data }) => {
  const SIZE = ms(120);
  const THICK = ms(14);
  const anims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      100,
      anims.map((a, i) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 600,
          delay: i * 80,
          useNativeDriver: false,
        }),
      ),
    ).start();
  }, []);

  return (
    <View style={ringStyles.wrapper}>
      <View style={ringStyles.rings}>
        {data.map((item, i) => {
          const ringSize = SIZE - i * (THICK + ms(4));

          return (
            <Animated.View
              key={item.name}
              style={[
                ringStyles.ring,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: THICK,
                  borderColor: anims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.dim, item.color],
                  }),
                },
              ]}
            />
          );
        })}
      </View>

      <View style={ringStyles.legend}>
        {data.map((item) => (
          <View key={item.name} style={ringStyles.legendRow}>
            <View
              style={[ringStyles.legendDot, { backgroundColor: item.color }]}
            />
            <Text style={ringStyles.legendName}>{item.name}</Text>
            <Text style={[ringStyles.legendPct, { color: item.color }]}>
              {item.pct}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const SummaryPills = ({ totalCalories, totalWorkouts, activeDays }) => {
  const items = [
    {
      icon: "flame-outline",
      label: "Calories",
      value: formatCalories(totalCalories),
      color: colors.primary,
    },
    {
      icon: "barbell-outline",
      label: "Workouts",
      value: String(totalWorkouts),
      color: colors.secondary,
    },
    {
      icon: "calendar-outline",
      label: "Days",
      value: String(activeDays),
      color: colors.green,
    },
  ];

  return (
    <View style={pillStyles.row}>
      {items.map((it, i) => {
        const anim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
          Animated.spring(anim, {
            toValue: 1,
            delay: i * 100,
            tension: 60,
            friction: 8,
            useNativeDriver: false,
          }).start();
        }, []);

        return (
          <Animated.View
            key={it.label}
            style={[
              pillStyles.pill,
              {
                opacity: anim,
                transform: [{ scale: anim }],
                borderColor: it.color + "44",
              },
            ]}
          >
            <View
              style={[
                pillStyles.iconWrap,
                { backgroundColor: it.color + "20" },
              ]}
            >
              <Ionicons name={it.icon} size={ms(18)} color={it.color} />
            </View>
            <Text style={pillStyles.value}>{it.value}</Text>
            <Text style={pillStyles.label}>{it.label}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

export default function StatsScreen() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("7D");

  const titleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      try {
        await initDB();
        const data = await getAllWorkouts();
        Logger.log("StatsScreen workouts--->", data.length);
        setWorkouts(data);
      } catch (error) {
        Logger.log("StatsScreen error", error);
      } finally {
        setLoading(false);
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();
      }
    };

    load();
  }, []);

  const filteredWorkouts = useMemo(() => {
    if (filter === "All") return workouts;

    const days = filter === "7D" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    return workouts.filter((w) => new Date(w.dateTime) >= cutoff);
  }, [workouts, filter]);

  const data = useMemo(
    () => computeChartData(filteredWorkouts),
    [filteredWorkouts],
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <Ionicons name="stats-chart" size={ms(40)} color={colors.primary} />
        <Text style={styles.loaderText}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View
          style={[
            styles.headerCard,
            {
              opacity: titleAnim,
              transform: [
                {
                  translateY: titleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerIconWrap}>
            <Ionicons name="stats-chart" size={ms(22)} color={colors.primary} />
          </View>

          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>Stats</Text>
            <Text style={styles.headerSub}>
              Track your workouts, calories, and progress
            </Text>
          </View>
        </Animated.View>

        {workouts && workouts.length > 0 && data ? (
          <View>
            <Animated.View style={[styles.filterRow, { opacity: titleAnim }]}>
              {["7D", "30D", "All"].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterTab,
                    filter === f && styles.filterTabActive,
                  ]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === f && styles.filterTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>

            <SummaryPills
              totalCalories={data.totalCalories}
              totalWorkouts={data.totalWorkouts}
              activeDays={data.activeDays}
            />

            <Card delay={100}>
              <View style={cardStyles.titleRow}>
                <View
                  style={[
                    cardStyles.titleIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <AntDesign name="fire" size={ms(14)} color={colors.primary} />
                </View>
                <Text style={cardStyles.title}>Calories Burned</Text>
                <Text style={cardStyles.subtitle}>Last 7 days</Text>
              </View>
              <BarChart
                data={data.caloriesLast7}
                color={colors.primary}
                unit="kcal"
              />
            </Card>

            <Card delay={200}>
              <View style={cardStyles.titleRow}>
                <View
                  style={[
                    cardStyles.titleIcon,
                    { backgroundColor: colors.secondary + "20" },
                  ]}
                >
                  <Ionicons
                    name="barbell-outline"
                    size={ms(14)}
                    color={colors.secondary}
                  />
                </View>
                <Text style={cardStyles.title}>Workouts / Day</Text>
                <Text style={cardStyles.subtitle}>Last 7 days</Text>
              </View>
              <BarChart data={data.workoutsLast7} color={colors.secondary} />
            </Card>

            <Card delay={300}>
              <View style={cardStyles.titleRow}>
                <View
                  style={[
                    cardStyles.titleIcon,
                    { backgroundColor: colors.blue + "20" },
                  ]}
                >
                  <Ionicons
                    name="body-outline"
                    size={ms(14)}
                    color={colors.blue}
                  />
                </View>
                <Text style={cardStyles.title}>Body Part Focus</Text>
                <Text style={cardStyles.subtitle}>
                  {data.totalWorkouts} sessions
                </Text>
              </View>
              <View style={{ marginTop: ms(8) }}>
                {data.bodyParts.map((item, i) => (
                  <HorizBar key={item.name} item={item} delay={i * 80} />
                ))}
              </View>
            </Card>

            <Card delay={400}>
              <View style={cardStyles.titleRow}>
                <View
                  style={[
                    cardStyles.titleIcon,
                    { backgroundColor: colors.purple + "20" },
                  ]}
                >
                  <Ionicons
                    name="trophy-outline"
                    size={ms(14)}
                    color={colors.purple}
                  />
                </View>
                <Text style={cardStyles.title}>Difficulty Split</Text>
              </View>
              <RingChart data={data.levels} />
            </Card>

            <Card delay={500}>
              <View style={cardStyles.titleRow}>
                <View
                  style={[
                    cardStyles.titleIcon,
                    { backgroundColor: colors.green + "20" },
                  ]}
                >
                  <Ionicons
                    name="list-outline"
                    size={ms(14)}
                    color={colors.green}
                  />
                </View>
                <Text style={cardStyles.title}>Top Exercises</Text>
              </View>
              <View style={{ marginTop: ms(12) }}>
                {data.topExercises.map((ex, i) => (
                  <TopExerciseRow
                    key={ex.name}
                    ex={ex}
                    index={i}
                    maxCount={data.topExercises[0]?.count || 1}
                  />
                ))}
              </View>
            </Card>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="bar-chart-outline"
                size={ms(38)}
                color={colors.primary}
              />
            </View>

            <Text style={styles.emptyText}>No stats yet</Text>

            <Text style={styles.emptySubText}>
              Complete your first workout to see calories, progress, and
              activity insights.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: PADDING,
    paddingTop: ms(12),
    paddingBottom: ms(80),
  },
  loader: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(12),
  },
  loaderText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(14),
    color: colors.muted,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    paddingHorizontal: ms(10),
    paddingVertical: ms(10),
    marginBottom: ms(18),
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerIconWrap: {
    borderRadius: ms(15),

    alignItems: "center",
    justifyContent: "center",
    marginEnd: ms(12),
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: "#0F172A",
  },
  headerSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "#64748B",
    marginTop: ms(3),
    lineHeight: ms(17),
  },
  emptyContainer: {
    flex: 1,
    minHeight: height * 0.65,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(28),
  },
  emptyIconWrap: {
    width: ms(76),
    height: ms(76),
    borderRadius: ms(38),
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(16),
  },
  emptyText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(20),
    color: "#0F172A",
    textAlign: "center",
  },
  emptySubText: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(13),
    color: "#64748B",
    textAlign: "center",
    lineHeight: ms(20),
    marginTop: ms(8),
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: ms(4),
    marginBottom: ms(20),
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: ms(8),
    alignItems: "center",
    borderRadius: 9,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.muted,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
});

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: ms(10),
    marginBottom: ms(16),
  },
  pill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: ms(12),
    alignItems: "flex-start",
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  iconWrap: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(9),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: ms(8),
  },
  value: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(18),
    color: colors.text,
  },
  label: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(10),
    color: colors.muted,
    marginTop: 2,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: ms(16),
    marginBottom: ms(14),
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: ms(16),
    gap: ms(8),
  },
  titleIcon: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(8),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(14),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11),
    color: colors.muted,
  },
});

const barStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  col: {
    flex: 1,
    alignItems: "center",
  },
  topLabel: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(9),
    color: colors.muted,
    marginBottom: ms(4),
    height: ms(12),
  },
  track: {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    borderRadius: ms(6),
  },
  label: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10),
    color: colors.muted,
    marginTop: ms(6),
  },
});

const horizStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: ms(12),
    gap: ms(8),
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    width: ms(80),
    gap: ms(6),
  },
  dot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
  },
  name: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.text,
    flex: 1,
  },
  track: {
    height: ms(7),
    backgroundColor: colors.dim,
    borderRadius: ms(4),
    overflow: "hidden",
    flex: 1,
  },
  fill: {
    height: "100%",
    borderRadius: ms(4),
  },
  pct: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: colors.muted,
    width: ms(32),
    textAlign: "right",
  },
});

const ringStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(24),
    marginTop: ms(4),
  },
  rings: {
    width: ms(120),
    height: ms(120),
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
  legend: {
    flex: 1,
    gap: ms(10),
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
  },
  legendDot: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
  },
  legendName: {
    flex: 1,
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.text,
  },
  legendPct: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
  },
});

const topStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginBottom: ms(12),
  },
  rank: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: colors.muted,
    width: ms(24),
  },
  name: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(13),
    color: colors.text,
    marginBottom: ms(4),
  },
  barTrack: {
    height: ms(5),
    backgroundColor: colors.dim,
    borderRadius: ms(3),
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: ms(3),
  },
  count: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: colors.muted,
    width: ms(28),
    textAlign: "right",
  },
});
