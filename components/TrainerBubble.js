import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  registerBubbleListener,
  registerBubbleVisibility,
} from "../constants/bubbleMessage";
import { getChatContext } from "../constants/chatContext";
import { trackEvent } from "../constants/mixpanel";
import { TRAINER_NAME } from "../constants/trainerChat";
import { scaling } from "../constants/useScaling";

const { moderateScale: ms } = scaling();
const TRAINER_AVATAR = require("../assets/images/trainer.png");

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const SIZE = ms(62);
const MARGIN = ms(10);
const MIN_Y = ms(70);
const MAX_Y = SCREEN_H - ms(190);

// Cycled inside the bubble so it advertises what Jack can actually help with.
const HINTS = ["Diet", "Workouts", "Fat loss", "Protein", "Recovery"];
const HINT_MS = 2200;

const HIDDEN_ON = [
  "/trainer",
  "/signup",
  "/login",
  "/index",
  "/Splash",
  "/event/pushup",
];

/**
 * Floating chat bubble shown across the app. Draggable, snaps to the nearest
 * edge, and cycles a hint so users learn what to ask without extra chrome.
 */
export default function TrainerBubble() {
  const router = useRouter();
  const pathname = usePathname();

  const pan = useRef(
    new Animated.ValueXY({ x: SCREEN_W - SIZE - MARGIN, y: MAX_Y - ms(40) }),
  ).current;
  const scale = useRef(new Animated.Value(1)).current;
  const dragged = useRef(false);
  // PanResponder is memoized once; this keeps it pointing at the latest open().
  const openRef = useRef(null);

  const [hint, setHint] = useState(0);
  const hintFade = useRef(new Animated.Value(1)).current;

  // Congratulation message + which side of the screen the bubble is on, so the
  // speech bubble always opens toward the middle instead of off-screen.
  const [message, setMessage] = useState(null);
  const [side, setSide] = useState("right");
  const msgAnim = useRef(new Animated.Value(0)).current;
  const msgTimer = useRef(null);

  // Route-level hiding, plus a runtime flag screens can toggle (the scanner
  // hides it over the camera and shows it again on the result).
  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => registerBubbleVisibility(setSuppressed), []);

  const hidden =
    suppressed || HIDDEN_ON.some((p) => pathname?.startsWith(p));

  // Cross-fade the rotating hint. Paused while hidden so it costs nothing.
  useEffect(() => {
    if (hidden) return;
    const id = setInterval(() => {
      Animated.timing(hintFade, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        setHint((i) => (i + 1) % HINTS.length);
        Animated.timing(hintFade, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    }, HINT_MS);
    return () => clearInterval(id);
  }, [hidden, hintFade]);

  // Slow breathing so it reads as live without demanding attention.
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (hidden) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hidden, breathe]);

  // Any screen can call sayFromJack(...) after a workout / quiz / exercise.
  useEffect(() => {
    const dismiss = () =>
      Animated.timing(msgAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setMessage(null));

    const unregister = registerBubbleListener((text, ms) => {
      clearTimeout(msgTimer.current);
      setMessage(text);
      msgAnim.setValue(0);
      Animated.spring(msgAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }).start();
      msgTimer.current = setTimeout(dismiss, ms);
    });

    return () => {
      unregister();
      clearTimeout(msgTimer.current);
    };
  }, [msgAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

        onPanResponderGrant: () => {
          dragged.current = false;
          pan.setOffset({ x: pan.x._value, y: pan.y._value });
          pan.setValue({ x: 0, y: 0 });
          Animated.spring(scale, {
            toValue: 1.12,
            friction: 6,
            useNativeDriver: false,
          }).start();
        },

        onPanResponderMove: (e, g) => {
          if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) dragged.current = true;
          Animated.event([null, { dx: pan.x, dy: pan.y }], {
            useNativeDriver: false,
          })(e, g);
        },

        onPanResponderRelease: () => {
          pan.flattenOffset();
          Animated.spring(scale, {
            toValue: 1,
            friction: 6,
            useNativeDriver: false,
          }).start();

          // A tap (no real movement) opens the chat. Handling it here rather
          // than with a child touch handler — a child that claims the touch
          // stops the PanResponder ever seeing the drag.
          if (!dragged.current) {
            openRef.current?.();
            return;
          }

          const x = pan.x._value;
          const y = Math.min(Math.max(pan.y._value, MIN_Y), MAX_Y);
          const onLeft = x + SIZE / 2 < SCREEN_W / 2;
          const toX = onLeft ? MARGIN : SCREEN_W - SIZE - MARGIN;
          setSide(onLeft ? "left" : "right");

          Animated.spring(pan, {
            toValue: { x: toX, y },
            friction: 7,
            tension: 60,
            useNativeDriver: false,
          }).start();
        },
      }),
    [pan, scale],
  );

  if (hidden) return null;

  const open = () => {
    // Screens can register what the user is looking at (e.g. the current
    // exercise) so the chat opens with a relevant question already typed.
    const ctx = getChatContext();
    trackEvent("Trainer Bubble Opened", {
      from: pathname || "",
      context: ctx?.kind || "none",
      contextTitle: ctx?.title || "",
    });
    router.push(
      ctx?.prefill
        ? { pathname: "/trainer/chat", params: { prefill: ctx.prefill } }
        : "/trainer/chat",
    );
  };
  openRef.current = open;

  return (
    // Outer node is JS-driven ONLY (PanResponder requires it). Mixing a
    // useNativeDriver:true animation into this same transform moves the node
    // to native and every drag then throws — the breathe lives one level down.
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        { transform: [...pan.getTranslateTransform(), { scale }] },
      ]}
    >
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.msg,
            side === "right" ? styles.msgLeft : styles.msgRight,
            {
              opacity: msgAnim,
              transform: [
                { scale: msgAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                {
                  translateX: msgAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [side === "right" ? ms(12) : ms(-12), 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.msgText}>{message}</Text>
          <View
            style={[
              styles.msgTail,
              side === "right" ? styles.msgTailRight : styles.msgTailLeft,
            ]}
          />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.bubble,
          {
            transform: [
              {
                translateY: breathe.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Image
          source={TRAINER_AVATAR}
          style={styles.avatar}
          contentFit="cover"
        />

        {/* Dark gradient so the name + hint stay legible over any photo. */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"]}
          style={styles.scrim}
        />

        <View style={styles.caption}>
          <Text style={styles.name} numberOfLines={1}>
            {TRAINER_NAME}
          </Text>
          <Animated.Text
            style={[styles.hint, { opacity: hintFade }]}
            numberOfLines={1}
          >
            {HINTS[hint]}
          </Animated.Text>
        </View>

        <View style={styles.onlineDot} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    zIndex: 999,
    // No elevation here on purpose: on Android an elevated parent clips
    // children drawn outside its bounds, which would cut off the speech
    // bubble. The shadow lives on the circle and the message instead.
  },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: ms(2),
    borderColor: "#FFD9C7", // light warm ring — visible on dark and light
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
    elevation: 12,
  },
  avatar: { width: "100%", height: "100%" },

  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "62%",
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: ms(5),
    alignItems: "center",
  },
  name: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(9.5),
    lineHeight: ms(12),
    color: "#FFFFFF",
  },
  hint: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(7.5),
    lineHeight: ms(10),
    color: "#FFD9C7",
  },

  msg: {
    position: "absolute",
    top: ms(6),
    width: ms(178),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(14),
    paddingVertical: ms(9),
    paddingHorizontal: ms(12),
    borderWidth: 1,
    borderColor: "#FFD9C7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 14,
  },
  // Bubble on the right of the screen → message opens to its left, and vice versa.
  msgLeft: { right: SIZE + ms(10) },
  msgRight: { left: SIZE + ms(10) },
  msgText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11.5),
    lineHeight: ms(16),
    color: "#111827",
  },
  msgTail: {
    position: "absolute",
    top: ms(18),
    width: ms(10),
    height: ms(10),
    backgroundColor: "#FFFFFF",
    borderColor: "#FFD9C7",
    transform: [{ rotate: "45deg" }],
  },
  msgTailRight: {
    right: ms(-6),
    borderRightWidth: 1,
    borderTopWidth: 1,
  },
  msgTailLeft: {
    left: ms(-6),
    borderLeftWidth: 1,
    borderBottomWidth: 1,
  },

  onlineDot: {
    position: "absolute",
    right: ms(4),
    top: ms(4),
    width: ms(11),
    height: ms(11),
    borderRadius: ms(6),
    backgroundColor: "#22C55E",
    borderWidth: ms(1.5),
    borderColor: "#FFFFFF",
  },
});
