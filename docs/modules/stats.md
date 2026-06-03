# Stats Module

## Files

| File | Role |
|---|---|
| `app/stats/_layout.js` | Stats / analytics dashboard screen |

---

## Overview

The Stats tab gives the user a visual breakdown of their fitness activity over time — total workouts, calories burned, active days, weekly patterns, and body part distribution.

---

## Data Sources

All data is read from the local SQLite database via `offlinedb/workoutdb.js`:

| Query | Purpose |
|---|---|
| `getProfileStats()` | Total workouts, total calories, active days |
| `getAllWorkouts()` | Full history for charting |
| `getWorkoutsForCurrentWeek()` | Weekly bar chart |
| `getAllWorkoutDates()` | Calendar heatmap |
| `getCurrentStreak()` | Consecutive day streak |

---

## Displayed Metrics

### Summary Cards
- **Total Workouts** — lifetime count
- **Calories Burned** — lifetime total
- **Active Days** — distinct calendar days with at least one workout
- **Current Streak** — consecutive days (with one-day grace period)

### Weekly Bar Chart
- 7-bar chart (Sun–Sat)
- Height = number of workouts or total calories per day
- Current day highlighted

### Body Part Distribution
- Pie or donut chart showing which muscle groups are trained most
- Derived from `bodyPart` field across all workout records

### Monthly Heatmap / Calendar
- Uses `react-native-calendars`
- Days with workouts marked with a dot or coloured cell
- Tapping a day shows workouts logged that day

---

## Refresh Strategy

- Data is re-fetched every time the Stats tab comes into focus (`useFocusEffect` from React Navigation)
- No caching — queries are fast because the dataset is local SQLite

---

## Dependencies

- `offlinedb/workoutdb.js` — all data queries
- `react-native-calendars` — calendar heatmap
- `constants/colors.js` — chart colour palette (`#FF6B35` primary)
- `ads/BannerAdComponent.js` — banner ad at screen bottom
