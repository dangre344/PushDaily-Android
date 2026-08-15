/**
 * Push Daily — "Jack" trainer chat proxy (Cloudflare Worker).
 *
 * The app calls this Worker; the Worker holds the LLM keys as secrets and
 * forwards the question. Keys never ship in the APK. Tries Gemini's free tier
 * first, then falls back to Groq's free tier if Gemini is exhausted/errors.
 * Deploy with `wrangler deploy` (see README.md).
 *
 * Secrets (set via `wrangler secret put …`, NOT in wrangler.toml):
 *   GEMINI_KEY    — Google AI Studio API key (free tier)         [primary]
 *   GROQ_API_KEY  — Groq API key (free tier)                     [fallback]
 *   APP_TOKEN     — shared string the app sends in X-App-Token
 */

const GEMINI_MODEL = "gemini-2.5-flash"; // free-tier flash model
const GROQ_MODEL = "llama-3.3-70b-versatile"; // Groq free-tier model
// Vision fallback for label reading — separate quota from Gemini.
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_QUESTION_CHARS = 600;

const SYSTEM_PROMPT = `You are Jack, an experienced, certified personal fitness trainer inside the "Push Daily" home-workout app.

SCOPE — Answer ONLY fitness-related questions: workouts, exercise technique, training plans, recovery, sleep for performance, and basic nutrition/diet for fitness goals. If the question is about anything else (general medical problems, politics, coding, relationships, finance, etc.), politely decline in one short line and steer the user back to fitness. Do not answer non-fitness questions.

STYLE — Speak like a knowledgeable coach: warm but to the point. Keep replies SHORT and meaningful — 3–5 short sentences or a tight bullet list, around 120 words max (up to 160 when you also have to explain a goal like fat loss). Skip filler intros like "Hey there!" and get straight to the useful advice. Always finish your final sentence. Use the user's profile (age, weight, goal, experience) when relevant.

COACHING — When the question is about losing weight/belly fat or training a specific body part:
1. Explain the "why" in plain language first. For fat loss that means the calorie deficit: fat is lost when you burn more calories than you eat, roughly 300–500 kcal/day for about 0.5 kg a week; spot reduction is a myth, so belly fat goes when overall body fat goes.
2. Give 2–3 concrete actions (training frequency, protein, steps, sleep).
3. Then point them at the app's own workout — the app shows a "Start workout" card right under your reply, so close with a short line telling them to tap it (e.g. "Tap below to start the HIIT session."). Recommend from the app's library only: HIIT, Chest, Abs, Arms, Back, Shoulder, Legs, Full Body. Do NOT send them to a gym, another app, or equipment they may not have.

SAFETY RULES (always follow):
- NEVER recommend, prescribe, name dosages for, or explain how to use steroids, SARMs, or any performance-enhancing drugs. If asked, refuse and tell them to seek guidance from a qualified doctor.
- For injuries, pain, or medical conditions, tell them to see a doctor or physiotherapist.
- Whenever your answer suggests any diet, foods, or a meal plan, end the reply with this exact line on its own line:
  "Note: Please check your food allergies before trying these options."
- Never give medical, legal, or financial advice.`;

const ANALYSIS_PROMPT = `You are Jack, an experienced certified personal fitness trainer in the "Push Daily" app. The user has unlocked a full progress review. You are given a JSON summary of ALL their completed workouts.

Write an encouraging, specific review (about 150–230 words) using short labelled sections or bullet points:
- A warm opening that cheers their effort and calls out the headline numbers (total workouts, calories burned, active days).
- "What's going well": consistency, volume, variety, favourite body part.
- "Focus next": 1–3 specific, kind suggestions (e.g. a neglected body part, balancing difficulty levels, training more often).
- "Your next move": one concrete goal for the coming week.
End with an energetic one-line cheer.

Base everything ONLY on the numbers provided — never invent data. Never mention steroids or PEDs. If you suggest any diet or food, end the reply with: "Note: Please check your food allergies before trying these options."`;

