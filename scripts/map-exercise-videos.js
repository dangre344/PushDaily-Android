#!/usr/bin/env node
// Points every exercise in workoutListGlobal (constants/Constants.js) at its
// looping video in assets/exercise-videos/ by setting `video: "<slug>"`.
//
// Matching: the exercise name is slugged ("Pike Push-Ups" → pike_push_ups) and
// looked up among the rendered videos; names that differ from the library's
// are mapped by hand in ALIASES (checked against each exercise's description).
// Re-run after rendering new videos: existing `video:` lines are replaced.
//
//   node scripts/map-exercise-videos.js          # write
//   node scripts/map-exercise-videos.js --check  # report only

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "constants", "Constants.js");
const VIDEOS = path.join(__dirname, "..", "assets", "exercise-videos");

const library = new Set(
  fs
    .readdirSync(VIDEOS)
    .filter((f) => f.endsWith(".mp4"))
    .map((f) => f.slice(0, -4)),
);

const slugOf = (name) =>
  name
    .toLowerCase()
    .replace(/push[\s-]?ups\b/g, "push_ups")
    .replace(/push[\s-]?up\b/g, "push_up")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// Workout name → library slug, where the names differ.
const ALIASES = {
  "Elevated Push Ups": "incline_push_ups", // hands on a bench or step
  "Push Ups with Shoulder Tap": "push_up_shoulder_taps",
  "Push-Up Hold (Tricep Focus)": "push_up_hold",
  "Dynamic Back Extensions": "back_extension", // face down, lift chest
  "Plank Row Taps": "plank_shoulder_taps", // plank, tap opposite shoulder
  "Standing Arm Swings": "arm_swings",
  "Y-T Raises": "prone_y_t_raises",
  "Wall Bicep Hold (Isometric)": "wall_bicep_hold",
  "Forearm Plank Hold": "plank",
  "Forearm Push Ups": "plank_up_downs", // forearm plank → hands → back down
  "Inverted Rows (Under Table)": "inverted_rows",
  "Bench Dips (Feet Elevated)": "feet_elevated_dips",
  "Towel Bicep Curls (Advanced)": "towel_bicep_curls",
  "Tricep Dips (Chair)": "bench_dips",
  "Tricep Dips": "bench_dips",
  "Leg Raises": "leg_lifts", // lying straight-leg raises
  "Reverse Plank": "reverse_plank_hold",
  "Toe Touch Crunch": "toe_touches",
  "Step Ups (on low step)": "step_ups",
  "Step Ups (Higher)": "step_ups",
  "Step Ups (High)": "step_ups",
  "Step-Ups (High)": "step_ups",
  "Glute Bridges": "bridge",
  "Bridge Hold": "glute_bridge_hold",
  "Single Leg Glute Bridges (Left)": "single_leg_glute_bridge_left",
  "Single Leg Glute Bridges (Right)": "single_leg_glute_bridge_right",
  "Single Leg Bridge (Left)": "single_leg_glute_bridge_left",
  "Single Leg Bridge (Right)": "single_leg_glute_bridge_right",
  "Skater Bounds": "skater_jumps",
  "Skater Steps": "skater_jumps", // "side jumps"
  "Mountain Climbers (Slow)": "mountain_climbers",
  "Plank to Knee Drive": "mountain_climbers", // knee to chest, alternating
  "Plank Shoulder Tap": "plank_shoulder_taps",
  "Shoulder Taps": "plank_shoulder_taps",
  "Arm Raises": "front_arm_raises", // raise arms forward
  "Arm Circles Fast": "arm_circles",
  "Punches Fast": "punches",
  "Punch Combo": "shadow_boxing",
  "Shadow Boxing Fast": "shadow_boxing",
  "Plank Up-Down": "plank_up_downs",
  "Plank Up Down": "plank_up_downs",
  "Plank Jack": "plank_jacks",
  "Handstand Hold": "wall_handstand_hold",
  "Wall Handstand Push-Up": "handstand_push_ups",
  "Standing Calf Raises": "calf_raises",
  "Jumping Lunges": "jump_lunges",
  "Jump Rope (Simulated)": "jump_rope",
  "Fire Hydrants": "fire_hydrants_left",
  "Kickbacks": "glute_kickbacks_standing", // kick leg back, squeeze glutes
  "Wall Hold": "wall_posture_hold", // posture alignment against a wall
  "Shoulder Blade Squeeze": "back_arm_squeeze",
  "Neck Stretch": "neck_side_stretch",
  "Cat Cow": "cat_cow_stretch",
  "Spine Stretch": "seated_spine_stretch",
};

const resolve = (name) => {
  const s = ALIASES[name] || slugOf(name);
  return library.has(s) ? s : null;
};

const src = fs.readFileSync(FILE, "utf8");
const EOL = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(/\r?\n/);
const start = lines.findIndex((l) => l.startsWith("export const workoutListGlobal"));

const out = [];
const missing = new Set();
const used = new Set();
let mapped = 0;
let pending = null; // the video line, waiting for the exercise's photo line
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (i > start) {
    // Drop lines from earlier runs (and the old SVG-zip mapping).
    if (/^\s{8}(video|svg): "/.test(line)) continue;

    const m = line.match(/^(\s{8})name: "([^"]+)",$/);
    if (m) {
      if (pending) out.push(pending); // previous exercise had no photo line
      const slug = resolve(m[2]);
      if (slug) {
        pending = `${m[1]}video: "${slug}",`;
        used.add(slug);
        mapped++;
      } else {
        pending = null;
        missing.add(m[2]);
      }
      out.push(line);
      continue;
    }
    if (pending && /^\s{8}photo: /.test(line)) {
      out.push(line, pending);
      pending = null;
      continue;
    }
  }
  out.push(line);
}

console.log(`${mapped} exercise entries mapped · ${used.size} of ${library.size} videos used`);
console.log(`no video (photo stays): ${[...missing].join(", ") || "none"}`);
console.log(`videos not used by any workout: ${[...library].filter((s) => !used.has(s)).join(", ") || "none"}`);
if (!process.argv.includes("--check")) {
  fs.writeFileSync(FILE, out.join(EOL));
  console.log("updated", path.relative(process.cwd(), FILE));
}
