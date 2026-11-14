// SPDX-License-Identifier: Apache-2.0
//
// The 3D model: every node the page uses is in model/trs80-model-i.glb, its keys agree
// with the machine's own matrix (js/sim/keymap.js), the chips the page lights are the
// memory map's, the take-apart order is sound, and the model keeps to its budgets.
// Acceptance area MOD (design/v0.0.1.md, §6). After `pnpm build:model`, these say whether
// the rebuilt model still fits the page.

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { Assembly } from "../js/sim/assembly.js";
import { KEYS } from "../js/sim/keymap.js";
import { REGIONS } from "../js/sim/machine.js";
import { nodesByName, readGlb, triangles } from "./glb.js";

const GLB = new URL("../model/trs80-model-i.glb", import.meta.url);
const glb = readGlb(GLB);
const nodes = nodesByName(glb);
/** @type {{ keys: { node: string, name: string, keypad: boolean, matrix_row: number, matrix_bit: number }[] }} */
const KEYBOARD = JSON.parse(readFileSync(new URL("../model/params/keyboard.json", import.meta.url), "utf8"));
const MACHINE = JSON.parse(readFileSync(new URL("../model/params/machine.json", import.meta.url), "utf8"));

/** The nodes the page reaches by name (js/scene/). */
export const CONTRACT = [
  "trs80",
  "unit.keyboard", "unit.display", "unit.recorder", "unit.psu",
  "case.top", "case.bottom", "keyboard", "board.main", "cable.video", "cable.tape", "cable.power",
  "button.power", "button.reset", "led.power",
  "display.screen", "display.power_button", "display.control.contrast", "display.control.brightness",
  "recorder.door", "recorder.cassette", "recorder.reel.left", "recorder.reel.right",
  ...["play", "record", "rewind", "fastf", "stop", "eject"].map((k) => `recorder.key.${k}`),
  "part.z40", "part.z29",
];

describe("MOD: the model", () => {
  it("MOD-1: every node the page uses is there", () => {
    const missing = CONTRACT.filter((n) => !nodes.has(n));
    assert.deepEqual(missing, []);
  });

  it("MOD-2: the model's keys are the matrix's: every key in keymap.js has a cap, at its row and bit", () => {
    for (const k of KEYS) {
      const caps = KEYBOARD.keys.filter((c) => !c.keypad && (c.name === k.name || (k.name === "SHIFT" && /SHIFT$/.test(c.name))));
      assert.ok(caps.length >= 1, `${k.name} has a cap`);
      for (const c of caps) {
        assert.deepEqual([c.matrix_row, c.matrix_bit], [k.row, k.bit], c.node);
        const n = nodes.get(c.node);
        assert.ok(n, `${c.node} is in the .glb`);
        assert.deepEqual([n.node.extras?.matrix_row, n.node.extras?.matrix_bit], [k.row, k.bit], `${c.node} in the .glb`);
      }
    }
  });

  it("MOD-3: the 12 keypad keys close the same switches as 0-9, the period and ENTER [rs-info keyboard]", () => {
    const pad = KEYBOARD.keys.filter((c) => c.keypad);
    assert.equal(pad.length, 12);
    for (const c of pad) {
      const main = KEYS.find((k) => k.name === c.name);
      assert.ok(main, c.name);
      assert.deepEqual([c.matrix_row, c.matrix_bit], [main.row, main.bit], c.node);
    }
  });

  it("MOD-4: every chip the memory map names is a part on the board", () => {
    for (const r of REGIONS) for (const chip of r.chips) assert.ok(nodes.has(`part.${chip}`), `part.${chip} (${r.id})`);
  });

  it("MOD-5: every take-apart unit is a node with a path out, and the order is sound", () => {
    /** @type {{ unit: string, requires: string[] }[]} */
    const order = MACHINE.take_apart.order;
    /** @type {Set<string>} */
    const seen = new Set();
    for (const s of order) {
      for (const r of s.requires) assert.ok(seen.has(r), `${s.unit} requires ${r}, which comes later`);
      seen.add(s.unit);
      const ids = s.unit === "cables" ? ["cable.video", "cable.tape", "cable.power"] : [s.unit];
      for (const id of ids) assert.equal(nodes.get(id)?.node.extras?.motion, "path", `${id} moves along a path`);
    }
    const a = new Assembly(order);
    assert.deepEqual(a.planOut("board.main"), ["cables", "case.top", "keyboard", "board.main"]);
    for (const u of a.planOut("board.main")) a.set(u, 1);
    assert.deepEqual(a.planIn("cables"), ["board.main", "keyboard", "case.top", "cables"]);
    assert.deepEqual(a.planIn("keyboard"), ["board.main", "keyboard"]);
    assert.deepEqual(a.planAllIn(), ["board.main", "keyboard", "case.top", "cables"]);
    assert.ok(a.anyOut());
  });

  it("MOD-6: the screen node carries its picture's rectangle; the moving parts their motion", () => {
    const scr = nodes.get("display.screen")?.node.extras;
    assert.equal(scr?.motion, "screen");
    assert.equal(/** @type {number[]} */ (scr?.picture).length, 4);
    for (const n of ["recorder.door", "recorder.reel.left", "recorder.reel.right"]) assert.equal(nodes.get(n)?.node.extras?.motion, "rotate", n);
    for (const n of ["button.power", "display.power_button", "recorder.key.play"]) assert.equal(nodes.get(n)?.node.extras?.motion, "translate", n);
  });

  it("MOD-7: within its budgets: under 5 MB (plain git, D9) and 100,000 triangles", () => {
    assert.ok(statSync(GLB).size < 5e6, `${statSync(GLB).size} bytes`);
    assert.ok(triangles(glb) < 100_000, `${triangles(glb)} triangles`);
  });
});
