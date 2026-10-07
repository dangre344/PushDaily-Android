import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";

import { Logger } from "./Logger";
import {
  identifyUser,
  registerSuperPropertiesOnce,
  setUserPropertiesOnce,
  trackEvent,
} from "./mixpanel";
import { getSession } from "./SessionManager";

// ─── Install attribution ─────────────────────────────────────────────────────
// Where did this install come from? Answered once, kept forever.
//
// HOW IT WORKS
//   1. A marketing link carries UTM tags inside Play's `referrer` parameter:
//        play.google.com/store/apps/details?id=…&referrer=utm_source%3Dinstagram…
//   2. Play hands that string to the app through the Install Referrer API.
//   3. On the first launch we read it, parse it and store it on the device.
//   4. Every Mixpanel event from then on carries utm_source as a super
//      property, and signup copies it onto the user's profile.
//
// THE ONE HARD LIMIT
//   Google keeps the referrer for 90 days after install. Someone who installs
//   from Instagram and first opens the app on day 91 is unattributable — no
//   client code can recover it. Opening on day 89 and signing up a year later
//   is fine: once read, it is stored here permanently.
//
// Reinstalling the app clears both this storage and Play's referrer, so a
// reinstall from a different link is correctly attributed to the new link.

const STORAGE_KEY = "install_attribution_v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

// The referrer service is occasionally unavailable right after install (Play
// still updating, no connection). Retrying across launches recovers those
// instead of writing them off as "unknown" on the first hiccup.
const MAX_ATTEMPTS = 3;

let memo = null;

/**
 * "utm_source=instagram&utm_medium=bio" → { utm_source: "instagram", ... }
 *
 * Hand-rolled rather than URLSearchParams: React Native's polyfill is partial,
 * and Play has been seen returning values with stray encoding.
 */
export const parseReferrer = (raw) => {
  const out = {};
  if (!raw || typeof raw !== "string") return out;

  // A link built with the referrer still percent-encoded arrives as
  // "utm_source%3Dinstagram%26…" — no "=" to split on, so every field would be
  // lost. Decode one level first when that is clearly what happened.
  if (!raw.includes("=") && /%3D/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return out;
    }
  }

  for (const pair of raw.split("&")) {
    const i = pair.indexOf("=");
    if (i <= 0) continue;
    let key;
    let value;
    try {
      key = decodeURIComponent(pair.slice(0, i)).trim().toLowerCase();
      value = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " ")).trim();
    } catch {
      continue; // malformed escape — skip the pair, keep the rest
    }
    if (UTM_KEYS.includes(key) && value) {
      // Lowercase so "Instagram" and "instagram" are one segment in Mixpanel.
      out[key] = value.toLowerCase().slice(0, 100);
    }
    if (key === "gclid" && value) out.gclid = true;
  }

  // Google Ads installs carry a click id but often no utm_source.
  if (!out.utm_source && out.gclid) {
    out.utm_source = "google-ads";
    out.utm_medium = out.utm_medium || "cpc";
  }
  delete out.gclid;
  return out;
};

const read = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = async (value) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (e) {
    Logger.log("[Attribution] save failed:", String(e));
  }
};

const isKnown = (a) => !!a?.utm_source && a.utm_source !== "unknown";

/**
 * Writes first-touch attribution onto the user's Mixpanel profile, set-once.
 *
 * Never writes "unknown". Set-once means the first value sticks forever, so
 * recording "unknown" when the referrer simply hadn't resolved yet would block
 * the real "instagram" from ever landing. Instead this runs again whenever a
 * real source resolves — at signup if it is ready, or on the later launch that
 * resolves it.
 */
const applyToProfile = async (a, userId) => {
  if (!isKnown(a) || !userId) return;
  // identify first: on launch this can race UserContext's own identify, and a
  // profile update sent before it lands on the anonymous id instead.
  await identifyUser(userId);
  await setUserPropertiesOnce({
    ...utmProps(a),
    initial_utm_source: a.utm_source,
    initial_utm_medium: a.utm_medium || "",
    initial_utm_campaign: a.utm_campaign || "",
  });
};

/** Called by signup once the Mixpanel user exists. */
export const applyInstallAttributionToProfile = async (userId) => {
  if (!memo) memo = await read();
  if (memo?.resolved) await applyToProfile(memo, userId);
};

/** Just the UTM fields, ready to spread into an event or profile. */
const utmProps = (a) => {
  const props = {};
  for (const k of UTM_KEYS) if (a?.[k]) props[k] = a[k];
  // Always present, so dashboards can segment "unknown" instead of dropping it.
  props.utm_source = props.utm_source || "unknown";
  return props;
};

/**
 * Resolves this install's attribution. Safe to call on every launch: after the
 * first success it only re-applies the stored values.
 */
export const captureInstallAttribution = async () => {
  try {
    const stored = await read();

    // Already resolved — just make sure the super properties are set. They can
    // be wiped by a Mixpanel reset, and registerSuperPropertiesOnce never
    // overwrites, so re-applying is harmless.
    if (stored?.resolved) {
      memo = stored;
      await registerSuperPropertiesOnce(utmProps(stored));
      return stored;
    }

    const attempts = (stored?.attempts || 0) + 1;
    let raw = "";
    let status = "unsupported";

    if (Platform.OS === "android") {
      try {
        raw = (await Application.getInstallReferrerAsync()) || "";
        status = raw ? "ok" : "empty";
      } catch (e) {
        // Dev builds installed over adb, and phones without Play, land here.
        status = "unavailable";
        Logger.log("[Attribution] referrer unavailable:", String(e));
      }

      // Transient failure — try again next launch rather than giving up.
      if (status === "unavailable" && attempts < MAX_ATTEMPTS) {
        await write({ resolved: false, attempts });
        return null;
      }
    }

    const parsed = parseReferrer(raw);
    const session = await getSession();

    const result = {
      resolved: true,
      ...parsed,
      referrer_status: status,
      install_referrer: raw.slice(0, 200),
      captured_at: new Date().toISOString(),
      attempts,
    };
    await write(result);
    memo = result;

    await registerSuperPropertiesOnce(utmProps(result));

    // Already signed up (signed up before this resolved, or an existing user
    // opening the update) — the profile has no source yet, so give it one.
    if (session?._id) await applyToProfile(result, session._id);

    // First-touch event. `had_account` separates real new installs from
    // existing users who are simply opening the update that added this —
    // filter it to false when counting installs.
    await trackEvent("App First Open", {
      ...utmProps(result),
      referrer_status: status,
      install_referrer: result.install_referrer,
      had_account: !!session,
    });

    Logger.log("[Attribution] resolved:", JSON.stringify(utmProps(result)));
    return result;
  } catch (e) {
    Logger.log("[Attribution] capture failed:", String(e));
    return null;
  }
};

/**
 * UTM fields for this install — for signup and anything else that wants them.
 * Always returns an object with at least utm_source ("unknown" if unresolved).
 */
export const getInstallAttribution = async () => {
  if (!memo) memo = await read();
  return utmProps(memo?.resolved ? memo : null);
};
