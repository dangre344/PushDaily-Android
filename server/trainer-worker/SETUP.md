# Complete Setup — Keys, Secrets, Cron & Fallback

Everything the app needs from a server lives behind **one Cloudflare Worker**.
The app itself contains **no API keys and no database keys**.

```
                       ┌─────────────────────────────────────┐
 App  ──POST──────────►│  Cloudflare Worker                  │
   X-App-Token         │  (secrets stored encrypted here)    │
                       │                                     │
                       │   GEMINI_KEY ──► Gemini  ┐          │
                       │   GROQ_API_KEY ─► Groq   ├ fallback │
                       │   SUPABASE_SERVICE_KEY ──► Supabase │
                       └─────────────────────────────────────┘
```

---

## 1. Where every key lives

| Key | Stored in | Ships in the APK? |
|---|---|---|
| `GEMINI_KEY` | Cloudflare Worker secret | ❌ never |
| `GROQ_API_KEY` | Cloudflare Worker secret | ❌ never |
| `SUPABASE_SERVICE_KEY` | Cloudflare Worker secret | ❌ never |
| `SUPABASE_URL` | Cloudflare Worker secret | ❌ never |
| `APP_TOKEN` | Worker secret **and** app `.env` | ⚠️ yes — by necessity |
| Worker URL | app `.env` | ✅ yes — it's public |

**Why `APP_TOKEN` is different:** the app must present *something* to identify
itself, and anything shipped in an APK can be extracted. It is a deterrent
against drive-by abuse of the public URL — **not** a security boundary. The
important guarantee is that no key which can read/write your database or spend
your AI quota is in the app.

`wrangler secret put` stores values in **Cloudflare's encrypted secret store**.
They're write-only afterwards: you can list names (`wrangler secret list`) but
never read the values back, and they're injected into `env` at runtime only.

---

## 2. Get the keys

| Key | Where |
|---|---|
| `GEMINI_KEY` | https://aistudio.google.com/apikey → **Create API key** (don't enable billing — that leaves the free tier) |
| `GROQ_API_KEY` | https://console.groq.com/keys → **Create API Key** |
| `SUPABASE_URL` | Supabase → Settings → API → **Project URL** |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** |
| `APP_TOKEN` | Invent any random string, e.g. `pushdaily-7h3k9x2` |

---

## 3. Create the database table

Supabase → **SQL Editor**:

```sql
-- Daily AI-generated quiz
create table if not exists daily_quiz (
  date date primary key,
  questions jsonb not null,
  provider text,
  created_at timestamptz default now()
);

-- Push-up leaderboard
create table if not exists scores (
  id text primary key,
  name text not null,
  pushup_count integer not null,
  date timestamptz default now(),
  country text
);

-- Lock both down: only the Worker (service_role) may touch them.
alter table daily_quiz enable row level security;
alter table scores     enable row level security;
```

No policies are needed. The app never connects to Supabase directly, and the
`service_role` key used by the Worker bypasses RLS. With RLS enabled and no
policies, **anyone who somehow got your publishable key still gets nothing.**

---

## 4. Store the secrets in Cloudflare

```bash
cd server/trainer-worker

wrangler secret put GEMINI_KEY            # AIza...
wrangler secret put GROQ_API_KEY          # gsk_...   (fallback)
wrangler secret put SUPABASE_URL          # https://xxxx.supabase.co
wrangler secret put SUPABASE_SERVICE_KEY  # service_role key
wrangler secret put APP_TOKEN             # same string as the app .env
```

Verify (names only — values are never readable):

```bash
wrangler secret list
```

Expected: `APP_TOKEN, GEMINI_KEY, GROQ_API_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL`

---

## 5. Point the app at the Worker

`.env` in the project root — **only these two lines**, no keys:

```
EXPO_PUBLIC_TRAINER_WORKER_URL=https://push-daily-trainer.pushdaily.workers.dev
EXPO_PUBLIC_TRAINER_APP_TOKEN=pushdaily-7h3k9x2
```

`.env` is gitignored, so release builds fall back to the same literals baked
into `constants/api.js` — the single source of truth for both values.

---

## 6. Deploy (registers the cron too)

```bash
wrangler deploy
```

`wrangler.toml` already declares the daily job:

```toml
[triggers]
crons = ["10 3 * * *"]   # 03:10 UTC daily  (= 08:40 IST)
```

Confirm in the dashboard → **Workers & Pages → push-daily-trainer → Settings →
Triggers → Cron Triggers**.

---

## 7. The Gemini → Groq fallback

Every AI path tries **Gemini first, then Groq**, and this is fully automatic:

| Path | Fallback |
|---|---|
| Trainer chat reply | Gemini → Groq → honest "try again" message |
| Workout analysis | Gemini → Groq → local summary from your own numbers |
| Daily quiz generation | Gemini → Groq → nothing written (yesterday's set stays) |

Quiz generation also falls back when Gemini **succeeds but returns unusable
JSON** — the output must pass validation (exactly 10 questions, 4 unique
options, in-range answer index, non-empty hint, answers not all at one index)
before it counts. Failing that, Groq is tried; if it also fails, **nothing is
stored**, so a bad night can never publish a broken quiz.

The response includes `"provider": "gemini" | "groq"` so you can see which one
answered.

---

## 8. Test everything

**Quiz generation:**
```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" -H "X-App-Token: pushdaily-7h3k9x2" \
  -d '{"mode":"generate-quiz","force":true}'
```
→ `{"result":"stored:gemini","date":"..."}`

**Fetch today's quiz (what the app calls):**
```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" -H "X-App-Token: pushdaily-7h3k9x2" \
  -d '{"mode":"daily-quiz"}'
```

**Leaderboard:**
```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" -H "X-App-Token: pushdaily-7h3k9x2" \
  -d '{"mode":"leaderboard","best":0,"limit":10}'
```

**Chat:**
```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" -H "X-App-Token: pushdaily-7h3k9x2" \
  -d '{"question":"best chest workout at home?"}'
```

**Verify the token actually gates access** (should return `401`):
```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" -d '{"mode":"daily-quiz"}'
```

Watch logs live: `wrangler tail`

---

## 9. Test the Groq fallback

Temporarily break Gemini and confirm Groq takes over:

```bash
wrangler secret put GEMINI_KEY     # paste an invalid value
wrangler deploy
# run the chat curl → response should show "provider":"groq"
wrangler secret put GEMINI_KEY     # restore the real key
wrangler deploy
```

---

## 10. Rotating a key

Because nothing is baked into the app, rotation needs **no app release**:

```bash
wrangler secret put GEMINI_KEY   # paste the new value
wrangler deploy
```

Rotating `APP_TOKEN` is the one exception — it must change in the app `.env`
**and** `constants/api.js`, and requires a new build.

---

## 11. Security checklist

- [ ] `wrangler secret list` shows all 5 names
- [ ] RLS **enabled** on `daily_quiz` and `scores`, with no public policies
- [ ] App `.env` contains only the Worker URL + app token
- [ ] `grep -rn "service_role\|AIza\|gsk_" app/ constants/` returns nothing
- [ ] Request without `X-App-Token` returns `401`
- [ ] Billing **not** enabled on the Google Cloud project (stays free)
