import {
  AdEventType,
  AppOpenAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  RewardedInterstitialAd,
} from "react-native-google-mobile-ads";

// ─────────────────────────────────────────────
// Ad Unit IDs
// Use TestIds in development.
// Replace production values with real Ad Unit IDs from AdMob.
// IMPORTANT:
// App ID uses "~" and belongs in app.json/app.config.js.
// Ad Unit IDs use "/" and belong here.
// Example Ad Unit ID:

// ─────────────────────────────────────────────

export const AD_UNIT_IDS = {
  banner: "ca-app-pub-3788587565382003/2126854515",

  interstitial: "ca-app-pub-3788587565382003/5080777760",

  rewarded: "ca-app-pub-3788587565382003/9813772844",

  rewardedInterstitial: "ca-app-pub-3788587565382003/6633532586",

  appOpen: "ca-app-pub-3788587565382003/4390512628",
};

const DEFAULT_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: false,
};

// ─────────────────────────────────────────────
// Interstitial Ad Manager
// ─────────────────────────────────────────────

class InterstitialAdManager {
  static instance = null;

  ad = null;
  loaded = false;
  loading = false;
  showing = false;

  constructor() {
    this.createAd();
  }

  static getInstance() {
    if (!InterstitialAdManager.instance) {
      InterstitialAdManager.instance = new InterstitialAdManager();
    }

    return InterstitialAdManager.instance;
  }

  createAd() {
    this.ad = InterstitialAd.createForAdRequest(
      AD_UNIT_IDS.interstitial,
      DEFAULT_REQUEST_OPTIONS,
    );

    this.setupListeners();
    this.load();
  }

  setupListeners() {
    this.ad.addAdEventListener(AdEventType.LOADED, () => {
      this.loaded = true;
      this.loading = false;
      console.log("[AdMob] Interstitial loaded");
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      console.warn("[AdMob] Interstitial error:", error);
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      this.load();
    });
  }

  load() {
    if (this.loading || this.loaded) return;

    this.loading = true;
    this.ad.load();
  }

  isLoaded() {
    return this.loaded;
  }

  show(onAdClosed) {
    if (!this.loaded || this.showing) {
      console.warn("[AdMob] Interstitial not ready");
      this.load();
      return Promise.resolve(false);
    }

    this.showing = true;

    return new Promise((resolve) => {
      const unsubscribeClosed = this.ad.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeClosed();
          onAdClosed?.();
          resolve(true);
        },
      );

      this.ad.show().catch((error) => {
        unsubscribeClosed();
        this.loaded = false;
        this.loading = false;
        this.showing = false;
        console.warn("[AdMob] Interstitial show error:", error);
        this.load();
        resolve(false);
      });
    });
  }
}

// ─────────────────────────────────────────────
// Rewarded Ad Manager
// ─────────────────────────────────────────────

class RewardedAdManager {
  static instance = null;

  ad = null;
  loaded = false;
  loading = false;
  showing = false;

  constructor() {
    this.createAd();
  }

  static getInstance() {
    if (!RewardedAdManager.instance) {
      RewardedAdManager.instance = new RewardedAdManager();
    }

    return RewardedAdManager.instance;
  }

  createAd() {
    this.ad = RewardedAd.createForAdRequest(
      AD_UNIT_IDS.rewarded,
      DEFAULT_REQUEST_OPTIONS,
    );

    this.setupListeners();
    this.load();
  }

  setupListeners() {
    this.ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.loaded = true;
      this.loading = false;
      console.log("[AdMob] Rewarded loaded");
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      console.warn("[AdMob] Rewarded error:", error);
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      this.load();
    });
  }

  load() {
    if (this.loading || this.loaded) return;

    this.loading = true;
    this.ad.load();
  }

  isLoaded() {
    return this.loaded;
  }

  show() {
    if (!this.loaded || this.showing) {
      console.warn("[AdMob] Rewarded not ready");
      this.load();
      return Promise.resolve({
        earned: false,
      });
    }

    this.showing = true;

    return new Promise((resolve) => {
      let rewardEarned = false;
      let rewardData = null;

      const unsubscribeReward = this.ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          rewardEarned = true;
          rewardData = reward;
        },
      );

      const unsubscribeClosed = this.ad.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeReward();
          unsubscribeClosed();

          resolve({
            earned: rewardEarned,
            type: rewardData?.type,
            amount: rewardData?.amount,
          });
        },
      );

      this.ad.show().catch((error) => {
        unsubscribeReward();
        unsubscribeClosed();

        this.loaded = false;
        this.loading = false;
        this.showing = false;

        console.warn("[AdMob] Rewarded show error:", error);
        this.load();

        resolve({
          earned: false,
        });
      });
    });
  }
}

