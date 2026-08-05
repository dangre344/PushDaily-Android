# Daily AI Quiz — Full Setup Guide

Every night a Cloudflare Cron wakes the Worker, asks Gemini for 10 fresh fitness
questions, validates them, and stores them in Supabase. The app downloads that
set once a day and caches it. **Every user gets the same questions**, and the
whole pipeline runs on free tiers.

```
Cloudflare Cron (03:10 UTC daily)
   └─► Worker: generate via Gemini  (Groq = fallback)
        └─► validate strictly
             └─► upsert into Supabase `daily_quiz`
                  └─► App fetches once/day → caches in AsyncStorage
                       └─► if anything fails → bundled offline question bank
```

---

## 0. What you need (all free, no card)

| Service | Used for | Free tier |
|---|---|---|
| Cloudflare Workers | Cron + generation | 100k req/day, cron included |
| Google AI Studio (Gemini) | Writes the questions | ~1,500 req/day (we use **1**) |
| Supabase | Stores the daily set | 500 MB DB, 5 GB egress |
| Groq *(optional)* | Fallback generator | Free tier |

> Do **not** enable billing on the Google Cloud project — billing switches you
> off the free tier.

---

## 1. Create the Supabase table

Supabase dashboard → **SQL Editor** → run:

```sql
create table daily_quiz (
  date date primary key,
  questions jsonb not null,
  provider text,
  created_at timestamptz default now()
);

alter table daily_quiz enable row level security;

-- The app reads with the publishable key.
create policy "public read" on daily_quiz
  for select using (true);
```

No insert policy is needed: the Worker writes with the **service key**, which
bypasses RLS.

---

## 2. Collect your keys

| Key | Where to get it | Goes where |
|---|---|---|
| `GEMINI_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key | Worker secret |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | Worker secret |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** | Worker secret |
| `GROQ_API_KEY` *(optional)* | [console.groq.com/keys](https://console.groq.com/keys) | Worker secret |
| Publishable (anon) key | Supabase → Settings → API → anon/publishable | already in the app `.env` |

> ⚠️ **The service_role key must never go in the app.** It bypasses every
> security rule. It lives only as a Worker secret (server-side).

---

## 3. Set the Worker secrets

```bash
cd server/trainer-worker

wrangler secret put GEMINI_KEY            # AIza...
wrangler secret put SUPABASE_URL          # https://xxxx.supabase.co
wrangler secret put SUPABASE_SERVICE_KEY  # service_role key
wrangler secret put GROQ_API_KEY          # optional fallback
wrangler secret put APP_TOKEN             # any random string; must match the app
```

`APP_TOKEN` must equal `EXPO_PUBLIC_TRAINER_APP_TOKEN` in the app's `.env`
(currently `pushdaily-7h3k9x2`).

Check what's stored:

```bash
wrangler secret list
```

---

## 4. Deploy (this also registers the cron)

```bash
wrangler deploy
```

The cron is already declared in `wrangler.toml`:

```toml
[triggers]
crons = ["10 3 * * *"]     # 03:10 UTC every day
```

Deploy output should list the schedule. You can also confirm it in the
Cloudflare dashboard → **Workers & Pages → push-daily-trainer → Settings →
Triggers → Cron Triggers**.

**Changing the time:** cron is always **UTC**. `10 3 * * *` = 08:40 IST /
23:10 US-Eastern (prev. day). Pick a time comfortably before your users wake up.

---

## 5. Test it immediately (don't wait for the cron)

```bash
curl -X POST https://push-daily-trainer.pushdaily.workers.dev \
  -H "Content-Type: application/json" \
  -H "X-App-Token: pushdaily-7h3k9x2" \
  -d '{"mode":"generate-quiz","force":true}'
```

PowerShell:

```powershell
$body = '{"mode":"generate-quiz","force":true}'
Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Headers @{"X-App-Token"="pushdaily-7h3k9x2"} -Body $body `
  -Uri "https://push-daily-trainer.pushdaily.workers.dev"
```

