import { Ionicons } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

/**
 * Press-in shrink + a small pop when it becomes selected. The pop runs only
 * on the transition into "selected", never on an unrelated re-render.
 */
function useCardMotion(selected) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasSelected = useRef(selected);

  useEffect(() => {
    if (selected && !wasSelected.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.04, useNativeDriver: true, speed: 40, bounciness: 0 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
      ]).start();
    }
    wasSelected.current = selected;
  }, [selected, scale]);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return { scale, pressIn, pressOut };
}

function Radio({ selected }) {
  return (
    <View style={[styles.radio, selected && styles.radioOn]}>
      {selected ? (
        <MotiView
          from={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 260 }}
        >
          <Ionicons name="checkmark" size={ms(13)} color="#FFFFFF" />
        </MotiView>
      ) : null}
    </View>
  );
}

function ListCard({ option, selected, onPress, index }) {
  const { scale, pressIn, pressOut } = useCardMotion(selected);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 280, delay: 40 + index * 60 }}
    >
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View
          style={[styles.card, selected && styles.cardOn, { transform: [{ scale }] }]}
        >
          <View style={[styles.emojiWrap, selected && styles.emojiWrapOn]}>
            <Text style={styles.emoji}>{option.emoji}</Text>
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, selected && styles.titleOn]}>{option.title}</Text>
            {option.time ? <Text style={styles.time}>{option.time}</Text> : null}
            {option.description ? (
              <Text style={styles.description}>{option.description}</Text>
            ) : null}
          </View>

          <Radio selected={selected} />
        </Animated.View>
      </Pressable>
    </MotiView>
  );
}

function GridCard({ option, selected, onPress, index, columns }) {
  const { scale, pressIn, pressOut } = useCardMotion(selected);
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "timing", duration: 260, delay: 40 + index * 50 }}
      style={{ width: `${100 / columns}%`, padding: 5 }}
    >
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View
          style={[styles.gridCard, selected && styles.cardOn, { transform: [{ scale }] }]}
        >
          <Text style={styles.gridEmoji}>{option.emoji}</Text>
          <Text
            style={[styles.gridTitle, selected && styles.titleOn]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {option.title}
          </Text>
          {option.time ? <Text style={styles.gridTime}>{option.time}</Text> : null}

          {selected ? (
            <MotiView
              from={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 260 }}
              style={styles.gridCheck}
            >
              <Ionicons name="checkmark" size={ms(11)} color="#FFFFFF" />
            </MotiView>
          ) : null}
        </Animated.View>
      </Pressable>
    </MotiView>
  );
}

/**
 * Single-choice cards bound to a react-hook-form field.
 *
 * The stored value is still `option.title`, exactly as before — signup and
 * WorkoutLevelModal both depend on that, so this is a visual change only.
 *
 * @param horizontal  compact grid instead of a list
 * @param columns     grid columns (default 2; gender uses 3 so all fit on a row)
 */
export const OptionCardController = ({
  control,
  name,
  rules = {},
  options = [],
  defaultValue = "",
  horizontal = false,
  columns = 2,
}) => (
  <Controller
    control={control}
    name={name}
    rules={rules}
    defaultValue={defaultValue}
    render={({ field: { value, onChange } }) => {
      const select = (title) => {
        if (title !== value) tapHaptic();
        onChange(title);
      };

      return horizontal ? (
        <View style={styles.grid}>
          {options.map((option, i) => (
            <GridCard
              key={option.title}
              index={i}
              columns={columns}
              option={option}
              selected={value === option.title}
              onPress={() => select(option.title)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {options.map((option, i) => (
            <ListCard
              key={option.title}
              index={i}
              option={option}
              selected={value === option.title}
              onPress={() => select(option.title)}
            />
          ))}
        </View>
      );
    }}
  />
);

const styles = StyleSheet.create({
  // ── list ──
  list: { gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: "#E7EAEF",
  },
  cardOn: {
    borderColor: colors.primary,
    backgroundColor: "#FFF6F2",
  },
  emojiWrap: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(14),
    backgroundColor: "#F4F6F8",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiWrapOn: { backgroundColor: "#FFFFFF" },
  emoji: { fontSize: ms(22) },
  textWrap: { flex: 1 },
  title: {
    fontSize: ms(15),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
  },
  titleOn: { color: colors.primary },
  time: {
    fontSize: ms(12),
    fontFamily: "OpenSans_700Bold",
    color: colors.success,
    marginTop: 1,
  },
  description: {
    fontSize: ms(12.5),
    fontFamily: "OpenSans_500Medium",
    color: colors.textLight,
    marginTop: 2,
    lineHeight: ms(17),
  },
  radio: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    borderWidth: 2,
    borderColor: "#D5DAE1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },

  // ── grid ──
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  gridCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: "#E7EAEF",
  },
  gridEmoji: { fontSize: ms(26) },
  gridTitle: {
    fontSize: ms(13.5),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginTop: 6,
  },
  gridTime: {
    fontSize: ms(11),
    fontFamily: "OpenSans_700Bold",
    color: colors.success,
    marginTop: 2,
  },
  gridCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
