# Analytics

## Files

| File | Role |
|---|---|
| `constants/mixpanel.js` | Mixpanel initialisation & event tracking functions |

---

## Overview

User behaviour is tracked via **Mixpanel**. Only two events are currently fired — both tied to the signup / profile-edit flow. No workout-level or navigation events are tracked.

---

## Setup

```js
// constants/mixpanel.js
import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = '3342707f6d2ec658953866e71502b736';
const mixpanel = new Mixpanel(TOKEN, /* trackAutomaticEvents */ true);
mixpanel.init();

export default mixpanel;
```

`init()` is called once on module load. The instance is exported as a singleton.

---

## Tracked Events

### `'Signup Completed'`

Fired when the user finishes the 7-step onboarding wizard for the first time.

**Payload:**
```js
{
  userId:     string,
  name:       string,
  gender:     'male' | 'female',
  age:        number,
  height:     number,    // cm
  weight:     number,    // kg
  experience: string,
  goal:       string,
  days:       string[],
  timestamp:  string     // ISO 8601
}
```

---

### `'Update'`

Fired when the user saves changes from the edit profile flow (`/signup?from=edit`).

**Payload:** same shape as `'Signup Completed'`.

---

## Usage

```js
import mixpanel from 'constants/mixpanel';

mixpanel.track('Signup Completed', { ...payload });
mixpanel.track('Update', { ...payload });
```

---

## Extending Analytics

To add new events, call `mixpanel.track(eventName, properties)` at the relevant point. Common places to instrument:

| Event idea | Where to add |
|---|---|
| `'Workout Started'` | `CurrentWorkout.js` on begin |
| `'Workout Completed'` | `CongratsScreen.js` on mount |
| `'Tab Viewed'` | Tab `onPress` in `home/_layout.js` |
| `'Badge Earned'` | `BadgeLevelUpModal.js` on show |
| `'Ad Shown'` | Manager class `onAdOpened` callback |

---

## Dependencies

- `mixpanel-react-native` 3.3.0