// ─── Daily quiz generation (cron) ────────────────────────────────────────────
const QUIZ_CATEGORIES = [
  "fat_loss",
  "calories",
  "nutrients",
  "workouts",
  "muscles",
  "home",
  "vitamins",
  "water",
  "recovery",
];
const QUIZ_COUNT = 10;

const QUIZ_PROMPT = `Generate exactly ${QUIZ_COUNT} multiple-choice fitness quiz questions.

MIX: exactly 4 "basic", 3 "intermediate", 3 "advanced".
TOPICS: spread across fat_loss, calories, nutrients, workouts, muscles, home, vitamins, water, recovery — include at least one "water" question.

RULES:
- Only well-established, mainstream exercise-science and nutrition facts. No fads, no controversial or fringe claims, nothing requiring medical advice.
- Exactly 4 options per question; exactly ONE is unambiguously correct and the other three are clearly wrong.
- "correct" is the 0-based INDEX of the right option.
- Vary which index is correct across the set (do not always use 0).
- "tip" is a HINT shown BEFORE the user answers. It must nudge them toward the
  right reasoning WITHOUT naming or restating the correct option. Never include
  the answer text or a number that gives it away. 1–2 short sentences.
  GOOD: "Think about which macronutrient your body works hardest to digest."
  BAD:  "Protein has the highest thermic effect." (that's the answer)
- "emoji" is a single relevant emoji.
- Keep question text under 110 characters and each option under 60 characters.
- Never mention steroids or performance-enhancing drugs.

Return ONLY a JSON array of ${QUIZ_COUNT} objects with exactly these keys:
category, difficulty, emoji, question, options, correct, tip`;

function validateQuiz(raw) {
  if (!Array.isArray(raw) || raw.length !== QUIZ_COUNT) return null;

  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const q = raw[i] || {};
    const options = q.options;
    const correct = Number(q.correct);

    if (
      typeof q.question !== "string" ||
      q.question.trim().length < 8 ||
      !Array.isArray(options) ||
      options.length !== 4 ||
      options.some((o) => typeof o !== "string" || !o.trim()) ||
      new Set(options.map((o) => o.trim().toLowerCase())).size !== 4 ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > 3 ||
      typeof q.tip !== "string" ||
      q.tip.trim().length < 10
    ) {
      return null;
    }

    out.push({
      id: i + 1,
      category: QUIZ_CATEGORIES.includes(q.category) ? q.category : "workouts",
      difficulty: ["basic", "intermediate", "advanced"].includes(q.difficulty)
        ? q.difficulty
        : "basic",
      emoji: typeof q.emoji === "string" && q.emoji ? q.emoji.slice(0, 4) : "💪",
      question: q.question.trim(),
      options: options.map((o) => o.trim()),
      correct,
      tip: q.tip.trim(),
    });
  }

  // Reject a degenerate set where every answer sits at the same index.
  if (new Set(out.map((q) => q.correct)).size < 2) return null;
  return out;
}

// Quiz content is GEMINI ONLY — its JSON mode is far more reliable here, and a
// single author keeps the daily set consistent in tone and difficulty.
// (Groq remains the fallback for chat and analysis, where prose is fine.)
// A failed night writes nothing, so yesterday's valid set stays live.
async function generateQuiz(env) {
  const gem = await callGemini(
    env,
    "You are a certified strength & nutrition coach writing quiz content. Output strict JSON only.",
    QUIZ_PROMPT,
    2600,
    true,
  );
  const parsed = safeParseArray(gem.status === "ok" ? gem.text : null);
  const quiz = validateQuiz(parsed);
  if (quiz) return { quiz, provider: "gemini" };

  console.log(`[quiz] gemini failed (status=${gem.status}) — nothing stored`);
  return { quiz: null, provider: null };
}

