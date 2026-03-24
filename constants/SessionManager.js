import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logger } from "./Logger";

const SESSION_KEY = "@user_session";

/**
 * Save session data
 * @param {Object} sessionData
 */
export const saveSession = async (sessionData) => {
  try {
    const jsonValue = JSON.stringify(sessionData);
    await AsyncStorage.setItem(SESSION_KEY, jsonValue);
    console.log("✅ Session saved:", sessionData);
  } catch (e) {
    console.error("❌ Error saving session:", e);
  }
};

/**
 * Get session data
 * @returns {Object|null}
 */
export const getSession = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(SESSION_KEY);

    Logger.log("🔍 Retrieved session JSON:", jsonValue);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("❌ Error reading session:", e);
    return null;
  }
};

/**
 * Clear session data
 */
export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    console.log("🧹 Session cleared");
  } catch (e) {
    console.error("❌ Error clearing session:", e);
  }
};
