import * as Speech from "expo-speech";

import { Logger } from "./Logger";

// ─── Coach voice ────────────────────────────────────────────────────────────
// Spoken instructions use a deep male English voice when the phone has one,
// instead of whatever the phone's default happens to be. The voice is picked
// once and cached. Phones without a male voice keep their default voice but
// with a lowered pitch, so it still sounds deeper.

// Known male voices, best first: Google TTS ids (most Android phones; the
// "-local" variants work offline) and iOS voice names.
const MALE_VOICES = [
  "en-us-x-iom", "en-us-x-tpd", "en-us-x-iol", "en-gb-x-rjs", "en-gb-x-gbd", "en-au-x-aud",
  "aaron", "daniel", "arthur", "gordon", "fred", "tom", "alex", "rishi",
];

// Pitch multiplier: deep, but not robotic.
const DEEP_PITCH = 0.8;
// Without a male voice the default (often female) voice needs to go lower.
const FALLBACK_PITCH = 0.7;

let chosen = null; // { identifier, language } once found
let pitchScale = FALLBACK_PITCH;
let loading = null;

const rank = (v) => {
  const id = `${v.identifier || ""} ${v.name || ""}`.toLowerCase();
  const i = MALE_VOICES.findIndex((m) => id.includes(m));
  if (i >= 0) return i * 2 + (id.includes("network") ? 1 : 0); // prefer offline
  // Some engines just label voices "male".
  return /(^|[^e])male/.test(id) ? 100 : -1;
};

/** Picks the voice once (call early, e.g. when a workout opens). Never throws. */
export const prepareCoachVoice = () => {
  if (!loading) {
    loading = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const best = (voices || [])
          .filter((v) => /^en/i.test(v.language || "") && rank(v) >= 0)
          .sort((a, b) => rank(a) - rank(b))[0];
        if (best) {
          chosen = { identifier: best.identifier, language: best.language };
          pitchScale = DEEP_PITCH;
        }
        Logger.log("[CoachVoice]", best ? best.identifier : "no male voice — lowered pitch");
      })
      .catch((e) => Logger.log("[CoachVoice] voice list failed:", String(e)));
  }
  return loading;
};

/**
 * Speech options for the coach: merges the deep voice into `options`.
 * `options.pitch` is relative (1 = the coach's normal pitch).
 */
export const coachVoice = (options = {}) => {
  prepareCoachVoice();
  return {
    ...options,
    language: chosen?.language || "en-US",
    ...(chosen ? { voice: chosen.identifier } : null),
    pitch: (options.pitch ?? 1) * pitchScale,
  };
};