function safeParseArray(text) {
  if (!text) return null;
  try {
    // Tolerate ```json fences or leading prose.
    const cleaned = String(text)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// ─── Supabase helpers (service key stays server-side) ───────────────────────
function sbHeaders(env) {
  const key = env.SUPABASE_SERVICE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function supabaseSelect(env, pathWithQuery) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathWithQuery}`, {
      headers: sbHeaders(env),
    });
    if (!res.ok) {
      console.log(`[supabase] select ${res.status}: ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`[supabase] select threw: ${String(e)}`);
    return null;
  }
}

// Last PostgREST failure, echoed back by the manual generate-quiz trigger so a
// single curl tells you what broke. Per-isolate, diagnostics only.
let lastSupabaseError = null;

async function supabaseUpsert(env, table, row) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    lastSupabaseError = "SUPABASE_URL / SUPABASE_SERVICE_KEY not set";
    console.log(`[supabase] ${table}: ${lastSupabaseError}`);
    return false;
  }
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sbHeaders(env), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    });
    // Surface PostgREST's reason (missing table, bad key, column mismatch) —
    // a silent false here is impossible to diagnose from the outside.
    if (!res.ok) {
      // Include the host: a 404 from a non-supabase host means SUPABASE_URL
      // itself is wrong (Cloudflare error 1042 = the Worker fetched itself).
      let host = "unparseable";
      try {
        host = new URL(env.SUPABASE_URL).host;
      } catch {}
      lastSupabaseError = `${res.status} from host "${host}": ${(await res.text()).slice(0, 200)}`;
      console.log(`[supabase] ${table} upsert ${lastSupabaseError}`);
    }
    return res.ok;
  } catch (e) {
    lastSupabaseError = `threw: ${String(e)}`;
    console.log(`[supabase] ${table} upsert ${lastSupabaseError}`);
    return false;
  }
}

// PostgREST filter restricting rows to the current UTC day. The leaderboard is
// global, so the day boundary must be the same instant for every country.
function utcDayFilter() {
  const n = new Date();
  const start = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0),
  ).toISOString();
  const end = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 23, 59, 59, 999),
  ).toISOString();
  return `&date=gte.${start}&date=lte.${end}`;
}

