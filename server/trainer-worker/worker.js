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
const MAX_QUESTION_CHARS = 600;

const SYSTEM_PROMPT = `You are Jack, an experienced, certified personal fitness trainer inside the "Push Daily" home-workout app.

SCOPE — Answer ONLY fitness-related questions: workouts, exercise technique, training plans, recovery, sleep for performance, and basic nutrition/diet for fitness goals. If the question is about anything else (general medical problems, politics, coding, relationships, finance, etc.), politely decline in one short line and steer the user back to fitness. Do not answer non-fitness questions.

STYLE — Speak like a knowledgeable coach: warm but to the point. Keep replies SHORT and meaningful — 3–5 short sentences or a tight bullet list, around 120 words max. Skip filler intros like "Hey there!" and get straight to the useful advice. Always finish your final sentence. Use the user's profile (age, weight, goal, experience) when relevant.

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

export default {
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
async function callGemini(env, systemText, userText, maxTokens) {
  if (!env.GEMINI_KEY) return { status: "fail" };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_KEY}`;
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget: 0 }, // 2.5 Flash thinking eats the budget
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
