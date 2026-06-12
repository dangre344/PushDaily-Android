import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { useWatch } from "react-hook-form";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Default reminder time per slot — mirrors getNotificationTime() in signup.
const SLOT_DEFAULTS = {
  Morning: { hour: 6, minute: 0 },
  Afternoon: { hour: 12, minute: 0 },
  Evening: { hour: 17, minute: 0 },
  Night: { hour: 20, minute: 0 },
};

const pad = (n) => String(n).padStart(2, "0");
const toHHMM = ({ hour, minute }) => `${pad(hour)}:${pad(minute)}`;
const parseHHMM = (s) => {
  const [h, m] = String(s || "")
    .split(":")
    .map((x) => parseInt(x, 10));
  if (Number.isFinite(h) && Number.isFinite(m)) return { hour: h, minute: m };
  return null;
};

/**
 * Lets the user pick a custom reminder time. Seeds the default from the
 * selected workout slot (Morning/Afternoon/Evening/Night) and updates the
 * `reminderTime` form field ("HH:mm", 24h) which signup uses for scheduling.
 */
export default function ReminderTimePicker({ form }) {
  const slot = useWatch({ control: form.control, name: "time" });
  const reminderTime = useWatch({ control: form.control, name: "reminderTime" });
  const prevSlotRef = useRef(undefined);

  // Seed on first mount (if empty) and reset whenever the slot actually changes.
  useEffect(() => {
    if (!slot) return;
    const def = SLOT_DEFAULTS[slot] || { hour: 18, minute: 0 };

    if (prevSlotRef.current === undefined) {
      if (!reminderTime) form.setValue("reminderTime", toHHMM(def));
    } else if (prevSlotRef.current !== slot) {
      form.setValue("reminderTime", toHHMM(def));
    }
    prevSlotRef.current = slot;
  }, [slot]);

  if (!slot) return null;

  const current =
    parseHHMM(reminderTime) || SLOT_DEFAULTS[slot] || { hour: 18, minute: 0 };
  const { hour, minute } = current;

  const setTime = (h, m) =>
    form.setValue("reminderTime", toHHMM({ hour: (h + 24) % 24, minute: m }), {
      shouldDirty: true,
    });

  const changeHour = (delta) => setTime((hour + delta + 24) % 24, minute);
  const changeMinute = (delta) => {
    let m = minute + delta;
    let h = hour;
    if (m >= 60) {
      m -= 60;
      h = (h + 1) % 24;
    } else if (m < 0) {
      m += 60;
      h = (h + 23) % 24;
    }
    setTime(h, m);
  };
  const toggleMeridiem = () => setTime((hour + 12) % 24, minute);

  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const meridiem = hour < 12 ? "AM" : "PM";

  const Stepper = ({ label, value, onUp, onDown }) => (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={styles.stepBtn}
        onPress={onUp}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-up" size={ms(18)} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.valueBox}>
        <Text style={styles.valueText}>{value}</Text>
      </View>

      <TouchableOpacity
        style={styles.stepBtn}
        onPress={onDown}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={ms(18)} color={colors.primary} />
      </TouchableOpacity>

      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="alarm-outline" size={ms(16)} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reminder time</Text>
          <Text style={styles.subtitle}>
            We&apos;ll nudge you 15 minutes before.
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Stepper
          label="Hour"
          value={pad(hour12)}
          onUp={() => changeHour(1)}
          onDown={() => changeHour(-1)}
        />

        <Text style={styles.colon}>:</Text>

        <Stepper
          label="Min"
          value={pad(minute)}
          onUp={() => changeMinute(5)}
          onDown={() => changeMinute(-5)}
        />

        <TouchableOpacity
          style={styles.meridiem}
          onPress={toggleMeridiem}
          activeOpacity={0.8}
        >
          <Text style={styles.meridiemText}>{meridiem}</Text>
          <Ionicons name="swap-vertical" size={ms(14)} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: ms(12),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: colors.grey,
    padding: ms(12),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginBottom: ms(10),
  },
  headerIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(10),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(15),
    color: colors.text,
  },
  subtitle: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(2),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(10),
  },
  stepper: {
    alignItems: "center",
  },
  stepBtn: {
    width: ms(46),
    height: ms(30),
    borderRadius: ms(10),
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  valueBox: {
    width: ms(56),
    height: ms(46),
    borderRadius: ms(12),
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: ms(6),
  },
  valueText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(24),
    color: colors.text,
  },
  stepLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10),
    color: colors.textLight,
    marginTop: ms(4),
  },
  colon: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(24),
    color: colors.text,
    marginBottom: ms(18),
  },
  meridiem: {
    marginLeft: ms(6),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    borderRadius: ms(12),
    backgroundColor: colors.primary + "12",
    borderWidth: 1,
    borderColor: colors.primary + "33",
    alignItems: "center",
    gap: ms(2),
    marginBottom: ms(18),
  },
  meridiemText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: colors.primary,
  },
});
