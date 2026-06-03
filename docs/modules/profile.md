# Profile Module

## Files

| File | Role |
|---|---|
| `app/profile/ProfileScreen.js` | User profile, stats, settings, and app info |
| `app/profile/privacy/PrivacyPolicyModal.js` | In-app privacy policy modal |
| `app/profile/privacy/AboutModal.js` | In-app about / app info modal |

---

## Overview

The Profile tab is the user's personal hub. It displays their stats summary, earned badges, streak, and provides access to settings, policy pages, and social actions (rate / share).

---

## Sections

### User Card
- Avatar (gender-based SVG icon from `assets/AllSvgs.js`)
- Display name and age
- BMI indicator (calculated from height + weight in `UserContext`)
- Edit profile button → navigates to `/signup?from=edit`

### Stats Summary
Three quick-stat tiles (data from `getProfileStats()`):

| Tile | Field |
|---|---|
| Workouts | Total lifetime workout count |
| Calories | Total lifetime calories burned |
| Active Days | Distinct calendar days with a workout |

### Streak Badge
- Current consecutive streak from `getCurrentStreak()`
- Flame icon with count
- Motivational label ("Keep going!", "On fire!", etc.)

### Badge Showcase
- Horizontal scroll row of all earned badges
- Current badge highlighted with glow effect
- Progress bar towards next badge
- Tap badge → brief tooltip with badge name + description
- Uses `WorkoutBadgeInfo.js` logic

### Settings / Actions

| Item | Action |
|---|---|
| Edit Profile | Navigate to `/signup?from=edit` |
| Rate App | Opens store rating via `react-native-rate` |
| Share App | Native share sheet with store link |
| Privacy Policy | Opens `PrivacyPolicyModal` |
| About | Opens `AboutModal` |

### App Version
- Displays version string (`v1.0.0`) and build number from `app.json`

---

## Modals

### `PrivacyPolicyModal.js`
- Full-screen scroll view with the app's privacy policy text
- Closes via header X button
- No navigation change, stays on profile tab

### `AboutModal.js`
- App name, version, brief description
- Developer credit / contact email
- Social links (if any)

---

## BMI Calculation

```js
const bmi = weight / ((height / 100) ** 2);   // weight in kg, height in cm
```

BMI category shown as a colour-coded label:
- < 18.5 → Underweight (blue)
- 18.5–24.9 → Normal (green)
- 25–29.9 → Overweight (yellow)
- ≥ 30 → Obese (red)

---

## Data Flow

```
useFocusEffect (tab gains focus)
  ├─ UserContext → name, age, gender, height, weight
  ├─ getProfileStats() → workouts, calories, active days
  └─ getCurrentStreak() → streak count

getEarnedBadges(totalWorkouts) → badge row (WorkoutBadgeInfo)
```

---

## Dependencies

- `constants/UserContext.js` — user data (name, age, body measurements)
- `offlinedb/workoutdb.js` — `getProfileStats()`, `getCurrentStreak()`
- `app/home/WorkoutBadgeInfo.js` — badge evaluation
- `react-native-rate` — app rating prompt
- `assets/AllSvgs.js` — gender avatar SVGs
- `ads/BannerAdComponent.js` — banner ad at screen bottom
