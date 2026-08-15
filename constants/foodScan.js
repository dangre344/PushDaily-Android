// ─── Packaged-food label analysis ────────────────────────────────────────────
// Verdicts are computed by FIXED RULES, never by the AI. The AI only ever turns
// messy label text into structured numbers; everything below is deterministic,
// so the same product always produces the same answer and we can show the
// arithmetic behind it.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { callBackend } from "./api";
import { Logger } from "./Logger";

// ── UK FSA front-of-pack thresholds, grams per 100g ─────────────────────────
// Published, free to use, and maps cleanly onto our three states.
const THRESHOLDS = {
  sugars_g: { low: 5, high: 22.5, label: "Sugar" },
  fat_g: { low: 3, high: 17.5, label: "Fat" },
  saturates_g: { low: 1.5, high: 5, label: "Saturates" },
  salt_g: { low: 0.3, high: 1.5, label: "Salt" },
};

export const VERDICT = {
  HEALTHY: "healthy",
  SOMETIMES: "sometimes",
  AVOID: "avoid",
};

export const VERDICT_META = {
  [VERDICT.HEALTHY]: {
    emoji: "✅",
    title: "Healthy",
    blurb: "Good to eat regularly.",
    color: "#16A34A",
    bg: "#F0FDF4",
  },
  [VERDICT.SOMETIMES]: {
    emoji: "⚠️",
    title: "Can eat sometimes",
    blurb: "Fine occasionally — not every day.",
    color: "#B45309",
    bg: "#FFFBEB",
  },
  [VERDICT.AVOID]: {
    emoji: "❌",
    title: "Unhealthy",
    blurb: "High in something you want to limit.",
    color: "#DC2626",
    bg: "#FEF2F2",
  },
};

// ── Allergens (FSSAI declared list, aligned with the EU 14) ─────────────────
// Matched against the ingredient text as well as any "Contains:" line, since
// most labels bury allergens inside the ingredients.
const ALLERGENS = {
  Milk: /\b(milk|whey|casein|caseinate|lactose|butter|ghee|paneer|cream|curd|khoya|malai)\b/i,
  Gluten:
    /\b(wheat|atta|maida|barley|rye|malt|semolina|suji|rava|oats?|spelt|durum|seitan)\b/i,
  Soy: /\b(soy|soya|soybean|soja|tvp|textured vegetable protein|e322|soy lecithin)\b/i,
  Peanut: /\b(peanut|groundnut|arachis|moongphali)\b/i,
  "Tree nuts":
    /\b(almond|badam|cashew|kaju|pistachio|pista|walnut|akhrot|hazelnut|pecan|macadamia|brazil nut)\b/i,
  Egg: /\b(egg|albumen|albumin|ovalbumin|lysozyme)\b/i,
  Fish: /\b(fish|anchovy|cod|tuna|salmon|sardine|surimi)\b/i,
  Crustaceans: /\b(prawn|shrimp|crab|lobster|crustacean)\b/i,
  Sesame: /\b(sesame|til\b|tahini|gingelly)\b/i,
  Sulphites: /\b(sulphite|sulfite|e22[1-8]|sulphur dioxide|sulfur dioxide)\b/i,
  Mustard: /\b(mustard|sarson|rai\b)\b/i,
};

// ── "Not suitable for" rules ───────────────────────────────────────────────
// Phrased as observations, never as instructions — see the note in the UI.
const NON_VEG = /\b(gelatin|gelatine|rennet|carmine|e120|cochineal|shellac|e904|lard|tallow|l-cysteine|anchovy|fish)\b/i;
const NON_VEGAN = /\b(milk|whey|casein|lactose|butter|ghee|honey|egg|albumen)\b/i;
const PHOSPHATES = /\b(e33[89]|e34[01]|e45[012]|phosphate)\b/i;
const ASPARTAME = /\b(aspartame|e951|phenylalanine)\b/i;

