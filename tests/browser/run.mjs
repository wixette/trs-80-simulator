// SPDX-License-Identifier: Apache-2.0
//
// The browser checks: the page itself, in a headless Chrome, for what the Node tests cannot
// reach: clicks, keys, menus, dialogs, the 3D and 2D views, the layout at a phone's width.
//
//     pnpm test:browser              every check
//     pnpm test:browser boot tape    just these
//
// They take a few minutes and need Chrome (or CHROME set to its path), so they are run by
// hand before a release, not in CI; `pnpm test` is what CI runs (docs/development.md). Each
// check gets a fresh browser profile. After the Altair 8800 simulator's.

import { existsSync } from "node:fs";
import { findChrome, killAll, serve, start } from "./harness.mjs";

const CHECKS = ["boot", "focus", "programs", "tape", "views", "flat", "layout", "dock", "dialogs", "lang"];

const chrome = findChrome();
if (!chrome || !existsSync(chrome)) {
  console.error(`${chrome ? `Chrome is not at ${chrome}.` : "Chrome was not found."} Set CHROME to its path, e.g.\n  CHROME=/usr/bin/chromium pnpm test:browser`);
  process.exit(2);
}
for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM"])) {
  process.on(signal, () => {
    killAll();
    process.exit(130);
  });
}
const wanted = process.argv.slice(2);
const unknown = wanted.filter((n) => !CHECKS.includes(n));
if (unknown.length) {
  console.error(`No such check: ${unknown.join(", ")}. The checks are: ${CHECKS.join(", ")}`);
  process.exit(2);
}
const server = await serve();
let passed = 0;
let failed = 0;
for (const name of wanted.length ? wanted : CHECKS) {
  console.log(name);
  /** @type {{ default: (h: import("./harness.mjs").Harness) => Promise<void> }} */
  const module = await import(`./${name}.mjs`);
  /** @type {import("./harness.mjs").Harness | null} */
  let h = null;
  try {
    h = await start(chrome, server.url);
    await module.default(h);
  } catch (e) {
    if (!h) {
      console.log(`  FAIL the browser started  | ${e instanceof Error ? e.message : e}`);
      failed++;
      continue;
    }
    h.verify("ran to the end", false, e instanceof Error ? e.stack : String(e));
  } finally {
    await h?.stop();
  }
  if (!h) continue;
  if (h.errors.length) h.verify("no errors in the page", false, h.errors);
  passed += h.results.filter((r) => r.ok).length;
  failed += h.results.filter((r) => !r.ok).length;
}
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
