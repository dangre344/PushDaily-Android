#!/usr/bin/env node
// Generates Push Daily's notification tunes as small 16-bit mono WAV files.
//
// Synthesised from scratch (sine tones + envelopes), so they are original
// work — no licence, attribution or copyright questions. Re-run after tweaking:
//   node scripts/make-notification-sounds.js
//
// Output: assets/sounds/*.wav — registered in app.json (expo-notifications
// "sounds"), which copies them into android/app/src/main/res/raw at prebuild.
// Android refers to them by file name without the extension, e.g. "jack_ping".

const fs = require("fs");
const path = require("path");

const RATE = 22050;
const OUT = path.join(__dirname, "..", "assets", "sounds");

/** A soft bell-like note: fundamental + a quiet octave, fast attack, smooth decay. */
function note(freq, start, dur, gain = 0.5) {
  return { freq, start, dur, gain };
}

function render(notes, totalSec) {
  const n = Math.round(totalSec * RATE);
  const buf = new Float32Array(n);
  for (const { freq, start, dur, gain, sweepTo } of notes) {
    const s0 = Math.round(start * RATE);
    const len = Math.round(dur * RATE);
    let phase = 0;
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / RATE;
      const f = sweepTo ? freq + (sweepTo - freq) * (i / len) : freq;
      phase += (2 * Math.PI * f) / RATE;
      const attack = Math.min(1, t / 0.02); // 20 ms — a soft start, not a click
      const decay = Math.exp((-4.2 * t) / dur);
      // Mostly the pure fundamental: fewer bright overtones = less piercing.
      const tone = Math.sin(phase) + 0.12 * Math.sin(2 * phase);
      buf[s0 + i] += tone * gain * attack * decay;
    }
  }
  // Normalise to about -9 dBFS (was -3: too loud next to system sounds) and fade the very end so it never cuts off abruptly.
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? 0.35 / peak : 1;
  const fade = Math.round(0.03 * RATE);
  for (let i = 0; i < n; i++) {
    buf[i] *= k * (i > n - fade ? (n - i) / fade : 1);
  }
  return buf;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SOUNDS = {
  // Jack's call-sign: a gentle two-note "do-ding" an octave lower than before
  // (C5 → G5). Workout + period reminders, the quiz.
  jack_ping: render([note(523.3, 0, 0.4, 0.5), note(784.0, 0.16, 0.6, 0.55)], 0.8),

  // Celebration: a rising major arpeggio, an octave lower and softer than
  // before (C5 E5 G5 C6). Push-up challenge / leaderboard and achievements.
  jack_cheer: render(
    [
      note(523.3, 0.0, 0.35, 0.45),
      note(659.3, 0.11, 0.35, 0.45),
      note(784.0, 0.22, 0.35, 0.5),
      note(1046.5, 0.33, 0.6, 0.5),
    ],
    1.0,
  ),

  // A water droplet: a short, round upward "bloop" twice (lower than before). Water reminders.
  jack_drop: render(
    [
      { freq: 330, sweepTo: 700, start: 0, dur: 0.18, gain: 0.6 },
      { freq: 400, sweepTo: 820, start: 0.22, dur: 0.2, gain: 0.5 },
    ],
    0.5,
  ),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, wav(samples));
  console.log(`${name}.wav  ${(fs.statSync(file).size / 1024).toFixed(1)} KB  ${(samples.length / RATE).toFixed(2)}s`);
}
