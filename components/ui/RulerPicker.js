import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { selectionHaptic } from "../../constants/haptics";

// px between two adjacent values. Wide enough to land on a value with a
// thumb, narrow enough that a flick still covers a useful range.
const TICK = 12;
const RULER_HEIGHT = 74;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

const Tick = memo(function Tick({ value, majorEvery, label }) {
  const major = value % majorEvery === 0;
  const half = !major && majorEvery % 2 === 0 && value % (majorEvery / 2) === 0;
  return (
    <View style={styles.cell}>
      <View
        style={[
          styles.tick,
          major ? styles.tickMajor : half ? styles.tickHalf : styles.tickMinor,
        ]}
      />
      {major ? (
        <Text style={styles.tickLabel} numberOfLines={1}>
          {label ?? value}
        </Text>
      ) : null}
    </View>
  );
});

/**
 * Horizontal snapping ruler — the standard pattern for picking a body
 * measurement precisely on a phone.
 *
 * A plain slider maps ~120 values onto ~250px, so landing on an exact number
 * is fiddly and people give up and keep whatever was pre-filled. Here every
 * value is 12px apart, the ruler snaps to whole values, and each notch gives a
 * haptic tick.
 *
 * - `onChange(v)` fires for every whole value passed while dragging.
 * - `onSettle(v)` fires once the ruler comes to rest — commit expensive work
 *   (validation) there, not on every notch.
 * - A `value` change from outside (± buttons, typing, unit switch) scrolls the
 *   ruler to match, without echoing intermediate values back.
 */
export default function RulerPicker({
  min,
  max,
  value,
  onChange,
  onSettle,
  majorEvery = 10,
  labelFor,
  onInteract,
}) {
  const listRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [ready, setReady] = useState(false);

  const lastEmitted = useRef(value);
  const dragging = useRef(false);
  // True while WE are scrolling the list in response to a prop change; the
  // onScroll events that produces must not be reported back as user input.
  const programmatic = useRef(false);
  const programmaticTimer = useRef(null);
  const settleTimer = useRef(null);

  const data = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );

  // Spacer so the first and last values can sit under the centre line.
  const pad = Math.max(0, width / 2 - TICK / 2);

  const offsetFor = useCallback((v) => (clamp(v, min, max) - min) * TICK, [min, max]);

  const scrollTo = useCallback(
    (v, animated) => {
      programmatic.current = true;
      clearTimeout(programmaticTimer.current);
      listRef.current?.scrollToOffset({ offset: offsetFor(v), animated });
      lastEmitted.current = v;
      programmaticTimer.current = setTimeout(
        () => {
          programmatic.current = false;
        },
        animated ? 420 : 80,
      );
    },
    [offsetFor],
  );

  // Initial position. On Android a scroll issued before the list has measured
  // its content is silently dropped, which would leave the ruler at `min`
  // while the number above says 170. So position once the content size is
  // known — `contentOffset` below covers the first frame as well.
  const placed = useRef(false);
  const onContentSizeChange = (w) => {
    if (placed.current || w < pad * 2) return;
    placed.current = true;
    scrollTo(value, false);
    requestAnimationFrame(() => setReady(true));
  };

  // Frozen at mount. If this object changed every render, iOS would apply it
  // mid-drag and fight the user's finger. (A unit switch remounts the ruler,
  // so a new range still gets a fresh initial offset.)
  const [initialOffset] = useState(() => ({ x: (clamp(value, min, max) - min) * TICK, y: 0 }));

  // Later changes that did not come from dragging: ±, typing, a reset.
  useEffect(() => {
    if (!ready || dragging.current) return;
    if (value === lastEmitted.current) return;
    scrollTo(value, true);
  }, [value, ready, scrollTo]);

  useEffect(
    () => () => {
      clearTimeout(programmaticTimer.current);
      clearTimeout(settleTimer.current);
    },
    [],
  );

  const onScroll = (e) => {
    if (programmatic.current) return;
    const x = e.nativeEvent.contentOffset.x;
    const v = clamp(min + Math.round(x / TICK), min, max);
    if (v !== lastEmitted.current) {
      lastEmitted.current = v;
      selectionHaptic();
      onChange?.(v);
    }
  };

  const settle = () => {
    clearTimeout(settleTimer.current);
    dragging.current = false;
    onSettle?.(lastEmitted.current);
  };

  const renderItem = useCallback(
    ({ item }) => (
      <Tick value={item} majorEvery={majorEvery} label={labelFor?.(item)} />
    ),
    [majorEvery, labelFor],
  );

  const getItemLayout = useCallback(
    (_, index) => ({ length: TICK, offset: pad + TICK * index, index }),
    [pad],
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={data}
          horizontal
          keyExtractor={String}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          ListHeaderComponent={<View style={{ width: pad }} />}
          ListFooterComponent={<View style={{ width: pad }} />}
          showsHorizontalScrollIndicator={false}
          contentOffset={initialOffset}
          onContentSizeChange={onContentSizeChange}
          snapToInterval={TICK}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            dragging.current = true;
            programmatic.current = false;
            clearTimeout(settleTimer.current);
            onInteract?.();
          }}
          // No momentum after a slow release on some devices — settle anyway.
          onScrollEndDrag={() => {
            settleTimer.current = setTimeout(settle, 140);
          }}
          onMomentumScrollBegin={() => clearTimeout(settleTimer.current)}
          onMomentumScrollEnd={() => {
            if (dragging.current) settle();
          }}
          initialNumToRender={70}
          maxToRenderPerBatch={60}
          windowSize={9}
          style={{ opacity: ready ? 1 : 0 }}
        />
      ) : null}

      {/* fade the ends so the ruler reads as continuous, not cut off */}
      <LinearGradient
        pointerEvents="none"
        colors={["#FFFFFF", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, { left: 0 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0)", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, { right: 0 }]}
      />

      <View pointerEvents="none" style={styles.centerLine} />
      <View pointerEvents="none" style={styles.centerCap} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: RULER_HEIGHT,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  cell: {
    width: TICK,
    height: RULER_HEIGHT,
    alignItems: "center",
  },
  tick: {
    width: 2,
    borderRadius: 1,
    marginTop: 8,
  },
  tickMinor: { height: 14, backgroundColor: "#D5DAE1" },
  tickHalf: { height: 22, backgroundColor: "#B9C0CA" },
  tickMajor: { height: 32, backgroundColor: colors.text },
  tickLabel: {
    position: "absolute",
    top: 46,
    width: 44,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "OpenSans_600SemiBold",
    color: colors.textLight,
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 54,
  },
  centerLine: {
    position: "absolute",
    top: 2,
    left: "50%",
    width: 4,
    height: 46,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  centerCap: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
});
