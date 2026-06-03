# Home & Navigation Module

## Files

| File | Role |
|---|---|
| `app/home/_layout.js` | Bottom tab navigator shell + badge modals |
| `app/home/BadgeLevelUpModal.js` | Modal shown when user earns a new badge |
| `app/home/WorkoutBadgeInfo.js` | Badge definitions, threshold logic, display |

---

## Overview

The `home` module is the main app shell after onboarding. It renders a custom-animated **bottom tab bar** with four tabs and hosts the badge achievement system.

---

## Bottom Tab Navigator

**Tabs (in order):**

| Tab | Icon | Route | Screen |
|---|---|---|---|
| Workout | dumbbell | `workouts` | `app/workouts/workoutscreen.js` |
| Attendance | calendar | `progress` | `app/progress/ProgressScreen.js` |
| Stats | bar-chart | `stats` | `app/stats/_layout.js` |
| Profile | person | `profile` | `app/profile/ProfileScreen.js` |

**Custom Tab Bar Features:**
- Slide-up entrance animation on first render (Moti / Reanimated)
- Per-tab animations when selected: pop, rise, label slide-in
- Orange active indicator (`#FF6B35`)
- Haptic feedback on tab press (`expo-haptics`)

---

## Badge System

### `WorkoutBadgeInfo.js`

Defines all achievement badges and evaluates which the user has earned.

**Badge tiers (example):**

| Badge | Threshold | Description |
|---|---|---|
| Starter | 1 workout | First workout logged |
| Consistent | 7 workouts | One week of effort |
| Dedicated | 30 workouts | Monthly dedication |
| Warrior | 100 workouts | Three-digit milestone |
| Legend | 365 workouts | One year of workouts |

Each badge has: `id`, `name`, `icon`, `description`, `threshold` (total workout count).

**Key function:**
```js
getEarnedBadges(totalWorkouts) → Badge[]
getCurrentBadge(totalWorkouts) → Badge
getNextBadge(totalWorkouts)    → Badge | null
getProgressToNextBadge(totalWorkouts) → 0.0–1.0
```

### `BadgeLevelUpModal.js`

A full-screen celebration modal triggered when the user's workout count crosses a badge threshold.

- **Trigger:** Checked after every workout is logged (in `workoutscreen.js`)
- **UI:** Lottie confetti animation, badge icon, congratulatory message
- **Dismiss:** Tap outside or press continue → saves new badge level to AsyncStorage so it only shows once

---

## Layout Hierarchy

```
/home/_layout.js  (Tab.Navigator)
  ├─ Tab: workouts  → app/workouts/workoutscreen.js
  ├─ Tab: progress  → app/progress/ProgressScreen.js
  ├─ Tab: stats     → app/stats/_layout.js
  └─ Tab: profile   → app/profile/ProfileScreen.js

Overlaid modals (rendered in _layout.js):
  └─ BadgeLevelUpModal (conditionally visible)
```

---

## Dependencies

- `react-navigation/bottom-tabs` — tab navigator
- `expo-haptics` — haptic feedback on tab press
- `moti` / `react-native-reanimated` — tab bar animations
- `lottie-react-native` — confetti in badge modal
- `constants/UserContext.js` — read user data for badge calculation
- `offlinedb/workoutdb.js` — `getProfileStats()` for total workout count
- `AsyncStorage` — persist seen-badge state
