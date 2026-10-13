// ─── What Jack says in notifications ─────────────────────────────────────────
// One place for every scheduled message, written in Jack's voice: cheeky,
// warm, never guilt-tripping. Each line carries the mascot mood (`jack`) shown
// next to it — see constants/jackNotifications.js.
//
// Rules of thumb for new lines:
//   • Title ≤ ~40 chars, body ≤ ~90 — both survive a collapsed Android banner.
//   • Lead with a hook (a question, a tease, a number), end with the action.
//   • {name} = first name ("champ" if unknown). No dates or health details:
//     notifications show on the lock screen.

/**
 * Workout reminders, one pair per weekday (0 = Sunday … 6 = Saturday):
 *   pre   — 15 minutes before the user's workout time
 *   start — at the workout time
 */
export const WORKOUT_COPY = [
  {
    pre: { title: "Sunday reset in 15 min 🌅", body: "Jack's already stretching. Ease into the week with one easy session.", jack: "hi" },
    start: { title: "Lazy Sunday? Not you, {name} 😏", body: "10 minutes now = a fresh start to the week. Tap to begin.", jack: "wink" },
  },
  {
    pre: { title: "Monday's calling 📞", body: "Your workout starts in 15 min. Don't send it to voicemail 😏", jack: "phone" },
    start: { title: "New week, new you, {name} 🔥", body: "The first session sets the tone for the whole week. Let's go!", jack: "flex" },
  },
  {
    pre: { title: "15 minutes, {name} ⏰", body: "Shoes on, water ready — I'll be waiting right here 💪", jack: "water" },
    start: { title: "Tuesday grind time 🏋️", body: "Consistency beats motivation. Tap and knock it out.", jack: "dumbbell" },
  },
  {
    pre: { title: "Midweek check-in 👀", body: "Halfway there! Workout in 15 min — don't leave me hanging.", jack: "think" },
    start: { title: "Hump day = pump day 💦", body: "Your workout is ready. 10 minutes and you're a legend.", jack: "flex" },
  },
  {
    pre: { title: "Almost Friday… almost 😅", body: "Workout in 15 min. Future you is already saying thanks.", jack: "wink" },
    start: { title: "Thursday power hour ⚡", body: "The weekend is close — earn it. Tap to start.", jack: "dumbbell" },
  },
  {
    pre: { title: "Friday finisher in 15 🙌", body: "End the week strong and enjoy your weekend guilt-free.", jack: "cheer" },
    start: { title: "Last push of the week, {name} 🔥", body: "One session and you can flex all weekend 😎", jack: "flex" },
  },
  {
    pre: { title: "Weekend warrior mode 🏆", body: "Workout in 15 min. Champions don't take Saturdays off.", jack: "proud" },
    start: { title: "Saturday sweat session 💪", body: "Short, sweaty, done. Tap and let's go!", jack: "dumbbell" },
  },
];

/** Daily quiz (10:00), a different line for each weekday (0 = Sunday). */
export const QUIZ_COPY = [
  { title: "Sunday brain workout 🧠", body: "5 quick cards, 2 minutes. Can you go 5/5 today?", jack: "think" },
  { title: "Monday quiz drop 📬", body: "Fresh fitness questions just landed. First one's easy… maybe 😏", jack: "wink" },
  { title: "Are you smarter than Jack? 🤓", body: "Today's quiz is ready. Prove it in 2 minutes.", jack: "think" },
  { title: "Quick! Pop quiz 🧠", body: "Protein, sleep, fat loss — test what you know and earn XP.", jack: "wow" },
  { title: "Your streak is hungry 🔥", body: "Feed it with today's 5-card quiz. Takes 2 minutes.", jack: "cheer" },
  { title: "Friday fact check ✅", body: "Myth or truth? Today's quiz will tell. Tap to play.", jack: "think" },
  { title: "Weekend brain gains 🧠", body: "Fresh questions are waiting. Bet you can't get them all 😎", jack: "wink" },
];

/** Water reminders (10 slots, 08:00 → 21:30). No picture — see waterReminder.js. */
export const WATER_COPY = [
  { title: "💧 Morning sip, {name}?", body: "First glass of the day wakes your body up better than coffee." },
  { title: "🚰 Water o'clock!", body: "A glass now keeps your energy up till lunch." },
  { title: "💦 Jack's thirsty. Are you?", body: "Quick water break — your muscles will thank you." },
  { title: "🥤 Lunch-time hydration", body: "Sip before you eat — it helps you feel full and focused." },
  { title: "😴 Afternoon slump?", body: "It's often just thirst. One glass, then see how you feel." },
  { title: "🌊 Halfway through the day", body: "Your plant is checking on you. Water it (and yourself) 🌱" },
  { title: "💧 Pre-workout sip", body: "Hydrated muscles work harder. Grab a glass now." },
  { title: "🍋 Evening refill", body: "A glass now beats a headache later. Cheers!" },
  { title: "🥛 Almost there!", body: "A couple more glasses and today's goal is done 🎯" },
  { title: "🌙 Last call for water", body: "One final glass and your plant is fully grown 🌳" },
];

/** {name} → first name, or "champ". */
export const fillName = (text, name) =>
  String(text || "").replace(/\{name\}/g, (name || "").trim().split(/\s+/)[0] || "champ");
