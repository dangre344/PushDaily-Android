import { useRef, useState } from "react";
import { Toast } from "toastify-react-native";

import { RewardedAdManager } from "../../../ads/Admobmanager";
import { trackEvent } from "../../../constants/mixpanel";
import {
  isRecommendationFree,
  markRecommendationUsed,
  recommendAlternative,
  recommendToday,
} from "../../../constants/trainRecommendation";

/**
 * "What to train today".
 *
 * Analyses the last 7 days on device and suggests the body part that has
 * recovered longest. The first analysis each day is free; after that it costs
 * a rewarded ad — "Plan again" included.
 *
 * `analyze({ again: true })` swaps to a related body part (Chest → Shoulder,
 * Back → Arms…) instead of repeating the same answer, and never repeats one
 * already shown in this round until the options run out.
 */
export default function useTrainToday(history = [], { experience } = {}) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const shown = useRef([]); // body parts suggested in this round

  const analyze = async ({ again = false } = {}) => {
    if (busy) return;
    setBusy(true);

    const isFree = await isRecommendationFree();

    if (!isFree) {
      const mgr = RewardedAdManager.getInstance();
      if (!mgr.isLoaded()) {
        mgr.load();
        Toast.info("Ad is loading, try again in a moment", "top");
        setBusy(false);
        return;
      }
      const { earned } = await mgr.show();
      if (!earned) {
        Toast.info("Watch the full ad to unlock another plan", "top");
        setBusy(false);
        return;
      }
    }

    const previous = result;

    // A beat of "thinking" so the analysis reads as deliberate, not instant.
    setTimeout(async () => {
      const anchor = shown.current[0];
      const rec =
        again && previous
          ? recommendAlternative(previous, history, { experience, exclude: shown.current, anchor })
          : recommendToday(history, { experience });

      // A fresh plan starts a new round; once every sibling has been shown the
      // round starts over from the original pick.
      if (!again || !previous) shown.current = [rec.bodyPart];
      else if (rec.wrapped) shown.current = [anchor, rec.bodyPart];
      else shown.current = [...shown.current, rec.bodyPart];

      await markRecommendationUsed();
      setResult(rec);
      setBusy(false);
      trackEvent("Train Today Analyzed", {
        bodyPart: rec.bodyPart,
        group: rec.group || "none",
        restAdvised: rec.restAdvised,
        wasFree: isFree,
        historyCount: history.length,
        isQuick: !!rec.isQuick,
        isAlternative: !!rec.isAlternative,
        replaced: rec.replaced || "none",
      });
    }, 700);
  };

  return { result, busy, analyze };
}
