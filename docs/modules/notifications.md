# Notifications

## Overview

Push notifications are used solely as **workout reminders**. They are scheduled locally on-device (no server required) based on the user's preferred workout days and time slot chosen during onboarding.

---

## Configuration (`app.json`)

```json
"plugins": [
  [
    "expo-notifications",
    {
      "icon": "./assets/icon.png",
      "color": "#FF6B35",
      "androidMode": "default",
      "androidCollapsedTitle": "Push Daily"
    }
  ]
]
```

Android notification channel is created in `app/_layout.tsx`:

```js
Notifications.setNotificationChannelAsync('workout-reminders', {
  name: 'Workout Reminders',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  sound: true,
});
```

---

## Scheduling Logic

Notifications are scheduled at the end of signup step 7 (`app/signup/_layout.js`).

### Time Slots → Trigger Times

| User Choice | Reminder Notification | Start Notification |
|---|---|---|
| Morning | 5:45 AM | 6:00 AM |
| Afternoon | 11:45 AM | 12:00 PM |
| Evening | 4:45 PM | 5:00 PM |
| Night | 7:45 PM | 8:00 PM |

### Per-Day Messages

Each notification has a day-specific motivational title:

| Day | Title |
|---|---|
| Monday | "Monday Motivation 🔥" |
| Tuesday | "Tuesday Grind 💪" |
| Wednesday | "Hump Day Hustle 💦" |
| Thursday | "Thursday Power ⚡" |
| Friday | "Friday Finish Strong 🏁" |
| Saturday | "Saturday Sweat 🌟" |
| Sunday | "Sunday Funday Workout 🎯" |

### Schedule Creation

```js
async function scheduleNotifications(preferredDays, timeSlot) {
  // Cancel all existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  const triggerTime = TIME_SLOTS[timeSlot];       // { hour, minute }
  const reminderTime = REMINDER_TIMES[timeSlot];  // 15 min before

  for (const day of preferredDays) {
    const weekday = DAY_TO_WEEKDAY[day];  // 'Monday' → 2 (Sun=1)

    // Reminder notification (15 min before)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${DAY_TITLES[day]} - Reminder`,
        body: "Your workout starts in 15 minutes. Get ready!",
        sound: true,
        data: { url: '/home' }
      },
      trigger: {
        type: 'weekly',
        weekday,
        hour: reminderTime.hour,
        minute: reminderTime.minute,
        repeats: true
      }
    });

    // Start notification (at preferred time)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: DAY_TITLES[day],
        body: "Time to push! Your workout is waiting. 💪",
        sound: true,
        data: { url: '/home' }
      },
      trigger: {
        type: 'weekly',
        weekday,
        hour: triggerTime.hour,
        minute: triggerTime.minute,
        repeats: true
      }
    });
  }
}
```

**Total notifications scheduled:** `preferredDays.length × 2` (max 14 for all 7 days).

---

## Notification Tap Handling

Configured in `app/_layout.tsx`:

```js
Notifications.addNotificationResponseReceivedListener(response => {
  const url = response.notification.request.content.data?.url;
  if (url) router.push(url);  // deep link to /home
});
```

---

## Permission Request

Permissions are requested via `NotificationDialog.js` after step 7 of signup:

```js
const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
  await scheduleNotifications(days, time);
}
```

If the user denies, notifications are simply not scheduled — the app works fully without them.

---

## Rescheduling

Notifications are rescheduled whenever the user updates their profile (days or time changed):
- Triggered in `/signup?from=edit` on save
- Old notifications are cancelled first (`cancelAllScheduledNotificationsAsync`)
- New set scheduled based on updated preferences

---

## Dependencies

- `expo-notifications` 0.32.17
