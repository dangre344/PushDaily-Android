# Constants & Utilities

## Files

| File | Role |
|---|---|
| `constants/Constants.js` | Static workout/exercise data, body part list |
| `constants/UserContext.js` | React context for global user state |
| `constants/SessionManager.js` | AsyncStorage read/write helpers |
| `constants/colors.js` | App colour palette |
| `constants/theme.ts` | Theme configuration object |
| `constants/mixpanel.js` | Mixpanel setup & event tracking |
| `constants/Logger.js` | Logging utility |
| `constants/useScaling.js` | Responsive scaling hook |
| `constants/utils.js` | General helper functions |

---

## `Constants.js` — Exercise Library

The single source of truth for all static app content.

**Exports:**

```js
BODY_PARTS     // string[] — e.g. ['Chest', 'Back', 'Legs', 'Arms', 'Core', 'Full Body', 'Shoulders']

EXERCISES      // Exercise[] — full workout library

WORKOUT_LEVELS // ['beginner', 'intermediate', 'advanced']
```

**Exercise shape:**
```js
{
  id: string,
  name: string,
  bodyPart: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  reps: string,
  duration: string,      // seconds as string
  calories: string,
  imageUrl: string,
  instructions: string[]
}
```

No network fetch — all data is bundled with the app.

---

## `UserContext.js` — Global User State

A React Context + Provider that holds the current user object in memory and exposes update functions.

**Context value:**
```js
{
  user: UserSession | null,
  setUser: (user) => void,
  loadUser: () => Promise<void>,   // reads from AsyncStorage
  updateUser: (partial) => void    // merge + persist
}
```

**Used in:**
- `app/_layout.tsx` — wraps entire app
- `app/index.tsx` — boot check (`user?.name`)
- `app/signup/_layout.js` — populate edit form
- `app/profile/ProfileScreen.js` — display name, age, BMI
- `app/workouts/workoutscreen.js` — user level preference

---

## `SessionManager.js` — AsyncStorage Helpers

```js
SessionManager.saveSession(user)   // JSON → '@user_session'
SessionManager.loadSession()       // '@user_session' → JSON
SessionManager.clearSession()      // removes key
```

All three functions are async and return Promises.

---

## `colors.js` — Colour Palette

```js
export const PRIMARY   = '#FF6B35';   // main orange — buttons, active states
export const SECONDARY = '#F7931E';   // lighter orange — accents
export const ACCENT    = '#FFD23F';   // yellow — stars, highlights
export const BG        = '#FFFFFF';   // white background
export const TEXT      = '#2D3436';   // dark charcoal text
export const MUTED     = '#636E72';   // secondary text
export const SURFACE   = '#F5F6FA';   // card / input background
```

---

## `theme.ts` — Theme Object

Extends React Native Paper and/or Expo themes. Used by components that consume the Paper `ThemeProvider` or the custom `useThemeColor` hook.

---

## `mixpanel.js` — Analytics Setup

See [analytics.md](analytics.md) for full documentation.

---

## `Logger.js` — Logging

```js
Logger.log(tag, message, data?)
Logger.warn(tag, message, data?)
Logger.error(tag, message, data?)
```

Wraps `console.log/warn/error` and can be toggled off in production builds via an `__DEV__` guard.

---

## `useScaling.js` — Responsive Scaling

```js
const { scale, moderateScale, verticalScale } = useScaling();
```

Wraps `react-native-size-matters` to provide consistent, screen-density-aware sizing across all device sizes.

**Usage pattern:**
```js
fontSize: moderateScale(16)     // 16sp on base device, scales proportionally
paddingHorizontal: scale(20)
```

---

## `utils.js` — Helpers

```js
generateUniqueId()          // UUID-like string for new user IDs
formatDate(isoString)       // '2025-06-01T...' → 'Jun 1, 2025'
parseDateKey(isoString)     // → 'YYYY-MM-DD'
getWeekRange()              // { start: Date, end: Date } for current week
capitalise(str)             // 'hello' → 'Hello'
```
