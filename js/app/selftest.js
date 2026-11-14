// SPDX-License-Identifier: Apache-2.0
//
// `?selftest` (docs/development.md): runs acceptance checks in the page itself and shows a
// tick or a cross for each; publishes window.__selftest = { done, passed, failed }. The Node
// tests cover the machine; these cover what only a browser has: the page's own parts.

import { el } from "../ui/components.js";

/** @param {import("../sim/system.js").System} system */
export async function selftest(system) {
  /** @type {[string, () => boolean | Promise<boolean>][]} */
  const checks = [
    ["APP-20: the stage, the dock and the status line are on the page", () => ["stage", "dock", "status"].every((id) => !!document.getElementById(id))],
    ["APP-21: the ROM is Level II v1.2", () => system.hasRom],
    ["APP-22: the computer boots to MEMORY SIZE?", async () => {
      system.power(true);
      system.clock.step(1.5);
      return system.machine.screenText()[0].startsWith("MEMORY SIZE?");
    }],
    ["APP-23: the 2D view has 65 keys and six recorder keys", () => document.querySelectorAll(".flat-key").length === 65 && document.querySelectorAll(".flat-deckkey").length === 6],
    ["APP-24: the dock has five tools", () => document.querySelectorAll("#dock-tabs [role=tab]").length === 5],
  ];
  /** @type {string[]} */
  const passed = [];
  /** @type {string[]} */
  const failed = [];
  const box = el("div", { class: "selftest" });
  document.body.append(box);
  for (const [name, run] of checks) {
    let ok = false;
    try {
      ok = !!(await run());
    } catch {
      ok = false;
    }
    (ok ? passed : failed).push(name);
    box.append(el("div", { class: ok ? "pass" : "fail", text: `${ok ? "✓" : "✗"} ${name}` }));
  }
  Object.assign(window, { __selftest: { done: true, passed, failed } });
}
