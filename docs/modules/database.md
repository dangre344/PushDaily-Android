# Database Layer

## Files

| File | Role |
|---|---|
| `offlinedb/workoutdb.js` | SQLite schema, queries, and helper functions |
| `offlinedb/SQLiteProvider.js` | Database context provider / wrapper |

---

## Overview

The app is fully offline. All workout history is stored in a local **SQLite** database via `expo-sqlite`. The database is initialised once on app boot (`initDB()` called from `app/_layout.tsx`).

---

## Schema

### Table: `workouts`

```sql
CREATE TABLE IF NOT EXISTS workouts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  workoutId  TEXT,          -- exercise ID from Constants.js
  name       TEXT,          -- exercise display name
  calories   TEXT,          -- estimated calories burned
  level      TEXT,          -- 'beginner' | 'intermediate' | 'advanced'
  bodyPart   TEXT,          -- e.g. 'Chest', 'Back', 'Legs'
  dateTime   TEXT           -- ISO 8601 string (e.g. '2025-06-01T08:30:00.000Z')
);
```

There is only one table. All queries operate on it.

---

## API

### Initialisation

```js
initDB()           // Creates table if not exists; called once on app boot
getDB()            // Returns the active SQLite database instance
```

### Writes

```js
insertWorkout(workout)
// workout: { workoutId, name, calories, level, bodyPart, dateTime }

insertMultipleWorkouts(workouts)
// Batch insert using an exclusive transaction for performance
```

### Reads

```js
getAllWorkouts()
// → all rows ordered by dateTime DESC

getAllWorkoutsBydate(dateKey)
// dateKey: 'YYYY-MM-DD'
// → rows where dateTime LIKE 'YYYY-MM-DD%'

getTotalCalories()
// → SUM(calories) as integer

getAllWorkoutDates()
// → array of distinct 'YYYY-MM-DD' strings

getWorkoutsForCurrentWeek()
// → rows for the current week (Sunday–Saturday)

getProfileStats()
// → { totalWorkouts, totalCalories, activeDays }

getCurrentStreak()
// → integer (consecutive days ending today or yesterday)
```

### Deletes

```js
deleteWorkout(id)   // Delete single row by primary key
clearWorkouts()     // DELETE FROM workouts (full wipe)
```

---

## Streak Calculation (`getCurrentStreak`)

```
1. Get all distinct workout dates, sorted DESC
2. Start from today (or yesterday if no workout today — grace period)
3. Walk backwards counting consecutive days
4. Stop when there is a gap > 1 day
5. Return the count
```

The one-day grace period means the streak does not break until the day *after* the missed day, encouraging users who work out late at night.

---

## User Session (AsyncStorage)

User profile data is **not** stored in SQLite. It uses AsyncStorage.

```js
// constants/SessionManager.js
const SESSION_KEY = '@user_session';

saveSession(userObject)   // JSON.stringify → AsyncStorage.setItem
loadSession()             // AsyncStorage.getItem → JSON.parse
clearSession()            // AsyncStorage.removeItem
```

**User object shape:**
```js
{
  _id: string,
  name: string,
  gender: 'male' | 'female',
  age: number,
  height: number,         // cm
  heightFeet: number,
  heightInches: number,
  weight: number,         // kg
  weightLbs: number,
  experience: 'beginner' | 'intermediate' | 'advanced',
  goal: 'weight-loss' | 'muscle' | 'flexibility' | 'fitness',
  days: string[],         // ['Monday', 'Wednesday', ...]
  time: 'Morning' | 'Afternoon' | 'Evening' | 'Night'
}
```

---

## Dependencies

- `expo-sqlite` ~16.0.10
- `@react-native-async-storage/async-storage` 2.2.0
