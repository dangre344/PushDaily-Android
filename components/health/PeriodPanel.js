import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { AnimatePresence, MotiView } from "moti";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "toastify-react-native";

import { colors } from "../../constants/colors";
import { selectionHaptic, tapHaptic } from "../../constants/haptics";
import { Logger } from "../../constants/Logger";
import {
  disablePeriodReminders,
  enablePeriodReminders,
  markPeriodPrimerShown,
  openNotificationSettings,
  isPartnerMode,
  periodRemindersActive,
  syncPeriodReminders,
  wasPeriodPrimerShown,
} from "../../constants/periodReminders";
import { useUser } from "../../constants/UserContext";
import {
  CYCLE_RANGE,
  DEFAULT_CYCLE,
  DEFAULT_PERIOD,
  PERIOD_RANGE,
  daysBetween,
  fromKey,
  getCycleStatus,
  isPeriodNearby,
  loadPeriodData,
  logPeriodStart,
  removePeriodStart,
  toKey,
  updateCycleSettings,
} from "../../constants/periodTracker";
import { scaling } from "../../constants/useScaling";
import { EXPRESSION_IMAGES } from "../../constants/widgetPromo";

const ms = (n) => scaling().moderateScale(n);

export const ROSE = "#E8466B";
const ROSE_SOFT = "#FFF1F4";
const ROSE_LINE = "#FAD4DE";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pretty = (key, withDay = false) => {
  const d = fromKey(key);
  return `${withDay ? WEEKDAYS[d.getDay()] + ", " : ""}${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// ─── Voice: her own cycle, or a partner's ────────────────────────────────────
// A woman tracks her own cycle. Anyone else (Male, Other, unset) is tracking a
// partner's — same features, the wording just talks about "her".
const PartnerContext = createContext(false);
const usePartner = () => useContext(PartnerContext);

const BENEFITS = {
  self: [
    { icon: "calendar-outline", text: "Know when your next period is due" },
    { icon: "barbell-outline", text: "Workout tips that match each phase" },
    { icon: "time-outline", text: "Spot delays early with your own history" },
    { icon: "lock-closed-outline", text: "Private — stays only on this phone" },
  ],
  partner: [
    { icon: "calendar-outline", text: "Know when her next period is due" },
    { icon: "heart-outline", text: "Know when she may need a little extra care" },
    { icon: "barbell-outline", text: "Plan workouts together around her energy" },
    { icon: "lock-closed-outline", text: "Private — stays only on this phone" },
  ],
};

const INTRO = {
  self: {
    title: "Track your cycle, train smarter",
    sub: "Your energy changes through the month. Knowing where you are helps you plan workouts — and be kinder to yourself on tough days.",
    cta: "Add my last period date",
  },
  partner: {
    title: "Track your partner's cycle",
    sub: "Know when her period is due and when she might need extra care — so you can support her better and plan workouts together.",
    cta: "Add her last period date",
  },
};

const DOS = [
  { icon: "water-outline", text: "Drink plenty of water — it eases bloating and cramps." },
  { icon: "walk-outline", text: "Move gently: walks, yoga and light stretching help." },
  { icon: "nutrition-outline", text: "Eat iron-rich food — spinach, lentils, dates, jaggery." },
  { icon: "flame-outline", text: "A warm heat pad on the belly relaxes cramps." },
  { icon: "moon-outline", text: "Sleep 7–9 hours; the body is working harder." },
  { icon: "refresh-outline", text: "Change pads or tampons every 4–6 hours." },
];

const DONTS = [
  { icon: "fast-food-outline", text: "Don't skip meals — low sugar makes cramps worse." },
  { icon: "barbell-outline", text: "Don't chase heavy max lifts when feeling weak or dizzy." },
  { icon: "cafe-outline", text: "Go easy on caffeine, salty and very sugary food." },
  { icon: "wine-outline", text: "Avoid alcohol — it can worsen cramps and mood." },
  { icon: "medkit-outline", text: "Don't ignore severe pain or very heavy flow — see a doctor." },
  { icon: "heart-outline", text: "Don't feel guilty about rest days. Rest is training too." },
];

const plural = (n) => (n === 1 ? "" : "s");

/** Jack's support line for the days around a period. */
const supportFor = (s, partner = false) => {
  switch (s.phase) {
    case "period":
      if (partner) {
        return s.dayOfPeriod <= 2
          ? {
              expression: "sleepy",
              title: `Day ${s.dayOfPeriod} for her`,
              text: "Energy is usually low today. Warm water, a heat pad and a little extra patience go a long way 💛",
            }
          : {
              expression: "water",
              title: `Day ${s.dayOfPeriod} — check in on her`,
              text: "A short walk together or her favourite snack can really help 🌸",
            };
      }
      return s.dayOfPeriod <= 2
        ? {
            expression: "sleepy",
            title: `Day ${s.dayOfPeriod} — go easy`,
            text: "Rest counts as training today. Warm water, a heat pad and zero guilt. I've got your streak 💛",
          }
        : {
            expression: "water",
            title: `Day ${s.dayOfPeriod} — you're doing great`,
            text: "Stay hydrated and try a gentle stretch or a short walk. Light movement often eases cramps 🌸",
          };
    case "due":
      return partner
        ? {
            expression: "hi",
            title: "Her period may start today",
            text: "Keep a heat pad and her favourite snack handy — small gestures count 🍫",
          }
        : {
            expression: "hi",
            title: "Period may start today",
            text: "Keep a heat pad and your favourite snack close — I fully approve the chocolate 🍫",
          };
    case "soon":
      return partner
        ? {
            expression: "hi",
            title: `Her period in ${s.untilNext} day${plural(s.untilNext)}`,
            text: "Plan lighter days together and be extra kind. She'll notice 🤍",
          }
        : {
            expression: "hi",
            title: `Period in ${s.untilNext} day${plural(s.untilNext)}`,
            text: "Pack the essentials and plan lighter workouts. Future you says thanks 🤍",
          };
    case "pms":
      return partner
        ? {
            expression: "think",
            title: "PMS week for her",
            text: "Mood swings and cravings are normal. Patience and snacks beat advice 🙂",
          }
        : {
            expression: "think",
            title: "PMS week",
            text: "Moody, bloated, craving snacks? Totally normal. A 15-minute walk can lift your mood 🚶‍♀️",
          };
    case "late":
      return {
        expression: "think",
        title: `Running ${s.lateBy} day${plural(s.lateBy)} late`,
        text: partner
          ? "Stress, sleep and travel can all shift a cycle — it's common. If it keeps happening, she may want to check with a doctor 🤍"
          : "Stress, sleep, travel and training can all shift a cycle — it's common. If it keeps happening, check in with a doctor 🤍",
      };
    default:
      return null;
  }
};

