import { scaling } from "@/constants/useScaling";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";

const SliderSelector = ({
  control,
  name,
  label = "Select Age",
  min = 10,
  max = 80,
  step = 1,
  defaultValue = 25,
  rules = {},
  units = "yrs",
}) => {
  Logger.log("default---Age--->" + defaultValue);
  const [value, setValue] = useState(defaultValue);
  const [previewValue, setPreviewValue] = useState(defaultValue);

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          {label && <Text style={styles.label}>{label}</Text>}

          <View style={styles.sliderRow}>
            <Text style={styles.valueText}>
              {previewValue || defaultValue}{" "}
            </Text>
            <Text style={styles.unitText}>{units}</Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={min}
            maximumValue={max}
            step={step}
            minimumTrackTintColor={colors?.primary || "#007AFF"}
            maximumTrackTintColor="#ccc"
            thumbTintColor={colors?.primary || "#007AFF"}
            value={value || defaultValue}
            onValueChange={(value) => setPreviewValue(value)}
            onSlidingComplete={(value) => {
              setValue(value);
              onChange(value);
            }}
          />

          {error && <Text style={styles.errorText}>{error.message}</Text>}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    fontFamily: "OpenSans_400Regular",
    marginBottom: 8,
    color: "#333",
  },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    marginBottom: 8,
  },
  valueText: {
    fontSize: scaling().moderateScale(26),
    fontFamily: "OpenSans_700Bold",
    color: "#000",
  },
  unitText: {
    fontSize: scaling().moderateScale(16),
    fontFamily: "OpenSans_400Regular",
    color: "#555",
    marginLeft: 4,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  errorText: {
    color: colors.errorRed,
    fontSize: 12,
    marginTop: 4,
  },
});

export default SliderSelector;
