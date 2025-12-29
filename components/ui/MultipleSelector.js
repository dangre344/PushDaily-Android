import { Logger } from "@/constants/Logger";
import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";

const MultipleSelector = ({
  form,
  name,
  options,
  defaultValues = [],
  rules = {},
}) => {
  Logger.log("defaultValues----->" + defaultValues);
  const { t } = useTranslation();

  return (
    <Controller
      control={form.control}
      name={name}
      rules={rules}
      defaultValue={[defaultValues]}
      render={({ field: { value = [], onChange } }) => {
        const toggleDay = (day) => {
          const updatedDays = value.includes(day)
            ? value.filter((d) => d !== day)
            : [...value, day];
          onChange(updatedDays);
        };

        return (
          <View style={styles.daysGrid}>
            {options.map((day) => {
              const isSelected = value.includes(day);

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    isSelected && styles.dayButtonSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {t(day)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
    marginTop: 8,
  },
  dayButton: {
    flex: 1,
    minWidth: "28%",
    paddingVertical: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  dayButtonSelected: {
    backgroundColor: colors.primary + 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
  },
  dayTextSelected: {
    color: colors.primary,
  },
});

export default MultipleSelector;
