import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Real screenshots of adding the widget, played in order like a short video.
const STEPS = [
  {
    img: require("../../assets/images/widget-steps/step1.webp"),
    title: "Go to your phone's home screen",
    text: "Close Push Daily and go to the screen with your app icons (not this app).",
  },
  {
    img: require("../../assets/images/widget-steps/step2.webp"),
    title: "Long-press an empty space",
    text: "Hold your finger on the wallpaper, then tap Widgets.",
  },
  {
    img: require("../../assets/images/widget-steps/step3.webp"),
    title: "Find Push Daily",
    text: "Scroll the list and tap Push Daily to open it.",
  },
  {
    img: require("../../assets/images/widget-steps/step4.webp"),
    title: "Press and hold the widget",
    text: "Keep your finger on the yellow Jack widget.",
  },
  {
    img: require("../../assets/images/widget-steps/step5.webp"),
    title: "Drag it into place",
    text: "Move it where you'll see it and let go.",
  },
  {
    img: require("../../assets/images/widget-steps/step6.webp"),
    title: "Done! Jack keeps you on track",
    text: "Your streak and a daily nudge, right on your home screen.",
  },
];

const STEP_MS = 3200;

/** Auto-playing, loop-forever walkthrough. Tap right/left half to skip. */
export default function WidgetStepsPlayer() {
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    progress.setValue(0);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: STEP_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    run.start(({ finished }) => {
      if (finished) setIndex((i) => (i + 1) % STEPS.length);
    });
    return () => run.stop();
  }, [index, progress, fade]);

  const go = (d) => setIndex((i) => (i + d + STEPS.length) % STEPS.length);
  const step = STEPS[index];

  return (
    <View style={styles.card}>
      <View style={styles.bars}>
        {STEPS.map((_, i) => (
          <View key={i} style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width:
                    i < index
                      ? "100%"
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                        : "0%",
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.stage}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          <Image source={step.img} style={styles.img} contentFit="contain" />
        </Animated.View>
        {/* Tap zones: left = back, right = next */}
        <Pressable style={styles.tapLeft} onPress={() => go(-1)} accessibilityLabel="Previous step" />
        <Pressable style={styles.tapRight} onPress={() => go(1)} accessibilityLabel="Next step" />
      </View>

      <Animated.View style={[styles.caption, { opacity: fade }]}>
        <View style={styles.num}>
          <Text style={styles.numText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.text}>{step.text}</Text>
        </View>
        <Ionicons name="play-circle" size={ms(18)} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    padding: 12,
    marginBottom: 16,
  },
  bars: { flexDirection: "row", gap: 4, marginBottom: 10 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "#EEF0F4", overflow: "hidden" },
  barFill: { height: 3, backgroundColor: colors.primary },
  stage: {
    height: ms(240),
    borderRadius: 12,
    backgroundColor: "#F4F5F8",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  tapLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "35%" },
  tapRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "65%" },
  caption: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  num: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { color: "#FFFFFF", fontFamily: "OpenSans_700Bold", fontSize: ms(12) },
  title: { fontFamily: "OpenSans_700Bold", fontSize: ms(14), color: colors.text },
  text: { fontFamily: "OpenSans_400Regular", fontSize: ms(12), color: colors.textLight, marginTop: 1 },
});