async function countScoresAbove(env, best) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return 0;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/scores?select=id&pushup_count=gt.${best}` +
        utcDayFilter(),
      { method: "HEAD", headers: { ...sbHeaders(env), Prefer: "count=exact" } },
    );
    const cr = res.headers.get("content-range"); // "*/N"
    const total = cr ? parseInt(cr.split("/")[1], 10) : 0;
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

// created_at is intentionally omitted — the column defaults to now(), and
// sending it fails the whole insert on tables created without that column.
const supabaseUpsertQuiz = (env, date, questions, provider) =>
  supabaseUpsert(env, "daily_quiz", { date, questions, provider });

async function supabaseHasQuiz(env, date) {
  const rows = await supabaseSelect(
    env,
    `daily_quiz?select=date&date=eq.${date}&limit=1`,
  );
  return Array.isArray(rows) && rows.length > 0;
}

// ═══════════════════════ Push-up event broadcast (FCM) ══════════════════════
// Fully automated: a cron fires twice a day, reads the live leaderboard and
// pushes one message to the "daily_updates" FCM topic. Every device already
// subscribes to that topic on launch, so there is no token list to maintain
// and no per-user fan-out — one HTTP call reaches everyone, free of charge.

const FCM_TOPIC = "daily_updates";

// Must match the quiz entry in wrangler.toml — scheduled() routes on it.
const QUIZ_CRON = "10 3 * * *";

// Sent when somebody already holds the top spot today.
const LEADER_MESSAGES = [
  { title: "👑 New champion today!", body: "{name} just hit {count} push-ups. Think you can beat that?" },
  { title: "🔥 {name} is on top!", body: "{count} push-ups and counting. The crown is still up for grabs." },
  { title: "💪 Record to beat", body: "{name} set today's bar at {count} push-ups. Your move." },
  { title: "🏆 {count} push-ups!", body: "{name} leads the global board today. Can you take #1?" },
  { title: "⚡ Someone's flying today", body: "{name} pushed out {count} reps. Beat it before midnight!" },
  { title: "🚨 Leaderboard shake-up", body: "{name} is #1 with {count} push-ups. Fight back!" },
  { title: "😤 {name} took the lead", body: "{count} push-ups. You've still got hours to reclaim the top spot." },
  { title: "🥇 Today's number one", body: "{name} is at {count}. How many can you do right now?" },
  { title: "🎯 Target: {count} push-ups", body: "That's {name}'s score today. Drop and prove you're stronger." },
  { title: "💥 {count} and counting", body: "{name} owns the board. Every rep gets you closer." },
  { title: "🌍 Global leader alert", body: "{name} tops today's challenge with {count}. Join in!" },
  { title: "⏳ The crown is warm", body: "{name} holds #1 with {count} push-ups. Nobody said it's permanent." },
];

// Sent when the board is still empty — nobody has logged a push-up today.
const FIRST_MOVER_MESSAGES = [
  { title: "🥇 Be the first today!", body: "Nobody has logged a push-up yet. Claim rank #1 in seconds." },
  { title: "🌍 The global board is empty", body: "Be the first athlete to rank today. One set is all it takes." },
  { title: "👑 #1 is unclaimed", body: "No push-ups logged yet today. Take the top spot before anyone else." },
  { title: "💪 An empty leaderboard!", body: "Be the first to score today and set the target for everyone." },
  { title: "🚀 First mover advantage", body: "Zero push-ups on the board. Log yours and lead the world today." },
  { title: "⏰ Board resets daily", body: "Nobody has claimed today yet. Be the one everyone chases." },
];

const fillMessage = (msg, name, count) => ({
  title: msg.title.replace(/\{name\}/g, name).replace(/\{count\}/g, count),
  body: msg.body.replace(/\{name\}/g, name).replace(/\{count\}/g, count),
});

// ── Google OAuth for FCM HTTP v1 (service-account JWT, signed with WebCrypto) ─
let cachedToken = null; // { token, expiresAt }

const b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pemToBytes = (pem) => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

async function getGoogleAccessToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  if (!env.FCM_SERVICE_ACCOUNT) return null;

  let sa;
  try {
    sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  } catch {
    console.log("[fcm] FCM_SERVICE_ACCOUNT is not valid JSON");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const seg = (o) => b64url(enc.encode(JSON.stringify(o)));
  const unsigned =
    seg({ alg: "RS256", typ: "JWT" }) +
    "." +
    seg({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    });

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  if (!res.ok) {
    console.log(`[fcm] token exchange ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

