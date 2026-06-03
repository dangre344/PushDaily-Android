# Push Daily — Project Overview

## What Is This App?

**Push Daily** is an offline-first React Native fitness tracking app built with Expo. Users log daily workouts, track calories burned, maintain streaks, and receive scheduled push notifications as reminders. There is no backend server — all data lives on-device in a SQLite database.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo ~54 |
| Routing | Expo Router ~6 (file-based) |
| Styling | Tailwind CSS 3.3.2 + NativeWind 2.0.11 |
| Animations | Moti 0.30, Reanimated ~4.1, Lottie 7.3 |
| Forms | React Hook Form 7.65 + Yup 1.7 |
| Local DB | expo-sqlite ~16 |
| Key-Value Store | AsyncStorage 2.2 |
| Ads | react-native-google-mobile-ads 16.3 (AdMob) |
| Analytics | Mixpanel 3.3 |
| Notifications | expo-notifications 0.32 |
| Localization | i18next 25 + react-i18next 16 (EN & HI) |
| Language | TypeScript (strict) + JavaScript |

---

## Project Structure

```
C:\MyWorkout\
├── app/                  # Screens & navigation (Expo Router file-based)
│   ├── _layout.tsx       # Root providers, font loading, ads init
│   ├── index.tsx         # Splash/boot — routes to /signup or /home
│   ├── signup/           # 7-step onboarding wizard
│   ├── home/             # Bottom tab shell + badge modals
│   ├── workouts/         # Workout browsing & execution screens
│   ├── stats/            # Analytics dashboard
│   ├── progress/         # Attendance calendar
│   └── profile/          # User profile & settings
├── components/           # Reusable UI components
│   └── ui/               # Form controls, cards, buttons, etc.
├── constants/            # Colors, workout data, context, utilities
├── offlinedb/            # SQLite database schema & query functions
├── ads/                  # AdMob managers & banner component
├── locales/              # i18n translation files (en.json, hi.json)
├── hooks/                # Custom React hooks (theme, color scheme)
├── assets/               # Images, animations, audio, SVGs
└── docs/                 # This documentation
    └── modules/          # Per-module documentation
```

---

## Module Docs

| Module | File |
|---|---|
| App Entry & Root Layout | [app-entry.md](modules/app-entry.md) |
| Signup / Onboarding | [signup.md](modules/signup.md) |
| Home & Navigation | [home.md](modules/home.md) |
| Workouts | [workouts.md](modules/workouts.md) |
| Stats | [stats.md](modules/stats.md) |
| Progress & Attendance | [progress.md](modules/progress.md) |
| Profile | [profile.md](modules/profile.md) |
| Database Layer | [database.md](modules/database.md) |
| UI Components | [components.md](modules/components.md) |
| Constants & Utilities | [constants.md](modules/constants.md) |
| Ads & Monetization | [ads.md](modules/ads.md) |
| Localization | [localization.md](modules/localization.md) |
| Analytics | [analytics.md](modules/analytics.md) |
| Notifications | [notifications.md](modules/notifications.md) |

---

## App Flow

```
App launch
  └─ index.tsx (Splash)
       ├─ No user session → /signup (7 steps) → /home
       └─ Existing session  ─────────────────→ /home

/home (Bottom Tabs)
  ├─ Workouts tab  → browse body parts → exercise list → detail → active workout → congrats
  ├─ Attendance tab → calendar view of logged workouts
  ├─ Stats tab     → analytics (calories, active days, totals)
  └─ Profile tab   → user info, badges, streak, settings
```

---

## Key Design Decisions

- **Offline-first**: No API calls, no user accounts. SQLite + AsyncStorage only.
- **File-based routing**: Expo Router handles all navigation declaratively.
- **Tailwind styling**: NativeWind brings utility classes to React Native.
- **Context for user state**: `UserContext` (in `constants/UserContext.js`) is the single source of truth for the logged-in user object.
- **Monetization via ads**: Four AdMob ad types are wired in from app boot.
- **Two languages**: English and Hindi via i18next with device locale detection.

---

## Colors

| Token | Hex | Use |
|---|---|---|
| Primary | `#FF6B35` | Buttons, highlights |
| Secondary | `#F7931E` | Accents, badges |
| Accent | `#FFD23F` | Stars, rewards |
| Background | `#FFFFFF` | Screen background |
| Text | `#2D3436` | Body text |