const PHASE_TIP = {
  self: {
    follicular: "Energy is usually higher now — a great week to push a little harder 💪",
    ovulation: "Many feel strongest around now. Good days for strength work 🔥",
    luteal: "Energy can dip in this phase. Moderate workouts usually feel best 🙂",
  },
  partner: {
    follicular: "Her energy is usually higher now — a great week for workouts together 💪",
    ovulation: "Many feel strongest around now. Good days to train together 🔥",
    luteal: "Her energy can dip in this phase. Keep plans light and easy 🙂",
  },
};

// ─── small pieces ────────────────────────────────────────────────────────────

function Card({ children, style, delay = 0 }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320, delay }}
      style={[styles.card, style]}
    >
      {children}
    </MotiView>
  );
}

function Stepper({ label, value, range, unit, onChange }) {
  const step = (d) => {
    const next = Math.max(range[0], Math.min(range[1], value + d));
    if (next !== value) {
      selectionHaptic();
      onChange(next);
    }
  };
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => step(-1)}
          hitSlop={6}
          style={[styles.stepBtn, value <= range[0] && styles.stepBtnOff]}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons name="remove" size={ms(16)} color={ROSE} />
        </Pressable>
        <Text style={styles.stepValue}>
          {value}
          <Text style={styles.stepUnit}> {unit}</Text>
        </Text>
        <Pressable
          onPress={() => step(1)}
          hitSlop={6}
          style={[styles.stepBtn, value >= range[1] && styles.stepBtnOff]}
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons name="add" size={ms(16)} color={ROSE} />
        </Pressable>
      </View>
    </View>
  );
}