/** One HTTP call → every subscribed device. */
async function sendTopicNotification(env, { title, body }) {
  const token = await getGoogleAccessToken(env);
  if (!token) return "no-credentials";

  const projectId = JSON.parse(env.FCM_SERVICE_ACCOUNT).project_id;
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          topic: FCM_TOPIC,
          notification: { title, body },
          data: { type: "pushup_event", screen: "event" },
          android: {
            priority: "high",
            notification: { channel_id: "default", sound: "default" },
          },
        },
      }),
    },
  );
  if (!res.ok) {
    console.log(`[fcm] send ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return `send-failed:${res.status}`;
  }
  return "sent";
}

/**
 * Reads today's board and broadcasts the right message. Fully unattended —
 * no human picks the copy, the leaderboard decides which list is used.
 */
async function runEventBroadcast(env) {
  const rows =
    (await supabaseSelect(
      env,
      `scores?select=name,pushup_count&order=pushup_count.desc&limit=1${utcDayFilter()}`,
    )) || [];

  const leader = rows[0];
  // Rotate copy by day + score so consecutive sends never repeat.
  const seed = Number(utcDateKey().replace(/-/g, "")) + new Date().getUTCHours();

  const msg = leader
    ? fillMessage(
        LEADER_MESSAGES[seed % LEADER_MESSAGES.length],
        String(leader.name || "Someone").split(" ")[0],
        leader.pushup_count,
      )
    : FIRST_MOVER_MESSAGES[seed % FIRST_MOVER_MESSAGES.length];

  const result = await sendTopicNotification(env, msg);
  console.log(`[event-broadcast] ${result} — "${msg.title}"`);
  return result;
}


// ═════════════════════════ Food label reading (vision) ══════════════════════
// The model ONLY transcribes what it can see into structured JSON. The healthy
// / unhealthy decision is made by fixed rules in the app, so the same label
// always yields the same verdict and we can show the arithmetic.
const LABEL_PROMPT = `You are reading a photo of a packaged food label.

Return STRICT JSON only, no prose, matching exactly:
{
  "name": "product name if visible, else empty string",
  "basis": "per_100g" or "per_serving",
  "serving_size_g": number or null,
  "nutrition": {
    "energy_kcal": number|null, "sugars_g": number|null, "fat_g": number|null,
    "saturates_g": number|null, "salt_g": number|null,
    "fibre_g": number|null, "protein_g": number|null
  },
  "ingredients_text": "the full ingredients list exactly as printed, or empty string",
  "declared_allergens": ["names from any Contains: line"]
}

Rules:
- Copy numbers EXACTLY as printed. Never estimate, infer or round.
- "basis" must reflect which column you read. If the table shows both, use per_100g.
- If sodium is given instead of salt, convert: salt_g = sodium_g * 2.5.
- Use null for anything not legible. Do NOT guess.
- Transcribe ingredients verbatim - allergen detection depends on it.
- Output nothing except the JSON object.`;

async function readLabel(env, base64) {
  if (!env.GEMINI_KEY) {
    console.log("[label] GEMINI_KEY secret is not set");
    return { reason: "server" };
  }

  const t0 = Date.now();
  console.log(
    `[label] start — ${Math.round((base64.length * 3) / 4 / 1024)}KB image, model ${GEMINI_MODEL}`,
  );

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_KEY}`;

  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: LABEL_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: base64 } },
                { text: "Read this label." },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            // Trimmed: the schema is small, and fewer tokens = faster reply.
            maxOutputTokens: 900,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
          },
        }),
      },
      55000, // vision round-trips regularly exceed 30s on the free tier
    );
  } catch (e) {
    // Almost always the 28s timeout — a big image on a slow uplink.
    console.log(`[label] fetch threw after ${Date.now() - t0}ms: ${String(e)}`);
    return { reason: "server" };
  }

  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    console.log(`[label] gemini HTTP ${res.status} after ${Date.now() - t0}ms: ${body}`);
    // 429 = free-tier quota gone for the day; worth its own message.
    return { reason: res.status === 429 ? "quota" : "server" };
  }

  console.log(`[label] gemini 200 in ${Date.now() - t0}ms`);

  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.[0]?.text;
  if (!text) {
    // finishReason tells us whether it was a safety block, a token cutoff,
    // or genuinely nothing readable in the photo.
    console.log(
      `[label] no text. finishReason=${cand?.finishReason} ` +
        `promptFeedback=${JSON.stringify(data?.promptFeedback || null)}`,
    );
    return { reason: "unreadable" };
  }
  console.log(`[label] parsed ${text.length} chars of JSON`);

  let parsed;
  try {
    parsed = JSON.parse(String(text).replace(/^```json\s*/i, "").replace(/```$/, ""));
  } catch {
    console.log(`[label] unparseable JSON: ${String(text).slice(0, 160)}`);
    return { reason: "unreadable" };
  }
  return validateLabel(parsed);
}

