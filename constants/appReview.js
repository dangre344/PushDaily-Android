import AsyncStorage from "@react-native-async-storage/async-storage";
import Rate, { AndroidMarket } from "react-native-rate";
import { Logger } from "./Logger";

// Show the Play Store in-app review nudge once the user has built a habit
// (more than 7–8 workouts). Google's in-app review dialog submits the rating
// without leaving the app.
const REVIEW_PROMPTED_KEY = "appReviewPromptedAt";
const MIN_WORKOUTS = 8; // "more than 7–8"
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 45; // don't re-ask for ~45 days

const PACKAGE_NAME = "com.pushdaily.homeworkout.fit";

const options = {
  AppleAppID: "123456789", // replace with real App Store ID when on iOS
  GooglePackageName: PACKAGE_NAME,
  preferredAndroidMarket: AndroidMarket.Google,
  preferInApp: true, // use the native in-app review dialog
  openAppStoreIfInAppFails: false, // silent nudge — don't yank user to the store
  fallbackPlatformURL: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`,
};

/**
 * Asks for an in-app review IF the user has crossed the workout threshold and
 * we haven't asked recently. Driven by a count the caller already has in hand
 * (e.g. stats.totalWorkouts) — no extra DB query.
 *
 * Note: Google never tells us whether the user actually rated, and quota-limits
 * how often the dialog can appear, so we guard with our own cooldown flag and
 * set it BEFORE prompting to avoid double-triggering on re-renders.
 */
export const maybeAskForReview = async (totalWorkouts) => {
  try {
    if (Number(totalWorkouts || 0) < MIN_WORKOUTS) return;

    const last = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
    if (last && Date.now() - Number(last) < COOLDOWN_MS) return;

    // Mark first so a quick re-render / second screen can't double-prompt.
    await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, String(Date.now()));

    Rate.rate(options, (success, errorMessage) => {
      Logger.log(
        "[Review] in-app review flow:",
        success ? "shown" : "not shown",
        errorMessage || "",
      );
    });
  } catch (e) {
    Logger.log("[Review] maybeAskForReview failed:", String(e));
  }
};
