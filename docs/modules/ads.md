# Ads & Monetization

## Files

| File | Role |
|---|---|
| `ads/Admobmanager.js` | Manager classes for each ad unit type |
| `ads/BannerAdComponent.js` | Reusable banner ad React component |
| `ads/Useads.js` | Custom hooks for ad lifecycle |

---

## Overview

The app monetizes via **Google AdMob** using four ad unit types. Ads are initialised once at app boot and then loaded/shown at specific trigger points throughout the user journey.

---

## Ad Unit Types

| Type | Trigger Point | Manager Class |
|---|---|---|
| App Open | On cold app launch | `AppOpenAdManager` |
| Interstitial | Between major screen transitions (e.g., after completing onboarding, between workouts) | `InterstitialAdManager` |
| Banner | Bottom of most content screens (persistent) | `BannerAdComponent` |
| Rewarded | Optional user-initiated (e.g., "Watch ad for bonus feature") | `RewardedAdManager` |
| Rewarded Interstitial | High-value full-screen with reward, shown at natural breaks | `RewardedInterstitialAdManager` |

---

## `Admobmanager.js`

Contains singleton-style manager classes. Each manager:
1. Loads the ad in `preload()` / constructor
2. Exposes `show()` method
3. Handles `onAdLoaded`, `onAdFailed`, `onAdDismissed` callbacks
4. Automatically reloads after dismissal to keep a fresh ad ready

```js
// Usage example
await InterstitialAdManager.load();
InterstitialAdManager.show();
```

**Ad Unit IDs** are defined as constants at the top of the file (Test IDs during development, real IDs in production builds via EAS environment variables or `eas.json`).

---

## `BannerAdComponent.js`

A thin React component wrapper around `BannerAd` from `react-native-google-mobile-ads`.

```jsx
<BannerAdComponent size={BannerAdSize.FULL_BANNER} />
```

- Placed at the bottom of: `ProfileScreen`, `workoutlisting.js`, `workoutscreen.js`, `ProgressScreen`, `stats/_layout.js`
- Hides itself if the ad fails to load (`onAdFailedToLoad` → `setVisible(false)`)

---

## `Useads.js`

Custom React hooks that abstract ad loading/showing so screens don't depend directly on manager classes.

```js
const { showInterstitial } = useInterstitialAd();
const { showRewarded, rewardEarned } = useRewardedAd();
```

---

## Initialisation

Called once in `app/_layout.tsx` during app boot:

```js
import mobileAds from 'react-native-google-mobile-ads';
await mobileAds().initialize();
```

---

## Configuration (`app.json`)

```json
"plugins": [
  [
    "react-native-google-mobile-ads",
    {
      "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX",
      "iosAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
    }
  ]
]
```

---

## Dependencies

- `react-native-google-mobile-ads` 16.3.3
