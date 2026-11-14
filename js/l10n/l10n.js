// SPDX-License-Identifier: Apache-2.0
//
// The page's words (docs/conventions.md, "Text"): every text a visitor sees is a message, by
// key, in js/l10n/en.js, and in each other language's file (js/l10n/<locale>.js, U11). A
// language's file may leave a message out, and English stands in. Pure logic, no DOM: the page
// and the tests share it. A message may hold {name} placeholders, filled from the params of
// t(). The machine's own voice (the screen, listings, key legends) is data, not a message (P5).

import en from "./en.js";

/** @typedef {Record<string, string>} Messages */
/** @typedef {import("./locales.js").Locale} Locale */

/** @type {Messages} */
let table = en;
/** The language in use. @type {Locale} */
let current = "en";

/**
 * Uses a language: its messages, over English's. Call before the page is built.
 * @param {Locale} locale
 */
export async function useLocale(locale) {
  current = locale;
  if (locale === "en") {
    table = en;
    return;
  }
  /** @type {{ default: Messages }} */
  const m = await import(`./${locale}.js`);
  table = { ...en, ...m.default };
}

/** The language in use. */
export const locale = () => current;

/**
 * Whether a key has a message.
 * @param {string} key
 * @returns {boolean}
 */
export const has = (key) => key in table;

/**
 * A message, with its placeholders filled. A key without a message comes back as itself, so a
 * missing text shows rather than breaks (and tests/l10n.test.js fails).
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const msg = table[key] ?? key;
  return msg.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}
