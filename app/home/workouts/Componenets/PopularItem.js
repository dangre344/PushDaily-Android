import { AntDesign, Octicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import IconWithText from "../../../../components/ui/IconWithText";
import { colors } from "../../../../constants/colors";
import { scaling } from "../../../../constants/useScaling";
const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function PopularItem({ item }) {
  return (
    <View style={styles.hiitContainer}>
      <Image
        style={{
          borderRadius: 10,
          width: scaleWidth(60),
          height: scaleHeight(60),
          marginVertical: 10,
        }}
        source={{ uri: item.photo }}
        resizeMode="cover"
      />

      <View style={{ marginHorizontal: 20, gap: 5 }}>
        <Text
          style={styles.bodyPartName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.name}
        </Text>

        <Text style={styles.expLevel} numberOfLines={1} ellipsizeMode="tail">
          {item.level}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
          }}
        >
          <IconWithText
            icon={<Octicons name="clock" size={24} color={colors.textLight} />}
            label={item.time}
            size={12}
            textStyle={{ fontSize: moderateScale(10) }}
            color={colors.textLight}
            orientation="horizontal"
          />

          <IconWithText
            icon={<AntDesign name="fire" size={10} color={colors.textLight} />}
            label="280 Cal"
            size={12}
            textStyle={{ fontSize: moderateScale(10) }}
            color={colors.primary}
            orientation="horizontal"
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hiitContainer: {
    marginTop: 10,
    alignContent: "center",

    flexDirection: "row",

    borderWidth: 0.2,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderColor: colors.textLight,
    marginEnd: 20,
  },

  bodyPartName: {
    fontSize: 12,
    fontFamily: "OpenSans_700Bold",
    color: colors.primary,
    marginTop: 5,
  },

  headerTitle: {
    fontSize: 15,
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },
  expLevel: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
  },

  weeklyAttContainer: {
    marginTop: 5,
    alignContent: "center",
    flexDirection: "row",
    marginBottom: 10,
    justifyContent: "space-between",
    alignItems: "center",
  },
});
