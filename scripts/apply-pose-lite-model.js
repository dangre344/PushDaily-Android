/**
 * Swaps the pose model bundled in @thinksys/react-native-mediapipe from FULL
 * to LITE for mid-range device support.
 *
 * The library hardcodes the asset name `pose_landmarker_full.task`, so we
 * overwrite that file's CONTENT with the official MediaPipe LITE model
 * (committed at scripts/models/pose_landmarker_lite.task) — no native code
 * changes needed. Runs on `postinstall`, so it re-applies after npm install.
 *
 * NOTE: this changes a native Android asset → requires a native rebuild
 * (expo run:android / gradle assemble*) to take effect.
 */
const fs = require("fs");
const path = require("path");

const LITE = path.join(__dirname, "models", "pose_landmarker_lite.task");
const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "@thinksys",
  "react-native-mediapipe",
  "android",
  "src",
  "main",
  "assets",
  "pose_landmarker_full.task",
);

try {
  if (!fs.existsSync(LITE)) {
    console.warn("[pose-lite] lite model missing at", LITE, "— skipping");
    process.exit(0);
  }
  if (!fs.existsSync(TARGET)) {
    console.warn("[pose-lite] mediapipe package not installed — skipping");
    process.exit(0);
  }

  const liteSize = fs.statSync(LITE).size;
  const targetSize = fs.statSync(TARGET).size;

  if (liteSize === targetSize) {
    console.log("[pose-lite] lite model already applied ✔");
    process.exit(0);
  }

  fs.copyFileSync(LITE, TARGET);
  console.log(
    `[pose-lite] replaced full model (${(targetSize / 1e6).toFixed(1)}MB) ` +
      `with lite (${(liteSize / 1e6).toFixed(1)}MB) ✔ — rebuild the app to apply`,
  );
} catch (e) {
  console.warn("[pose-lite] failed:", e.message);
  process.exit(0); // never break install
}
