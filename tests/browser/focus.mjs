// SPDX-License-Identifier: Apache-2.0
//
// The visitor's keys go to BASIC after a click on the 3D view: a click never focuses the view
// (only Tab does), so Shift, + and the arrows are typed, not taken by the camera.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.desk() !== null", 30000);
  await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000);
  await h.key("Enter");
  await h.until("trs80.machine.screenText().some((l) => l === 'READY')", 20000);
  // a click on an empty part of the 3D view
  const r = await h.js("(() => { const b = app.viewer.canvas.getBoundingClientRect(); return { x: b.x + 30, y: b.y + 30 }; })()");
  await h.clickAt(r.x, r.y);
  h.verify("a click leaves the 3D view unfocused", !(await h.js("document.activeElement === app.viewer.canvas")));
  await h.typeHost("PRINT 2+3\n");
  h.verify("then + is typed to BASIC: PRINT 2+3 prints 5", await h.until("trs80.machine.screenText().some((l) => l === ' 5')", 15000), await h.screen());
  // Tab reaches the 3D view, with its ring
  await h.js("document.body.focus()");
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await h.key("Tab");
    reached = await h.js("document.activeElement === app.viewer.canvas");
  }
  h.verify("Tab reaches the 3D view", reached);
}
