import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { AnimatePresence, MotiView } from "moti";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import BrandGradient from "../../../components/ui/BrandGradient";
import { dayPartsLabel, localDayKey } from "../../../constants/bodyPartCodes";
import { openAttendanceOn } from "../../../constants/tabNavigation";
import { colors } from "../../../constants/colors";
import { tapHaptic } from "../../../constants/haptics";
import { scaling } from "../../../constants/useScaling";
import { resolveTodayMood } from "../../../constants/todayMood";
import { EXPRESSION_IMAGES } from "../../../constants/widgetPromo";
import useTrainToday from "./useTrainToday";

const ms = (n) => scaling().moderateScale(n);

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// Local calendar day, so a 11pm workout counts for that evening — same rule
// the streak query uses ('localtime').
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** The last 7 days ending today: trained or not, and which body parts. */
function useWeek(history) {
  return useMemo(() => {
    const byDay = new Map(); // dayKey → body parts in the order trained
    const sorted = [...(history || [])].sort((a, b) => new Date(a?.dateTime) - new Date(b?.dateTime));
    for (const w of sorted) {
      const t = new Date(w?.dateTime);
      if (Number.isNaN(t.getTime())) continue;
      const k = dayKey(t);
      const parts = byDay.get(k) || [];
      if (w?.bodyPart && !parts.includes(w.bodyPart)) parts.push(w.bodyPart);
      byDay.set(k, parts);
    }
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const parts = byDay.get(dayKey(d));
      return {
        key: localDayKey(d),
        letter: DAY_LETTERS[d.getDay()],
        done: !!parts,
        parts: parts || [],
        isToday: i === 6,
      };
    });
  }, [history]);
}

function WeekDot({ day, index, showLabels }) {
  const label = dayPartsLabel(day.parts);
  return (
    // Any day opens Attendance on that date, where the full details live.
    <Pressable
      style={({ pressed }) => [styles.day, pressed && { opacity: 0.6 }]}
      onPress={() => {
        tapHaptic();
        openAttendanceOn(day.key);
      }}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={
        day.done
          ? `${day.letter}: trained ${day.parts.join(", ") || "a workout"}. Open in Attendance`
          : `${day.letter}: no workout. Open in Attendance`
      }
    >
      <Text style={[styles.dayLetter, day.isToday && styles.dayLetterToday]}>{day.letter}</Text>
      <MotiView
        from={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 13, delay: 120 + index * 55 }}
        style={[
          styles.dot,
          day.done ? styles.dotDone : day.isToday ? styles.dotToday : styles.dotMiss,
          day.done && day.isToday && styles.dotDoneToday,
        ]}
      >
        {day.done ? (
          <Ionicons name="checkmark" size={ms(14)} color={colors.primary} />
        ) : day.isToday ? (
          <View style={styles.todayPip} />
        ) : null}
      </MotiView>

      {/* The row is only rendered when at least one day has a label, and every
          day reserves the same height, so the dots stay perfectly aligned. */}
      {showLabels ? (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 300, delay: 260 + index * 55 }}
          style={styles.partSlot}
        >
          {/* One part: "Chest". Several: "C+B" — still one short line. */}
          {label ? (
            <Text style={styles.partText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
          ) : null}
        </MotiView>
      ) : null}
    </Pressable>
  );
}

