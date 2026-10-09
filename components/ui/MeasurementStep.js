import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { scaling } from "../../constants/useScaling";
import RulerCard from "./RulerCard";

const ms = (n) => scaling().moderateScale(n);

// ── Unit maths — unchanged from the previous version, so saved data matches ──
const roundToOne = (value) => Math.round(Number(value) * 10) / 10;

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const cmToFtIn = (cm) => {
  const totalInches = Number(cm) / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
};

const kgToLbs = (kg) => roundToOne(Number(kg) * 2.20462);

// Module-level so its identity is stable: a fresh function each render would
// invalidate the ruler's renderItem on every notch while dragging.
const footLabel = (inches) => `${inches / 12}′`;
const lbsToKg = (lbs) => roundToOne(Number(lbs) / 2.20462);

/**
 * Starting point when nothing has been saved yet.
 *
 * The old default was 140 cm / 65 kg for everyone — 140 cm is 4′7″, which is
 * implausible for almost any adult, and since it was one tap from being
 * saved, it was. Starting near a typical adult for the selected gender means
 * someone who barely nudges the ruler still lands close to the truth, and the
 * "Typical value · set yours" chip makes it clear it isn't theirs yet.
 */
const SUGGESTED = {
  Male: { height: 170, weight: 70 },
  Female: { height: 157, weight: 57 },
  default: { height: 164, weight: 64 },
};

const bmiInfo = (kg, cm) => {
  const m = cm / 100;
  if (!m) return null;
  const bmi = kg / (m * m);
  if (bmi < 18.5) return { bmi, label: "Below the typical range", color: "#2563EB", bg: "#EFF6FF" };
  if (bmi < 25) return { bmi, label: "In the healthy range", color: "#047857", bg: "#ECFDF5" };
  if (bmi < 30) return { bmi, label: "Above the typical range", color: "#B45309", bg: "#FFFBEB" };
  return { bmi, label: "Well above the typical range", color: "#C2410C", bg: "#FFF7ED" };
};

/**
 * @param ui        a ref owned by the signup screen that survives this step
 *                  unmounting (going Back/Continue): which values the user has
 *                  actually touched, and which units they chose.
 * @param hasSaved  true when editing a profile that already has measurements —
 *                  never overwrite those with a suggestion.
 */
