import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { Component, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "toastify-react-native";
import { colors } from "../../constants/colors";
import {
  getDeviceCountry,
  incrementTodaySession,
  savePushupBest,
  saveScore,
} from "../../constants/leaderboard";
import { Logger } from "../../constants/Logger";
import { setUserProperties, trackEvent } from "../../constants/mixpanel";
import { useUser } from "../../constants/UserContext";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CAM_W = SCREEN_W;
const CAM_H = Math.round(SCREEN_H * 0.64);

// MediaPipe pose landmark indices – these are standard for the pose model.
// If the library includes extra landmarks (face, hands) they may shift these indices.
// We'll still try 11 and 12; the logs will show if they are correct.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;
const L_HIP = 23;
const R_HIP = 24;

// Posture gate: a valid push-up body is roughly HORIZONTAL (plank), so the
// vertical gap between shoulders and hips is small. Standing/sitting and just
// bending an elbow gives a large gap → rejected. Counting only starts after a
// good posture is held for READY_FRAMES.
const HORIZ_TOL = 0.26; // shoulder↔hip vertical gap below this = flat (plank)
const READY_FRAMES = 6; // lock the push-up posture fast (~0.3s) once body is flat

// Angle (degrees) at joint `b` formed by points a-b-c, in 3D (x,y,z) so an
// elbow bend toward the camera is still measured (front-angle push-ups).
const angleAt = (a, b, c) => {
  if (!a || !b || !c) return null;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = (a.z ?? 0) - (b.z ?? 0);
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = (c.z ?? 0) - (b.z ?? 0);
  const m1 = Math.hypot(abx, aby, abz);
  const m2 = Math.hypot(cbx, cby, cbz);
  if (!m1 || !m2) return null;
  let cos = (abx * cbx + aby * cby + abz * cbz) / (m1 * m2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
};

const ONBOARDING = [
  {
    icon: "phone-portrait-outline",
    text: "Lean your phone ~1.5 m away, facing you (front angle).",
  },
  {
    icon: "body-outline",
    text: "Keep your full body in the frame — head to feet.",
  },
  { icon: "sunny-outline", text: "Train in a bright, well-lit space." },
  {
    icon: "fitness-outline",
    text: "Lower until your chest nears the floor, then push up.",
  },
];

// Error boundary
class CameraBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e) {
    Logger.log("[Pushup] camera mount failed:", String(e));
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

// Dynamic loader for the native camera component
function CameraWrapper(props) {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useState(() => {
    try {
      const module = require("@thinksys/react-native-mediapipe");
      console.log("MediaPipe exports:", Object.keys(module));
      const Cam = module.RNMediapipe;
      if (!Cam) throw new Error("RNMediapipe component not found.");
      setComponent(() => Cam);
    } catch (e) {
      setError(e);
      Logger.log("[Pushup] dynamic require failed:", String(e));
    }
  }, []);

  if (error) {
    return (
      <View style={styles.camFallback}>
        <Ionicons name="alert-circle-outline" size={ms(34)} color="#94A3B8" />
        <Text style={styles.camFallbackTitle}>Camera component not found</Text>
        <Text style={styles.camFallbackText}>
          {error.message ||
            "Check that @thinksys/react-native-mediapipe is installed."}
        </Text>
      </View>
    );
  }

  if (!Component) {
    return (
      <View style={styles.camFallback}>
        <Ionicons name="sync" size={ms(34)} color="#94A3B8" />
        <Text style={styles.camFallbackTitle}>Loading camera...</Text>
      </View>
    );
  }

  return <Component {...props} />;
}

export default function PushupScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState("onboarding");
  const [count, setCount] = useState(0);
  const [down, setDown] = useState(false);
  const [posture, setPosture] = useState("positioning"); // positioning | ready
  const [debugInfo, setDebugInfo] = useState("");

  const repPhaseRef = useRef("up");
  const baseUpRef = useRef(null);
  const smoothRef = useRef(null);
  const elbowSmoothRef = useRef(null);
  // Per-user range of motion, so thresholds adapt to ability (beginner-friendly).
  const angMaxRef = useRef(null); // straightest elbow angle seen
  const angMinRef = useRef(null); // most-bent elbow angle seen
  const dipMaxRef = useRef(0); // deepest shoulder dip seen
  const lastRepRef = useRef(0); // debounce timestamp
  const readyRef = useRef(false); // good posture confirmed → counting active
  const validFramesRef = useRef(0); // consecutive good-posture frames
  const postureLostRef = useRef(0); // consecutive bad-posture frames (UI only)
  const cameraRef = useRef();
  const frameCountRef = useRef(0);
  const loggedSampleRef = useRef(false);
  const loggedStructRef = useRef(false);

  const bumpRep = () => {
    setCount((c) => {
      const next = c + 1;
      if (next % 5 === 0) {
        Speech.stop();
        Speech.speak(String(next), { rate: 0.95, pitch: 1.0 });
      }
      return next;
    });
  };

  // ─── Core counting logic ───
  const onLandmark = (data) => {
    frameCountRef.current += 1;

    // 1. Normalise the payload. The native module emits a JSON STRING — that's
    //    why Object.keys(data) returned char indices "0".."6161" (the string is
    //    6162 chars long). Parse it into a real object first.
    let payload = data;
    try {
      if (typeof payload === "string") {
        payload = JSON.parse(payload);
      } else if (typeof payload?.nativeEvent === "string") {
        payload = JSON.parse(payload.nativeEvent);
      } else if (payload?.nativeEvent) {
        payload = payload.nativeEvent;
      }
    } catch (e) {
      if (frameCountRef.current % 60 === 0) {
        console.warn("[Pushup] Could not JSON.parse landmark payload:", String(e));
      }
      return;
    }

    // One-time dump of the parsed structure so we can confirm the shape.
    if (!loggedStructRef.current) {
      loggedStructRef.current = true;
      console.log(
        "[Pushup] Parsed payload keys:",
        payload && typeof payload === "object" ? Object.keys(payload) : typeof payload,
      );
    }

    // 2. Pull out the landmark array (33 pose points: {x,y,z,visibility}).
    let landmarks = null;
    if (Array.isArray(payload?.landmarks)) landmarks = payload.landmarks;
    else if (Array.isArray(payload)) landmarks = payload;
    else if (Array.isArray(payload?.poseLandmarks)) landmarks = payload.poseLandmarks;
    else if (Array.isArray(payload?.worldLandmarks)) landmarks = payload.worldLandmarks;

    // World landmarks give true 3D positions (metres) — best for the elbow angle.
    const world = Array.isArray(payload?.worldLandmarks)
      ? payload.worldLandmarks
      : null;

    if (!landmarks || landmarks.length === 0) {
      if (frameCountRef.current % 60 === 0) {
        console.warn(
          "[Pushup] No landmarks. Parsed keys:",
          payload && typeof payload === "object"
            ? Object.keys(payload)
            : String(payload).slice(0, 80),
        );
      }
      return;
    }

    // Log sample once.
    if (!loggedSampleRef.current && landmarks.length > 0) {
      loggedSampleRef.current = true;
      console.log(
        "[Pushup] Landmark sample (index 0):",
        JSON.stringify(landmarks[0]),
      );
      console.log(
        "[Pushup] Landmark sample (index 11):",
        JSON.stringify(landmarks[L_SHOULDER]),
      );
      console.log(
        "[Pushup] Landmark sample (index 12):",
        JSON.stringify(landmarks[R_SHOULDER]),
      );
      console.log("[Pushup] Total landmarks:", landmarks.length);
    }

    // 2. Shoulders (depth proxy) + elbows/wrists (angle).
    const ls = landmarks[L_SHOULDER];
    const rs = landmarks[R_SHOULDER];
    const le = landmarks[L_ELBOW];
    const re = landmarks[R_ELBOW];
    const lw = landmarks[L_WRIST];
    const rw = landmarks[R_WRIST];
    if (!ls || !rs) {
      if (frameCountRef.current % 60 === 0) {
        console.warn("[Pushup] Shoulder landmarks missing at indices 11,12.");
      }
      return;
    }

    const vis = (p) => p?.visibility ?? p?.score ?? p?.confidence ?? 1;
    if (vis(ls) < 0.3 || vis(rs) < 0.3) {
      if (frameCountRef.current % 60 === 0) {
        console.log("[Pushup] Low shoulder visibility:", vis(ls), vis(rs));
      }
      return;
    }

    // ── POSTURE GATE: must be in a roughly horizontal (plank) push-up body. ──
    const lh = landmarks[L_HIP];
    const rh = landmarks[R_HIP];
    const shY = (Number(ls.y) + Number(rs.y)) / 2;
    const hipsOk = lh && rh && vis(lh) > 0.3 && vis(rh) > 0.3;
    const hipY = hipsOk ? (Number(lh.y) + Number(rh.y)) / 2 : null;
    const vGap = hipY != null ? Math.abs(shY - hipY) : null;
    // Flat body = small shoulder↔hip vertical gap. Standing = large gap.
    const postureOk = vGap != null && vGap < HORIZ_TOL;

    if (frameCountRef.current % 10 === 0) {
      console.log(
        `[Pushup] posture vGap=${vGap != null ? vGap.toFixed(3) : "-"} ` +
          `ok=${postureOk} ready=${readyRef.current}`,
      );
    }

    // Not counting yet → wait for a held good posture before we begin.
    if (!readyRef.current) {
      if (postureOk) {
        validFramesRef.current += 1;
        if (validFramesRef.current >= READY_FRAMES) {
          readyRef.current = true;
          // Calibrate the rep detector fresh from the plank position.
          smoothRef.current = null;
          baseUpRef.current = null;
          elbowSmoothRef.current = null;
          angMaxRef.current = null;
          angMinRef.current = null;
          dipMaxRef.current = 0;
          repPhaseRef.current = "up";
          setPosture("ready");
          Speech.stop();
          Speech.speak("Start", { rate: 0.95 });
          console.log("[Pushup] ✅ Posture good — counting started");
        }
      } else {
        validFramesRef.current = 0;
      }
      setDebugInfo(
        postureOk
          ? `Hold it… ${validFramesRef.current}/${READY_FRAMES}`
          : `Get into push-up position (vGap=${vGap != null ? vGap.toFixed(2) : "?"})`,
      );
      return; // do NOT count until posture is confirmed
    }

    // Once the plank is locked we keep counting through brief posture flicker
    // (a real rep can momentarily wobble the hip estimate) — this was dropping
    // valid reps. We only flag a sustained loss for the UI, never block counts.
    if (!postureOk) {
      postureLostRef.current += 1;
    } else {
      postureLostRef.current = 0;
    }

    // ── Signal A: shoulder DEPTH (vertical position, 0 top → 1 bottom). ──
    const y = (Number(ls.y) + Number(rs.y)) / 2;
    if (!Number.isFinite(y)) return;
    const sy = smoothRef.current == null ? y : smoothRef.current * 0.7 + y * 0.3;
    smoothRef.current = sy;
    // "Up" baseline tracks the highest position (smallest y) but slowly relaxes
    // downward so it follows the real up-level instead of sticking forever.
    if (baseUpRef.current == null) baseUpRef.current = sy;
    else baseUpRef.current = Math.min(sy, baseUpRef.current + 0.0006);
    const base = baseUpRef.current;
    const dip = Math.max(0, sy - base);

    // ── Signal B: ELBOW ANGLE (shoulder-elbow-wrist) in 3D, per visible arm. ──
    // Prefer world (3D metric) landmarks; fall back to image landmarks (with z).
    const w = (i, fallback) => (world && world[i] ? world[i] : fallback);
    const aL =
      vis(le) > 0.3 && vis(lw) > 0.3
        ? angleAt(w(L_SHOULDER, ls), w(L_ELBOW, le), w(L_WRIST, lw))
        : null;
    const aR =
      vis(re) > 0.3 && vis(rw) > 0.3
        ? angleAt(w(R_SHOULDER, rs), w(R_ELBOW, re), w(R_WRIST, rw))
        : null;
    const angRaw =
      aL != null && aR != null ? (aL + aR) / 2 : aL != null ? aL : aR;
    let ang = null;
    if (angRaw != null) {
      ang =
        elbowSmoothRef.current == null
          ? angRaw
          : elbowSmoothRef.current * 0.6 + angRaw * 0.4;
      elbowSmoothRef.current = ang;
    }

    // ── Adaptive, beginner-friendly detection ──────────────────────────────
    // No fixed "perfect form" angles. We learn this person's own range of
    // motion (ROM) and count a rep on a RELATIVE down→up swing, so shallow
    // depth and partial elbow bend still count.

    // Extremes DECAY back toward the current value, so the range reflects
    // RECENT reps. Without this, one deep rep inflates the range and every
    // following shallow rep is missed (the main cause of skipped counts).
    if (ang != null) {
      angMaxRef.current = Math.max(ang, (angMaxRef.current ?? ang) - 0.08);
      angMinRef.current = Math.min(ang, (angMinRef.current ?? ang) + 0.08);
    }
    dipMaxRef.current = Math.max(dip, dipMaxRef.current * 0.99);

    const angRange =
      angMaxRef.current != null ? angMaxRef.current - angMinRef.current : 0;
    const dipRange = dipMaxRef.current;

    // A real push-up = elbows BEND **and** the chest LOWERS, together, in a
    // flat plank. This rejects look-alikes:
    //   • legs/body bob  → chest drop but NO elbow bend            → reject
    //   • bicep curl     → elbow bend but NO chest drop            → reject
    //   • standing curl  → also fails the plank-posture gate       → reject
    const armsBending = ang != null && angRange >= 12; // ≥12° of real elbow motion
    const haveDepth = dipRange >= 0.025;

    const angDown = armsBending && ang < angMaxRef.current - angRange * 0.45;
    const angUp = armsBending && ang > angMaxRef.current - angRange * 0.35;
    const depthDown = haveDepth && dip > dipRange * 0.45;
    const depthUp = haveDepth && dip < dipRange * 0.4;

    // DOWN = an elbow bend that happens EITHER in a confirmed flat plank
    // (postureOk) OR together with a real chest drop (depthDown). You can't
    // bicep-curl in a plank (hands are planted), and a standing curl fails both
    // the plank check and the chest-drop check → rejected. Legs-only has no
    // elbow bend → already rejected. Real push-ups satisfy at least one.
    const goingDown = angDown && (postureOk || depthDown);
    // UP completes the rep when either signal returns.
    const goingUp = angUp || depthUp;

    const now = Date.now();

    if (frameCountRef.current % 6 === 0) {
      console.log(
        `[Pushup] dip=${dip.toFixed(3)}/${dipRange.toFixed(3)} ang=${ang ? ang.toFixed(0) : "-"} range=${angRange.toFixed(0)}° ` +
          `arms=${armsBending} depthDown=${depthDown} plank=${postureOk} ` +
          `phase=${repPhaseRef.current} down=${goingDown} up=${goingUp}`,
      );
      setDebugInfo(
        `ang ${ang ? Math.round(ang) + "°" : "—"}  ROM ${angRange.toFixed(0)}°  dip ${dip.toFixed(2)}`,
      );
    }

    // State machine (+600ms debounce so a single rep can't double-count).
    if (repPhaseRef.current === "up" && goingDown) {
      repPhaseRef.current = "down";
      setDown(true);
      console.log(
        `[Pushup] ↓ DOWN  ang=${ang ? ang.toFixed(0) : "-"}° dip=${dip.toFixed(3)}`,
      );
    } else if (
      repPhaseRef.current === "down" &&
      goingUp &&
      now - lastRepRef.current > 400
    ) {
      repPhaseRef.current = "up";
      lastRepRef.current = now;
      setDown(false);
      bumpRep();
      console.log(
        `[Pushup] ↑ UP → ✅ REP COUNTED  ang=${ang ? ang.toFixed(0) : "-"}° dip=${dip.toFixed(3)}`,
      );
    }
  };

  const switchCamera = () => {
    if (cameraRef.current) {
      const cam = cameraRef.current;
      if (typeof cam.switchCamera === "function") {
        cam.switchCamera();
      } else {
        Alert.alert("Not available", "Camera switching is not supported.");
      }
    }
  };

  const startSession = async () => {
    if (Platform.OS === "android") {
      try {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "Camera access",
            message:
              "We use the camera to detect your push-up form and count reps.",
            buttonPositive: "Allow",
          },
        );
        if (res !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            "Camera needed",
            "Allow camera access to track your push-ups.",
          );
          return;
        }
      } catch (e) {
        Logger.log("[Pushup] permission error:", String(e));
      }
    }
    repPhaseRef.current = "up";
    baseUpRef.current = null;
    smoothRef.current = null;
    elbowSmoothRef.current = null;
    angMaxRef.current = null;
    angMinRef.current = null;
    dipMaxRef.current = 0;
    lastRepRef.current = 0;
    readyRef.current = false;
    validFramesRef.current = 0;
    postureLostRef.current = 0;
    setPosture("positioning");
    frameCountRef.current = 0;
    loggedSampleRef.current = false;
    loggedStructRef.current = false;
    frameCountRef.current = 0;
    loggedSampleRef.current = false;
    loggedStructRef.current = false;
    setCount(0);
    setDown(false);
    setPhase("counting");
  };

  const finish = async () => {
    Speech.stop();
    const best = await savePushupBest(count);
    const sessionsToday = await incrementTodaySession();
    // Upload the best score to the global leaderboard (best-effort, non-blocking).
    saveScore(user?._id, user?.name, best, getDeviceCountry()).catch(() => {});
    trackEvent("Pushup Event", {
      count,
      best,
      sessionsToday,
      userId: user?._id || "",
      name: user?.name || "",
    });
    setUserProperties({ "Best Pushups": best, "Last Pushup Count": count });
    Toast.success(`Great! ${count} push-ups uploaded 🎉`, "top");
    router.back();
  };

  // ---- Onboarding ----
  if (phase === "onboarding") {
    return (
      <SafeAreaView
        style={styles.screen}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={ms(22)} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Get ready</Text>
          <View style={{ width: ms(40) }} />
        </View>

        <View style={styles.onbBody}>
          <View style={styles.onbImageWrap}>
            <Image
              source={require("../../assets/images/chestImages/pushups.webp")}
              style={styles.onbImage}
              contentFit="contain"
            />
            <Text style={styles.onbImageCaption}>
              Plank position · hands facing the front camera
            </Text>
          </View>

          <Text style={styles.onbTitle}>How to perform</Text>
          <Text style={styles.onbLead}>
            Get into a flat plank facing the camera, then lower your chest and
            push back up. Counting locks on as soon as your form is detected.
          </Text>

          {ONBOARDING.map((o) => (
            <View key={o.icon} style={styles.onbRow}>
              <View style={styles.onbIcon}>
                <Ionicons name={o.icon} size={ms(16)} color={colors.primary} />
              </View>
              <Text style={styles.onbText}>{o.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.readyBtn}
          activeOpacity={0.9}
          onPress={startSession}
        >
          <Ionicons name="camera" size={ms(18)} color="#FFFFFF" />
          <Text style={styles.readyText}>Open Camera & Start</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ---- Counting ----
  return (
    <SafeAreaView
      style={styles.darkScreen}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.viewport}>
        <CameraBoundary
          fallback={
            <View style={styles.camFallback}>
              <Ionicons
                name="construct-outline"
                size={ms(34)}
                color="#94A3B8"
              />
              <Text style={styles.camFallbackTitle}>
                Camera needs a rebuild
              </Text>
              <Text style={styles.camFallbackText}>
                Run a native rebuild (the pose model isn't in this build yet).
              </Text>
            </View>
          }
        >
          <CameraWrapper
            ref={cameraRef}
            width={CAM_W}
            height={CAM_H}
            onLandmark={onLandmark}
            // Only enable landmarks that are relevant for push‑up detection.
            face // optional – helps with face tracking but not necessary
            leftArm
            rightArm
            leftWrist
            rightWrist
            torso
            // Removed: leftLeg, rightLeg, leftAnkle, rightAnkle – not needed
          />
        </CameraBoundary>

        <View style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.roundBtn}
          >
            <Ionicons name="close" size={ms(20)} color="#FFFFFF" />
          </TouchableOpacity>
          <View
            style={[
              styles.phasePill,
              posture !== "ready"
                ? styles.phasePillWait
                : down && styles.phasePillDown,
            ]}
          >
            <Text style={styles.phaseText}>
              {posture !== "ready" ? "POSITION" : down ? "DOWN" : "UP"}
            </Text>
          </View>
          <TouchableOpacity onPress={switchCamera} style={styles.roundBtn}>
            <Ionicons name="camera-reverse" size={ms(20)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {posture !== "ready" && (
          <View style={styles.positionBanner} pointerEvents="none">
            <Ionicons name="body" size={ms(28)} color="#FFFFFF" />
            <Text style={styles.positionTitle}>Get into push-up position</Text>
            <Text style={styles.positionSub}>
              Lie flat in a plank. Counting starts when your form is detected.
            </Text>
          </View>
        )}

        <View style={styles.countOverlay} pointerEvents="none">
          <Text style={styles.countLabel}>ACTIVE REPS</Text>
          <Text style={styles.countValue}>{count}</Text>
          {debugInfo ? (
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: ms(10) }}>
              {debugInfo}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.doneBtn, count === 0 && styles.doneBtnDisabled]}
        activeOpacity={0.9}
        onPress={finish}
        disabled={count === 0}
      >
        <Ionicons name="checkmark-circle" size={ms(20)} color="#FFFFFF" />
        <Text style={styles.doneText}>Done · Upload {count}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// (Styles remain exactly as before – copy from the previous version or keep them unchanged)
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  darkScreen: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
  },
  backBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
  },
  onbBody: { flex: 1, padding: ms(22) },
  onbEmoji: { fontSize: ms(46), textAlign: "center", marginTop: ms(8) },
  onbImageWrap: {
    alignItems: "center",
    marginTop: ms(4),
    marginBottom: ms(12),
  },
  onbImage: {
    width: "100%",
    height: ms(170),
    borderRadius: ms(16),
    backgroundColor: "#F2F4F7",
  },
  onbImageCaption: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: colors.textLight,
    marginTop: ms(8),
    textAlign: "center",
  },
  onbTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(20),
    color: colors.text,
    textAlign: "center",
    marginTop: ms(8),
  },
  onbLead: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(13),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(19),
    marginTop: ms(8),
    marginBottom: ms(20),
  },
  onbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(12),
    marginBottom: ms(14),
  },
  onbIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(10),
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  onbText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(13),
    color: colors.text,
  },
  readyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    margin: ms(18),
    height: ms(54),
    borderRadius: ms(18),
    backgroundColor: colors.primary,
  },
  readyText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  camFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(30),
    gap: ms(8),
  },
  camFallbackTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#E2E8F0",
  },
  camFallbackText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "#94A3B8",
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    top: ms(12),
    left: ms(12),
    right: ms(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  phasePill: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(6),
    borderRadius: ms(999),
    backgroundColor: "rgba(34,197,94,0.85)",
  },
  phasePillDown: { backgroundColor: "rgba(239,68,68,0.85)" },
  phasePillWait: { backgroundColor: "rgba(148,163,184,0.9)" },
  positionBanner: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    alignItems: "center",
    paddingHorizontal: ms(28),
    gap: ms(6),
  },
  positionTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 8,
  },
  positionSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 8,
  },
  phaseText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  countOverlay: {
    position: "absolute",
    bottom: ms(18),
    alignSelf: "center",
    alignItems: "center",
  },
  countLabel: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11),
    letterSpacing: 2,
    color: "rgba(255,255,255,0.75)",
  },
  countValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(72),
    lineHeight: ms(80),
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    marginHorizontal: ms(16),
    marginBottom: ms(8),
    marginTop: ms(8),
    height: ms(56),
    borderRadius: ms(18),
    backgroundColor: colors.primary,
  },
  doneBtnDisabled: { backgroundColor: "#475569" },
  doneText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: "#FFFFFF",
  },
});