/** White button with a soft breathing pulse — the one primary action here. */
function PlanButton({ label, busy, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.025, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(pulse, press) }] }}>
      <Pressable
        disabled={busy}
        onPress={() => {
          tapHaptic();
          onPress();
        }}
        onPressIn={() => Animated.spring(press, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
        style={styles.planBtn}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="sparkles" size={ms(16)} color={colors.primary} />
            <Text style={styles.planText}>{label}</Text>
            <Ionicons name="chevron-forward" size={ms(16)} color={colors.primary} />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const toneOf = (result) => {
  const tone = result.forTomorrow ? "tomorrow" : result.restAdvised ? "rest" : "go";
  const eyebrow =
    tone === "tomorrow"
      ? "TOMORROW'S FOCUS"
      : tone === "rest"
        ? "GO EASY TODAY"
        : result.isQuick
          ? "QUICK START FOR YOU"
          : "TODAY'S FOCUS";
  const icon = tone === "tomorrow" ? "calendar" : tone === "rest" ? "moon" : result.isQuick ? "flash" : "barbell";
  return { tone, eyebrow, icon };
};

function ResultIcon({ tone, icon }) {
  return (
    <View style={[styles.resultIcon, tone !== "go" && styles.resultIconCalm]}>
      <Ionicons name={icon} size={ms(16)} color={tone === "go" ? colors.primary : "#B45309"} />
    </View>
  );
}

/** Small round icon button used for collapse / expand / plan again. */
function IconBtn({ name, onPress, busy, label }) {
  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      disabled={busy}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.textLight} />
      ) : (
        <Ionicons name={name} size={ms(15)} color={colors.textLight} />
      )}
    </Pressable>
  );
}

/**
 * The recommendation, shown inside the card once "Plan" has run.
 *
 * ONE component for both states. It used to swap between a collapsed and an
 * expanded component inside AnimatePresence(exitBeforeEnter): every toggle
 * ran an exit, left a gap, mounted the other card and re-ran the staggered
 * "why" lines — the card visibly blinked several times. Now the header row
 * stays mounted and only the details section appears/disappears, with a single
 * soft fade in (no exit animation, nothing to flash).
 */
function PlanResult({ result, collapsed, onToggle, onStart, onAgain, busy }) {
  const { tone, eyebrow, icon } = toneOf(result);
  const start = () => {
    tapHaptic();
    onStart({ id: result.id, bodyPart: result.bodyPart });
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "timing", duration: 260 }}
      style={[styles.result, collapsed && styles.resultCollapsed]}
    >
      <View style={styles.resultHead}>
        <Pressable
          style={styles.resultHeadInfo}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Show plan details" : "Hide plan details"}
        >
          <ResultIcon tone={tone} icon={icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.resultEyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
            <Text style={collapsed ? styles.miniTitle : styles.resultTitle} numberOfLines={1}>
              {result.bodyPart}
            </Text>
          </View>
        </Pressable>

        {collapsed ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.miniStart, pressed && { opacity: 0.85 }]}
              onPress={start}
              accessibilityRole="button"
              accessibilityLabel={`Start ${result.bodyPart} workout`}
            >
              <Ionicons name="play" size={ms(12)} color="#FFFFFF" />
              <Text style={styles.miniStartText}>Start</Text>
            </Pressable>
            <IconBtn name="shuffle" onPress={onAgain} busy={busy} label="Plan again" />
          </>
        ) : null}
        <IconBtn
          name={collapsed ? "chevron-down" : "chevron-up"}
          onPress={onToggle}
          label={collapsed ? "Expand plan" : "Collapse plan"}
        />
      </View>

      {!collapsed ? (
        <Reanimated.View entering={FadeIn.duration(200)}>
          {result.isAlternative ? (
            <Text style={styles.swapNote}>Swapped from {result.replaced} · same goal, fresh moves</Text>
          ) : result.weekSummary ? (
            <Text style={styles.resultSummary}>{result.weekSummary}</Text>
          ) : null}

          <View style={styles.why}>
            {(result.why || []).map((line, i) => (
              <View key={i} style={styles.whyRow}>
                <Ionicons name="checkmark-circle" size={ms(14)} color={colors.primary} />
                <Text style={styles.whyText}>{line}</Text>
              </View>
            ))}
          </View>

          {result.forTomorrow ? (
            <>
              <View style={styles.restNote}>
                <Text style={styles.restEmoji}>🌙</Text>
                <Text style={styles.restText}>
                  You&apos;ve done your session today. Rest up — this plan is waiting for you tomorrow.
                </Text>
              </View>
              {/* Advice, not a lock: they can still train if they want to. */}
              <Pressable style={styles.secondaryCta} onPress={start}>
                <Ionicons name="play" size={ms(14)} color={colors.primary} />
                <Text style={styles.secondaryCtaText}>Train {result.bodyPart} anyway</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.startCta} onPress={start}>
              <Ionicons name="play" size={ms(15)} color="#FFFFFF" />
              <Text style={styles.startCtaText}>Start {result.bodyPart} workout</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.again}
            onPress={() => {
              tapHaptic();
              onAgain();
            }}
            hitSlop={8}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.textLight} />
            ) : (
              <>
                <Ionicons name="shuffle" size={ms(13)} color={colors.textLight} />
                <Text style={styles.againText}>Plan again · try something else</Text>
              </>
            )}
          </Pressable>
        </Reanimated.View>
      ) : null}
    </MotiView>
  );
}

