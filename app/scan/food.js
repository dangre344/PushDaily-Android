import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RewardedAdManager } from "../../ads/Admobmanager";
import { colors } from "../../constants/colors";
import { Logger } from "../../constants/Logger";
import {
  analyzePhoto,
  buildResult,
  hasSeenScanIntro,
  isScanFree,
  lookupBarcode,
  markScanIntroSeen,
  markScanUsed,
} from "../../constants/foodScan";
import {
  addFoodEntry,
  getFoodLog,
  markEaten,
  toSections,
  unhealthyEatenToday,
} from "../../constants/foodLog";
import {
  foodVerdictMessage,
  sayFromJack,
  setBubbleHidden,
} from "../../constants/bubbleMessage";
import { NutritionTableMock } from "./LabelMocks";
import ScanIntro from "./ScanIntro";
import ScannedList from "./ScannedList";
import { successHaptic, tapHaptic, warningHaptic } from "../../constants/haptics";
import { trackEvent, trackScreen } from "../../constants/mixpanel";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128"];

// Specific guidance beats "try again" — each maps to a different user action.
// Vision reads can take 20-40s on the free tier. Silence for that long reads
// as "broken", so the overlay narrates what is happening.
const PROGRESS_STEPS = [
  "📷  Reading the label…",
  "🔎  Finding the nutrition table…",
  "🧾  Checking the ingredients…",
  "⏳  Almost there — hang tight…",
];
const PROGRESS_MS = 4500;

const READ_ERRORS = {
  offline: "No connection. Check your internet and try again.",
  server: "Our reader is unavailable right now. Please try again shortly.",
  quota: "Daily free reads are used up. Please try again tomorrow.",
  too_few:
    "Only part of the table was readable. Include the sugar, fat and salt rows.",
  no_serving:
    "That table is per serving but doesn't show the serving size — try the per-100g column.",
  unreadable:
    "Couldn't read that label. Move closer, hold steady and avoid glare.",
};

