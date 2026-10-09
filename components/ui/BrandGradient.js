import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { colors } from "../../constants/colors";

export const BRAND_GRADIENT = ["#FF8A4C", colors.primary, "#F2541F"];

/**
 * The warm orange card background used by the Workouts "Today" card, the
 * Event header, the Attendance summary and the Quiz header — one look for
 * every hero surface. A soft yellow glow sits in the top-right corner.
 */
export default function BrandGradient({ style, children }) {
  return (
    <LinearGradient
      colors={BRAND_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.base, style]}
    >
      <View pointerEvents="none" style={styles.glow} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  glow: {
    position: "absolute",
    right: -60,
    top: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,210,63,0.22)",
  },
});