/**
 * The one card at the top of Workouts. Replaces three separate cards — the
 * mascot, "Your progress" and "What to train today" — so the screen leads with
 * a single, clear "here's today" instead of three competing headers.
 *
 * Everything here reads data the screen already loads; nothing new is stored.
 */
export default function TodayCard({
  name,
  gender,
  experience,
  streak = 0,
  daysSinceLast = -1,
  history = [],
  onStart,
}) {
  const week = useWeek(history);
  const showLabels = week.some((d) => d.parts.length > 0);
  const { result, busy, analyze } = useTrainToday(history, { experience });
  const [collapsed, setCollapsed] = useState(false);
  const [shift, setShift] = useState(0);
  const bob = useRef(new Animated.Value(0)).current;
  const poke = useRef(new Animated.Value(0)).current;

  // A fresh plan always opens expanded so the "why" is seen at least once.
  useEffect(() => {
    if (result) setCollapsed(false);
  }, [result]);

  // Character + line follow this week's training days (and gender for the
  // "missed you more than your girlfriend/boyfriend" lines).
  const shown = resolveTodayMood({ history, streak, daysSinceLast, name, gender, shift });

  // Tap Jack for another line — with a little wiggle.
  const pokeMascot = () => {
    tapHaptic();
    setShift((s) => s + 1);
    poke.setValue(0);
    Animated.timing(poke, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const hasHistory = history.length > 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 18 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 380 }}
      style={styles.shadow}
    >
      <BrandGradient style={styles.card}>
        <View style={styles.top}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            {/* The streak is the one number worth keeping on this card; the
                date is already on the phone and highlighted in the week strip. */}
            {streak > 0 ? (
              <View style={styles.streakChip}>
                <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
              </View>
            ) : null}
            <MotiView
              key={shown.text}
              from={{ opacity: 0, translateY: 4 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 260 }}
            >
              <Text style={styles.message} numberOfLines={2}>
                {shown.text}
              </Text>
            </MotiView>
          </View>
          <Pressable onPress={pokeMascot} hitSlop={6} accessibilityLabel="Tap Jack for another message">
            <Animated.View
              style={{
                transform: [
                  { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -ms(5)] }) },
                  {
                    rotate: poke.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange: ["0deg", "-9deg", "7deg", "-4deg", "0deg"],
                    }),
                  },
                ],
              }}
            >
              <Image
                source={EXPRESSION_IMAGES[shown.expression]}
                style={styles.mascot}
                contentFit="contain"
                transition={220}
              />
            </Animated.View>
          </Pressable>
        </View>

        <View style={styles.week}>
          {week.map((d, i) => (
            <WeekDot key={i} day={d} index={i} showLabels={showLabels} />
          ))}
        </View>

        <AnimatePresence exitBeforeEnter>
          {/* AnimatePresence only for button → plan (once). Collapse/expand
              happens inside PlanResult, which stays mounted. */}
          {result ? (
            <PlanResult
              key="result"
              result={result}
              collapsed={collapsed}
              busy={busy}
              onToggle={() => setCollapsed((c) => !c)}
              onStart={(item) => onStart?.(item)}
              onAgain={() => analyze({ again: true })}
            />
          ) : (
            <MotiView
              key="plan"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={styles.planWrap}
            >
              <PlanButton
                label={hasHistory ? "Plan today's session" : "Plan your first session"}
                busy={busy}
                onPress={() => analyze()}
              />
            </MotiView>
          )}
        </AnimatePresence>
      </BrandGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 22,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  card: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14 },

  top: { flexDirection: "row", alignItems: "center" },
  streakChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.14)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  streakText: { fontSize: ms(10.5), fontFamily: "OpenSans_800ExtraBold", color: "#FFFFFF" },
  message: {
    fontSize: ms(15),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    lineHeight: ms(20),
    marginTop: 0,
    letterSpacing: -0.2,
  },
  mascot: { width: ms(64), height: ms(64), marginRight: -4, marginVertical: -4 },

  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  // flex, not a fixed width: seven columns must fit even on 320pt phones.
  day: { flex: 1, alignItems: "center", gap: 4 },
  partSlot: { height: ms(12), width: "100%", alignItems: "center", justifyContent: "center", marginTop: -1 },
  partText: {
    fontSize: ms(8.5),
    lineHeight: ms(12),
    fontFamily: "OpenSans_700Bold",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
  },
  dayLetter: { fontSize: ms(9.5), fontFamily: "OpenSans_700Bold", color: "rgba(255,255,255,0.8)" },
  dayLetterToday: { color: "#FFFFFF", fontFamily: "OpenSans_800ExtraBold" },
  dot: { width: ms(28), height: ms(28), borderRadius: ms(14), alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: "#FFFFFF" },
  dotDoneToday: { borderWidth: 2, borderColor: colors.accent },
  dotToday: { borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "rgba(255,255,255,0.14)" },
  dotMiss: { backgroundColor: "rgba(255,255,255,0.18)" },
  todayPip: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },

  planWrap: { marginTop: 10 },
  planBtn: {
    height: ms(42),
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  planText: { fontSize: ms(14), fontFamily: "OpenSans_800ExtraBold", color: colors.primary },

  // ── recommendation panel ──
  result: { marginTop: 10, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12 },
  resultCollapsed: { paddingVertical: 9, paddingHorizontal: 10 },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  resultHeadInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  resultIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: colors.primary + "16",
    alignItems: "center",
    justifyContent: "center",
  },
  resultIconCalm: { backgroundColor: "#FFF4E5" },
  resultEyebrow: { fontSize: ms(9.5), fontFamily: "OpenSans_800ExtraBold", letterSpacing: 1.1, color: colors.textLight },
  resultTitle: { fontSize: ms(18), fontFamily: "OpenSans_800ExtraBold", color: colors.text },
  resultSummary: { fontSize: ms(11.5), fontFamily: "OpenSans_500Medium", color: colors.textLight, marginTop: 8 },
  why: { gap: 6, marginTop: 10, marginBottom: 12 },
  whyRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  whyText: { flex: 1, fontSize: ms(12), fontFamily: "OpenSans_500Medium", color: colors.text, lineHeight: ms(17) },
  startCta: {
    height: ms(46),
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  startCtaText: { fontSize: ms(13.5), fontFamily: "OpenSans_800ExtraBold", color: "#FFFFFF" },
  secondaryCta: {
    height: ms(42),
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryCtaText: { fontSize: ms(12.5), fontFamily: "OpenSans_800ExtraBold", color: colors.primary },
  restNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    marginBottom: 10,
  },
  restEmoji: { fontSize: ms(18) },
  restText: { flex: 1, fontSize: ms(11.5), fontFamily: "OpenSans_600SemiBold", color: "#9A3412", lineHeight: ms(16) },
  again: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
    minHeight: ms(20),
  },
  againText: { fontSize: ms(11.5), fontFamily: "OpenSans_700Bold", color: colors.textLight },
  swapNote: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: ms(10.5),
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    backgroundColor: colors.primary + "12",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  iconBtn: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── collapsed plan row ──
  miniTitle: { fontSize: ms(14.5), fontFamily: "OpenSans_800ExtraBold", color: colors.text },
  miniStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: ms(30),
    paddingHorizontal: 12,
    borderRadius: ms(15),
    backgroundColor: colors.primary,
  },
  miniStartText: { fontSize: ms(12), fontFamily: "OpenSans_800ExtraBold", color: "#FFFFFF" },
});
