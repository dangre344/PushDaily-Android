import { Logger } from "@/constants/Logger";
import { Controller } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { RulerPicker } from "react-native-ruler-picker";
import { colors } from "../../constants/colors";

const RulerPickerField = ({
  form,
  name,
  defaultValue = 65,
  onSelected,
  ...props
}) => {
  Logger.log("typeOF---->", typeof defaultValue);
  return (
    <Controller
      control={form.control}
      name={name}
      defaultValue={defaultValue} // ✅ ensures default is set
      render={({ field: { onChange, value } }) => {
        const currentValue = !isNaN(value) ? Number(value) : defaultValue;

        Logger.log("currentValue--->" + currentValue);

        return (
          <View>
            <RulerPicker
              value={currentValue}
              // initialValue={currentValue} // 👈 needed for RulerPicker
              onValueChangeEnd={(num) => {
                onChange(num); // updates form
                form.setValue(name, num, { shouldValidate: true }); // keeps form synced
                onSelected?.(num); // optional callback
              }}
              {...props}
            />
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 5,
  },

  valueText: {
    fontSize: 22,
    fontFamily: "OpenSans_400Regular",
    color: colors.primary,
  },
  unitText: {
    fontSize: 14,
    fontFamily: "OpenSans_400Regular",
    color: "#777",
  },
});

export default RulerPickerField;