/** Normalises whatever basis the label used to a strict per-100g view. */
export const toPer100g = (nutrition = {}, basis, servingG) => {
  if (basis !== "per_serving" || !servingG || servingG <= 0) return nutrition;
  // Brands shrink the "serving" so numbers look small — rescaling is what
  // stops every verdict being wrong in the manufacturer's favour.
  const k = 100 / servingG;
  const out = {};
  for (const [key, val] of Object.entries(nutrition)) {
    out[key] = typeof val === "number" ? Math.round(val * k * 10) / 10 : val;
  }
  return out;
};

/** Per-nutrient traffic lights, worst-first. */
export const rateNutrients = (per100g = {}) => {
  const rows = [];
  for (const [key, t] of Object.entries(THRESHOLDS)) {
    const v = per100g[key];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    const level = v > t.high ? "high" : v > t.low ? "medium" : "low";
    rows.push({
      key,
      label: t.label,
      value: v,
      level,
      emoji: level === "high" ? "🔴" : level === "medium" ? "🟡" : "🟢",
    });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return rows.sort((a, b) => order[a.level] - order[b.level]);
};

/** Worst nutrient decides the verdict. */
export const verdictFrom = (rows) => {
  if (!rows.length) return null; // not enough data to judge
  if (rows.some((r) => r.level === "high")) return VERDICT.AVOID;
  if (rows.some((r) => r.level === "medium")) return VERDICT.SOMETIMES;
  return VERDICT.HEALTHY;
};

/**
 * Allergens we can SEE declared. Never proof of absence — OCR misses lines,
 * so the UI must always say "check the pack" alongside this.
 */
export const findAllergens = (ingredientsText = "", declared = []) => {
  const hay = String(ingredientsText || "");
  const found = new Set(
    declared.map((d) => String(d).trim()).filter(Boolean),
  );
  for (const [name, re] of Object.entries(ALLERGENS)) {
    if (re.test(hay)) found.add(name);
  }
  return [...found];
};

/** Who might want to steer clear, derived from the same parsed data. */
export const notSuitableFor = (per100g = {}, ingredientsText = "", allergens = []) => {
  const hay = String(ingredientsText || "");
  const out = [];

  if (per100g.sugars_g > 22.5)
    out.push({ who: "Diabetes", why: "Very high in sugar", emoji: "🩸" });
  if (per100g.salt_g > 1.5)
    out.push({ who: "High blood pressure", why: "Very high in salt", emoji: "❤️" });
  if (allergens.includes("Gluten"))
    out.push({ who: "Coeliac disease", why: "Contains gluten", emoji: "🌾" });
  if (allergens.includes("Milk"))
    out.push({ who: "Lactose intolerance", why: "Contains milk", emoji: "🥛" });
  if (NON_VEG.test(hay))
    out.push({ who: "Vegetarians", why: "Animal-derived ingredient", emoji: "🥗" });
  else if (NON_VEGAN.test(hay))
    out.push({ who: "Vegans", why: "Contains dairy, egg or honey", emoji: "🌱" });
  if (PHOSPHATES.test(hay))
    out.push({ who: "Kidney conditions", why: "Added phosphates", emoji: "🫘" });
  if (ASPARTAME.test(hay))
    out.push({ who: "PKU", why: "Contains a source of phenylalanine", emoji: "⚠️" });

  return out;
};

// ── Open Food Facts (free, no key, no quota) ───────────────────────────────
const OFF_URL = (barcode) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=product_name,brands,nutriments,ingredients_text,allergens_tags,image_front_small_url`;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;
};

/** Looks a barcode up. Returns null when unknown — caller falls back to photo. */
export const lookupBarcode = async (barcode, timeoutMs = 8000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(OFF_URL(barcode), {
      headers: { "User-Agent": "PushDaily/1.0 (android)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return null;

    const p = data.product;
    const n = p.nutriments || {};
    // OFF already normalises to 100g, so no rescaling needed here.
    return {
      source: "barcode",
      name: [p.brands, p.product_name].filter(Boolean).join(" ").trim(),
      image: p.image_front_small_url || null,
      basis: "per_100g",
      nutrition: {
        energy_kcal: num(n["energy-kcal_100g"]),
        sugars_g: num(n.sugars_100g),
        fat_g: num(n.fat_100g),
        saturates_g: num(n["saturated-fat_100g"]),
        salt_g: num(n.salt_100g),
        fibre_g: num(n.fiber_100g),
        protein_g: num(n.proteins_100g),
      },
      ingredients_text: p.ingredients_text || "",
      declared_allergens: (p.allergens_tags || []).map((t) =>
        t.replace(/^en:/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      ),
    };
  } catch (e) {
    Logger.log("[FoodScan] barcode lookup failed:", String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Photo fallback. Returns the product on success, or `{ reason }` so the screen
 * can tell the user what to actually change instead of a generic "try again".
 */
export const analyzePhoto = async (base64) => {
  const t0 = Date.now();
  const res = await callBackend("analyze-label", { image: base64 }, 52000);
  const ms = Date.now() - t0;

  // callBackend returns null for ANY transport/HTTP failure — including a
  // non-200 from the Worker, so a stale deployment lands here too.
  if (!res) {
    Logger.log(
      `[FoodScan] worker gave no JSON after ${ms}ms — offline, timeout, ` +
        "or the Worker returned a non-200 (is analyze-label deployed?)",
    );
    return { reason: "offline" };
  }

  Logger.log(`[FoodScan] worker responded in ${ms}ms`, {
    keys: Object.keys(res),
    error: res.error || null,
    reason: res.reason || null,
    hasProduct: !!res.product,
  });

  if (res.error) {
    return { reason: res.error === "bad_image" ? "unreadable" : "server" };
  }
  if (!res.product) return { reason: res.reason || "unreadable" };

  return { source: "photo", ...res.product };
};

/**
 * Turns either source into the finished, renderable result.
 * Everything here is deterministic — no AI involved.
 */
export const buildResult = (product) => {
  if (!product) return null;

  const per100g = toPer100g(
    product.nutrition || {},
    product.basis,
    product.serving_size_g,
  );
  const rows = rateNutrients(per100g);
  const verdict = verdictFrom(rows);
  const allergens = findAllergens(
    `${product.ingredients_text || ""} ${(product.declared_allergens || []).join(" ")}`,
    product.declared_allergens || [],
  );

  return {
    source: product.source,
    name: product.name || "Unknown product",
    image: product.image || null,
    per100g,
    rows,
    verdict, // null when the label didn't give us enough to judge
    meta: verdict ? VERDICT_META[verdict] : null,
    allergens,
    notFor: notSuitableFor(per100g, product.ingredients_text || "", allergens),
    // True when the ingredient list looks truncated — the UI hides the
    // allergen section entirely rather than showing a partial one.
    lowConfidence:
      !product.ingredients_text || product.ingredients_text.length < 25,
  };
};

// ─── Daily free scan + first-run onboarding ─────────────────────────────────
// One scan a day is free; after that a rewarded ad unlocks another. Kept here
// so the screen stays presentational.

const K_USES = "food_scan_uses"; // { date, used }
const K_SEEN = "food_scan_onboarded";

const dayKey = () => new Date().toISOString().slice(0, 10);

const readUses = async () => {
  try {
    const raw = await AsyncStorage.getItem(K_USES);
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.date !== dayKey()) return { date: dayKey(), used: 0 };
    return u;
  } catch {
    return { date: dayKey(), used: 0 };
  }
};

/** True while today's free scan is still available. */
export const isScanFree = async () => (await readUses()).used === 0;

export const markScanUsed = async () => {
  const u = await readUses();
  u.used += 1;
  AsyncStorage.setItem(K_USES, JSON.stringify(u)).catch(() => {});
};

/** First run shows the "how it works" screen once. */
export const hasSeenScanIntro = async () => {
  try {
    return (await AsyncStorage.getItem(K_SEEN)) === "true";
  } catch {
    return false;
  }
};

export const markScanIntroSeen = () =>
  AsyncStorage.setItem(K_SEEN, "true").catch(() => {});
