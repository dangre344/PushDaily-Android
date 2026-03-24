import { Logger } from "@/constants/Logger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { HeightMeasure, WeightImg } from "../../assets/AllSvgs";
import RulerPickerField from "../../components/ui/RulerPickerField";
import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";

const { scaleHeight, scaleWidth, moderateScale } = scaling();

const MeasurementsStep = ({ form, selectedWeight, selectedHeight }) => {
  Logger.log("selectedHeight---->" + selectedHeight);
  Logger.log("selectedHeight---->" + selectedHeight);
  const { t } = useTranslation();
  const [heightCm, setHeightCm] = useState(form.getValues("height") || 140);
  const [weightKg, setWeightKg] = useState(form.getValues("weight") || 65);

  Logger.log("heightCm--->" + form.getValues("height"));

  Logger.log("heightCm--->" + heightCm);
  Logger.log("weightKg--->" + weightKg);

  const cmToFeetInches = (cm) => {
    const inchesTotal = cm / 2.54;
    const feet = Math.floor(inchesTotal / 12);
    const inches = Math.round(inchesTotal % 12);
    return `${feet}ft ${inches}in`;
  };

  const kgToLbs = (kg) => (kg * 2.20462).toFixed(1);

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>{t("yourMeasurement")}</Text>
      <Text style={styles.stepSubtitle}>{t("yourMeasurementSub")}</Text>

      {/* HEIGHT SELECTOR */}
      <Text style={styles.title}>{t("selectYourHeight")}</Text>

      <View
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          gap: 10,
          backgroundColor: colors.primary + 10,
          paddingHorizontal: 20,
          marginVertical: 10,
          borderRadius: 10,
          alignSelf: "center",
          color: colors.primary,
        }}
      >
        <HeightMeasure
          width={scaleWidth(20)}
          height={scaleHeight(20)}
          color={colors.primary}
        />
        <Text style={styles.altText}>{cmToFeetInches(heightCm)}</Text>
      </View>

      <View style={styles.row}>
        {/* <View style={{ flex: 0.3 }}>
          <HeightMeasure
            width={scaleWidth(100)}
            height={scaleHeight(160)}
            color={colors.primary}
          />
        </View> */}

        <View style={styles.rulerWrapper}>
          <RulerPickerField
            form={form}
            name="height"
            defaultValue={form.getValues("height")}
            min={100}
            max={250}
            initialValue={140}
            step={0.1}
            unit="cm"
            onSelected={(value) => {
              setHeightCm(value);
            }}
            height={scaleHeight(200)}
            indicatorColor={colors.primary}
            rulerLineColor={colors.primary}
            rulerBackgroundColor="#f9f9f9"
            valueTextStyle={styles.valueText}
            unitTextStyle={styles.unitText}
          />

          {/* <RulerPicker
            value={heightCm}
            min={100}
            max={250}
            initialValue={140}
            step={1}
            unit="cm"
            onValueChangeEnd={(value) => setHeightCm(value)}
            indicatorColor={colors.primary}
            rulerLineColor={colors.primary}
            rulerBackgroundColor="#f9f9f9"
            valueTextStyle={styles.valueText}
            unitTextStyle={styles.unitText}
            height={scaleHeight(200)}
            vertical 
          /> */}
        </View>
      </View>

      {/* WEIGHT SELECTOR */}
      <View style={styles.weightContainer}>
        <Text style={styles.title}>{t("selectYourWeight")}</Text>

        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
            backgroundColor: colors.primary + 10,
            paddingHorizontal: 20,
            marginVertical: 10,
            borderRadius: 10,
            alignSelf: "center",
            color: colors.primary,
          }}
        >
          <WeightImg
            width={scaleWidth(20)}
            height={scaleHeight(20)}
            color={colors.primary}
          />
          <Text style={styles.altText}>{kgToLbs(weightKg)} lbs</Text>
        </View>

        <View style={styles.rulerWrapper}>
          <RulerPickerField
            form={form}
            name="weight"
            min={30}
            defaultValue={selectedWeight ?? 65}
            max={150}
            step={0.1}
            unit="kg"
            onSelected={(value) => {
              setWeightKg(value);
            }}
            indicatorColor={colors.primary}
            unitTextStyle={styles.unitText}
            valueTextStyle={styles.valueText}
            rulerLineColor={colors.primary}
            rulerBackgroundColor="#f5f5f5"
            height={scaleHeight(200)}
            horizontal
          />
        </View>

        {/* <RulerPicker
          value={weightKg}
          min={30}
          max={150}
          step={0.5}
          unit="kg"
          onValueChangeEnd={(number) => setWeightKg(number)}
          indicatorColor={colors.primary}
          unitTextStyle={styles.unitText}
          valueTextStyle={styles.valueText}
          rulerLineColor={colors.primary}
          rulerBackgroundColor="#f5f5f5"
          height={220}
          horizontal
        /> */}
      </View>
    </View>
  );
};

export default MeasurementsStep;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 5,
  },

  title: {
    fontSize: 16,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
    marginBottom: 20,
  },
  heightContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  personImage: {
    width: 80,
    height: 300,
    marginRight: 10,
  },

  row: {
    flexDirection: "row",
  },

  rulerWrapper: {
    flex: 1,
    alignItems: "center",
  },
  valueText: {
    fontSize: 22,
    fontFamily: "OpenSans_400Regular",
    color: colors.primary,
  },
  unitText: {
    fontSize: 14,
    color: "#777",
  },
  altText: {
    marginVertical: 10,
    fontSize: 16,
    color: colors.dark,

    alignSelf: "center",
    fontFamily: "OpenSans_700Bold",
  },
  unitAlt: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  weightContainer: {},
  weightLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  unitText: {
    color: colors.primary,
    fontSize: 14,
  },
  valueText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
  },
});