export default function MeasurementsStep({
  form,
  ui,
  hasSaved = false,
  minHeight = 120,
  maxHeight = 240,
  minWeight = 30,
  maxWeight = 170,
}) {
  const state = ui?.current ?? {};

  const initial = useMemo(() => {
    const gender = form.getValues("gender");
    const s = SUGGESTED[gender] ?? SUGGESTED.default;
    // Suggest only until the user has touched the value — then it's theirs.
    const useSuggestion = !hasSaved;
    const h = useSuggestion && !state.heightTouched ? s.height : form.getValues("height");
    const w = useSuggestion && !state.weightTouched ? s.weight : form.getValues("weight");
    return {
      height: clamp(toNumber(h, s.height), minHeight, maxHeight),
      weight: clamp(toNumber(w, s.weight), minWeight, maxWeight),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [heightCm, setHeightCm] = useState(initial.height);
  const [weightKg, setWeightKg] = useState(initial.weight);
  const [heightUnit, setHeightUnitState] = useState(state.heightUnit || "cm");
  const [weightUnit, setWeightUnitState] = useState(state.weightUnit || "kg");
  const [heightTouched, setHeightTouched] = useState(!!state.heightTouched);
  const [weightTouched, setWeightTouched] = useState(!!state.weightTouched);

  const remember = (patch) => {
    if (ui) ui.current = { ...ui.current, ...patch };
  };

  // Writes exactly the same five fields, with the same rounding, as before.
  const commitHeight = (cm, validate) => {
    const safeCm = clamp(roundToOne(cm), minHeight, maxHeight);
    const { feet, inches } = cmToFtIn(safeCm);
    setHeightCm(safeCm);
    // While dragging: write the value, skip validation (it runs per notch
    // otherwise). Validate once the ruler settles.
    const opts = validate ? { shouldValidate: true, shouldDirty: true } : undefined;
    form.setValue("height", safeCm, opts);
    form.setValue("heightFeet", feet, opts);
    form.setValue("heightInches", inches, opts);
  };

  const commitWeight = (kg, validate) => {
    const safeKg = clamp(roundToOne(kg), minWeight, maxWeight);
    setWeightKg(safeKg);
    const opts = validate ? { shouldValidate: true, shouldDirty: true } : undefined;
    form.setValue("weight", safeKg, opts);
    form.setValue("weightLbs", kgToLbs(safeKg), opts);
  };

  // Seed the form on mount — including the suggestion, if one applies.
  useEffect(() => {
    const ftIn = cmToFtIn(initial.height);
    const quiet = { shouldValidate: true, shouldDirty: false };
    form.setValue("height", initial.height, quiet);
    form.setValue("heightFeet", ftIn.feet, quiet);
    form.setValue("heightInches", ftIn.inches, quiet);
    form.setValue("weight", initial.weight, quiet);
    form.setValue("weightLbs", kgToLbs(initial.weight), quiet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touchHeight = () => {
    if (!heightTouched) {
      setHeightTouched(true);
      remember({ heightTouched: true });
    }
  };
  const touchWeight = () => {
    if (!weightTouched) {
      setWeightTouched(true);
      remember({ weightTouched: true });
    }
  };

  const setHeightUnit = (u) => {
    setHeightUnitState(u);
    remember({ heightUnit: u });
  };
  const setWeightUnit = (u) => {
    setWeightUnitState(u);
    remember({ weightUnit: u });
  };

  // ── Height ruler, in whichever unit is showing ──
  const isCm = heightUnit === "cm";
  const inMin = Math.ceil(minHeight / 2.54);
  const inMax = Math.floor(maxHeight / 2.54);
  const totalIn = Math.round(heightCm / 2.54);
  const ftIn = cmToFtIn(heightCm);

  const heightRuler = isCm
    ? {
        min: minHeight,
        max: maxHeight,
        value: Math.round(heightCm),
        toCm: (v) => v,
        majorEvery: 10,
        labelFor: undefined,
        display: `${Math.round(heightCm)} cm`,
        secondary: `${ftIn.feet} ft ${ftIn.inches} in`,
      }
    : {
        min: inMin,
        max: inMax,
        value: clamp(totalIn, inMin, inMax),
        toCm: (v) => v * 2.54,
        majorEvery: 12, // a major notch per foot
        labelFor: footLabel,
        display: `${ftIn.feet} ft ${ftIn.inches} in`,
        secondary: `${Math.round(heightCm)} cm`,
      };

  // ── Weight ruler ──
  const isKg = weightUnit === "kg";
  const lbMin = Math.floor(minWeight * 2.20462);
  const lbMax = Math.floor(maxWeight * 2.20462);
  const lbs = Math.round(kgToLbs(weightKg));

  const weightRuler = isKg
    ? {
        min: minWeight,
        max: maxWeight,
        value: Math.round(weightKg),
        toKg: (v) => v,
        display: `${Math.round(weightKg)} kg`,
        secondary: `${lbs} lbs`,
      }
    : {
        min: lbMin,
        max: lbMax,
        value: clamp(lbs, lbMin, lbMax),
        toKg: (v) => lbsToKg(v),
        display: `${lbs} lbs`,
        secondary: `${Math.round(weightKg)} kg`,
      };

  const status = (touched) => (touched ? "set" : hasSaved ? "saved" : "suggested");
  const bmi = bmiInfo(weightKg, heightCm);

  return (
    <View style={styles.container}>
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 280 }}
      >
        <Text style={styles.stepTitle}>Your measurements</Text>
        <Text style={styles.stepSubtitle}>
          Drag the ruler, tap ± or tap the number to type it.
        </Text>
      </MotiView>

      <RulerCard
        index={0}
        title="Height"
        icon="resize-outline"
        unitOptions={[
          { label: "CM", value: "cm" },
          { label: "FT/IN", value: "ftin" },
        ]}
        unit={heightUnit}
        onUnitChange={setHeightUnit}
        min={heightRuler.min}
        max={heightRuler.max}
        value={heightRuler.value}
        majorEvery={heightRuler.majorEvery}
        labelFor={heightRuler.labelFor}
        display={heightRuler.display}
        secondary={heightRuler.secondary}
        typeable={isCm}
        typeSuffix="cm"
        status={status(heightTouched)}
        onInteract={touchHeight}
        onChange={(v) => commitHeight(heightRuler.toCm(v), false)}
        onSettle={(v) => commitHeight(heightRuler.toCm(v), true)}
      />

      <RulerCard
        index={1}
        title="Weight"
        icon="barbell-outline"
        unitOptions={[
          { label: "KG", value: "kg" },
          { label: "LBS", value: "lbs" },
        ]}
        unit={weightUnit}
        onUnitChange={setWeightUnit}
        min={weightRuler.min}
        max={weightRuler.max}
        value={weightRuler.value}
        display={weightRuler.display}
        secondary={weightRuler.secondary}
        typeSuffix={isKg ? "kg" : "lbs"}
        status={status(weightTouched)}
        onInteract={touchWeight}
        onChange={(v) => commitWeight(weightRuler.toKg(v), false)}
        onSettle={(v) => commitWeight(weightRuler.toKg(v), true)}
      />

      {bmi ? (
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0, backgroundColor: bmi.bg }}
          transition={{ type: "timing", duration: 300, delay: 240 }}
          style={styles.bmiCard}
        >
          <View>
            <Text style={styles.bmiLabel}>Your BMI</Text>
            <Text style={[styles.bmiValue, { color: bmi.color }]}>
              {bmi.bmi.toFixed(1)}
            </Text>
          </View>
          <Text style={[styles.bmiNote, { color: bmi.color }]}>{bmi.label}</Text>
        </MotiView>
      ) : null}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={ms(15)} color={colors.primary} />
        <Text style={styles.noteText}>
          Accurate values give you accurate calorie burn and daily water targets.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 24 },

  stepTitle: {
    fontSize: ms(24),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: ms(13.5),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 4,
    lineHeight: ms(19),
  },

  bmiCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bmiLabel: {
    fontSize: ms(11.5),
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
    letterSpacing: 0.4,
  },
  bmiValue: {
    fontSize: ms(24),
    fontFamily: "OpenSans_800ExtraBold",
    fontVariant: ["tabular-nums"],
  },
  bmiNote: {
    flexShrink: 1,
    marginLeft: 12,
    textAlign: "right",
    fontSize: ms(13),
    fontFamily: "OpenSans_700Bold",
  },

  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontSize: ms(12),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    lineHeight: ms(17),
  },
});
