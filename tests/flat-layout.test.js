// SPDX-License-Identifier: Apache-2.0
//
// APP: the 2D view's geometry (js/flat/layout.js, docs/ui-design.md U10). The display's front
// puts readability first: a larger glass, everything round it trimmed, nothing overlapping.
// The drawings share one scale on the stage, and fit in it.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { displayLayout, fitFlat } from "../js/flat/layout.js";

const machine = JSON.parse(readFileSync(new URL("../model/params/machine.json", import.meta.url), "utf8"));
const d = machine.video_display;
const L = displayLayout(d);
/** @param {{ x0: number, x1: number, z0: number, z1: number }} a @param {{ x0: number, x1: number, z0: number, z1: number }} b */
const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.z0 >= b.z0 && a.z1 <= b.z1;
/** @param {{ x0: number, x1: number, z0: number, z1: number }} a @param {{ x0: number, x1: number, z0: number, z1: number }} b */
const apart = (a, b) => a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0;

test("APP-FLAT-1: the 2D glass is larger than the machine's, at the monitor's own width", () => {
  const measured = d.tube_face.x.v[1] - d.tube_face.x.v[0];
  assert.equal(L.W, d.width.v);
  assert.ok(L.face.x1 - L.face.x0 > measured * 1.2, `the glass is ${(L.face.x1 - L.face.x0).toFixed(0)} mm across, the machine's ${measured.toFixed(0)}`);
  // the glass keeps its measured shape
  const shape = measured / (d.tube_face.z.v[1] - d.tube_face.z.v[0]);
  assert.ok(Math.abs((L.face.x1 - L.face.x0) / (L.face.z1 - L.face.z0) - shape) < 1e-9);
});

test("APP-FLAT-2: the front's parts nest and do not overlap", () => {
  assert.ok(inside(L.face, L.opening), "the glass in its opening");
  assert.ok(inside(L.opening, L.brown), "the opening in the brown front");
  assert.ok(inside(L.panel, L.brown), "the right-hand panel in the brown front");
  assert.ok(inside(L.plate, L.panel), "the name plate on its panel");
  assert.ok(apart(L.opening, L.panel), "the opening clear of the panel");
  const button = { x0: L.button.x - L.ring.casing, x1: L.button.x + L.ring.casing, z0: L.button.z - L.ring.casing, z1: L.button.z + L.ring.casing };
  assert.ok(inside(button, L.brown) && apart(button, L.panel), "the POWER button above the panel");
  assert.ok(L.label.z + L.label.size / 2 < L.brown.z1, "the word Power on the brown");
  assert.ok(L.vents.z1 <= L.brown.z0 && L.vents.z0 >= 0, "the vents in the band under the brown");
  for (const [, z] of L.knobs) assert.ok(z + L.bushing[1] <= L.brown.z0 && L.letters.z + L.letters.size / 2 <= L.brown.z0, "C, B and V in the band");
  assert.ok(L.brown.z1 < L.H - L.base.h, "the brown under the case's top edge");
});

const display = { w: L.W, h: L.H };
const recorder = { w: 134, h: 240 };
const keyboard = { w: 380, h: 140 };
for (const [w, h] of [[1400, 330], [1400, 700], [900, 500], [380, 600]]) {
  test(`APP-FLAT-3: the drawings fit the stage, at one scale, at ${w} x ${h}`, () => {
    for (const rec of [null, recorder]) {
      for (const kbd of [null, keyboard]) {
        const o = fitFlat({ width: w, height: h, gap: 12, display, recorder: rec, keyboard: kbd });
        const s = o.display / display.w; // px per mm
        const across = o.display + (rec ? 12 + o.recorder : 0);
        const down = Math.max(display.h, rec ? rec.h : 0) * s + (kbd ? 12 + (o.keyboard * kbd.h) / kbd.w : 0);
        assert.ok(across <= w + 0.01 && down <= h + 0.01, `${across.toFixed(1)} x ${down.toFixed(1)}`);
        assert.ok(Math.abs(across - w) < 0.01 || Math.abs(down - h) < 0.01, "one side is filled");
        if (rec) assert.ok(Math.abs(o.recorder / recorder.w - s) < 1e-9, "the recorder at the display's scale");
        if (kbd) assert.ok(Math.abs(o.keyboard / keyboard.w - s) < 1e-9, "the keyboard at the display's scale");
      }
    }
  });
}

test("APP-FLAT-4: on an upright phone the keyboard takes the width, the display what is left", () => {
  const o = fitFlat({ width: 380, height: 600, gap: 8, display, recorder: null, keyboard, fullKeyboard: true });
  assert.equal(o.keyboard, 380);
  assert.ok((o.display / display.w) * display.h + 8 + (380 * keyboard.h) / keyboard.w <= 600 + 0.01);
});