/** Rejects anything we cannot safely act on, and says which check failed. */
function validateLabel(p) {
  if (!p || typeof p !== "object") return { reason: "unreadable" };

  const n = p.nutrition;
  if (!n || typeof n !== "object") return { reason: "unreadable" };

  const numOrNull = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 10000 ? v : null;

  const nutrition = {
    energy_kcal: numOrNull(n.energy_kcal),
    sugars_g: numOrNull(n.sugars_g),
    fat_g: numOrNull(n.fat_g),
    saturates_g: numOrNull(n.saturates_g),
    salt_g: numOrNull(n.salt_g),
    fibre_g: numOrNull(n.fibre_g),
    protein_g: numOrNull(n.protein_g),
  };

  // Need at least two of the four scored nutrients or the verdict is meaningless.
  const scored = ["sugars_g", "fat_g", "saturates_g", "salt_g"].filter(
    (k) => nutrition[k] !== null,
  );
  if (scored.length < 2) {
    console.log(`[label] only ${scored.length} scored nutrient(s) legible`);
    return { reason: "too_few" };
  }

  const basis = p.basis === "per_serving" ? "per_serving" : "per_100g";
  const serving = numOrNull(p.serving_size_g);
  // A per-serving basis without a serving size cannot be rescaled - refuse it
  // rather than scoring numbers that flatter the manufacturer.
  if (basis === "per_serving" && !serving) {
    console.log("[label] per-serving basis with no serving size");
    return { reason: "no_serving" };
  }

  return {
    product: {
    name: String(p.name || "").slice(0, 120),
    basis,
    serving_size_g: serving,
    nutrition,
    ingredients_text: String(p.ingredients_text || "").slice(0, 1500),
    declared_allergens: Array.isArray(p.declared_allergens)
      ? p.declared_allergens.map((a) => String(a).slice(0, 40)).slice(0, 20)
      : [],
    },
  };
}


/**
 * Second reader: Groq's free-tier vision model. Separate quota from Gemini, so
 * a Gemini 429 doesn't take label reading down with it.
 */
async function readLabelGroq(env, base64) {
  if (!env.GROQ_API_KEY) return { reason: "server" };

  const t0 = Date.now();
  console.log("[label] falling back to groq vision");

  let res;
  try {
    res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_VISION_MODEL,
          temperature: 0,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: LABEL_PROMPT },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
        }),
      },
      45000,
    );
  } catch (e) {
    console.log(`[label] groq threw after ${Date.now() - t0}ms: ${String(e)}`);
    return { reason: "server" };
  }

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    console.log(`[label] groq HTTP ${res.status}: ${body}`);
    return { reason: res.status === 429 ? "quota" : "server" };
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { reason: "unreadable" };

  try {
    return validateLabel(
      JSON.parse(String(text).replace(/^```json\s*/i, "").replace(/```$/, "")),
    );
  } catch {
    console.log("[label] groq returned unparseable JSON");
    return { reason: "unreadable" };
  }
}

/**
 * Reader chain: Gemini → Groq. Both are free tiers with independent quotas,
 * so exhausting one still leaves a working path.
 */
async function readLabelChain(env, base64) {
  const first = await readLabel(env, base64);
  if (first?.product) return first;

  // Only worth a second attempt when the FIRST failed for a reason another
  // provider might not share — quota or an outage, not an illegible photo.
  if (first?.reason === "quota" || first?.reason === "server") {
    const second = await readLabelGroq(env, base64);
    if (second?.product) return second;
    // Both out of credit reads better than a generic error.
    if (first.reason === "quota" && second?.reason === "quota") {
      return { reason: "quota" };
    }
    return second;
  }
  return first;
}

/** Generates + stores tomorrow-safe today's set. Returns a status string. */
async function runDailyQuizJob(env, { force = false } = {}) {
  const date = utcDateKey();

  if (!force && (await supabaseHasQuiz(env, date))) return "already-exists";

  const { quiz, provider } = await generateQuiz(env);
  if (!quiz) return "generation-failed"; // app falls back to its local bank

  const ok = await supabaseUpsertQuiz(env, date, quiz, provider);
  return ok ? `stored:${provider}` : "store-failed";
}

