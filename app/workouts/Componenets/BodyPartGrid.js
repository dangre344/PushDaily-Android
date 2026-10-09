import { Image } from "expo-image";
import { MotiView } from "moti";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../../constants/colors";
import { tapHaptic } from "../../../constants/haptics";
import { scaling } from "../../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

function Tile({ item, index, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: to < 1 ? 50 : 26, bounciness: to < 1 ? 0 : 8 }).start();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 300, delay: 80 + index * 55 }}
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
          <View style={styles.imageWrap}>
            <Image
              source={item.image}
              style={styles.image}
              contentFit="cover"
              // these photos are framed head-first; keep the upper body in view
              contentPosition={{ top: "18%", left: "50%" }}
              transition={200}
            />
          </View>
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

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 15, marginTop: 12 },
  cell: { width: "33.333%", padding: 5 },
  tile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 6,
    paddingBottom: 9,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  imageWrap: { aspectRatio: 1, borderRadius: 15, overflow: "hidden", backgroundColor: "#111" },
  image: { width: "100%", height: "100%" },
  label: {
    marginTop: 7,
    textAlign: "center",
    fontSize: ms(13),
    fontFamily: "OpenSans_800ExtraBold",
    color: colors.text,
  },
});
