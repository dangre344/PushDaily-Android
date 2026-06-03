# Signup / Onboarding Module

## Files

| File | Role |
|---|---|
| `app/signup/_layout.js` | 7-step onboarding wizard (main file) |

---

## Overview

A multi-step form wizard that collects user profile data before the user can access the main app. Also doubles as the **edit profile** flow when accessed via `/signup?from=edit` from the profile screen.

---

## Steps

| Step | Data Collected | Component / Input |
|---|---|---|
| 1 | Gender | `OptionCard` (Male / Female) |
| 2 | Name + Age | `InputText` + number picker |
| 3 | Height | `RulerPickerField` (cm or ft/in) |
| 4 | Weight | `RulerPickerField` (kg or lbs) |
| 5 | Experience / Fitness level | `OptionCard` (Beginner / Intermediate / Advanced) |
| 6 | Goal | `OptionCard` (Weight Loss / Muscle / Flexibility / Overall Fitness) |
| 7 | Preferred workout days + time | `MultipleSelector` (days) + `OptionCard` (time slot) |

---

## Form Management

- **Library:** React Hook Form 7.65 + Yup 1.7
- Each step validates only its own fields before allowing `Next`
- A shared `StepContainer` component renders step header and progress bar

**Yup schema covers:**
- Name: required string
- Age: number, min 10, max 100
- Height: number, min 50 cm
- Weight: number, min 10 kg
- Gender, experience, goal: required string enums
- Days: array, min 1 selection
- Time: required string

---

## Session Persistence

On wizard completion:

```js
const session = {
  _id: generateUniqueId(),
  name, gender, age,
  height, heightFeet, heightInches,
  weight, weightLbs,
  experience, goal, days, time
};

await SessionManager.saveSession(session);
// → AsyncStorage key: '@user_session'
```

---

## Notifications Scheduling

After step 7 the wizard calls `scheduleNotifications(days, time)`:

- Cancels any existing scheduled notifications
- Creates 2 notifications per preferred day (reminder + start)
- Total: up to 14 weekly repeating notifications

See [notifications.md](notifications.md) for the full schedule logic.

---

## Analytics

```js
Mixpanel.track('Signup Completed', { ...userPayload });
// or
Mixpanel.track('Update', { ...userPayload }); // when from=edit
```

See [analytics.md](analytics.md).

---

## Edit Mode

When opened as `/signup?from=edit`:
- Pre-populates all fields from current `UserContext`
- Skips the splash/welcome screen
- On completion: updates session in AsyncStorage, triggers `'Update'` event in Mixpanel, navigates back to `/profile`

---

## Navigation

```
/signup (step 1)
  └─ Next × 6 steps
       └─ Complete → saveSession() → scheduleNotifications() → router.replace('/home')
```

---

## Dependencies

- `components/ui/` — `OptionCard`, `InputText`, `RulerPickerField`, `MultipleSelector`, `StepContainer`, `ProgressBar`
- `constants/SessionManager.js` — AsyncStorage persistence
- `constants/UserContext.js` — context update after save
- `constants/mixpanel.js` — analytics
- `offlinedb/workoutdb.js` — (indirectly, DB already initialised by root layout)
- `expo-notifications` — notification scheduling
