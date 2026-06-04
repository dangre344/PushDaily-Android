import { Platform } from "react-native";
import SpInAppUpdates, {
  IAUInstallStatus,
  IAUUpdateKind,
} from "sp-react-native-in-app-updates";
import { Logger } from "./Logger";

/**
 * In-App Update nudge (Google Play).
 *
 * Uses Google Play Core's native In-App Updates UI — the exact same update
 * sheet Play shows — so the user never leaves the app to update.
 *
 * IMPORTANT — this does NOT touch local data. A Play Store update keeps all app
 * storage (SQLite workouts.db + AsyncStorage session) intact. Data is only
 * removed on a full uninstall, never on an update. We also never drop/recreate
 * tables (schema uses CREATE TABLE IF NOT EXISTS), so user history is preserved.
 *
 * Notes:
 * - Only works on builds installed from the Play Store (internal testing track
 *   or production) with a HIGHER versionCode available. It no-ops in dev builds.
 * - FLEXIBLE = non-blocking "nudge": downloads in the background, then we prompt
 *   to restart. IMMEDIATE = full-screen blocking flow.
 */

// isDebug=false so it talks to the real Play Store (debug mode uses fake data).
let _inAppUpdates = null;
const getUpdater = () => {
  if (_inAppUpdates) return _inAppUpdates;
  try {
    _inAppUpdates = new SpInAppUpdates(false);
    return _inAppUpdates;
  } catch (e) {
    Logger.log("[Update] In-app updates not available:", String(e));
    return null;
  }
};

/**
 * Checks the store for a higher version and, if found, launches the Play
 * update flow. Safe to call on every app launch.
 *
 * @param {"flexible"|"immediate"} kind  Update style. Default "flexible".
 */
export const checkForAppUpdate = async (kind = "flexible") => {
  // iOS uses a different (App Store redirect) flow; keep this Android-only.
  if (Platform.OS !== "android") return;

  const updater = getUpdater();
  if (!updater) return;

  try {
    const result = await updater.checkNeedsUpdate();

    if (!result?.shouldUpdate) {
      Logger.log("[Update] App is up to date.");
      return;
    }

    Logger.log(
      `[Update] Newer version available (store: ${result.storeVersion}). Starting ${kind} update.`,
    );

    const updateType =
      kind === "immediate" ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE;

    // For a flexible update, listen for the background download to finish, then
    // show Play's "restart to install" prompt. This is what actually applies
    // the update — and it preserves all local data.
    if (updateType === IAUUpdateKind.FLEXIBLE) {
      const onStatus = (status) => {
        if (status?.status === IAUInstallStatus.DOWNLOADED) {
          Logger.log("[Update] Download complete — prompting install.");
          updater.installUpdate();
          updater.removeStatusUpdateListener(onStatus);
        }
      };
      updater.addStatusUpdateListener(onStatus);
    }

    await updater.startUpdate({ updateType });
  } catch (e) {
    Logger.log("[Update] checkForAppUpdate failed:", String(e));
  }
};