/** Do's & Don'ts, in a bottom sheet opened from the heart icon. */
function CareSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const partner = usePartner();
  const [tab, setTab] = useState("do");
  const items = tab === "do" ? DOS : DONTS;

  useEffect(() => {
    if (visible) setTab("do");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <View style={styles.grabber} />
          <View style={styles.careSheetHead}>
            <View style={styles.careSheetIcon}>
              <Ionicons name="heart" size={ms(18)} color={ROSE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{partner ? "During her period" : "During your period"}</Text>
              <Text style={styles.careSheetSub}>
                {partner ? "Good to know — and to gently share" : "Small habits that make those days easier"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose} accessibilityLabel="Close">
              <Ionicons name="close" size={ms(18)} color={colors.textLight} />
            </Pressable>
          </View>

          <View style={styles.segment}>
            {[
              { id: "do", label: "Do's", icon: "checkmark-circle" },
              { id: "dont", label: "Don'ts", icon: "close-circle" },
            ].map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    selectionHaptic();
                    setTab(t.id);
                  }}
                  style={[styles.segmentBtn, on && styles.segmentBtnOn]}
                >
                  <Ionicons
                    name={t.icon}
                    size={ms(14)}
                    color={on ? (t.id === "do" ? "#16A34A" : "#DC2626") : colors.textLight}
                  />
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexGrow: 0 }}>
            <AnimatePresence exitBeforeEnter>
              <MotiView
                key={tab}
                from={{ opacity: 0, translateX: tab === "do" ? -10 : 10 }}
                animate={{ opacity: 1, translateX: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "timing", duration: 200 }}
              >
                {items.map((it) => (
                  <View key={it.text} style={styles.careRow}>
                    <View style={[styles.careIcon, tab === "do" ? styles.careIconDo : styles.careIconDont]}>
                      <Ionicons name={it.icon} size={ms(14)} color={tab === "do" ? "#16A34A" : "#DC2626"} />
                    </View>
                    <Text style={styles.careText}>{it.text}</Text>
                  </View>
                ))}
              </MotiView>
            </AnimatePresence>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DelayChip({ delay }) {
  if (delay === null || delay === undefined) {
    return (
      <View style={[styles.chip, { backgroundColor: "#F3F4F6" }]}>
        <Text style={[styles.chipText, { color: colors.textLight }]}>First log</Text>
      </View>
    );
  }
  if (Math.abs(delay) <= 1) {
    return (
      <View style={[styles.chip, { backgroundColor: "#E9F7EF" }]}>
        <Text style={[styles.chipText, { color: "#15803D" }]}>On time</Text>
      </View>
    );
  }
  const late = delay > 0;
  return (
    <View style={[styles.chip, { backgroundColor: late ? "#FFF4E5" : "#EEF2FF" }]}>
      <Text style={[styles.chipText, { color: late ? "#B45309" : "#4338CA" }]}>
        {Math.abs(delay)} days {late ? "late" : "early"}
      </Text>
    </View>
  );
}

// ─── log / setup sheet ───────────────────────────────────────────────────────

