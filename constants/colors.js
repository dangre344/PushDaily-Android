import { Appearance } from "react-native";

// ─── Light / dark theme ──────────────────────────────────────────────────────
// Styles across the app are built once at module load (StyleSheet.create), so
// the palette must be decided before any screen imports it. The choice is read
// SYNCHRONOUSLY here; changing it saves and reloads the JS (see themeMode.js).

export const THEME_KEY = "themeMode"; // "light" | "dark" | "system"

const readMode = () => {
  try {
    const Storage = require("expo-sqlite/kv-store").default;
    const v = Storage.getItemSync(THEME_KEY);
    console.warn("[ThemeDbg] read", v); // TEMP-THEME-DEBUG
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch (e) {
    console.warn("[ThemeDbg] read failed", String(e)); // TEMP-THEME-DEBUG
  }
  return "light"; // the app was designed light; keep it unless chosen
};

export const themeMode = readMode();
export const isDark =
  themeMode === "dark" ||
  (themeMode === "system" && Appearance.getColorScheme() === "dark");

const light = {
  primary: "#FF6B35",
  secondary: "#F7931E",
  accent: "#FFD23F",
  background: "#FFFFFF",
  surface: "#F5F5F5",
  text: "#2D3436",
  textLight: "#636E72",
  white: "#FFFFFF",
  border: "#DFE6E9",
  success: "#00B894",
  error: "#D63031",
  dark: "#2D3436",
  gradient1: "#FF6B35",
  gradient2: "#F7931E",
  errorRed: "#E82222",
  lightRed: "#DF7C7C",
  grey: "#D3D3D3",
  green: "#008000",
  lightColor: "#F7FAFC",
  elevated: "#222222",
  muted: "#888888",
  dim: "#444444",

  // Theme tokens used in place of hard-coded neutrals.
  card: "#FFFFFF", // cards, sheets, tab bar
  screen: "#F7F8FA", // light grey screen backgrounds
  track: "#E2E8F0", // progress tracks, dividers filled
  hairline: "#EEF0F4", // card borders
  primarySoft: "#FFF3EE", // orange-tinted chips and banners
  textStrong: "#0F172A",
  textMuted: "#64748B",
};

const dark = {
  ...light,
  primary: "#FF7A45",
  gradient1: "#FF7A45",
  background: "#121318",
  surface: "#1C1E26",
  text: "#F3F4F6",
  textLight: "#9CA3AF",
  border: "#2A2D38",
  dark: "#F3F4F6",
  grey: "#3A3D48",
  lightColor: "#1A1C23",
  elevated: "#2A2D38",
  muted: "#9CA3AF",
  dim: "#C7CBD3",

  card: "#1C1E26",
  screen: "#121318",
  track: "#2A2D38",
  hairline: "#2A2D38",
  primarySoft: "#3A2418",
  textStrong: "#F9FAFB",
  textMuted: "#9CA3AF",
};

export const colors = isDark ? dark : light;
