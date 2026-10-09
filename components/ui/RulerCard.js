import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../../constants/colors";
import { selectionHaptic, tapHaptic, warningHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";
import RulerPicker from "./RulerPicker";

const ms = (n) => scaling().moderateScale(n);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const UNIT_W = ms(54);

/** Two-option pill with a sliding highlight. */
function UnitToggle({ options, selected, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.value === selected));
  return (
    <View style={styles.toggle}>
      <MotiView
        style={[styles.toggleThumb, { width: UNIT_W }]}
        animate={{ translateX: index * UNIT_W }}
        transition={{ type: "spring", damping: 18, stiffness: 220 }}
      />
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => {
            if (o.value === selected) return;
            tapHaptic();
            onChange(o.value);
          }}
          style={[styles.toggleBtn, { width: UNIT_W }]}
          hitSlop={6}
        >
          <Text
            style={[styles.toggleText, o.value === selected && styles.toggleTextOn]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Round ± button. Tap = one step, hold = keeps stepping, accelerating. */
function Stepper({ icon, onStep, disabled }) {
  const timer = useRef(null);
  const ticks = useRef(0);
  const scale = useRef(new Animated.Value(1)).current;

  // The repeat loop runs from setTimeout, so it must call the LATEST onStep —
  // the one from the first render would keep stepping from a stale value.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const stop = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  const repeat = () => {
    ticks.current += 1;
    // onStep returns false at a bound: stop rather than spin forever.
    if (onStepRef.current() === false) return stop();
    selectionHaptic();
    const delay = ticks.current < 6 ? 140 : ticks.current < 18 ? 70 : 35;
    timer.current = setTimeout(repeat, delay);
  };

  useEffect(() => stop, []);

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        ticks.current = 0;
        Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40 }).start();
      }}
      onPressOut={() => {
        stop();
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
      }}
      // Pressable never fires onPress after onLongPress, so the two can't double up.
      onPress={() => {
        tapHaptic();
        onStepRef.current();
      }}
      onLongPress={repeat}
      delayLongPress={320}
      hitSlop={8}
    >
      <Animated.View
        style={[
          styles.stepper,
          disabled && styles.stepperDisabled,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={icon}
          size={ms(20)}
          color={disabled ? "#B9C0CA" : colors.primary}
        />
      </Animated.View>
    </Pressable>
  );
}

const STATUS = {
  suggested: { icon: "sparkles", color: "#B45309", bg: "#FEF3C7", text: "Typical value · set yours" },
  set: { icon: "checkmark-circle", color: "#047857", bg: "#D1FAE5", text: "Set" },
  saved: { icon: "checkmark-circle", color: "#047857", bg: "#D1FAE5", text: "Saved" },
};

