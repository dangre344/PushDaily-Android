import { useCallback } from "react";
import {
  AppOpenAdManager,
  InterstitialAdManager,
  RewardedAdManager,
  RewardedInterstitialAdManager,
} from "../ads/Admobmanager.js";

/**
 * useAds — one hook for all ad types
 *
 * Usage:
 *   const { showInterstitial, showRewarded, showAppOpen } = useAds();
 */
export function useAds() {
  // ── Interstitial ──────────────────────────────
  const showInterstitial = useCallback((onClosed) => {
    return InterstitialAdManager.getInstance().show(onClosed);
  }, []);

  const isInterstitialLoaded = useCallback(() => {
    return InterstitialAdManager.getInstance().isLoaded();
  }, []);

  // ── Rewarded ──────────────────────────────────
  const showRewarded = useCallback(() => {
    return RewardedAdManager.getInstance().show();
  }, []);

  const isRewardedLoaded = useCallback(() => {
    return RewardedAdManager.getInstance().isLoaded();
  }, []);

  // ── Rewarded Interstitial ─────────────────────
  const showRewardedInterstitial = useCallback(() => {
    return RewardedInterstitialAdManager.getInstance().show();
  }, []);

  const isRewardedInterstitialLoaded = useCallback(() => {
    return RewardedInterstitialAdManager.getInstance().isLoaded();
  }, []);

  // ── App Open ──────────────────────────────────
  const showAppOpen = useCallback(() => {
    return AppOpenAdManager.getInstance().showOnForeground();
  }, []);

  return {
    showInterstitial,
    isInterstitialLoaded,
    showRewarded,
    isRewardedLoaded,
    showRewardedInterstitial,
    isRewardedInterstitialLoaded,
    showAppOpen,
  };
}
