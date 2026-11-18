import { reloadAppAsync } from "expo";
import { Alert } from "react-native";

import { THEME_KEY, themeMode } from "./colors";
import { Logger } from "./Logger";

export { themeMode };

/**
 * Saves the theme and reloads the app so every screen picks up the new
 * palette (styles are built once at start-up). Never throws.
 * @param {"light"|"dark"|"system"} mode
 */
export async function setThemeMode(mode) {
  if (mode === themeMode) return;
  try {
    const Storage = require("expo-sqlite/kv-store").default;
    Storage.setItemSync(THEME_KEY, mode);
    console.warn("[ThemeDbg] saved", mode, Storage.getItemSync(THEME_KEY)); // TEMP-THEME-DEBUG
  } catch (e) {
    console.warn("[ThemeDbg] save failed", String(e)); // TEMP-THEME-DEBUG
    Logger.log("[Theme] could not save:", String(e));
    return;
  }
  try {
    await reloadAppAsync("theme changed");
  } catch (e) {
    Logger.log("[Theme] reload failed:", String(e));
    Alert.alert("Theme saved", "Close and reopen the app to apply it.");
  }
}
