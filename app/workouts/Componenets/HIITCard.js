import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
function HIITCard({ item, onClick }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onClick?.(item)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.bodyPart} quick workout`}
    >
      <ExpoImage style={styles.banner} source={item.img} contentFit="cover" />

      <View style={styles.meta}>
        <View style={styles.metaText}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {item.bodyPart}
          </Text>
          <View style={styles.subRow}>
            <Ionicons
              name="barbell-outline"
              size={ms(12)}
              color={colors.textLight}
            />
            <Text style={styles.sub} numberOfLines={1}>
              {`${item.workoutList.length} ${t("exercises")}`}
            </Text>
          </View>
        </View>
        <View style={styles.play}>
          <Ionicons
            name="play"
            size={ms(12)}
            color="#FFFFFF"
            style={{ marginLeft: 1 }}
          />
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  metaText: { flex: 1 },
  title: {
    fontSize: ms(14),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    letterSpacing: -0.1,
  },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  sub: {
    fontSize: ms(11.5),
    fontFamily: "OpenSans_400Regular",
    color: colors.textLight,
  },
  play: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

// Memoised: the Workouts screen re-renders on every modal/state change.
export default memo(HIITCard);
