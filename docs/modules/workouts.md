# Workouts Module

## Files

| File | Role |
|---|---|
| `app/workouts/_layout.js` | Stack navigator for the workouts section |
| `app/workouts/workoutscreen.js` | Main workouts tab — weekly summary + body part selection |
| `app/workouts/workoutlisting.js` | Exercise list for a selected body part + level |
| `app/workouts/workoutdetail.js` | Detail view for a single exercise |
| `app/workouts/Componenets/CurrentWorkout.js` | Active workout in-progress screen |
| `app/workouts/Componenets/CongratsScreen.js` | Completion / celebration screen |
| `app/workouts/Componenets/HIITCard.js` | HIIT workout card component |
| `app/workouts/Componenets/NextWorkoutInfo.js` | Upcoming workout preview card |
| `app/workouts/Componenets/PopularItem.js` | Featured/popular exercise card |
| `app/workouts/Componenets/WorkoutLevelModal.js` | Difficulty level selector modal |

---

## User Flow

```
workoutscreen.js
  └─ Select body part  → workoutlisting.js
       └─ Select exercise → workoutdetail.js
            └─ Start workout → CurrentWorkout.js
                 └─ Finish    → CongratsScreen.js
                                  └─ Done → workoutscreen.js
```

---

## Screens

### `workoutscreen.js` — Main Workouts Tab

**Shows:**
- Current week's workout stats (days completed, total calories)
- Body part selection cards (Chest, Back, Legs, Arms, Core, Full Body, etc.)
- `NextWorkoutInfo` card (based on user's preferred schedule)
- `PopularItem` cards (curated featured workouts)
- Level selection via `WorkoutLevelModal`

**Data sources:**
- `getWorkoutsForCurrentWeek()` → weekly summary from SQLite
- `constants/Constants.js` → body part list + exercise library
- `UserContext` → preferred days/time for next workout logic

---

### `workoutlisting.js` — Exercise List

Receives `bodyPart` + `level` as route params.

**Shows:**
- Collapsible animated header with body part name
- List of exercises filtered by `bodyPart` + `level` from `Constants.js`
- Each item: name, reps/duration, GIF/image preview, estimated calories
- Animated image modal on exercise image tap
- "Start Workout" / "Add to Today" button

**Exercise data shape (from Constants.js):**
```js
{
  id: string,
  name: string,
  bodyPart: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  reps: string,
  duration: string,        // seconds
  calories: string,
  imageUrl: string,
  instructions: string[]
}
```

---

### `workoutdetail.js` — Exercise Detail

Full-screen detail for a single exercise.

**Shows:**
- Animated GIF / image of the exercise
- Step-by-step instructions
- Target muscles, equipment, calories
- Sets/reps configuration
- "Begin" button → navigates to `CurrentWorkout`

---

### `CurrentWorkout.js` — Active Workout

Live workout session screen.

**Features:**
- Exercise timer / rep counter
- Rest timer between sets (with haptic pulse)
- Audio cues via `expo-speech` (counts reps / announces rest)
- Progress indicator (current set / total sets)
- Ability to skip or complete early
- On completion: inserts record into SQLite via `insertWorkout()`

---

### `CongratsScreen.js` — Completion

Shown after a workout is logged.

**Features:**
- Lottie confetti/celebration animation
- Summary card: exercise name, calories burned, duration
- Streak update display
- Badge progress bar (from `WorkoutBadgeInfo`)
- "Done" button → pop back to `workoutscreen`
- Triggers badge level-up check (fires `BadgeLevelUpModal` if threshold crossed)

---

### Supporting Components

#### `WorkoutLevelModal.js`
Bottom-sheet modal to select difficulty:
- Beginner / Intermediate / Advanced
- Brief description of each level
- Sets `level` state in parent before navigating

#### `HIITCard.js`
Card displaying a HIIT (High Intensity Interval Training) workout:
- Short-format, timed intervals
- Calorie estimate, duration badge

#### `NextWorkoutInfo.js`
Preview card for the user's next scheduled workout based on:
- `UserContext.days` (preferred days)
- Current day of week
- Shows next matching day + suggested body part

#### `PopularItem.js`
Simple card for a featured exercise:
- Image thumbnail, name, level badge, calorie estimate
- Tap → navigates to `workoutdetail`

---

## Exercise Data Source

All exercise data is static and lives in `constants/Constants.js`. No network fetch required.

```js
// constants/Constants.js (shape)
export const BODY_PARTS = ['Chest', 'Back', 'Legs', 'Arms', 'Core', 'Full Body', 'Shoulders'];

export const EXERCISES = [
  {
    id: '001',
    name: 'Push Up',
    bodyPart: 'Chest',
    level: 'beginner',
    reps: '15',
    duration: '30',
    calories: '5',
    ...
  },
  ...
];
```

---

## Database Writes

After a workout completes, `CurrentWorkout.js` calls:

```js
insertWorkout({
  workoutId: exercise.id,
  name: exercise.name,
  calories: exercise.calories,
  level: exercise.level,
  bodyPart: exercise.bodyPart,
  dateTime: new Date().toISOString()
});
```

See [database.md](database.md) for schema details.

---

## Dependencies

- `constants/Constants.js` — exercise library & body parts
- `constants/UserContext.js` — user level preference
- `offlinedb/workoutdb.js` — `insertWorkout`, `getWorkoutsForCurrentWeek`
- `expo-speech` — audio cues during workout
- `expo-haptics` — vibration feedback
- `lottie-react-native` — congrats animation
- `app/home/WorkoutBadgeInfo.js` — badge threshold checks
- `ads/BannerAdComponent.js` — banner ad at bottom of listing screen