export default function FoodScanScreen() {
  const router = useRouter();
  const camera = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Shown as a dialog (not an inline pill) — hitting the daily AI limit is a
  // dead end for now, so it deserves a proper acknowledgement.
  const [limitOpen, setLimitOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState("scan"); // "scan" | "history"
  const [sections, setSections] = useState([]);
  const [entryId, setEntryId] = useState(null);
  const [ate, setAte] = useState(false);
  // Had unhealthy food ALREADY today (eaten, not just scanned).
  const [repeatOffence, setRepeatOffence] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  // The daily allowance is charged when the screen opens, not after a capture.
  const [gateChecked, setGateChecked] = useState(false);
  // "auto" fires the flash only when the scene is dark (photo capture).
  // "on" also keeps the TORCH lit, which is what barcode scanning needs —
  // expo-camera exposes no light sensor, so torch can't be automatic.
  const [flash, setFlash] = useState("auto");
  // Barcode read fine, but the product isn't in the open database.
  const [notFound, setNotFound] = useState(false);
  // Re-opening the explainer from the Scanned tab. Kept separate from
  // `showIntro` so dismissing it returns you to the list rather than
  // re-running the first-run gate.
  const [helpOpen, setHelpOpen] = useState(false);
  const openScannerRef = useRef(null);
  // Stops the barcode callback firing dozens of times per second.
  const handled = useRef(false);
  // null = still checking; true = show the one-time explainer.
  const [showIntro, setShowIntro] = useState(null);
  // Once the gate is passed (free scan or a watched ad) it stays open until a
  // scan actually SUCCEEDS — a failed read must never cost another ad.
  const unlocked = useRef(false);

  const scanLine = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    trackScreen("Food Scan");
    hasSeenScanIntro().then((seen) => setShowIntro(!seen));
    getFoodLog().then((l) => setSections(toSections(l)));
    // Warm the rewarded ad now so the 2nd scan of the day doesn't stall.
    try {
      RewardedAdManager.getInstance().load();
    } catch {}
  }, []);

  // Ask on first open — no extra tap needed when the answer is "not asked yet".
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission?.granted, permission?.canAskAgain]);

  // Runs the daily gate once the intro is out of the way.
  useEffect(() => {
    if (showIntro !== false || gateChecked) return;
    openScannerRef.current?.();
  }, [showIntro, gateChecked]);

  const switchTab = (next) => {
    if (next === tab) return;
    tapHaptic();
    setTab(next);
    if (next === "history") getFoodLog().then((l) => setSections(toSections(l)));
    Animated.timing(tabAnim, {
      toValue: next === "history" ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Walk the progress copy while a read is in flight.
  useEffect(() => {
    if (!busy) {
      setStep(0);
      return;
    }
    const id = setInterval(
      () => setStep((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1)),
      PROGRESS_MS,
    );
    return () => clearInterval(id);
  }, [busy]);

  // Sweeping scan line inside the frame guide.
  useEffect(() => {
    if (result || !permission?.granted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [result, permission?.granted, scanLine]);

  const revealResult = (r) => {
    setResult(r);
    sheet.setValue(0);
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(sheet, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const finish = (product, how) => {
    const r = buildResult(product);
    if (!r || !r.verdict) {
      Logger.log("[FoodScan] ✗ not enough scored nutrients", {
        per100g: r?.per100g,
        rows: r?.rows?.length ?? 0,
      });
      warningHaptic();
      setError(READ_ERRORS.too_few);
      trackEvent("Food Scan Failed", { how });
      handled.current = false;
      return;
    }
    // Torch has served its purpose; drop back to auto so it isn't left on.
    setFlash((f) => (f === "on" ? "auto" : f));
    Logger.log("[FoodScan] 5/5 verdict", {
      verdict: r.verdict,
      nutrients: r.rows.length,
      allergens: r.allergens.length,
    });
    // Charged only now that there is a real result on screen.
    markScanUsed();
    unlocked.current = false;

    // Persist the scan (not eaten yet) and see whether they've already had
    // something unhealthy today.
    (async () => {
      const entry = await addFoodEntry(r, false);
      setEntryId(entry?.id || null);
      setAte(false);

      const prior = await unhealthyEatenToday();
      const repeat = r.verdict === "avoid" && prior.length > 0;
      setRepeatOffence(repeat);

      getFoodLog().then((l) => setSections(toSections(l)));
      // Jack reacts a beat later so it doesn't collide with the reveal.
      setTimeout(
        () => sayFromJack(foodVerdictMessage(r.verdict, repeat), 6000),
        900,
      );
    })();
    successHaptic();
    // Uploaded only on a successful, rendered result.
    trackEvent("Food Scan Result", {
      how, // "barcode" | "photo"
      verdict: r.verdict,
      product: r.name,
      allergens: r.allergens,
      allergenCount: r.allergens.length,
      notSuitableFor: r.notFor.map((n) => n.who),
      sugars_g: r.per100g?.sugars_g ?? null,
      fat_g: r.per100g?.fat_g ?? null,
      saturates_g: r.per100g?.saturates_g ?? null,
      salt_g: r.per100g?.salt_g ?? null,
      nutrientsRead: r.rows.length,
    });
    revealResult(r);
  };

  /**
   * First scan each day is free. After that the rewarded ad plays straight
   * away — no confirmation dialog, per product decision.
   * @return true when the scan may proceed.
   */
  const passesGate = async () => {
    if (unlocked.current) return true; // already paid for this visit

    const mgr = RewardedAdManager.getInstance();
    if (!mgr.isLoaded()) {
      mgr.load();
      setError("Ad is still loading — try again in a moment.");
      return false;
    }
    const { earned } = await mgr.show();
    if (!earned) {
      setError("Watch the full ad to unlock another scan.");
      return false;
    }
    trackEvent("Food Scan Ad Watched");
    unlocked.current = true;
    return true;
  };

  // Charged the moment the scanner opens — the ad plays BEFORE the camera,
  // never after a capture, so the user is never left holding a result they
  // then have to pay to see.
  const openScanner = async () => {
    if (await isScanFree()) {
      unlocked.current = true;
      setGateChecked(true);
      return;
    }
    const ok = await passesGate();
    setGateChecked(ok);
    if (!ok) router.back(); // declined the ad — nothing to show
  };
  openScannerRef.current = openScanner;

  const onBarcode = async ({ data }) => {
    if (handled.current || busy || result) return;
    handled.current = true;
    tapHaptic();
    setError(null);
    setNotFound(false);
    setBusy(true);
    const product = await lookupBarcode(data);
    setBusy(false);
    if (!product) {
      // Expected outcome, not a failure: the food database is crowd-sourced
      // and many regional brands simply aren't in it yet.
      setNotFound(true);
      handled.current = false;
      trackEvent("Food Scan Barcode Miss", { barcode: String(data).slice(0, 20) });
      return;
    }
    finish(product, "barcode");
  };

  const onCapture = async () => {
    if (busy) return;
    tapHaptic();
    setError(null);
    setBusy(true);
    const t0 = Date.now();
    try {
      Logger.log("[FoodScan] 1/5 capturing…");
      // NOTE: do NOT set skipProcessing — it bypasses the whole processing
      // pipeline, which silently DISCARDS `quality` and yields a full-size
      // image that blows past the upload limit. `imageType`/`scale` are
      // web-only, so JPEG quality is the only size lever expo-camera gives us.
      const shot = await camera.current?.takePictureAsync({
        base64: true,
        quality: 0.3,
      });

      if (!shot?.base64) {
        Logger.log("[FoodScan] ✗ capture returned no base64", {
          hasShot: !!shot,
          keys: shot ? Object.keys(shot) : null,
        });
        throw new Error("no image");
      }

      const kb = Math.round((shot.base64.length * 3) / 4 / 1024);
      Logger.log("[FoodScan] 2/5 captured", {
        px: `${shot.width}x${shot.height}`,
        base64Chars: shot.base64.length,
        approxKB: kb,
        ms: Date.now() - t0,
      });
      // The Worker rejects anything over ~4M chars — catch it here with a
      // message the user can act on instead of a generic failure.
      if (shot.base64.length > 3_900_000) {
        Logger.log("[FoodScan] ✗ image too large", { approxKB: kb });
        setBusy(false);
        warningHaptic();
        setError(
          "This camera produces very large photos. Try the barcode instead — it's faster and more accurate.",
        );
        return;
      }
      Logger.log("[FoodScan] 3/5 sending to reader…");
      const res = await analyzePhoto(shot.base64);
      setBusy(false);
      Logger.log("[FoodScan] 4/5 reader replied", {
        ok: !res?.reason,
        reason: res?.reason || null,
        name: res?.name || null,
        totalMs: Date.now() - t0,
      });

      if (res?.reason) {
        warningHaptic();
        Logger.log("[FoodScan] label read failed:", res.reason);
        if (res.reason === "quota") {
          trackEvent("Food Scan Quota Hit");
          setLimitOpen(true);
        } else {
          setError(READ_ERRORS[res.reason] || READ_ERRORS.unreadable);
        }
        return;
      }
      finish(res, "photo");
    } catch (e) {
      setBusy(false);
      warningHaptic();
      setError("Something went wrong. Please try again.");
      Logger.log("[FoodScan] capture error:", String(e));
    }
  };

  // Never leave the torch burning after the screen is gone.
  useEffect(() => () => setFlash("auto"), []);

  // The bubble would sit on top of the viewfinder, so hide it while the camera
  // is live — but bring it back for the result, which is exactly where Jack's
  // verdict message needs to land.
  useEffect(() => {
    const overCamera = tab === "scan" && !result && !helpOpen && !showIntro;
    setBubbleHidden(overCamera);
  }, [tab, result, helpOpen, showIntro]);

  useEffect(() => () => setBubbleHidden(false), []);

  const scanAgain = () => {
    tapHaptic();
    setResult(null);
    setError(null);
    setNotFound(false);
    handled.current = false;
  };

  // Opened on demand from the Scanned tab.
  if (helpOpen) {
    return (
      <ScanIntro
        ctaLabel="Got it"
        onStart={() => {
          tapHaptic();
          setHelpOpen(false);
        }}
      />
    );
  }

  // ── One-time "how it works" ───────────────────────────────────────────────
  if (showIntro === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (showIntro) {
    return (
      <ScanIntro
        onStart={() => {
          tapHaptic();
          markScanIntroSeen();
          trackEvent("Food Scan Intro Completed");
          setShowIntro(false);
        }}
      />
    );
  }

  // Ad (if owed) plays before the camera ever appears — see the effect above.
  if (!gateChecked && tab === "scan") {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Permission states ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.permEmoji}>📷</Text>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permText}>
          We use the camera only to read food labels and barcodes. Nothing is
          stored or shared.
        </Text>

        <TouchableOpacity
          style={styles.permBtn}
          activeOpacity={0.9}
          onPress={() =>
            permission.canAskAgain ? requestPermission() : Linking.openSettings()
          }
        >
          <Ionicons name="camera" size={ms(17)} color="#FFFFFF" />
          <Text style={styles.permBtnText}>
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.permBack}>
          <Text style={styles.permBackText}>Not now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Scanner ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        // Torch only on "on" — leaving it lit in auto would drain the battery
        // and blow out close-up labels.
        enableTorch={flash === "on"}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={result ? undefined : onBarcode}
      />

      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Ionicons name="close" size={ms(20)} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Packet food scanner</Text>

          {tab === "scan" ? (
            <TouchableOpacity
              style={[styles.iconBtn, flash !== "off" && styles.iconBtnOn]}
              onPress={() => {
                tapHaptic();
                setFlash((f) =>
                  f === "auto" ? "on" : f === "on" ? "off" : "auto",
                );
              }}
              hitSlop={10}
            >
              <Ionicons
                name={
                  flash === "off"
                    ? "flash-off"
                    : flash === "on"
                      ? "flashlight"
                      : "flash"
                }
                size={ms(18)}
                color={flash === "off" ? "#FFFFFF" : "#111827"}
              />
            </TouchableOpacity>
          ) : (
            <View style={{ width: ms(36) }} />
          )}
        </View>

        <View style={styles.tabs}>
          {[
            { key: "scan", label: "Scan", icon: "scan-outline" },
            { key: "history", label: "Scanned", icon: "list-outline" },
          ].map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, on && styles.tabOn]}
                activeOpacity={0.85}
                onPress={() => switchTab(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={ms(14)}
                  color={on ? colors.primary : "rgba(255,255,255,0.85)"}
                />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === "history" ? (
          <Animated.View
            style={[
              styles.pane,
              {
                opacity: tabAnim,
                transform: [
                  {
                    translateX: tabAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [ms(28), 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScannedList
              sections={sections}
              onHelp={() => {
                tapHaptic();
                trackEvent("Food Scan Help Opened");
                setHelpOpen(true);
              }}
            />
          </Animated.View>
        ) : !result ? (
          <>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />

              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [
                      {
                        translateY: scanLine.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, ms(210)],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>

            <Text style={styles.hint}>
              Point at the <Text style={styles.hintStrong}>barcode</Text> — or
              snap the nutrition table below
            </Text>

            <Text style={styles.flashHint}>
              {flash === "auto"
                ? "⚡ Flash: auto"
                : flash === "on"
                  ? "🔦 Torch on"
                  : "🚫 Flash off"}
            </Text>

            {notFound ? (
              <View style={styles.missCard}>
                <Text style={styles.missEmoji}>🔎</Text>
                <Text style={styles.missTitle}>New product for us!</Text>
                <Text style={styles.missText}>
                  Not in the food database yet — photograph the nutrition table
                  instead. It looks like this:
                </Text>

                <View style={styles.missMock}>
                  <NutritionTableMock compact />
                </View>

                <Text style={styles.missCta}>
                  Point at it and tap the shutter 👇
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorPill}>
                <Ionicons name="alert-circle" size={ms(14)} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={styles.shutter}
              activeOpacity={0.85}
              onPress={onCapture}
              disabled={busy}
            >
              <Ionicons name="camera" size={ms(26)} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.shutterHint}>Tap to read the label</Text>
          </>
        ) : (
          <ResultSheet
            result={result}
            sheet={sheet}
            pop={pop}
            repeat={repeatOffence}
            ate={ate}
            onAgain={scanAgain}
            onAte={async () => {
              tapHaptic();
              setAte(true);
              if (entryId) await markEaten(entryId);
              trackEvent("Food Marked Eaten", {
                verdict: result.verdict,
                product: result.name,
                repeatUnhealthy: repeatOffence,
              });
              getFoodLog().then((l) => setSections(toSections(l)));
            }}
          />
        )}

        {/* Rendered last so it sits above every sibling. */}
        {busy ? (
          <View style={styles.working} pointerEvents="auto">
            <View style={styles.workingCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.workingTitle}>{PROGRESS_STEPS[step]}</Text>
              <Text style={styles.workingSub}>
                This can take up to a minute. Please keep the app open.
              </Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={limitOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setLimitOpen(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogEmoji}>⏳</Text>
            <Text style={styles.dialogTitle}>Reader is busy today</Text>
            <Text style={styles.dialogText}>
              Due to low credits we can&apos;t process this right now. Please
              check back later — scanning a barcode still works.
            </Text>

            <TouchableOpacity
              style={styles.dialogBtn}
              activeOpacity={0.9}
              onPress={() => {
                tapHaptic();
                setLimitOpen(false);
              }}
            >
              <Text style={styles.dialogBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Result ──────────────────────────────────────────────────────────────────
function ResultSheet({ result, sheet, pop, onAgain, repeat, ate, onAte }) {
  const { meta, rows, allergens, notFor, name, image, lowConfidence } = result;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: sheet,
          transform: [
            {
              translateY: sheet.interpolate({
                inputRange: [0, 1],
                outputRange: [ms(40), 0],
              }),
            },
          ],
        },
      ]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[styles.verdictRow, { transform: [{ scale: pop }] }]}
        >
          <Text style={styles.verdictEmoji}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.verdictTitle, { color: meta.color }]}>
              {meta.title}
            </Text>
            <Text style={styles.verdictBlurb}>{meta.blurb}</Text>
          </View>
          {image ? (
            <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" />
          ) : null}
        </Animated.View>

        <Text style={styles.productName} numberOfLines={2}>
          {name}
        </Text>

        {/* Second unhealthy item today — say so plainly. */}
        {repeat ? (
          <View style={styles.repeatBox}>
            <Text style={styles.repeatEmoji}>😤</Text>
            <Text style={styles.repeatText}>
              You&apos;ve already eaten something unhealthy today. Maybe give
              this one a miss.
            </Text>
          </View>
        ) : null}

        {/* Per-100g breakdown — the arithmetic behind the verdict */}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Per 100g</Text>
          {rows.map((r) => (
            <View key={r.key} style={styles.nutriRow}>
              <Text style={styles.nutriEmoji}>{r.emoji}</Text>
              <Text style={styles.nutriLabel}>{r.label}</Text>
              <Text style={styles.nutriValue}>{r.value}g</Text>
            </View>
          ))}
        </View>

        {/* Allergens — hidden entirely when the text looked truncated, rather
            than showing a partial (and dangerously reassuring) list. */}
        {!lowConfidence ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>⚠️ Contains</Text>
            {allergens.length ? (
              <View style={styles.chips}>
                {allergens.map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>
                No declared allergens found in the text we could read.
              </Text>
            )}
          </View>
        ) : null}

        {notFor.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>🚫 May not suit</Text>
            {notFor.map((n) => (
              <View key={n.who} style={styles.notForRow}>
                <Text style={styles.nutriEmoji}>{n.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notForWho}>{n.who}</Text>
                  <Text style={styles.notForWhy}>{n.why}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            This result is based on the data we could read. Please check your
            own allergies — whether to eat it is your decision.
          </Text>
        </View>

        <Text style={styles.ateHint}>
          Mark it as eaten and we&apos;ll track it — and warn you if too much
          unhealthy food stacks up.
        </Text>

        <TouchableOpacity
          style={[styles.ateBtn, ate && styles.ateBtnDone]}
          activeOpacity={0.9}
          onPress={onAte}
          disabled={ate}
        >
          <Ionicons
            name={ate ? "checkmark-circle" : "restaurant-outline"}
            size={ms(16)}
            color={ate ? "#0F766E" : "#FFFFFF"}
          />
          <Text style={[styles.ateBtnText, ate && styles.ateBtnTextDone]}>
            {ate ? "Marked as eaten" : "I am eating this"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.againBtn}
          activeOpacity={0.9}
          onPress={onAgain}
        >
          <Ionicons name="scan" size={ms(16)} color={colors.primary} />
          <Text style={styles.againText}>Scan another</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  center: { alignItems: "center", justifyContent: "center", padding: ms(28) },
  overlay: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
  },
  iconBtnOn: { backgroundColor: "#FDE68A" },
  iconBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(14),
    color: "#FFFFFF",
  },

  frame: {
    alignSelf: "center",
    width: ms(250),
    height: ms(220),
    marginTop: ms(24),
  },
  corner: {
    position: "absolute",
    width: ms(28),
    height: ms(28),
    borderColor: colors.primary,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: ms(10) },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: ms(10) },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: ms(10) },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: ms(10) },
  scanLine: {
    position: "absolute",
    left: ms(6),
    right: ms(6),
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.9,
  },

  hint: {
    textAlign: "center",
    marginTop: ms(18),
    paddingHorizontal: ms(30),
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.9)",
    lineHeight: ms(18),
  },
  hintStrong: { fontFamily: "OpenSans_800ExtraBold", color: colors.primary },

  missCard: {
    alignSelf: "center",
    alignItems: "center",
    marginTop: ms(16),
    marginHorizontal: ms(22),
    paddingVertical: ms(14),
    paddingHorizontal: ms(16),
    borderRadius: ms(16),
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  missEmoji: { fontSize: ms(24), marginBottom: ms(4) },
  missTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.text,
  },
  missText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(16),
    marginTop: ms(4),
  },
  missMock: { alignSelf: "stretch", marginTop: ms(10) },
  missCta: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(11),
    color: colors.primary,
    marginTop: ms(10),
  },
  flashHint: {
    textAlign: "center",
    marginTop: ms(6),
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(10),
    color: "rgba(255,255,255,0.8)",
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(7),
    alignSelf: "center",
    marginTop: ms(14),
    marginHorizontal: ms(24),
    paddingHorizontal: ms(12),
    paddingVertical: ms(9),
    borderRadius: ms(12),
    backgroundColor: "rgba(127,29,29,0.85)",
  },
  errorText: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: "#FEE2E2",
    lineHeight: ms(16),
  },

  shutter: {
    alignSelf: "center",
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: ms(4),
    borderColor: "rgba(255,255,255,0.35)",
  },
  shutterHint: {
    textAlign: "center",
    marginTop: ms(8),
    marginBottom: ms(10),
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(11),
    color: "rgba(255,255,255,0.85)",
  },

  // ── Result sheet ──
  sheet: {
    flex: 1,
    marginTop: ms(10),
    marginHorizontal: ms(12),
    marginBottom: ms(10),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(22),
    padding: ms(16),
  },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: ms(12) },
  verdictEmoji: { fontSize: ms(34) },
  verdictTitle: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(18) },
  verdictBlurb: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.textLight,
    marginTop: ms(2),
  },
  thumb: { width: ms(46), height: ms(46), borderRadius: ms(10) },

  productName: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(13),
    color: colors.text,
    marginTop: ms(12),
  },

  block: {
    marginTop: ms(14),
    padding: ms(12),
    borderRadius: ms(14),
    backgroundColor: "#F7F8FA",
  },
  blockTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
    marginBottom: ms(8),
  },

  nutriRow: { flexDirection: "row", alignItems: "center", gap: ms(9), paddingVertical: ms(4) },
  nutriEmoji: { fontSize: ms(13) },
  nutriLabel: {
    flex: 1,
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: colors.text,
  },
  nutriValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12),
    color: colors.text,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: ms(7) },
  chip: {
    paddingHorizontal: ms(11),
    paddingVertical: ms(6),
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  chipText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11),
    color: "#92400E",
  },
  muted: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    lineHeight: ms(16),
  },

  notForRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ms(9),
    paddingVertical: ms(5),
  },
  notForWho: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.text,
  },
  notForWhy: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
  },

  noteBox: {
    marginTop: ms(14),
    padding: ms(11),
    borderRadius: ms(12),
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noteText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10),
    color: "#92400E",
    lineHeight: ms(15),
    textAlign: "center",
  },

  againBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(44),
    borderRadius: ms(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: ms(10),
  },
  againText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(12.5),
    color: colors.primary,
  },

  tabs: {
    flexDirection: "row",
    gap: ms(8),
    paddingHorizontal: ms(14),
    paddingBottom: ms(10),
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(6),
    flex: 1,
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  tabOn: { backgroundColor: "#FFFFFF" },
  tabText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.85)",
  },
  tabTextOn: { color: colors.primary },

  pane: { flex: 1, backgroundColor: "#F7F8FA" },

  repeatBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginTop: ms(12),
    padding: ms(12),
    borderRadius: ms(14),
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  repeatEmoji: { fontSize: ms(20) },
  repeatText: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(11.5),
    color: "#991B1B",
    lineHeight: ms(16),
  },

  ateHint: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10.5),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(15),
    marginTop: ms(14),
    marginBottom: ms(8),
  },
  ateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(48),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
  },
  ateBtnDone: {
    backgroundColor: "#CCFBF1",
    borderWidth: 1,
    borderColor: "#5EEAD4",
  },
  ateBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: "#FFFFFF",
  },
  ateBtnTextDone: { color: "#0F766E" },

  working: {
    ...StyleSheet.absoluteFillObject,
    elevation: 30, // Android paints by elevation, not zIndex alone
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(30),
    zIndex: 10,
  },
  workingCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(20),
    paddingVertical: ms(24),
    paddingHorizontal: ms(22),
    alignSelf: "stretch",
  },
  workingTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13.5),
    color: colors.text,
    textAlign: "center",
    marginTop: ms(14),
  },
  workingSub: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(16),
    marginTop: ms(6),
  },

  // ── Credits dialog ──
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(28),
  },
  dialog: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(22),
    padding: ms(20),
    alignItems: "center",
  },
  dialogEmoji: { fontSize: ms(34), marginBottom: ms(8) },
  dialogTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(16),
    color: colors.text,
    textAlign: "center",
  },
  dialogText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: ms(6),
    marginBottom: ms(18),
  },
  dialogBtn: {
    alignSelf: "stretch",
    height: ms(46),
    borderRadius: ms(14),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: "#FFFFFF",
  },

  // ── Permission ──
  permEmoji: { fontSize: ms(48), marginBottom: ms(12) },
  permTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(17),
    color: "#FFFFFF",
    textAlign: "center",
  },
  permText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: ms(18),
    marginTop: ms(8),
    marginBottom: ms(22),
  },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(8),
    height: ms(48),
    paddingHorizontal: ms(26),
    borderRadius: ms(15),
    backgroundColor: colors.primary,
  },
  permBtnText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: "#FFFFFF",
  },
  permBack: { marginTop: ms(14), padding: ms(8) },
  permBackText: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(12),
    color: "rgba(255,255,255,0.6)",
  },
});
