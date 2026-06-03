# Progress & Attendance Module

## Files

| File | Role |
|---|---|
| `app/progress/ProgressScreen.js` | Attendance calendar & workout history view |

---

## Overview

The Attendance tab gives users a calendar-based view of their workout history. It answers "did I work out today / this week / this month?" at a glance and lets users drill into any specific day to see what was logged.

---

## Features

### Calendar View
- Monthly calendar rendered with `react-native-calendars`
- Days with logged workouts are marked (coloured dot or highlighted cell)
- Today is always highlighted with a distinct indicator
- Tapping a day loads that day's workout list below the calendar

### Daily Workout List
- Shows all workouts logged on the tapped date
- Each entry: exercise name, body part tag, calories, level badge, time of day
- Swipe-to-delete or long-press to remove a single entry (calls `deleteWorkout(id)`)

### Streak Display
- Current consecutive streak (days in a row with at least one workout)
- Uses `getCurrentStreak()` from the database, which includes a grace period for yesterday

### Weekly Summary Strip
- Row of 7 day bubbles (Mon–Sun) above the calendar
- Filled bubble = workout logged that day in the current week

---

## Data Flow

```
useFocusEffect (tab gains focus)
  ├─ getAllWorkoutDates()      → mark calendar dots
  ├─ getCurrentStreak()       → streak badge
  └─ getWorkoutsForCurrentWeek() → weekly strip

onDayPress(date)
  └─ getAllWorkoutsBydate(date) → daily list
```

---

## Database Queries Used

| Function | Result |
|---|---|
| `getAllWorkoutDates()` | Array of `YYYY-MM-DD` strings — used to mark calendar |
| `getAllWorkoutsBydate(dateKey)` | Workouts for selected day |
| `getWorkoutsForCurrentWeek()` | Workouts bucketed by day for the current week |
| `getCurrentStreak()` | Integer — consecutive days |
| `deleteWorkout(id)` | Remove a single logged workout |

---

## Dependencies

- `offlinedb/workoutdb.js` — all data queries
- `react-native-calendars` — calendar component
- `constants/colors.js` — dot / highlight colours
- `ads/BannerAdComponent.js` — banner ad at screen bottom
