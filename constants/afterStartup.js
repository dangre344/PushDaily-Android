import { InteractionManager } from "react-native";

import { Logger } from "./Logger";

/**
 * Runs `fn` once the first screen has rendered and settled, plus `delayMs`,
 * so start-up work (ad preloads, update checks, reminder rescheduling) doesn't
 * compete with drawing the home screen. Errors are logged, never thrown.
 *
 * @returns a cancel function (use it as an effect cleanup)
 */
export const runAfterStartup = (fn, delayMs = 1500) => {
  let cancelled = false;
  let timer = null;
  const task = InteractionManager.runAfterInteractions(() => {
    timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await fn();
      } catch (e) {
        Logger.log("[afterStartup] task failed:", String(e));
      }
    }, delayMs);
  });
  return () => {
    cancelled = true;
    task?.cancel?.();
    if (timer) clearTimeout(timer);
  };
};