// ─────────────────────────────────────────────
// Rewarded Interstitial Ad Manager
// ─────────────────────────────────────────────

class RewardedInterstitialAdManager {
  static instance = null;

  ad = null;
  loaded = false;
  loading = false;
  showing = false;

  constructor() {
    this.createAd();
  }

  static getInstance() {
    if (!RewardedInterstitialAdManager.instance) {
      RewardedInterstitialAdManager.instance =
        new RewardedInterstitialAdManager();
    }

    return RewardedInterstitialAdManager.instance;
  }

  createAd() {
    this.ad = RewardedInterstitialAd.createForAdRequest(
      AD_UNIT_IDS.rewardedInterstitial,
      DEFAULT_REQUEST_OPTIONS,
    );

    this.setupListeners();
    this.load();
  }

  setupListeners() {
    this.ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.loaded = true;
      this.loading = false;
      console.log("[AdMob] Rewarded Interstitial loaded");
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      console.warn("[AdMob] Rewarded Interstitial error:", error);
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      this.load();
    });
  }

  load() {
    if (this.loading || this.loaded) return;

    this.loading = true;
    this.ad.load();
  }

  isLoaded() {
    return this.loaded;
  }

  show() {
    if (!this.loaded || this.showing) {
      console.warn("[AdMob] Rewarded Interstitial not ready");
      this.load();
      return Promise.resolve({
        earned: false,
      });
    }

    this.showing = true;

    return new Promise((resolve) => {
      let rewardEarned = false;
      let rewardData = null;

      const unsubscribeReward = this.ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          rewardEarned = true;
          rewardData = reward;
        },
      );

      const unsubscribeClosed = this.ad.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeReward();
          unsubscribeClosed();

          resolve({
            earned: rewardEarned,
            type: rewardData?.type,
            amount: rewardData?.amount,
          });
        },
      );

      this.ad.show().catch((error) => {
        unsubscribeReward();
        unsubscribeClosed();

        this.loaded = false;
        this.loading = false;
        this.showing = false;

        console.warn("[AdMob] Rewarded Interstitial show error:", error);
        this.load();

        resolve({
          earned: false,
        });
      });
    });
  }
}

// ─────────────────────────────────────────────
// App Open Ad Manager
// ─────────────────────────────────────────────

class AppOpenAdManager {
  static instance = null;

  ad = null;
  loaded = false;
  loading = false;
  showing = false;

  constructor() {
    this.createAd();
  }

  static getInstance() {
    if (!AppOpenAdManager.instance) {
      AppOpenAdManager.instance = new AppOpenAdManager();
    }

    return AppOpenAdManager.instance;
  }

  createAd() {
    this.ad = AppOpenAd.createForAdRequest(
      AD_UNIT_IDS.appOpen,
      DEFAULT_REQUEST_OPTIONS,
    );

    this.setupListeners();
    this.load();
  }

  setupListeners() {
    this.ad.addAdEventListener(AdEventType.LOADED, () => {
      this.loaded = true;
      this.loading = false;
      console.log("[AdMob] App Open loaded");
    });

    this.ad.addAdEventListener(AdEventType.ERROR, (error) => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      console.warn("[AdMob] App Open error:", error);
    });

    this.ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.loaded = false;
      this.loading = false;
      this.showing = false;
      this.load();
    });
  }

  load() {
    if (this.loading || this.loaded) return;

    this.loading = true;
    this.ad.load();
  }

  isLoaded() {
    return this.loaded;
  }

  async showOnForeground() {
    if (!this.loaded || this.showing) {
      this.load();
      return false;
    }

    try {
      this.showing = true;
      await this.ad.show();
      return true;
    } catch (error) {
      this.loaded = false;
      this.loading = false;
      this.showing = false;

      console.warn("[AdMob] App Open show error:", error);
      this.load();

      return false;
    }
  }
}

// ─────────────────────────────────────────────
// Export Managers
// ─────────────────────────────────────────────

export {
  AppOpenAdManager,
  BannerAdSize,
  InterstitialAdManager,
  RewardedAdManager,
  RewardedInterstitialAdManager,
};
