// SPDX-License-Identifier: Apache-2.0
//
// The page's languages (docs/ui-design.md, U11): the Altair 8800 simulator's ten, each named
// as it names itself, since a visitor who needs another language cannot be expected to
// recognise its name in the one on the screen. Which one a visit uses: the address's ?lang=,
// else the one chosen before, else the first of the browser's languages that is here, else
// English. Pure logic, no DOM.

/** @typedef {"en" | "es" | "fr" | "de" | "it" | "pt-BR" | "zh" | "zh-TW" | "ja" | "ko"} Locale */

/** @type {readonly Locale[]} */
export const LOCALES = ["en", "es", "fr", "de", "it", "pt-BR", "zh", "zh-TW", "ja", "ko"];

/** What each language calls itself, for the menu. @type {Record<Locale, string>} */
export const LOCALE_NAMES = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "pt-BR": "Português (Brasil)",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
};

/** What the language button shows: short, beside an icon that already says "language". @type {Record<Locale, string>} */
export const LOCALE_SHORT = { en: "EN", es: "ES", fr: "FR", de: "DE", it: "IT", "pt-BR": "PT", zh: "简", "zh-TW": "繁", ja: "日", ko: "한" };

/** Where the visitor's choice is remembered. */
export const LOCALE_STORE = "trs80.lang";

/**
 * The locale a language tag stands for here, or null: an exact match first ("pt-BR"), then
 * Chinese by script or region (zh-Hant, zh-TW, zh-HK, zh-MO are traditional), then the base
 * language ("fr-CA" is French, "pt-PT" is Portuguese, as Brazil's).
 * @param {string | null | undefined} tag
 * @returns {Locale | null}
 */
export function matchLocale(tag) {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  const exact = LOCALES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;
  const [base, ...rest] = lower.split(/[-_]/);
  if (base === "zh") return rest.some((p) => ["hant", "tw", "hk", "mo"].includes(p)) ? "zh-TW" : "zh";
  if (base === "pt") return "pt-BR";
  return LOCALES.find((l) => l === base) ?? null;
}

/**
 * The locale for this visit.
 * @param {{ query?: string | null, saved?: string | null, browser?: readonly string[] }} from
 * @returns {Locale}
 */
export function pickLocale(from) {
  for (const tag of [from.query, from.saved, ...(from.browser ?? [])]) {
    const l = matchLocale(tag);
    if (l) return l;
  }
  return "en";
}
