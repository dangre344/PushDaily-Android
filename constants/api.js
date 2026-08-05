import { Logger } from "./Logger";

// ─── Backend client ───────────────────────────────────────────────────────────
// The app never talks to Supabase (or any LLM) directly — every request goes
// through our Cloudflare Worker, which holds the real keys server-side. The
// only value shipped in the app is a shared token, which just raises the bar
// against casual abuse of the public endpoint.
// Literal fallbacks so RELEASE builds still work when .env isn't bundled
// (it's gitignored, so EAS builds don't upload it). Neither value is a secret:
// the URL is public and the token only deters casual abuse.
export const WORKER_URL =
  process.env.EXPO_PUBLIC_TRAINER_WORKER_URL ||
  "https://push-daily-trainer.pushdaily.workers.dev";
export const APP_TOKEN =
  process.env.EXPO_PUBLIC_TRAINER_APP_TOKEN || "pushdaily-7h3k9x2";

export const isBackendConfigured = () => !!WORKER_URL;

/**
 * POSTs `{ mode, ...payload }` to the Worker.
 * Returns the parsed JSON, or null on any failure (callers fall back locally).
 */
export const callBackend = async (mode, payload = {}, timeoutMs = 12000) => {
  if (!WORKER_URL) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": APP_TOKEN,
      },
      body: JSON.stringify({ mode, ...payload }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      Logger.log(`[API] ${mode} failed:`, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    Logger.log(`[API] ${mode} error:`, String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
};
