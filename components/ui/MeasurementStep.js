import { colors } from "@/constants/colors";
import Slider from "@react-native-community/slider";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { scaling } from "../../constants/useScaling";

const { scaleHeight, scaleWidth } = scaling();

const roundToOne = (value) => Math.round(Number(value) * 10) / 10;

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

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

const ftInToCm = (feet, inches) => {
  return roundToOne((Number(feet) * 12 + Number(inches)) * 2.54);
};

const kgToLbs = (kg) => roundToOne(Number(kg) * 2.20462);
const lbsToKg = (lbs) => roundToOne(Number(lbs) / 2.20462);

function UnitToggle({ options, selected, onChange }) {
  return (
    <View style={styles.toggleContainer}>
      {options.map((item) => {
        const active = selected === item.value;

        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[styles.toggleButton, active && styles.toggleButtonActive]}
          >
            <Text
              style={[styles.toggleText, active && styles.toggleTextActive]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepperButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.stepperButton}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

function MeasurementCard({
  title,
  unit,
  unitOptions,
  value,
  min,
  max,
  step = 1,
  displayValue,
  helperText,
  onUnitChange,
  onChange,
}) {
  const decrease = () => {
    const nextValue = clamp(roundToOne(value - step), min, max);
    onChange(nextValue);
  };

  const increase = () => {
    const nextValue = clamp(roundToOne(value + step), min, max);
    onChange(nextValue);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>

        <UnitToggle
          options={unitOptions}
          selected={unit}
          onChange={onUnitChange}
        />
      </View>

      <Text style={styles.mainValue}>{displayValue}</Text>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <View style={styles.sliderRow}>
        <StepperButton label="−" onPress={decrease} />

        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={0} // continuous drag = smooth; we round the value on change
          value={value}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor={colors.primary}
          tapToSeek
          onValueChange={(nextValue) => {
            onChange(Math.round(nextValue));
          }}
        />

        <StepperButton label="+" onPress={increase} />
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  );
}

export default function MeasurementsStep({
  form,
  minHeight = 120,
  maxHeight = 240,
  unitHeight = "cm",
  minWeight = 30,
  maxWeight = 170,
  unitWeight = "kg",
  selectedWeight,
  selectedHeight,
}) {
  const DEFAULT_HEIGHT_CM = 140;
  const DEFAULT_WEIGHT_KG = 65;

  const initialHeightCm = clamp(
    toNumber(selectedHeight || form.getValues("height"), DEFAULT_HEIGHT_CM),
    minHeight,
    maxHeight,
  );

  const initialWeightKg = clamp(
    toNumber(selectedWeight || form.getValues("weight"), DEFAULT_WEIGHT_KG),
    minWeight,
    maxWeight,
  );

  const [heightCm, setHeightCm] = useState(initialHeightCm);
  const [weightKg, setWeightKg] = useState(initialWeightKg);

  const [heightUnit, setHeightUnit] = useState(
    String(unitHeight).toLowerCase() === "ftin" ? "ftin" : "cm",
  );

  const [weightUnit, setWeightUnit] = useState(
    String(unitWeight).toLowerCase() === "lbs" ? "lbs" : "kg",
  );

  const saveHeightValues = (nextCm) => {
    const safeCm = clamp(roundToOne(nextCm), minHeight, maxHeight);
    const { feet, inches } = cmToFtIn(safeCm);

    setHeightCm(safeCm);

    form.setValue("height", safeCm, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("heightFeet", feet, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("heightInches", inches, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const saveWeightValues = (nextKg) => {
    const safeKg = clamp(roundToOne(nextKg), minWeight, maxWeight);
    const lbs = kgToLbs(safeKg);

    setWeightKg(safeKg);

    form.setValue("weight", safeKg, {
      shouldValidate: true,
      shouldDirty: true,
    });

    form.setValue("weightLbs", lbs, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  useEffect(() => {
    const currentHeight = toNumber(form.getValues("height"), initialHeightCm);
    const currentWeight = toNumber(form.getValues("weight"), initialWeightKg);

    const heightFromEdit = clamp(currentHeight, minHeight, maxHeight);
    const weightFromEdit = clamp(currentWeight, minWeight, maxWeight);

    const heightFtIn = cmToFtIn(heightFromEdit);
    const weightLbs = kgToLbs(weightFromEdit);

    setHeightCm(heightFromEdit);
    setWeightKg(weightFromEdit);

    form.setValue("height", heightFromEdit, {
      shouldValidate: true,
      shouldDirty: false,
    });

    form.setValue("heightFeet", heightFtIn.feet, {
      shouldValidate: true,
      shouldDirty: false,
    });

    form.setValue("heightInches", heightFtIn.inches, {
      shouldValidate: true,
      shouldDirty: false,
    });

    form.setValue("weight", weightFromEdit, {
      shouldValidate: true,
      shouldDirty: false,
    });

    form.setValue("weightLbs", weightLbs, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, []);

  const heightFtIn = useMemo(() => cmToFtIn(heightCm), [heightCm]);
  const weightLbs = useMemo(() => kgToLbs(weightKg), [weightKg]);

  const heightDisplay =
    heightUnit === "cm"
      ? `${heightCm} cm`
      : `${heightFtIn.feet} ft ${heightFtIn.inches} in`;

  const heightHelper =
    heightUnit === "cm"
      ? `${heightFtIn.feet} ft ${heightFtIn.inches} in`
      : `${heightCm} cm`;

  const weightDisplay =
    weightUnit === "kg" ? `${weightKg} kg` : `${weightLbs} lbs`;

  const weightHelper =
    weightUnit === "kg" ? `${weightLbs} lbs` : `${weightKg} kg`;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Your Measurements</Text>
      <Text style={styles.stepSubtitle}>
        Select your height and weight. We save both units automatically.
      </Text>

      <MeasurementCard
        title="Height"
        unit={heightUnit}
        unitOptions={[
          { label: "CM", value: "cm" },
          { label: "FT/IN", value: "ftin" },
        ]}
        value={heightCm}
        min={minHeight}
        max={maxHeight}
        step={1}
        displayValue={heightDisplay}
        helperText={heightHelper}
        onUnitChange={setHeightUnit}
        onChange={saveHeightValues}
      />

      <MeasurementCard
        title="Weight"
        unit={weightUnit}
        unitOptions={[
          { label: "KG", value: "kg" },
          { label: "LBS", value: "lbs" },
        ]}
        value={weightKg}
        min={minWeight}
        max={maxWeight}
        step={1}
        displayValue={weightDisplay}
        helperText={weightHelper}
        onUnitChange={setWeightUnit}
        onChange={saveWeightValues}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 5,
    gap: 18,
    paddingBottom: 30,
  },

  stepTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  stepSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginBottom: 6,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 18,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },

  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 4,
  },

  toggleButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },

  toggleButtonActive: {
    backgroundColor: colors.primary,
  },

  toggleText: {
    fontSize: 12,
    fontFamily: "OpenSans_700Bold",
    color: colors.textLight,
  },

  toggleTextActive: {
    color: "#FFFFFF",
  },

  mainValue: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 42,
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.primary,
  },

  helperText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
    marginTop: 4,
  },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    gap: 12,
  },

  slider: {
    flex: 1,
    height: 56,
    marginHorizontal: 4,
  },

  stepperButton: {
    width: scaleWidth(42),
    height: scaleHeight(42),
    borderRadius: 999,
    backgroundColor: colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },

  stepperText: {
    fontSize: 26,
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    lineHeight: 28,
  },

  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },

  rangeText: {
    fontSize: 12,
    color: colors.textLight,
    fontFamily: "OpenSans_400Regular",
  },
});
