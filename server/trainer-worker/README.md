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

## Daily AI-generated quiz (cron)

A Cloudflare **Cron Trigger** (`10 3 * * *` — 03:10 UTC daily, free) makes the
Worker generate 10 fresh quiz questions with Gemini (Groq as fallback),
**validate** them, and upsert them into Supabase. The app reads the set once a
day and caches it. No manual work, no paid services.

### One-time setup

1. **Create the table** (Supabase → SQL editor):
   ```sql
   create table daily_quiz (
     date date primary key,
     questions jsonb not null,
     provider text,
     created_at timestamptz default now()
   );
   alter table daily_quiz enable row level security;
   create policy "public read" on daily_quiz for select using (true);
   ```
   The app reads with the publishable key; the Worker writes with the
   service key (which bypasses RLS), so only a read policy is needed.

2. **Add the write credentials** as Worker secrets (server-side only — the
   service key must NEVER go in the app):
   ```bash
   wrangler secret put SUPABASE_URL           # https://<project>.supabase.co
   wrangler secret put SUPABASE_SERVICE_KEY   # service_role key
   wrangler deploy
   ```

3. **Test it now** instead of waiting for the cron:
   ```bash
   curl -X POST https://push-daily-trainer.<you>.workers.dev \
     -H "Content-Type: application/json" \
     -H "X-App-Token: <APP_TOKEN>" \
     -d '{"mode":"generate-quiz","force":true}'
   ```
   Returns `{"result":"stored:gemini","date":"..."}`. Watch live logs with
   `wrangler tail`.

### Safety net
Generated questions are strictly validated (exactly 10, 4 unique options,
in-range answer index, non-empty tip, answers not all at the same index). If
validation or the network fails, **nothing is stored** and the app falls back to
its bundled deterministic question bank — so the quiz always works.

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
