// SPDX-License-Identifier: Apache-2.0
//
// APP: a view's framing (js/scene/framing.js, docs/ui-design.md U2). The subject fills its
// share of the limiting side of the free area, centred, on any shape of stage.

import assert from "node:assert/strict";
import { test } from "node:test";
import { corners, frame, silhouette } from "../js/scene/framing.js";

const FOV = 35;
/** A desk-sized box, 0.9 m wide, 0.3 m tall, 0.5 m deep. */
const points = corners([{ min: [-0.45, 0, -0.25], max: [0.45, 0.3, 0.25] }]);
const gap = { top: 8, right: 8, bottom: 8, left: 8 };

for (const [w, h] of [[1600, 600], [800, 800], [390, 300], [1200, 300]]) {
  test(`APP-FRAME: the subject fills 90 % of the limiting side, centred, at ${w} x ${h}`, () => {
    const cam = frame(points, [-0.6, 0.5, 1], FOV, w, h, gap);
    const s = silhouette(points, cam, FOV, w, h);
    const fillX = (s.right - s.left) / (w - 16);
    const fillY = (s.bottom - s.top) / (h - 16);
    assert.ok(Math.abs(Math.max(fillX, fillY) - 0.9) < 1e-3, `fills ${fillX.toFixed(3)} x ${fillY.toFixed(3)}`);
    assert.ok(Math.abs((s.left + s.right) / 2 - w / 2) < 0.5);
    assert.ok(Math.abs((s.top + s.bottom) / 2 - h / 2) < 0.5);
  });
}

test("APP-FRAME: insets move the subject into the free area", () => {
  const cam = frame(points, [0, 0.4, 1], FOV, 1000, 600, { top: 100, right: 8, bottom: 8, left: 8 });
  const s = silhouette(points, cam, FOV, 1000, 600);
  assert.ok(s.top >= 100 - 0.5);
  assert.ok(Math.abs((s.top + s.bottom) / 2 - (100 + 592) / 2) < 0.5);
});
