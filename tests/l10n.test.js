// SPDX-License-Identifier: Apache-2.0
//
// Every text is a message (docs/conventions.md, "Text"): every key the code names is in
// js/l10n/en.js, and every message there is used. Keys are found as string literals passed
// to t() or set as data-l10n in the page; keys built at run time (`view.${v}`) are listed
// with their families below.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import en from "../js/l10n/en.js";
import { LOCALES, matchLocale, pickLocale } from "../js/l10n/locales.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @param {string} dir @returns {string[]} */
const walk = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`${dir}/${e.name}`] : []));

/** The keys built at run time, by the prefix the code builds them from. */
const FAMILIES = [/^lesson\./, /^view\.[a-z]+$/, /^stage\.(2d|3d)\.tip$/, /^deck\.key\./, /^sample\./, /^part\./, /^unit\./, /^role\./, /^region\./, /^flag\./, /^cpu\.follow\./, /^(flat|display)\.(contrast|brightness)$/, /^deck\.(record|play|rewind|fastf|stop|eject)$/];

describe("APP: every text is a message", () => {
  const code = [...walk("js"), "index.html"].filter((f) => !f.startsWith("js/l10n/")).map((f) => readFileSync(join(ROOT, f), "utf8")).join("\n");
  const used = new Set([...code.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g), ...code.matchAll(/data-l10n(?:-tip)?="([^"]+)"/g), ...code.matchAll(/\bkey: "([a-zA-Z0-9_.]+)"/g), ...code.matchAll(/\bkey: [a-zA-Z.]+ \? "([a-zA-Z0-9_.]+)" : "([a-zA-Z0-9_.]+)"/g)].flatMap((m) => m.slice(1).filter(Boolean)));

  it("APP-40: every key the code names has a message", () => {
    const missing = [...used].filter((k) => !(k in en));
    assert.deepEqual(missing, []);
  });

  it("APP-41: every message is used, by name or by its family", () => {
    const unused = Object.keys(en).filter((k) => !used.has(k) && !FAMILIES.some((f) => f.test(k)) && !code.includes(`"${k}"`));
    assert.deepEqual(unused, []);
  });

  it("APP-42: placeholders are {name}s, and no message is empty", () => {
    for (const [k, v] of Object.entries(en)) {
      assert.ok(v.length > 0, k);
      assert.doesNotMatch(v, /\{\s|\{\}/, k);
    }
  });
});

/** The {name}s in a message, sorted. @param {string} m */
const holes = (m) => [...m.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();
/** The `code` in a message, in order: the machine's words, never translated. @param {string} m */
const code = (m) => [...m.matchAll(/`([^`]*)`/g)].map((x) => x[1]);

/** English, by any key. @type {Record<string, string>} */
const EN = en;

describe("APP: the page in ten languages (U11)", () => {
  it("APP-43: a language is picked from the address, then the visitor's choice, then the browser's, else English", () => {
    assert.equal(pickLocale({ query: "fr", saved: "de", browser: ["ja"] }), "fr");
    assert.equal(pickLocale({ query: null, saved: "de", browser: ["ja"] }), "de");
    assert.equal(pickLocale({ browser: ["sv-SE", "ja-JP"] }), "ja");
    assert.equal(pickLocale({ browser: ["sv-SE"] }), "en");
    assert.equal(matchLocale("zh-Hant-HK"), "zh-TW");
    assert.equal(matchLocale("zh-CN"), "zh");
    assert.equal(matchLocale("pt-PT"), "pt-BR");
    assert.equal(matchLocale("fr-CA"), "fr");
    assert.equal(matchLocale("xx"), null);
  });

  for (const loc of LOCALES.filter((l) => l !== "en")) {
    it(`APP-44 ${loc}: every message is translated, with the same placeholders and the same code`, async () => {
      /** @type {Record<string, string>} */
      const m = (await import(`../js/l10n/${loc}.js`)).default;
      assert.deepEqual(Object.keys(en).filter((k) => !(k in m)), [], "untranslated");
      assert.deepEqual(Object.keys(m).filter((k) => !(k in EN)), [], "keys English does not have");
      for (const [k, v] of Object.entries(m)) {
        assert.ok(typeof v === "string" && v.length > 0, `${k}: empty`);
        assert.deepEqual(holes(v), holes(EN[k]), `${k}: placeholders`);
        assert.deepEqual(code(v), code(EN[k]), `${k}: code`);
        assert.equal((v.match(/\*\*/g) ?? []).length % 2, 0, `${k}: unbalanced **`);
      }
    });
  }
});
