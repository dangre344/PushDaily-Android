import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../../constants/colors";
import { scaling } from "../../../constants/useScaling";
const { scaleHeight, scaleWidth, moderateScale: ms } = scaling();

// Card width + gap. workoutscreen uses this for snapping, so the two can't drift.
export const HIIT_CARD_WIDTH = scaleWidth(280);
export const HIIT_CARD_GAP = 14;

/**
 * Quick-start banner (the original artwork). ~20% shorter than before so the
 * row doesn't dominate the screen, and the same card style as the rest of the
 * screen: white, 16 radius, hairline border, no shadow.
 */
export default function HIITCard({ item, onClick }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onClick?.(item)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.bodyPart} quick workout`}
    >
      <Image style={styles.banner} source={item.img} resizeMode="cover" />

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {item.bodyPart}
        </Text>
        <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
          {`${item.workoutList.length} ${t("exercises")}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: HIIT_CARD_WIDTH,
    marginEnd: HIIT_CARD_GAP,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F4",
  },
  // Was 190 tall; 152 keeps the artwork readable without dominating.
  banner: { width: "100%", height: scaleHeight(152) },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  title: {
    flex: 1,
    fontSize: ms(13),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
    marginRight: 8,
  },
  sub: {
    fontSize: ms(11),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },
});
