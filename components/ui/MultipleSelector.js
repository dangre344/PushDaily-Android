import { Ionicons } from "@expo/vector-icons";
import { MotiText, MotiView } from "moti";
import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Encouragement keyed to how many days are picked — guidance, not a rule.
const hintFor = (n) => {
  if (n === 0) return { text: "Pick at least one day to start", icon: "hand-left-outline", color: colors.textLight };
  if (n <= 2) return { text: "A great start — consistency beats intensity", icon: "leaf-outline", color: "#047857" };
  if (n <= 5) return { text: "Ideal for steady progress", icon: "trending-up", color: "#047857" };
  return { text: "Strong! Keep one light day to recover", icon: "bed-outline", color: "#B45309" };
};

function DayChip({ label, selected, onPress, index }) {
  const scale = useRef(new Animated.Value(1)).current;
  const was = useRef(selected);

  useEffect(() => {
    if (selected !== was.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: selected ? 1.12 : 0.92, useNativeDriver: true, speed: 50, bounciness: 0 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    was.current = selected;
  }, [selected, scale]);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 260, delay: 40 + index * 40 }}
      style={styles.chipCell}
    >
      <Pressable onPress={onPress} hitSlop={4}>
        <Animated.View
          style={[styles.chip, selected && styles.chipOn, { transform: [{ scale }] }]}
        >
          <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </MotiView>
  );
}

/**
 * Multi-select for workout days. Stores the same array of option strings as
 * before; only the presentation changed.
 */
const MultipleSelector = ({ form, name, options, defaultValues = [], rules = {} }) => {
  const { t } = useTranslation();

  return (
    <Controller
      control={form.control}
      name={name}
      rules={rules}
      defaultValue={defaultValues}
      render={({ field: { value, onChange } }) => {
        const raw = Array.isArray(value) ? value : [];
        // Displayed/counted: only days that match the current options. Writes
        // still go through `raw`, exactly as before, so nothing already saved
        // (e.g. days stored under the other language) is silently dropped.
        const selected = raw.filter((d) => options.includes(d));

        const toggle = (day) => {
          tapHaptic();
          onChange(raw.includes(day) ? raw.filter((d) => d !== day) : [...raw, day]);
        };

        const allSelected = options.every((d) => raw.includes(d));
        const toggleAll = () => {
          tapHaptic();
          // keep the canonical Mon→Sun order when selecting all
          onChange(allSelected ? [] : [...options]);
        };

        const hint = hintFor(selected.length);

        return (
          <View>
            <View style={styles.summaryRow}>
              <View style={styles.countWrap}>
                <MotiText
                  key={selected.length}
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: "timing", duration: 200 }}
                  style={styles.count}
                >
                  {selected.length}
                </MotiText>
                <Text style={styles.countLabel}>
                  {selected.length === 1 ? "day / week" : "days / week"}
                </Text>
              </View>

              <Pressable onPress={toggleAll} style={[styles.allBtn, allSelected && styles.allBtnOn]} hitSlop={6}>
                <Ionicons
                  name={allSelected ? "close-circle" : "checkmark-done"}
                  size={ms(14)}
                  color={allSelected ? colors.textLight : colors.primary}
                />
                <Text style={[styles.allText, allSelected && styles.allTextOn]}>
                  {allSelected ? "Clear all" : "Every day"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.row}>
              {options.map((day, i) => (
                <DayChip
                  key={day}
                  index={i}
                  label={t(day)}
                  selected={selected.includes(day)}
                  onPress={() => toggle(day)}
                />
              ))}
            </View>

            <MotiView
              key={hint.text}
              from={{ opacity: 0, translateY: 4 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 220 }}
              style={styles.hint}
            >
              <Ionicons name={hint.icon} size={ms(15)} color={hint.color} />
              <Text style={[styles.hintText, { color: hint.color }]}>{hint.text}</Text>
            </MotiView>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 14,
  },
  countWrap: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  count: {
    fontSize: ms(30),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  countLabel: { fontSize: ms(13), fontFamily: "OpenSans_600SemiBold", color: colors.textLight },

  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primary + "12",
  },
  allBtnOn: { backgroundColor: "#F1F3F6" },
  allText: { fontSize: ms(12), fontFamily: "OpenSans_700Bold", color: colors.primary },
  allTextOn: { color: colors.textLight },

  row: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: -3 },
  chipCell: { flex: 1, paddingHorizontal: 3 },
  chip: {
    height: ms(52),
    borderRadius: ms(16),
    borderWidth: 1.5,
    borderColor: "#E7EAEF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: ms(12), fontFamily: "OpenSans_700Bold", color: colors.text },
  chipTextOn: { color: "#FFFFFF" },

  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F7F8FA",
  },
  hintText: { flex: 1, fontSize: ms(12.5), fontFamily: "OpenSans_600SemiBold" },
});

export default MultipleSelector;
