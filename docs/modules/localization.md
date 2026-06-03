# Localization

## Files

| File | Role |
|---|---|
| `locales/i18.js` | i18next configuration & initialisation |
| `locales/en.json` | English translation strings |
| `locales/hi.json` | Hindi translation strings |

---

## Overview

The app supports **English** and **Hindi** using `i18next` + `react-i18next`. The language is detected automatically from the device locale via `expo-localization` and `react-native-localize`.

---

## Setup (`locales/i18.js`)

```js
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: require('./en.json') },
      hi: { translation: require('./hi.json') },
    },
    lng: detectDeviceLanguage(),   // 'en' or 'hi'
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });
```

`detectDeviceLanguage()` uses `expo-localization` to read the device's primary locale and maps it to `'en'` or `'hi'`. Falls back to English for all other locales.

---

## Usage in Components

```jsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

<Text>{t('home.welcome')}</Text>
<Text>{t('workout.calories', { count: 250 })}</Text>
```

---

## Translation File Structure

Both `en.json` and `hi.json` share the same key hierarchy:

```json
{
  "home": {
    "welcome": "Welcome back!",
    "startWorkout": "Start Workout"
  },
  "signup": {
    "title": "Let's get started",
    "gender": "What's your gender?",
    "name": "What's your name?"
  },
  "workout": {
    "calories": "{{count}} cal",
    "level": {
      "beginner": "Beginner",
      "intermediate": "Intermediate",
      "advanced": "Advanced"
    }
  },
  "profile": { ... },
  "stats": { ... },
  "progress": { ... }
}
```

---

## Adding a New Language

1. Create `locales/xx.json` (where `xx` is the language code)
2. Copy `en.json` structure and translate values
3. In `i18.js`, add to `resources`: `xx: { translation: require('./xx.json') }`
4. Update `detectDeviceLanguage()` to map the new locale code

---

## Dependencies

- `i18next` 25.6.0
- `react-i18next` 16.0.0
- `expo-localization` 17.0.7
- `react-native-localize` 3.5.4