export default {
  // Cloudflare cron → fully unattended. Which job runs depends on which
  // schedule fired (event.cron matches the entries in wrangler.toml).
  async scheduled(event, env, ctx) {
    if (event.cron === QUIZ_CRON) {
      ctx.waitUntil(
        runDailyQuizJob(env).then((r) =>
          console.log(`[quiz-cron] ${utcDateKey()} → ${r}`),
        ),
      );
      return;
    }
    // Both broadcast schedules run the same job — it reads the live board and
    // picks "somebody leads" vs "be the first" copy on its own.
    ctx.waitUntil(runEventBroadcast(env));
  },

  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    // Cheap gate against drive-by abuse of the public endpoint.
    if (env.APP_TOKEN && request.headers.get("X-App-Token") !== env.APP_TOKEN) {
      return json({ error: "unauthorized" }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_request" }, 400);
    }

    // ── Data endpoints: the app talks to these instead of Supabase, so no
    // database keys ever ship inside the APK (same pattern as the chat). ──

    // Today's shared quiz set. Returns { questions: [] | null }.
    if (body?.mode === "daily-quiz") {
      const rows = await supabaseSelect(
        env,
        `daily_quiz?select=questions&date=eq.${utcDateKey()}&limit=1`,
      );
      const questions = rows?.[0]?.questions;
      return json({ questions: Array.isArray(questions) ? questions : null });
    }

    // Global push-up leaderboard for the current UTC day.
    if (body?.mode === "leaderboard") {
      const limit = Math.min(Number(body.limit) || 10, 50);
      const rows =
        (await supabaseSelect(
          env,
          `scores?select=id,name,pushup_count,country&order=pushup_count.desc` +
            `&limit=${limit}${utcDayFilter()}`,
        )) || [];

      let rank = 0;
      const best = Number(body.best) || 0;
      const mine = rows.findIndex((r) => String(r.id) === String(body.userId));
      if (mine >= 0) rank = mine + 1;
      else if (best > 0) rank = (await countScoresAbove(env, best)) + 1;

      return json({ rows, rank });
    }

    // Upsert this user's best score (stamped in UTC so the day is global).
    if (body?.mode === "submit-score") {
      const id = String(body.id || "").trim();
      const count = Number(body.count);
      if (!id || !Number.isFinite(count) || count < 0 || count > 10000) {
        return json({ error: "bad_score" }, 400);
      }
      const ok = await supabaseUpsert(env, "scores", {
        id,
        name: String(body.name || "Anonymous").slice(0, 60),
        pushup_count: Math.round(count),
        country: body.country ? String(body.country).slice(0, 2) : null,
        date: new Date().toISOString(),
      });
      return json({ ok });
    }

    // Reads a photographed food label into structured JSON. The verdict is
    // computed client-side from fixed rules — this only transcribes.
    if (body?.mode === "analyze-label") {
      const image = String(body.image || "");
      if (!image || image.length > 4000000) {
        return json({ error: "bad_image" }, 400);
      }
      console.log(`[label] request received, ${image.length} chars`);
      const out = await readLabelChain(env, image);
      console.log(`[label] result: ${out?.product ? "product" : out?.reason}`);
      return out?.product
        ? json({ product: out.product })
        : json({ product: null, reason: out?.reason || "unreadable" });
    }

    // Manual trigger for the event broadcast (same code both crons run) —
    // handy for testing: { "mode": "broadcast-event" }
    if (body?.mode === "broadcast-event") {
      const result = await runEventBroadcast(env);
      return json({ result });
    }

    // Manual trigger for the daily quiz job (same code the cron runs) —
    // handy for testing: { "mode": "generate-quiz", "force": true }
    if (body?.mode === "generate-quiz") {
      lastSupabaseError = null;
      const result = await runDailyQuizJob(env, { force: !!body.force });
      return json({
        result,
        date: utcDateKey(),
        ...(lastSupabaseError ? { detail: lastSupabaseError } : {}),
      });
    }

    const mode = body?.mode === "analyze" ? "analyze" : "chat";
    const profileLine = buildProfileLine(body?.profile || {});

    // Build the system + user text once; both providers reuse it.
    let systemText, userText, maxTokens;
    if (mode === "analyze") {
      const stats = body?.stats;
      if (!stats || typeof stats !== "object") {
        return json({ error: "missing_stats" }, 400);
      }
      systemText = ANALYSIS_PROMPT;
      userText =
        (profileLine ? `${profileLine}\n\n` : "") +
        `Here is the user's completed-workout data from the app:\n${JSON.stringify(stats)}`;
      maxTokens = 900;
    } else {
      const question = String(body?.question || "").slice(0, MAX_QUESTION_CHARS).trim();
      if (!question) return json({ error: "empty_question" }, 400);
      systemText = SYSTEM_PROMPT;
      userText = profileLine ? `${profileLine}\n\nQuestion: ${question}` : question;
      maxTokens = 800;
    }

    // ── Provider chain: Gemini (primary) → Groq (fallback) ──
    let result = await callGemini(env, systemText, userText, maxTokens);
    let provider = "gemini";

    if (result.status !== "ok") {
      const groq = await callGroq(env, systemText, userText, maxTokens);
      if (groq.status === "ok") {
        result = groq;
        provider = "groq";
      } else if (result.status === "quota" || groq.status === "quota") {
        // Both free tiers tapped out → let the app show a "try later" message.
        return json({ error: "quota", quotaExhausted: true }, 429);
      } else {
        return json({ error: "upstream_error" }, 502);
      }
    }

    return json({ reply: result.text, provider });
  },
};

