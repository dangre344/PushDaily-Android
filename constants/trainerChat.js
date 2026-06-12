// ─── Trainer chat engine ─────────────────────────────────────────────────────
// Jack, the in-app personal trainer. Currently a rule-based responder so the
// chat works fully offline with zero download. The chat screen only calls
// getTrainerReply(text, user) — swap its body for an on-device LLM
// (react-native-executorch useLLM) or a backend call later without touching UI.

export const TRAINER_NAME = "Jack";

export const TRAINER_GREETING =
  "Hi, I am Jack, your personal trainer 💪\n\nAsk me anything about workouts or diet — I will assist you!";

// Shown as tappable chips before the first user message.
export const QUICK_QUESTIONS = [
  "How do I lose belly fat?",
  "What is a calorie deficit?",
  "How much protein do I need?",
  "Best egg recipes for muscle?",
  "How much sleep do I need?",
  "What should I eat after a workout?",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Each topic: keywords to match + a reply builder (gets the user profile).
const TOPICS = [
  {
    keys: ["protein", "proteins"],
    reply: (u) => {
      const w = Number(u?.weight) || 0;
      const grams = w ? `${Math.round(w * 1.6)}–${Math.round(w * 2.2)} g` : "1.6–2.2 g per kg of body weight";
      return (
        `Great question! For muscle building and recovery, aim for ${grams} of protein daily${w ? ` (based on your ${w} kg)` : ""}.\n\n` +
        `Good sources:\n• Eggs, chicken, fish\n• Paneer, tofu, dal, chickpeas\n• Greek yogurt and milk\n\n` +
        `Spread it across 3–4 meals — your body absorbs it better that way. 🍳`
      );
    },
  },
  {
    keys: ["belly fat", "belly", "stomach fat", "lose fat", "fat loss", "weight loss", "lose weight", "reduce weight"],
    reply: () =>
      "Here's the honest truth: you can't spot-reduce belly fat — but you CAN lose it! 🔥\n\n" +
      "My 3-step plan:\n" +
      "1. Calorie deficit — eat ~300–500 kcal below maintenance. Cut sugar and fried food first.\n" +
      "2. Train 4–5x a week — mix strength workouts (try the Full Body sessions in this app) with brisk walks.\n" +
      "3. Sleep 7–8 hours — poor sleep raises cortisol, which stores belly fat.\n\n" +
      "Stay consistent for 8–12 weeks and you'll see real change. I believe in you! 💪",
  },
  {
    keys: ["muscle", "gain weight", "bulk", "bigger", "mass"],
    reply: (u) => {
      const w = Number(u?.weight) || 0;
      return (
        "To build muscle you need three things working together:\n\n" +
        "1. Progressive overload — each week, do a few more reps or a harder variation.\n" +
        `2. Eat in a small surplus — ${w ? `around ${Math.round(w * 35 + 300)} kcal/day for you` : "~300 kcal above maintenance"}, with plenty of protein.\n` +
        "3. Recover — muscles grow on rest days, not during the workout.\n\n" +
        "Start with the Intermediate workouts here and level up when 3 sets feel easy. 🏗️"
      );
    },
  },
  {
    keys: ["chest", "push up", "pushup", "push-up"],
    reply: () =>
      "Chest day — my favourite! 💥\n\n" +
      "Best home moves:\n• Standard push-ups (3×12)\n• Wide push-ups — outer chest\n• Decline push-ups (feet raised) — upper chest\n• Diamond push-ups — inner chest + triceps\n\n" +
      "Keep your core tight and lower slowly (2–3 s down). Open the Chest workout in this app and I'll see you on the other side! 😉",
  },
  {
    keys: ["abs", "six pack", "core", "sixpack"],
    reply: () =>
      "Abs are made in the gym and revealed in the kitchen! 🍽️\n\n" +
      "Train them 3–4x a week:\n• Plank (3×45 s)\n• Leg raises (3×12)\n• Mountain climbers (3×30 s)\n• Russian twists (3×20)\n\n" +
      "But remember — if there's a fat layer on top, no amount of crunches will show the six-pack. Pair this with a small calorie deficit. Try the ABS workout in the app!",
  },
  {
    keys: ["leg", "legs", "squat", "thigh", "calves"],
    reply: () =>
      "Never skip leg day! 🦵 Legs are half your body and training them boosts overall strength and metabolism.\n\n" +
      "Key moves:\n• Squats (3×15)\n• Lunges (3×12 each leg)\n• Glute bridges (3×15)\n• Calf raises (3×20)\n\n" +
      "Go slow and deep on squats — knees tracking over toes. The Leg workout in this app covers all of these!",
  },
  {
    keys: ["back", "pull up", "pullup", "posture"],
    reply: () =>
      "A strong back = better posture, fewer aches, wider look. 🦾\n\n" +
      "At home try:\n• Superman holds (3×30 s)\n• Reverse snow angels (3×12)\n• Doorframe rows or towel rows (3×12)\n• Glute bridges for the lower back chain\n\n" +
      "If you sit a lot, do these 3x a week and your posture will thank you. Check the Back workout in the app!",
  },
  {
    keys: ["shoulder", "shoulders", "delts"],
    reply: () =>
      "Boulder shoulders coming up! 🪨\n\n" +
      "• Pike push-ups (3×10)\n• Arm circles — great warm-up (2×30 s)\n• Lateral raises with water bottles (3×15)\n• Plank-to-downward-dog (3×10)\n\n" +
      "Shoulders are easy to injure — warm up properly and don't rush the reps. The Shoulder workout in the app has guided sets!",
  },
  {
    keys: ["arm", "arms", "bicep", "tricep"],
    reply: () =>
      "Let's pump those arms! 💪\n\n" +
      "• Diamond push-ups — triceps (3×10)\n• Chair dips (3×12)\n• Towel curls or backpack curls — biceps (3×12)\n• Close-grip wall push-ups for burnout\n\n" +
      "Arms grow with volume + protein. Hit them 2–3x a week and be patient — they're small muscles!",
  },
  {
    keys: ["rest", "recovery", "off day", "rest day", "overtraining"],
    reply: () =>
      "Rest is where the magic happens! 😴\n\n" +
      "• Take 1–2 full rest days per week\n• Sleep 7–8 hours — that's when muscle repairs\n• On rest days, light walking or stretching is perfect\n• Feeling constantly tired, sore, or unmotivated? That's your body asking for a break\n\n" +
      "Training hard 5 days + resting well beats training 7 days half-heartedly. Trust the process!",
  },
  {
    keys: ["sore", "pain", "hurt", "injury", "injured"],
    reply: () =>
      "Listen carefully here 👇\n\n" +
      "Normal soreness (DOMS) — dull ache in the muscle 24–48 h after training. Totally fine; light movement and water help.\n\n" +
      "⚠️ But sharp pain, joint pain, or pain during the movement is NOT normal. Stop the exercise, rest, and if it persists more than a few days, please see a doctor or physiotherapist. I'm a trainer, not a medic — your safety comes first!",
  },
  {
    keys: ["water", "hydration", "drink"],
    reply: (u) => {
      const w = Number(u?.weight) || 0;
      return (
        `Hydration is a game changer! 💧 ${w ? `For your ${w} kg, aim for about ${((w * 35) / 1000).toFixed(1)} L per day` : "Aim for ~35 ml per kg of body weight daily"} — more on heavy workout days.\n\n` +
        "Tip: this app has a Water Reminder in the Profile tab — turn it on and I won't have to nag you! 😄"
      );
    },
  },
  {
    keys: ["eat after", "post workout", "post-workout", "after workout", "after gym"],
    reply: () =>
      "Within ~60 minutes after training, eat protein + carbs:\n\n" +
      "• Eggs + toast 🍳\n• Curd/yogurt + banana 🍌\n• Chicken/paneer + rice\n• Protein shake + fruit if you're in a rush\n\n" +
      "Carbs refill energy, protein rebuilds muscle. Don't skip this meal — it's when your body is most ready to use it!",
  },
  {
    keys: ["eat before", "pre workout", "pre-workout", "before workout", "before gym", "empty stomach"],
    reply: () =>
      "Eat 1–2 hours before training: something light with carbs + a little protein.\n\n" +
      "• Banana + peanut butter 🍌\n• Oats with milk\n• Toast + eggs\n\n" +
      "Training fasted is okay for light sessions, but for strength workouts a small meal gives you noticeably more power. Avoid heavy/fried food right before — you'll feel it!",
  },
  {
    keys: ["diet", "meal", "nutrition", "food", "what should i eat", "khana"],
    reply: () =>
      "A simple plate rule that always works 🍽️:\n\n" +
      "• ½ plate — vegetables and salad\n• ¼ plate — protein (dal, paneer, eggs, chicken, fish)\n• ¼ plate — carbs (rice, roti, oats, potato)\n\n" +
      "Plus: drink water before meals, limit sugar and deep-fried food, and don't \"drink\" calories. No crash diets — consistency beats perfection every time!",
  },
  {
    keys: ["warm up", "warmup", "warm-up", "stretch", "stretching"],
    reply: () =>
      "Never train cold! A 5-minute warm-up prevents most injuries 🔥\n\n" +
      "Before workout (dynamic):\n• Jumping jacks (60 s)\n• Arm circles + leg swings\n• Bodyweight squats (10)\n\n" +
      "After workout (static): hold each stretch 20–30 s — hamstrings, quads, chest, shoulders.\n\nYour future self will thank you!",
  },
  {
    keys: ["cardio", "running", "walk", "treadmill", "cycling"],
    reply: () =>
      "Cardio is great for heart health and fat loss! ❤️\n\n" +
      "• Fat loss: 3–4 sessions/week, 20–30 min brisk walk, jog, or cycling\n• Short on time? HIIT — try the Popular Workouts section in this app\n• Keep 1 strength workout for every cardio session so you don't lose muscle\n\n" +
      "The best cardio is the one you'll actually do consistently. Pick what you enjoy!",
  },
  {
    keys: ["motivat", "lazy", "give up", "consistent", "consistency", "habit", "discipline"],
    reply: () =>
      "I'll tell you what I tell all my clients 🔥\n\n" +
      "Motivation gets you started, but HABIT keeps you going. So:\n" +
      "• Schedule workouts like meetings — same time daily\n• Start stupidly small — even 10 minutes counts\n• Never miss twice — one skipped day is fine, two becomes a pattern\n• Track your streak in this app and protect it!\n\n" +
      "You don't have to be great to start. You have to start to be great. Now go crush it! 💪",
  },
  {
    keys: ["streak", "badge", "points", "level up"],
    reply: () =>
      "Love that you're chasing the streak! 🏆\n\n" +
      "Every completed exercise earns points — Beginner 2, Intermediate 5, Advanced 10 per exercise. Points unlock badges, and daily workouts build your streak in the Milestones section (Profile tab).\n\n" +
      "My tip: don't break the chain. Even a short Beginner session keeps the streak alive on busy days!",
  },
  {
    keys: ["calorie deficit", "deficit", "how many calories", "calorie intake", "count calories"],
    reply: (u) => {
      const w = Number(u?.weight) || 0;
      const maintenance = w ? Math.round(w * 33) : 0;
      return (
        "A calorie deficit simply means eating fewer calories than your body burns — that's the ONLY way fat loss happens. 🔢\n\n" +
        `${w ? `Your rough maintenance is ~${maintenance} kcal/day, so aim for ~${maintenance - 400} kcal/day for steady fat loss.` : "Estimate maintenance (~30–35 kcal per kg of body weight), then eat 300–500 kcal below it."}\n\n` +
        "Rules of thumb:\n• 0.5 kg fat ≈ 3,850 kcal — so a 500 kcal/day deficit ≈ 0.5 kg/week\n• Don't crash below 1,200–1,500 kcal — you'll lose muscle and rebound\n• Keep protein HIGH in a deficit to protect muscle"
      );
    },
  },
  {
    keys: ["calorie surplus", "surplus", "gain calories"],
    reply: (u) => {
      const w = Number(u?.weight) || 0;
      return (
        "A calorie surplus means eating MORE than you burn — needed for building muscle. 📈\n\n" +
        `${w ? `For you that's roughly ${Math.round(w * 33) + 300} kcal/day (maintenance + ~300).` : "Aim for maintenance + 250–350 kcal/day."}\n\n` +
        "Keep it small! A huge surplus just adds fat. With a lean surplus + strength training + 1.6–2.2 g protein/kg, you gain mostly muscle. Expect ~0.25–0.5 kg/month of quality gain — slow is normal!"
      );
    },
  },
  {
    keys: ["sleep", "insomnia", "can't sleep", "how many hours"],
    reply: () =>
      "Sleep is your most underrated supplement! 😴\n\n" +
      "• Aim for 7–9 hours — muscle repair and growth hormone peak during deep sleep\n" +
      "• Under 6 hours regularly = more hunger (ghrelin up), more belly fat (cortisol up), weaker workouts\n\n" +
      "Better sleep tonight:\n• Same bedtime daily — even weekends\n• No screens 30–60 min before bed\n• Cool, dark room\n• No caffeine after ~3 PM\n• A light evening walk helps too\n\nTrain hard, sleep harder! 💤",
  },
  {
    keys: ["egg recipe", "egg recipes", "eggs", "egg", "boiled egg", "omelette", "omelet"],
    reply: () =>
      "Eggs are the cheapest quality protein on the planet — ~6 g protein each! 🥚\n\n" +
      "My go-to fitness egg meals:\n" +
      "1. Boiled eggs (2–3) + fruit — perfect grab-and-go breakfast\n" +
      "2. Veggie omelette — 2 whole eggs + 1 white, onion, tomato, spinach\n" +
      "3. Scrambled eggs on toast — post-workout protein + carbs combo\n" +
      "4. Egg bhurji — spiced scramble, great with roti\n" +
      "5. Egg + oats bowl — cook oats, stir in an egg for extra protein\n\n" +
      "Whole eggs are fine for most people — the yolk has the vitamins. 2–3 a day is a great habit!",
  },
  {
    keys: ["fiber", "fibre", "digestion", "constipation", "gut"],
    reply: () =>
      "Fiber is the forgotten hero of fitness diets! 🌾\n\n" +
      "Aim for 25–35 g/day. It keeps you full (great in a calorie deficit), steadies blood sugar, and keeps digestion smooth.\n\n" +
      "Best sources:\n• Oats and whole grains\n• Dal, beans, chickpeas\n• Fruits with skin (apple, pear, guava)\n• Veggies — broccoli, carrots, leafy greens\n• Chia/flax seeds on anything\n\n" +
      "Increase slowly and drink plenty of water, or your stomach will complain! 😅",
  },
  {
    keys: ["breakfast", "morning meal"],
    reply: () =>
      "Breakfast sets up your whole day! 🌅 Build it around protein + fiber so you stay full till lunch:\n\n" +
      "• Eggs + whole-grain toast\n• Oats with milk, nuts and banana\n• Greek yogurt/curd + fruit + seeds\n• Moong dal chilla or besan chilla\n• Poha/upma + a side of boiled eggs or sprouts\n\n" +
      "Skip the sugary cereals and juices — they spike you up then crash you by 11 AM.",
  },
  {
    keys: ["snack", "snacks", "hungry between", "evening hunger", "cravings", "craving"],
    reply: () =>
      "Smart snacking keeps the diet on track! 🥜\n\n" +
      "Great picks:\n• Handful of nuts (almonds, peanuts)\n• Roasted chana or makhana\n• Fruit + peanut butter\n• Curd/yogurt\n• Boiled eggs\n• Protein shake if you're short on protein\n\n" +
      "Craving something sweet? Have fruit or a square of dark chocolate — not the whole pack. And often \"hunger\" is thirst: drink a glass of water first, wait 10 minutes!",
  },
  {
    keys: ["sugar", "sweet", "dessert", "junk food", "cheat meal", "cheat day"],
    reply: () =>
      "Let's be real — no food is \"banned\", but sugar and junk add up FAST. 🍩\n\n" +
      "• A cheat MEAL once a week is fine; a cheat DAY can wipe out the whole week's deficit\n• Cut liquid sugar first (soda, packed juice, sweet tea) — easiest 200–400 kcal saved\n• Follow the 80/20 rule: 80% whole foods, 20% fun foods\n\n" +
      "Consistency beats perfection. One pizza doesn't make you fat, just like one salad doesn't make you fit!",
  },
  {
    keys: ["fasting", "intermittent", "16:8", "skip breakfast"],
    reply: () =>
      "Intermittent fasting (like 16:8 — eat within 8 hours, fast 16) works for many people, but here's the truth: ⏰\n\n" +
      "It's not magic — it works by making you eat fewer calories. If it suits your routine and controls your appetite, great! If it makes you binge at night, skip it.\n\n" +
      "If you train hard, make sure you still hit your protein target inside the eating window. Total calories and protein matter more than meal timing.",
  },
  {
    keys: ["supplement", "supplements", "creatine", "whey", "protein powder", "bcaa"],
    reply: () =>
      "Supplements are the icing, not the cake! 🎂 Priority order:\n\n" +
      "1. Food, sleep, training — 95% of results\n2. Whey protein — convenient way to hit protein targets, not mandatory\n3. Creatine (3–5 g daily) — the most researched, safe strength booster\n4. Almost everything else (BCAAs, fat burners) — save your money\n\n" +
      "If you eat enough protein from food, you may not need any. For specific medical conditions, check with a doctor first.",
  },
  {
    keys: ["metabolism", "slow metabolism", "boost metabolism"],
    reply: () =>
      "Want a faster metabolism? Here's what actually works: ⚙️\n\n" +
      "• Build muscle — every kg of muscle burns extra calories 24/7\n• Don't crash diet — eating too little for too long slows metabolism down\n• Move more outside the gym — walking, stairs, standing (NEAT is huge!)\n• Protein has the highest thermic effect — your body burns calories digesting it\n• Sleep 7–8 h — poor sleep dysregulates hunger hormones\n\n" +
      "Forget \"metabolism booster\" pills — strength training IS the booster.",
  },
  {
    keys: ["plateau", "stuck", "not losing", "no progress", "same weight"],
    reply: () =>
      "Hitting a plateau is normal — it means your body adapted. Time to change the stimulus! 📊\n\n" +
      "Fat-loss plateau:\n• Recalculate calories (lighter body burns less)\n• Tighten up tracking — hidden oils and snacks creep in\n• Add 2–3k more steps daily\n\n" +
      "Strength plateau:\n• Progress reps or difficulty (try the next level in this app)\n• Check sleep and protein\n• Take a lighter week, then push again\n\n" +
      "Weight stuck but clothes fitting better? You're gaining muscle while losing fat — that's a WIN, not a plateau!",
  },
  {
    keys: ["walking", "steps", "10000 steps", "10k steps"],
    reply: () =>
      "Walking is criminally underrated! 🚶\n\n" +
      "• 8–10k steps/day can burn 300–400 extra kcal — that's half your deficit without touching a treadmill\n• It aids recovery on rest days, lowers stress, and improves heart health\n• Easy hacks: walk after meals (great for blood sugar), take calls walking, stairs over lifts\n\n" +
      "Pair daily steps with your strength workouts in this app and fat loss becomes almost automatic.",
  },
  {
    keys: ["home or gym", "home vs gym", "without gym", "no equipment", "bodyweight"],
    reply: () =>
      "You do NOT need a gym to get fit! 🏠\n\n" +
      "Bodyweight training (everything in this app!) builds real strength and muscle — push-ups, squats, lunges, planks, dips. Progress by adding reps, slowing the tempo, or moving up Beginner → Intermediate → Advanced.\n\n" +
      "A gym adds heavier loading options later, but consistency at home beats an unused membership every single time. Train where you'll actually show up!",
  },
  {
    keys: ["hi", "hello", "hey", "good morning", "good evening", "namaste"],
    reply: (u) =>
      `Hey${u?.name ? ` ${u.name}` : " there"}! 👋 Great to see you. What's on your mind today — a workout question, diet advice, or do you want me to suggest what to train?`,
  },
  {
    keys: ["thank", "thanks", "great", "awesome", "nice", "ok", "okay"],
    reply: () =>
      pick([
        "Anytime! That's what I'm here for. Now go put it into action! 💪",
        "You got it! Remember — knowledge only works when you apply it. See you at the next workout! 🔥",
        "Happy to help! Anything else about training or diet, just ask.",
      ]),
  },
];

const FALLBACKS = [
  "Good question! I specialise in workouts and diet, so let me steer us there 🏋️ — you can ask me things like:\n\n• \"Best chest workout?\"\n• \"How much protein do I need?\"\n• \"How do I lose belly fat?\"\n\nWhat would you like to know?",
  "Hmm, I'm strongest on fitness and nutrition topics! Try asking about a body part you want to train, what to eat before/after workouts, or how to stay consistent. 💪",
  "I might not be the right guy for that one 😅 — but for anything about exercise form, diet, recovery, or motivation, I'm your trainer! What shall we work on?",
];

/**
 * Returns Jack's reply for the user's message. Pure and synchronous today
 * (rule-based); the chat screen awaits it, so this can become an async LLM
 * or API call later with no UI changes.
 */
export const getTrainerReply = async (text, user) => {
  const q = String(text || "").toLowerCase();

  // Longest-keyword match wins so "belly fat" beats a stray "hi" inside a word.
  let best = null;
  let bestLen = 0;
  for (const topic of TOPICS) {
    for (const key of topic.keys) {
      if (q.includes(key) && key.length > bestLen) {
        best = topic;
        bestLen = key.length;
      }
    }
  }

  return best ? best.reply(user) : pick(FALLBACKS);
};
