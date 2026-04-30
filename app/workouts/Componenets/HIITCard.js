import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";
const { scaleHeight, scaleWidth, moderateScale } = scaling();

export default function HIITCard({ item, onClick }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => onClick?.(item)}>
      <View style={styles.hiitContainer}>
        <Image
          style={{
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            width: "auto",
            height: scaleHeight(190),
          }}
          source={item.img}
          resizeMode="cover"
        />

        <View style={styles.weeklyAttContainer}>
          <Text
            style={styles.bodyPartName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.bodyPart}
          </Text>

          <Text style={styles.expLevel} numberOfLines={1} ellipsizeMode="tail">
            {`Min ${item.workoutList.length} ${t("exercises")}`}
          </Text>

          {/* <View
            style={{
              flexDirection: "row",
              gap: 10,
            }}
          >
            <IconWithText
              icon={
                <AntDesign name="fire" size={10} color={colors.textLight} />
              }
              label={`${item.calories} cal`}
              size={12}
              textStyle={{ fontSize: moderateScale(10) }}
              color={colors.textLight}
              orientation="horizontal"
            />
          </View> */}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hiitContainer: {
    marginTop: 10,
    alignContent: "center",
    justifyContent: "space-between",
    width: scaleWidth(280),
    height: "auto",
    borderWidth: 0.2,
    borderRadius: 10,

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
    marginHorizontal: 10,
  },
});
