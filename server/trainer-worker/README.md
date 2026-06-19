# Push Daily — Trainer Chat Worker (Gemini proxy)

A tiny Cloudflare Worker that lets the app's "Jack" chat use the **Gemini free
tier** without shipping the API key in the APK. The app talks to this Worker;
the Worker holds the key and calls Gemini.

```
App  ──POST /chat──►  Worker (key as secret)  ──►  Gemini free tier
  ◄── { reply } ───┘        └── 429 → app falls back to offline rule-based Jack
```

## One-time setup

1. **Get a free Gemini key** at https://aistudio.google.com → "Get API key".
   Do **not** enable billing on the Google Cloud project (billing = paid tier).

2. **Install & log in to Cloudflare** (free, no card):
   ```bash
   npm i -g wrangler
   wrangler login
   ```

3. **(Optional) Get a free Groq key** for fallback at https://console.groq.com/keys
   — used automatically when Gemini's free tier is exhausted.

4. **From this folder**, set the secrets and deploy:
   ```bash
   cd server/trainer-worker
   wrangler secret put GEMINI_KEY      # paste your AI Studio key   (primary)
   wrangler secret put GROQ_API_KEY    # paste your Groq key        (fallback, optional)
   wrangler secret put APP_TOKEN       # any random string, e.g. a UUID
   wrangler deploy
   ```
   Deploy prints your URL, e.g. `https://push-daily-trainer.<you>.workers.dev`.

   Provider order: **Gemini → Groq**. If `GROQ_API_KEY` isn't set, it simply
   uses Gemini only. The JSON response includes `"provider"` so you can see
   which one answered.

5. **Wire the app** — open `constants/trainerAI.js` and set:
   ```js
   const WORKER_URL = "https://push-daily-trainer.<you>.workers.dev";
   const APP_TOKEN  = "<the same random string you set above>";
   ```
   Until `WORKER_URL` is set, the chat shows an honest "couldn't reach" message.

## Test from a terminal

```bash
curl -X POST https://push-daily-trainer.<you>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "X-App-Token: <APP_TOKEN>" \
  -d '{"question":"best chest workout at home?","profile":{"weight":75,"goal":"muscle"}}'
```

## Notes / limits

- **Gemini free tier is one shared quota** (~15 req/min, ~1,500/day — verify
  current limits). The Worker doesn't increase it; the app rations it with a
  per-user daily cap + rewarded-ad gate, and falls back to rule-based Jack on
  `429`.
- **APP_TOKEN is a deterrent, not real security.** It ships in the app and can
  be extracted. For stronger protection, move to a Firebase Function + App
  Check, or add Cloudflare rate-limit rules / Turnstile.
- **Privacy:** questions go device → Cloudflare → Google, and the free tier may
  use them to improve Google's products. Reflect this in the privacy policy.