Expected: `{"result":"stored:gemini","date":"2026-08-01"}`

| Result | Meaning |
|---|---|
| `stored:gemini` / `stored:groq` | ✅ Success |
| `already-exists` | Today's row exists — use `"force":true` to regenerate |
| `generation-failed` | Both LLMs failed or output failed validation |
| `store-failed` | Supabase rejected the write (check URL / service key) |

Watch live logs while it runs:

```bash
wrangler tail
```

---

## 6. Verify the data

Supabase → **Table Editor → daily_quiz**, or SQL:

```sql
select date, provider, jsonb_array_length(questions) as n, created_at
from daily_quiz order by date desc limit 7;
```

You want `n = 10`. Inspect the actual questions:

```sql
select jsonb_pretty(questions) from daily_quiz where date = current_date;
```

---

## 7. Verify in the app

The app side is already wired (`constants/quizDaily.js`, `REMOTE_ENABLED = true`).

1. Reload the app, open the **Quiz** tab, start a quiz.
2. The questions should match what's in the `daily_quiz` row.
3. To force a re-fetch, clear the app's storage (the set is cached per day under
   `quiz_daily_set`).

**Resolution order:** AsyncStorage cache → Supabase → bundled offline bank.
If Supabase is unreachable, paused, or the row is missing, the app silently
falls back to its built-in deterministic set — the quiz never breaks.

---

## 8. How it behaves day to day

- **10 questions/day**, shared by all users, mixed 4 basic / 3 intermediate / 3 advanced.
- Played **5 at a time** → `DAILY_QUIZ_LIMIT = 2` quiz sessions per day
  (derived from `DAILY_QUESTION_COUNT / QUESTIONS_PER_QUIZ`).
- The job is **idempotent** — if today's row already exists it does nothing, so
  a retried cron can't overwrite a good set.
- Validation rejects a set unless it has exactly 10 questions, 4 unique options
  each, an in-range answer index, a non-empty hint, and answers not all at the
  same index. **On failure nothing is written.**

---

## 9. Free-tier maths

| | Per day | 1,000 users/month |
|---|---|---|
| Gemini calls | **1** (total, not per user) | 30 |
| Cloudflare invocations | 1 cron + app never calls it | ~30 |
| Supabase rows | 1 (~3 KB) | ~90 KB stored |
| Supabase egress | 1 cached fetch/user (~3 KB) | ~90 MB of 5 GB |

Comfortably free even at 10k+ users.

---

## 10. Troubleshooting

**`generation-failed`**
Gemini quota (429) or invalid JSON. Run `wrangler tail` while triggering. Add
`GROQ_API_KEY` as a fallback. Retry — free-tier 429s are usually transient.

**`store-failed`**
`SUPABASE_URL` malformed (must include `https://`, no trailing slash) or the
service key is wrong. Re-run `wrangler secret put` and redeploy.

**App shows different questions than the table**
It's using the cached set or the offline fallback. Clear app storage; confirm
the `public read` RLS policy exists (without it the app gets an empty result).

**Cron isn't firing**
Confirm the trigger in the dashboard, and that you ran `wrangler deploy` *after*
adding `[triggers]`. Cloudflare may run it a few minutes late — that's normal.

**Want to hand-write a specific day**

```sql
insert into daily_quiz (date, questions, provider)
values ('2026-08-05', '[ ...10 question objects... ]'::jsonb, 'manual')
on conflict (date) do update set questions = excluded.questions;
```

---

## 11. Quality control (recommended first week)

The validator checks **structure, not truth** — an LLM can state a fitness fact
confidently and be wrong. Review the generated sets for the first several days:

```sql
select jsonb_pretty(questions) from daily_quiz order by date desc limit 1;
```

Anything wrong can be corrected by editing the row directly (see §10) — no app
release needed.