function LogSheet({ visible, firstTime, data, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const partner = usePartner();
  const [picked, setPicked] = useState(toKey());
  const [cycle, setCycle] = useState(DEFAULT_CYCLE);
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPicked(toKey());
    setCycle(data?.cycleLength || DEFAULT_CYCLE);
    setPeriod(data?.periodLength || DEFAULT_PERIOD);
  }, [visible, data]);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 120);
    return toKey(d);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await logPeriodStart(fromKey(picked), firstTime ? { cycleLength: cycle, periodLength: period } : {});
      tapHaptic();
      onSaved();
    } catch (e) {
      Logger.log("[Period] save failed:", String(e));
      Toast.error("Couldn't save. Please try again.", "top");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>
            {firstTime
              ? partner
                ? "When did her last period start?"
                : "When did your last period start?"
              : "When did this period start?"}
          </Text>
          <Text style={styles.sheetSub}>
            Pick the first day of bleeding. An estimate is fine — you can fix it later.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexGrow: 0 }}>
            <Calendar
              current={picked}
              maxDate={toKey()}
              minDate={minDate}
              onDayPress={(d) => {
                selectionHaptic();
                setPicked(d.dateString);
              }}
              markedDates={{ [picked]: { selected: true, selectedColor: ROSE } }}
              enableSwipeMonths
              firstDay={1}
              theme={{
                calendarBackground: "#FFFFFF",
                monthTextColor: colors.text,
                textMonthFontFamily: "OpenSans_700Bold",
                textMonthFontSize: ms(14),
                dayTextColor: colors.text,
                textDayFontFamily: "OpenSans_600SemiBold",
                textDayFontSize: ms(13),
                todayTextColor: ROSE,
                selectedDayBackgroundColor: ROSE,
                selectedDayTextColor: "#FFFFFF",
                arrowColor: ROSE,
                textSectionTitleColor: colors.textLight,
                textDayHeaderFontFamily: "OpenSans_700Bold",
                textDayHeaderFontSize: ms(11),
                textDisabledColor: "#D1D5DB",
                "stylesheet.calendar.main": {
                  week: { marginTop: 2, marginBottom: 2, flexDirection: "row", justifyContent: "space-around" },
                },
              }}
            />

            {firstTime ? (
              <View style={styles.stepperGroup}>
                <Stepper label="Usual cycle length" value={cycle} range={CYCLE_RANGE} unit="days" onChange={setCycle} />
                <Stepper label="Period usually lasts" value={period} range={PERIOD_RANGE} unit="days" onChange={setPeriod} />
                <Text style={styles.stepHint}>Not sure? Keep 28 and 5 — we&apos;ll learn from your logs.</Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={ms(18)} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Save · {pretty(picked, true)}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const REMINDER_BENEFITS = [
  { icon: "notifications-outline", text: "A heads-up the day before the period is due" },
  { icon: "create-outline", text: "A gentle nudge to log it, so predictions stay accurate" },
  { icon: "repeat-outline", text: "Every 15 days until the first date is added" },
  { icon: "eye-off-outline", text: "Discreet — no dates or details on your lock screen" },
];

function BenefitList({ items }) {
  return (
    <View style={styles.benefits}>
      {items.map((b) => (
        <View key={b.text} style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <Ionicons name={b.icon} size={ms(15)} color={ROSE} />
          </View>
          <Text style={styles.benefitText}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Reminder status inside the Periods tab. Off → why it's worth it + one
 * button (the permission prompt only comes after this tap). On → a compact
 * row with a switch.
 */
function ReminderCard({ active, busy, onEnable, onDisable, delay }) {
  if (active) {
    return (
      <Card delay={delay} style={styles.reminderOnCard}>
        <View style={styles.reminderBell}>
          <Ionicons name="notifications" size={ms(16)} color={ROSE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderOnTitle}>Period reminders are on</Text>
          <Text style={styles.reminderOnSub}>Around the expected date, at 10 AM</Text>
        </View>
        <Switch
          value
          onValueChange={(v) => !v && onDisable()}
          disabled={busy}
          trackColor={{ true: ROSE + "88", false: "#E5E7EB" }}
          thumbColor={ROSE}
        />
      </Card>
    );
  }
  return (
    <Card delay={delay}>
      <View style={styles.reminderHead}>
        <View style={styles.reminderBell}>
          <Ionicons name="notifications" size={ms(16)} color={ROSE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Never forget to log</Text>
          <Text style={styles.cardHint}>Accurate predictions need the dates</Text>
        </View>
      </View>
      <BenefitList items={REMINDER_BENEFITS.slice(0, 2)} />
      <Pressable
        onPress={onEnable}
        disabled={busy}
        style={({ pressed }) => [styles.primaryBtn, styles.reminderBtn, pressed && { opacity: 0.9 }]}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="notifications" size={ms(16)} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Turn on period reminders</Text>
          </>
        )}
      </Pressable>
    </Card>
  );
}

/** Shown once, right after the first period is logged: benefits, then ask. */
function ReminderPrimer({ visible, busy, onEnable, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <View style={styles.grabber} />
          <View style={styles.primerTop}>
            <Image source={EXPRESSION_IMAGES.hi} style={styles.primerMascot} contentFit="contain" />
            <Text style={styles.primerTitle}>Want a reminder? 🔔</Text>
            <Text style={styles.primerSub}>
              Most people forget to log. A quick nudge keeps predictions spot on.
            </Text>
          </View>
          <BenefitList items={REMINDER_BENEFITS} />
          <Pressable
            onPress={onEnable}
            disabled={busy}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="notifications" size={ms(17)} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Turn on reminders</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={styles.primerLater} hitSlop={6}>
            <Text style={styles.primerLaterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

/**
 * Periods tab of the Water & Periods screen. All data stays on the device
 * (constants/periodTracker.js); nothing about it is sent to analytics.
 */
export default function PeriodPanel() {
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [editSettings, setEditSettings] = useState(false);
  const [careOpen, setCareOpen] = useState(false);

  // ── Reminders (Female / Other only) ──
  const { user } = useUser();
  const gender = user?.gender;
  // Reminders are for everyone; only the wording changes.
  const partner = isPartnerMode(gender);
  const [remindersOn, setRemindersOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [primerOpen, setPrimerOpen] = useState(false);

  useEffect(() => {
    periodRemindersActive().then(setRemindersOn).catch(() => {});
  }, []);

  // Any change to her dates moves the reminders with them.
  useEffect(() => {
    if (data) syncPeriodReminders({ gender });
  }, [data, gender]);

  const enableReminders = async () => {
    tapHaptic();
    setReminderBusy(true);
    const res = await enablePeriodReminders({ gender });
    setReminderBusy(false);
    setPrimerOpen(false);
    if (res === "scheduled") {
      setRemindersOn(true);
      Toast.success("Period reminders on 🔔", "top");
    } else if (res === "blocked") {
      Alert.alert(
        "Notifications are off",
        "Allow notifications for Push Daily in Settings to get period reminders.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: openNotificationSettings },
        ],
      );
    } else if (res === "denied") {
      Toast.info("No problem — you can turn reminders on here anytime.", "top");
    }
  };

  const disableReminders = async () => {
    setReminderBusy(true);
    await disablePeriodReminders();
    setReminderBusy(false);
    setRemindersOn(false);
    Toast.info("Period reminders off", "top");
  };

  const openCare = () => {
    tapHaptic();
    setCareOpen(true);
  };

  const reload = useCallback(async () => setData(await loadPeriodData()), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const status = useMemo(() => (data ? getCycleStatus(data) : { phase: "none" }), [data]);
  const support = supportFor(status, partner);
  const intro = partner ? INTRO.partner : INTRO.self;
  const phaseTip = (partner ? PHASE_TIP.partner : PHASE_TIP.self)[status.phase];
  const setUp = (data?.cycles?.length || 0) > 0;

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={ROSE} />
      </View>
    );
  }

  const confirmRemove = (key) =>
    Alert.alert("Remove this entry?", `Period starting ${pretty(key)} will be deleted from your history.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setData(await removePeriodStart(key));
        },
      },
    ]);

  return (
    <PartnerContext.Provider value={partner}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!setUp ? (
          // ── First visit: why it's worth it, then one clear action ──
          <Card style={styles.introCard}>
            <Image source={EXPRESSION_IMAGES.hi} style={styles.introMascot} contentFit="contain" />
            <Text style={styles.introTitle}>{intro.title}</Text>
            <Text style={styles.introSub}>{intro.sub}</Text>
            <View style={styles.benefits}>
              {(partner ? BENEFITS.partner : BENEFITS.self).map((b) => (
                <View key={b.text} style={styles.benefitRow}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name={b.icon} size={ms(15)} color={ROSE} />
                  </View>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() => {
                tapHaptic();
                setSheet(true);
              }}
              style={({ pressed }) => [styles.primaryBtn, styles.introBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="calendar" size={ms(17)} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{intro.cta}</Text>
            </Pressable>
            <Pressable onPress={openCare} hitSlop={6} style={styles.introCareLink}>
              <Ionicons name="heart" size={ms(14)} color={ROSE} />
              <Text style={styles.introCareText}>Period Do&apos;s & Don&apos;ts</Text>
            </Pressable>
          </Card>
        ) : null}

        {!setUp ? (
          <ReminderCard
            delay={80}
            active={remindersOn}
            busy={reminderBusy}
            onEnable={enableReminders}
            onDisable={disableReminders}
          />
        ) : null}

        {setUp ? (
          <>
            {/* ── Where she is today ── */}
            <Card style={styles.statusCard}>
              <View style={styles.statusTopRow}>
                <View style={{ flex: 1 }}>
                  <StatusHeadline status={status} />
                </View>
                {/* Do's & Don'ts live in a sheet, one tap away. */}
                <Pressable
                  onPress={openCare}
                  hitSlop={6}
                  style={({ pressed }) => [styles.careBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Period do's and don'ts"
                >
                  <Ionicons name="heart" size={ms(14)} color={ROSE} />
                  <Text style={styles.careBtnText}>Do&apos;s & Don&apos;ts</Text>
                </Pressable>
              </View>
              <View style={styles.cycleTrack}>
                <View
                  style={[
                    styles.cycleFill,
                    { width: `${Math.min(100, Math.max(4, (status.cycleDay / status.avgCycle) * 100))}%` },
                  ]}
                />
                {/* period days, shaded at the start of the bar */}
                <View
                  style={[
                    styles.cyclePeriod,
                    { width: `${Math.min(100, (status.periodLength / status.avgCycle) * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.statusMeta}>
                <Text style={styles.metaText}>
                  Cycle day <Text style={styles.metaStrong}>{Math.max(1, status.cycleDay)}</Text> of {status.avgCycle}
                </Text>
                <Text style={styles.metaText}>
                  Next: <Text style={styles.metaStrong}>{pretty(status.nextStart, true)}</Text>
                </Text>
              </View>
              {phaseTip ? <Text style={styles.phaseTip}>{phaseTip}</Text> : null}

              <Pressable
                onPress={() => {
                  tapHaptic();
                  setSheet(true);
                }}
                style={({ pressed }) => [styles.primaryBtn, styles.logBtn, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="calendar" size={ms(16)} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  {status.phase === "period" ? "Change start date" : "Log period start date"}
                </Text>
              </Pressable>
            </Card>

            {/* ── Jack, when it's close ── */}
            {support && isPeriodNearby(status) ? (
              <Card delay={80} style={styles.supportCard}>
                <Image
                  source={EXPRESSION_IMAGES[support.expression]}
                  style={styles.supportMascot}
                  contentFit="contain"
                  transition={250}
                />
                <View style={styles.supportBubble}>
                  <View style={styles.supportTail} />
                  <Text style={styles.supportTitle}>{support.title}</Text>
                  <Text style={styles.supportText}>{support.text}</Text>
                </View>
              </Card>
            ) : null}

            <ReminderCard
              delay={110}
              active={remindersOn}
              busy={reminderBusy}
              onEnable={enableReminders}
              onDisable={disableReminders}
            />
          </>
        ) : null}

        {setUp ? (
          <>
            {/* ── History with delays ── */}
            <Card delay={140}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>History</Text>
                <Text style={styles.cardHint}>Avg cycle {status.avgCycle} days</Text>
              </View>
              {data.cycles.slice(0, 12).map((c, i) => {
                const newer = data.cycles[i - 1];
                const length = newer ? daysBetween(fromKey(c.start), fromKey(newer.start)) : null;
                return (
                  <Pressable
                    key={c.start}
                    onLongPress={() => confirmRemove(c.start)}
                    delayLongPress={350}
                    style={[styles.historyRow, i > 0 && styles.historyDivider]}
                  >
                    <View style={styles.historyDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>{pretty(c.start, true)}</Text>
                      <Text style={styles.historySub}>
                        {length ? `${length}-day cycle` : i === 0 ? "Current cycle" : "—"}
                      </Text>
                    </View>
                    <DelayChip delay={c.delay} />
                    <Pressable onPress={() => confirmRemove(c.start)} hitSlop={10} style={styles.trash}>
                      <Ionicons name="trash-outline" size={ms(15)} color="#9CA3AF" />
                    </Pressable>
                  </Pressable>
                );
              })}
            </Card>

            {/* ── Cycle settings ── */}
            <Card delay={200}>
              <Pressable style={styles.rowBetween} onPress={() => setEditSettings((v) => !v)}>
                <View>
                  <Text style={styles.cardTitle}>Cycle settings</Text>
                  <Text style={styles.cardHint}>
                    {data.cycleLength}-day cycle · {data.periodLength}-day period
                  </Text>
                </View>
                <Ionicons name={editSettings ? "chevron-up" : "chevron-down"} size={ms(18)} color={colors.textLight} />
              </Pressable>
              {editSettings ? (
                <View style={styles.stepperGroup}>
                  <Stepper
                    label="Usual cycle length"
                    value={data.cycleLength}
                    range={CYCLE_RANGE}
                    unit="days"
                    onChange={async (v) => setData(await updateCycleSettings({ cycleLength: v }))}
                  />
                  <Stepper
                    label="Period usually lasts"
                    value={data.periodLength}
                    range={PERIOD_RANGE}
                    unit="days"
                    onChange={async (v) => setData(await updateCycleSettings({ periodLength: v }))}
                  />
                  <Text style={styles.stepHint}>
                    After two logs, predictions use your real average instead.
                  </Text>
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        <Text style={styles.disclaimer}>
          🔒 Stored only on this phone. Predictions are estimates, not medical advice.
        </Text>
      </ScrollView>

      <LogSheet
        visible={sheet}
        firstTime={!setUp}
        data={data}
        onClose={() => setSheet(false)}
        onSaved={async () => {
          const firstLog = !setUp;
          setSheet(false);
          await reload();
          Toast.success(
            setUp ? "Period logged 🌸" : partner ? "All set! Tracking her cycle 🌸" : "All set! Tracking your cycle 🌸",
            "top",
          );

          // Right after the first log is the moment reminders make sense —
          // offer them once, with the benefits, before any permission prompt.
          if (firstLog && !remindersOn && !(await wasPeriodPrimerShown())) {
            markPeriodPrimerShown();
            setTimeout(() => setPrimerOpen(true), 500);
          }
        }}
      />

      <CareSheet visible={careOpen} onClose={() => setCareOpen(false)} />

      <ReminderPrimer
        visible={primerOpen}
        busy={reminderBusy}
        onEnable={enableReminders}
        onClose={() => setPrimerOpen(false)}
      />
    </PartnerContext.Provider>
  );
}

function StatusHeadline({ status }) {
  const partner = usePartner();
  let eyebrow = "NEXT PERIOD";
  let big = `${status.untilNext}`;
  let unit = status.untilNext === 1 ? "day to go" : "days to go";

  if (status.phase === "period") {
    eyebrow = partner ? "ON HER PERIOD" : "ON YOUR PERIOD";
    big = `Day ${status.dayOfPeriod}`;
    unit = `of ~${status.periodLength}`;
  } else if (status.phase === "late") {
    eyebrow = "PERIOD IS LATE";
    big = `${status.lateBy}`;
    unit = status.lateBy === 1 ? "day late" : "days late";
  } else if (status.phase === "due") {
    eyebrow = "EXPECTED";
    big = "Today";
    unit = "";
  }

  return (
    <View>
      <Text style={styles.statusEyebrow}>{eyebrow}</Text>
      <View style={styles.statusBigRow}>
        <Text style={styles.statusBig}>{big}</Text>
        {unit ? <Text style={styles.statusUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingTop: ms(60), alignItems: "center" },
  scrollContent: { padding: ms(16), paddingBottom: ms(28) },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    padding: ms(16),
    marginBottom: ms(14),
    borderWidth: 1,
    borderColor: "#F3E8EB",
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(15.5), color: colors.text },
  cardHint: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(11.5), color: colors.textLight, marginTop: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // intro
  introCard: { alignItems: "center", paddingTop: ms(8) },
  introMascot: { width: ms(110), height: ms(110) },
  introTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: colors.text,
    textAlign: "center",
    marginTop: ms(2),
  },
  introSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12.5),
    lineHeight: ms(18),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(6),
  },
  benefits: { alignSelf: "stretch", gap: ms(10), marginTop: ms(16), marginBottom: ms(18) },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  benefitIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: ROSE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontFamily: "OpenSans_600SemiBold", fontSize: ms(13), color: colors.text },
  introBtn: { alignSelf: "stretch" },

  primaryBtn: {
    height: ms(50),
    borderRadius: ms(15),
    backgroundColor: ROSE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    shadowColor: ROSE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(14.5), color: "#FFFFFF" },

  // reminders
  reminderHead: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  reminderBell: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(12),
    backgroundColor: ROSE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderBtn: { height: ms(46), marginTop: -ms(4) },
  reminderOnCard: { flexDirection: "row", alignItems: "center", gap: ms(10), paddingVertical: ms(12) },
  reminderOnTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(13.5), color: colors.text },
  reminderOnSub: { fontFamily: "OpenSans_500Medium", fontSize: ms(11.5), color: colors.textLight, marginTop: 1 },
  primerTop: { alignItems: "center" },
  primerMascot: { width: ms(96), height: ms(96) },
  primerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(18),
    color: colors.text,
    textAlign: "center",
  },
  primerSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12.5),
    lineHeight: ms(18),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(4),
  },
  primerLater: { alignItems: "center", paddingVertical: ms(12) },
  primerLaterText: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(13), color: colors.textLight },

  // status
  statusCard: { backgroundColor: ROSE_SOFT, borderColor: ROSE_LINE },
  statusTopRow: { flexDirection: "row", alignItems: "flex-start", gap: ms(8) },
  careBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ROSE_LINE,
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
  },
  careBtnText: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(11), color: ROSE },
  introCareLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: ms(12),
    paddingVertical: 4,
  },
  introCareText: { fontFamily: "OpenSans_700Bold", fontSize: ms(12.5), color: ROSE },
  careSheetHead: { flexDirection: "row", alignItems: "center", gap: ms(10), marginBottom: ms(4) },
  careSheetIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: ROSE_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  careSheetSub: { fontFamily: "OpenSans_500Medium", fontSize: ms(11.5), color: colors.textLight, marginTop: 1 },
  sheetClose: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  statusEyebrow: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(10.5), letterSpacing: 1.3, color: ROSE },
  statusBigRow: { flexDirection: "row", alignItems: "baseline", gap: ms(6), marginTop: 2 },
  statusBig: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(34), color: colors.text, letterSpacing: -0.8 },
  statusUnit: { fontFamily: "OpenSans_700Bold", fontSize: ms(14), color: colors.textLight },
  cycleTrack: {
    height: ms(10),
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginTop: ms(12),
    borderWidth: 1,
    borderColor: ROSE_LINE,
  },
  cycleFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: ROSE + "55", borderRadius: 999 },
  cyclePeriod: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: ROSE, borderRadius: 999 },
  statusMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: ms(8) },
  metaText: { fontFamily: "OpenSans_500Medium", fontSize: ms(11.5), color: colors.textLight },
  metaStrong: { fontFamily: "OpenSans_800ExtraBold", color: colors.text },
  phaseTip: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    lineHeight: ms(17),
    color: colors.text,
    marginTop: ms(10),
  },
  logBtn: { marginTop: ms(14), height: ms(46) },

  // support
  supportCard: { flexDirection: "row", alignItems: "center", gap: ms(10), paddingVertical: ms(12) },
  supportMascot: { width: ms(78), height: ms(78) },
  supportBubble: { flex: 1, backgroundColor: ROSE_SOFT, borderRadius: ms(14), padding: ms(11) },
  supportTail: {
    position: "absolute",
    left: -ms(5),
    top: "50%",
    marginTop: -ms(5),
    width: ms(10),
    height: ms(10),
    backgroundColor: ROSE_SOFT,
    transform: [{ rotate: "45deg" }],
  },
  supportTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(13), color: ROSE },
  supportText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    lineHeight: ms(17),
    color: colors.text,
    marginTop: 3,
  },

  // do / don't
  segment: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: ms(12),
    padding: 3,
    marginTop: ms(10),
    marginBottom: ms(10),
  },
  segmentBtn: {
    flex: 1,
    height: ms(34),
    borderRadius: ms(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  segmentBtnOn: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontFamily: "OpenSans_700Bold", fontSize: ms(12.5), color: colors.textLight },
  segmentTextOn: { color: colors.text, fontFamily: "OpenSans_800ExtraBold" },
  careRow: { flexDirection: "row", alignItems: "center", gap: ms(10), paddingVertical: ms(6) },
  careIcon: { width: ms(28), height: ms(28), borderRadius: ms(8), alignItems: "center", justifyContent: "center" },
  careIconDo: { backgroundColor: "#E9F7EF" },
  careIconDont: { backgroundColor: "#FDECEC" },
  careText: { flex: 1, fontFamily: "OpenSans_500Medium", fontSize: ms(12.5), lineHeight: ms(17), color: colors.text },

  // history
  historyRow: { flexDirection: "row", alignItems: "center", gap: ms(10), paddingVertical: ms(10) },
  historyDivider: { borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  historyDot: { width: ms(10), height: ms(10), borderRadius: ms(5), backgroundColor: ROSE },
  historyDate: { fontFamily: "OpenSans_700Bold", fontSize: ms(13), color: colors.text },
  historySub: { fontFamily: "OpenSans_500Medium", fontSize: ms(11), color: colors.textLight, marginTop: 1 },
  chip: { borderRadius: 999, paddingHorizontal: ms(9), paddingVertical: ms(3) },
  chipText: { fontFamily: "OpenSans_700Bold", fontSize: ms(10.5) },
  trash: { padding: 2, marginLeft: 2 },

  // steppers
  stepperGroup: { marginTop: ms(12), gap: ms(10) },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperLabel: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(13), color: colors.text },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: ms(10) },
  stepBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: ROSE_SOFT,
    borderWidth: 1,
    borderColor: ROSE_LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnOff: { opacity: 0.4 },
  stepValue: {
    minWidth: ms(64),
    textAlign: "center",
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
  },
  stepUnit: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(11), color: colors.textLight },
  stepHint: { fontFamily: "OpenSans_500Medium", fontSize: ms(11), color: colors.textLight },

  disclaimer: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    textAlign: "center",
    marginTop: ms(4),
  },

  // sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    maxHeight: "92%",
  },
  grabber: {
    alignSelf: "center",
    width: ms(40),
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: ms(12),
  },
  sheetTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(17), color: colors.text },
  sheetSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    marginTop: 4,
    marginBottom: ms(8),
  },
});
