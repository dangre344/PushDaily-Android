# App Entry & Root Layout

## Files

| File | Role |
|---|---|
| `app/_layout.tsx` | Root provider shell — fonts, context, ads, navigation |
| `app/index.tsx` | Splash/boot screen — decides first route |
| `app/Splash.js` | Legacy splash component (superseded by index.tsx) |
| `components/CustomSplashScreen.tsx` | Animated custom splash UI |

---

## `app/_layout.tsx` — Root Layout

This is the first component Expo Router mounts. It wraps the entire app with all required providers.

**Responsibilities:**
1. Load custom fonts (via `expo-font`)
2. Initialise the SQLite database (`initDB()` from `offlinedb/workoutdb.js`)
3. Wrap the app in `UserContextProvider` (user session state)
4. Initialise AdMob (`mobileAds().initialize()`)
5. Configure Expo Router's `<Stack>` with screen options
6. Show a native splash screen until fonts & DB are ready (`expo-splash-screen`)

**Provider tree (outermost → innermost):**
```
UserContextProvider
  └─ SafeAreaProvider (react-native-safe-area-context)
       └─ Stack (Expo Router)
            └─ screens…
```

---

## `app/index.tsx` — Boot / Splash

The entry-point route. Shown immediately on app open.

**Logic:**
```
useEffect (on mount)
  ├─ Load user session from AsyncStorage
  ├─ Wait for fonts + DB ready
  └─ If user.name exists  → router.replace('/home')
     If no user session   → router.replace('/signup')
```

**UI:** Displays the animated `CustomSplashScreen` (logo + app name + tagline) while the async check runs.

---

## `components/CustomSplashScreen.tsx`

Animated splash screen component used during boot.

- Lottie or image-based animation
- Displays app branding (logo, "Push Daily" name)
- Fades out once boot logic completes

---

## Boot Sequence Diagram

```
App opens
  ↓
_layout.tsx mounts
  ├─ initDB()          (SQLite setup)
  ├─ loadFonts()       (expo-font)
  └─ mobileAds().init() (AdMob)
       ↓
index.tsx mounts (Splash shown)
  ├─ loadSession()    (AsyncStorage)
  └─ decision:
       ├─ has user → /home
       └─ no user  → /signup
```

---

## Dependencies

- `expo-splash-screen` — controls native splash visibility
- `expo-font` — custom font loading
- `UserContext` (`constants/UserContext.js`) — global user state
- `initDB` (`offlinedb/workoutdb.js`) — database initialisation
- `react-native-google-mobile-ads` — AdMob SDK init