// ── Gemini (Google AI Studio, free tier) ──
async function callGemini(env, systemText, userText, maxTokens, jsonMode = false) {
  if (!env.GEMINI_KEY) return { status: "fail" };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_KEY}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: jsonMode ? 0.9 : 0.7, // more variety for daily question sets
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 }, // 2.5 Flash thinking eats the budget
      // Structured output makes the quiz JSON reliably parseable.
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  // 500/503 are transient overloads on the free tier — retry briefly.
  const RETRYABLE = new Set([500, 503]);
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(
        url,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        20000,
      );
    } catch {
      if (attempt === 3) return { status: "fail" };
      await sleep(300 * attempt);
      continue;
    }
    if (res.status === 429) return { status: "quota" };
    if (RETRYABLE.has(res.status) && attempt < 3) {
      await sleep(500 * attempt);
      continue;
    }
    if (!res.ok) return { status: "fail" };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
    return text ? { status: "ok", text } : { status: "fail" };
  }
  return { status: "fail" };
}

// ── Groq (OpenAI-compatible, free tier) ──
async function callGroq(env, systemText, userText, maxTokens) {
  if (!env.GROQ_API_KEY) return { status: "fail" };

  let res;
  try {
    res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemText },
            { role: "user", content: userText },
          ],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      },
      20000,
    );
  } catch {
    return { status: "fail" };
  }

  if (res.status === 429) return { status: "quota" };
  if (!res.ok) return { status: "fail" };
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text ? { status: "ok", text } : { status: "fail" };
}

function buildProfileLine(p) {
  const bits = [];
  if (p.gender) bits.push(p.gender);
  if (p.age) bits.push(`${p.age}y`);
  if (p.weight) bits.push(`${p.weight}kg`);
  if (p.height) bits.push(`${p.height}cm`);
  if (p.goal) bits.push(`goal: ${p.goal}`);
  if (p.experience) bits.push(`level: ${p.experience}`);
  return bits.length ? `User profile — ${bits.join(", ")}.` : "";
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
