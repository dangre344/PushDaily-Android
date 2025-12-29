import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../constants/colors";

export default function TitleText({ text, style, isOptional = false }) {
  return (
    <View style={styles.container}>
      <Text style={[styles.textStyle, style]} className="whitespace-nowrap">
        {text}
      </Text>
      {isOptional ? <Text style={styles.secTextStyle}> (Optional)</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
  },
  textStyle: {
    fontSize: 14,
    color: colors.titleColor,
    fontFamily: "OpenSans_400Regular",
  },

  secTextStyle: {
    color: colors.optionalTextColor,
    fontSize: 13,

    alignSelf: "flex-end",
    fontFamily: "OpenSans_400Regular",
  },
});
