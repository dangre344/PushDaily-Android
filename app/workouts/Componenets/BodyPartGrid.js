import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { tapHaptic } from "../../../constants/haptics";
import { scaling } from "../../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

/**
 * Photo-first tile: the image IS the tile, with the name on a soft dark fade
 * at the bottom. No card, border or shadow around it — six framed boxes in a
 * grid read as clutter; six photos read as a menu.
 */
function Tile({ item, index, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: to < 1 ? 50 : 26, bounciness: to < 1 ? 0 : 8 }).start();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 280, delay: 60 + index * 45 }}
      style={styles.cell}
    >
      <Pressable
        onPress={() => {
          tapHaptic();
          onPress(item);
        }}
        onPressIn={() => spring(0.95)}
        onPressOut={() => spring(1)}
        accessibilityRole="button"
        accessibilityLabel={`${item.bodyPart} workouts`}
      >
        <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
          <Image
            source={item.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // these photos are framed head-first; keep the upper body in view
            contentPosition={{ top: "18%", left: "50%" }}
            transition={200}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
            locations={[0.45, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text style={styles.label} numberOfLines={1}>
            {item.bodyPart}
          </Text>
        </Animated.View>
      </Pressable>
    </MotiView>
  );
}

/** 3-across grid of body parts. Tapping one opens the existing level picker. */
export default function BodyPartGrid({ items, onSelect }) {
  return (
    <View style={styles.grid}>
      {items.map((item, i) => (
        <Tile key={item.bodyPart} item={item} index={i} onPress={onSelect} />
      ))}
    </View>
  );
}

const GAP = 10;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20 - GAP / 2,
    marginTop: 12,
  },
  cell: { width: "33.333%", padding: GAP / 2 },
  tile: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1F2937",
    justifyContent: "flex-end",
  },
  label: {
    paddingHorizontal: 10,
    paddingBottom: 9,
    fontSize: ms(13),
    fontFamily: "OpenSans_800ExtraBold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