function StatusChip({ status }) {
  const s = STATUS[status];
  const pulse = useRef(new Animated.Value(1)).current;

  // A slow pulse on "suggested" only — the one state that needs attention.
  useEffect(() => {
    if (status !== "suggested") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  if (!s) return null;
  return (
    <MotiView
      key={status}
      from={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 14 }}
      style={[styles.chip, { backgroundColor: s.bg }]}
    >
      {status === "suggested" ? (
        <Animated.View style={[styles.chipDot, { backgroundColor: s.color, opacity: pulse }]} />
      ) : (
        <Ionicons name={s.icon} size={ms(13)} color={s.color} />
      )}
      <Text style={[styles.chipText, { color: s.color }]}>{s.text}</Text>
    </MotiView>
  );
}

/**
 * A measurement card: title + unit switch, a big value you can tap to type,
 * ± steppers, and a snapping ruler underneath.
 *
 * Purely presentational — the parent owns the value and decides what to save.
 */
export default function RulerCard({
  title,
  icon,
  value,
  min,
  max,
  onChange,
  onSettle,
  display,
  secondary,
  unitOptions,
  unit,
  onUnitChange,
  majorEvery = 10,
  labelFor,
  status,
  typeable = true,
  typeSuffix,
  onInteract,
  index = 0,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const shake = useRef(new Animated.Value(0)).current;

  const draftNum = Number(draft);
  const draftValid = draft !== "" && Number.isFinite(draftNum) && draftNum >= min && draftNum <= max;

  // Returns false when already at a bound, which ends a held ± press.
  const step = (d) => {
    onInteract?.();
    const next = clamp(value + d, min, max);
    if (next === value) return false;
    onChange(next);
    onSettle?.(next);
    return true;
  };

  const startEdit = () => {
    if (!typeable) return;
    tapHaptic();
    onInteract?.();
    setDraft(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    if (draftValid) {
      const v = Math.round(draftNum);
      onChange(v);
      onSettle?.(v);
      setEditing(false);
      return;
    }
    if (draft === "") {
      setEditing(false); // nothing typed — keep the old value
      return;
    }
    // Out of range: shake, keep the field open so they can fix it.
    warningHaptic();
    Animated.sequence(
      [10, -10, 7, -7, 0].map((x) =>
        Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: true }),
      ),
    ).start();
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 320, delay: 60 + index * 90 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.iconWrap}>
              <Ionicons name={icon} size={ms(16)} color={colors.primary} />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        {unitOptions ? (
          <UnitToggle options={unitOptions} selected={unit} onChange={onUnitChange} />
        ) : null}
      </View>

      <View style={styles.valueRow}>
        <Stepper icon="remove" onStep={() => step(-1)} disabled={value <= min} />

        <View style={styles.valueCol}>
          {editing ? (
            <Animated.View style={[styles.editRow, { transform: [{ translateX: shake }] }]}>
              <TextInput
                value={draft}
                onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, "").slice(0, 3))}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
                returnKeyType="done"
                style={[styles.editInput, !draftValid && draft !== "" && styles.editInputBad]}
                maxLength={3}
              />
              {typeSuffix ? <Text style={styles.editSuffix}>{typeSuffix}</Text> : null}
            </Animated.View>
          ) : (
            <Pressable onPress={startEdit} hitSlop={10} style={styles.valuePress}>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {display}
              </Text>
              {typeable ? (
                <Ionicons name="pencil" size={ms(13)} color="#B9C0CA" style={styles.pencil} />
              ) : null}
            </Pressable>
          )}

          <Text
            style={[styles.secondary, editing && !draftValid && draft !== "" && styles.secondaryBad]}
          >
            {editing
              ? draftValid || draft === ""
                ? `Enter ${min}–${max}`
                : `Must be between ${min} and ${max}`
              : secondary}
          </Text>
        </View>

        <Stepper icon="add" onStep={() => step(1)} disabled={value >= max} />
      </View>

      <RulerPicker
        // A unit switch changes the whole range (cm 120–240 → in 48–94);
        // remount and re-centre instead of animating across unrelated scales.
        key={unit ?? "single"}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        onSettle={onSettle}
        majorEvery={majorEvery}
        labelFor={labelFor}
        onInteract={() => {
          if (editing) setEditing(false);
          onInteract?.();
        }}
      />

      {status ? (
        <View style={styles.chipRow}>
          <StatusChip status={status} />
        </View>
      ) : null}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#1F2937",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(10),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: ms(16), fontFamily: "OpenSans_700Bold", color: colors.text },

  toggle: {
    flexDirection: "row",
    backgroundColor: "#F1F3F6",
    borderRadius: 999,
    padding: 3,
  },
  toggleThumb: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  toggleBtn: { paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  toggleText: { fontSize: ms(11.5), fontFamily: "OpenSans_700Bold", color: colors.textLight },
  toggleTextOn: { color: "#FFFFFF" },

  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  valueCol: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  valuePress: { flexDirection: "row", alignItems: "center" },
  value: {
    fontSize: ms(38),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    letterSpacing: -1,
    // digits stay the same width, so the number doesn't jitter while dragging
    fontVariant: ["tabular-nums"],
  },
  pencil: { marginLeft: 6, marginTop: 6 },
  secondary: {
    marginTop: 2,
    fontSize: ms(12.5),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },
  secondaryBad: { color: colors.error },

  editRow: { flexDirection: "row", alignItems: "baseline" },
  editInput: {
    minWidth: ms(92),
    textAlign: "center",
    fontSize: ms(34),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingVertical: 0,
  },
  editInputBad: { borderBottomColor: colors.error, color: colors.error },
  editSuffix: {
    marginLeft: 6,
    fontSize: ms(16),
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
  },

  stepper: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperDisabled: { backgroundColor: "#F1F3F6" },

  chipRow: { alignItems: "center", marginTop: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipDot: { width: ms(7), height: ms(7), borderRadius: ms(4) },
  chipText: { fontSize: ms(11.5), fontFamily: "OpenSans_700Bold" },
});
