// SPDX-License-Identifier: Apache-2.0
//
// The 3D views (U2, U3): each in the Views menu flies there; Inside, from below turns the case
// to glass and leaving it makes it solid; Taken apart is greyed while the computer runs, and
// refused, then takes it apart once off; another view puts it back. C and B turn and a
// double-click puts them back to the middle.

const VIEWS = ["Whole system", "Three-quarter", "Keyboard", "Screen", "Recorder", "Inside, from below", "Taken apart"];

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  h.verify("the 3D model loads", await h.until("app.desk() !== null", 30000));
  await h.press("#band .menu-btn");
  const items = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Views lists the seven views", JSON.stringify(items?.map((/** @type {string} */ x) => x.replace(/switch off first$/, ""))) === JSON.stringify(VIEWS), items);
  h.verify("Taken apart is greyed while the computer is on, saying why", /switch off first$/.test(items?.[6] ?? ""));
  await h.key("Escape");
  h.verify("there is no Show menu", !(await h.js("document.querySelector('.show-btn')")));

  for (const v of VIEWS.slice(0, 5)) {
    await h.choose("#band .menu-btn", v);
    await h.until("!app.viewer.isFlying()", 5000);
    h.verify(`${v}: the band names it`, (await h.js("document.querySelector('#band .menu-btn').textContent")) === v);
  }
  await h.choose("#band .menu-btn", "Inside, from below");
  h.verify("Inside, from below turns the case to glass", (await h.js("app.stage.glass")) === true);
  await h.choose("#band .menu-btn", "Taken apart");
  h.verify("Taken apart, chosen while on, is refused, and says why", (await h.js("app.stage.view")) === "inside" && /Switch the computer off first/.test(await h.status()));
  await h.choose("#band .menu-btn", "Whole system");
  h.verify("leaving Inside makes the case solid", (await h.js("app.stage.glass")) === false);

  await h.pressText("#helper-strip button", "Computer");
  await h.choose("#band .menu-btn", "Taken apart");
  h.verify("off, Taken apart takes the computer apart", await h.until("[...trs80.motion.values()].every((m) => m.f === 1)", 15000));
  h.verify("Put it all back shows while anything is out", !(await h.js("document.querySelector('.put-back').hidden")));
  await h.pressText("#helper-strip button", "Computer");
  const said = await h.status();
  h.verify("POWER is refused while it is apart, naming the part for the visitor", !(await h.js("trs80.machine.powered")) && /Put the machine back together/.test(said) && !/board\.main|case\.top/.test(said), said);
  await h.press(".put-back");
  h.verify("Put it all back: the machine is whole, and the view is the whole system again", (await h.until("trs80.whole", 10000)) && (await h.js("document.querySelector('#band .menu-btn').textContent")) === "Whole system");
  await h.choose("#band .menu-btn", "Taken apart");
  await h.until("[...trs80.motion.values()].every((m) => m.f === 1)", 15000);
  await h.choose("#band .menu-btn", "Inside, from below");
  h.verify("another view puts it back together", await h.until("trs80.whole && [...trs80.motion.values()].every((m) => m.f === 0)", 10000));

  // C and B: the wheel turns C; a double-click puts it back to the middle
  await h.js("trs80.setControl('contrast', 0.9)");
  // the Whole system view: the Screen view frames the glass, and leaves the knobs under it out
  await h.choose("#band .menu-btn", "Whole system");
  await h.until("!app.viewer.isFlying()", 5000);
  const c = await h.js(`(() => { const k = app.desk().knobs.contrast; const p = k.getWorldPosition(k.position.clone()).project(app.viewer.camera);
    const r = app.viewer.canvas.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; })()`);
  await h.clickAt(c.x, c.y, 2);
  h.verify("a double-click on C puts it back to the middle", (await h.js("trs80.display.contrast")) === 0.5);

  // SHIFT clicked with the computer off latches; it never takes the keyboard out
  if (await h.js("trs80.machine.powered")) await h.pressText("#helper-strip button", "Computer");
  await h.choose("#band .menu-btn", "Keyboard");
  await h.until("!app.viewer.isFlying()", 5000);
  const shift = await h.js(`(() => { let k = null; app.viewer.scene.traverse((o) => { if (o.userData.matrix_row === 7 && !k) k = o; });
    const p = k.getWorldPosition(k.position.clone()).project(app.viewer.camera);
    const r = app.viewer.canvas.getBoundingClientRect(); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; })()`);
  await h.clickAt(shift.x, shift.y);
  await h.sleep(800);
  h.verify("SHIFT clicked with the computer off latches, and takes nothing out", (await h.js("trs80.typist.isHeld(7, 0)")) && (await h.js("trs80.whole && [...trs80.motion.values()].every((m) => m.target === 0)")));
  await h.clickAt(shift.x, shift.y);

  // a double-click on a unit's body goes to its view; never where a click takes a part out
  /** A point on the stage over a part that passes a test (given `o`, the part picked). @param {string} test */
  const spot = (test) =>
    h.js(`(() => { const d = app.desk(), r = app.viewer.canvas.getBoundingClientRect();
      for (let y = r.top + 10; y < r.bottom - 10; y += 6) for (let x = r.left + 10; x < r.right - 10; x += 6) {
        const o = d.pick({ clientX: x, clientY: y })?.object ?? null; if (${test}) return { x, y }; }
      return null; })()`);
  const viewAfter = async (/** @type {{ x: number, y: number }} */ p) => {
    await h.clickAt(p.x, p.y, 2);
    await h.until("!app.viewer.isFlying() && !app.stage.moving", 5000);
    return h.js("app.stage.view");
  };
  await h.choose("#band .menu-btn", "Whole system");
  await h.until("!app.viewer.isFlying()", 5000);
  const lid = await spot(`d.up(o, (x) => d.modelName(x) === "case.top")`);
  // its two clicks take the case top out and put it back (the cables, out first, stay out)
  h.verify("with the computer off, a double-click on its case top is two clicks, and the view stays", !!lid && (await viewAfter(lid)) === "desk" && (await h.until("trs80.motion.get('case.top').target === 0 && trs80.motion.get('case.top').f === 0", 5000)));
  await h.press(".put-back");
  await h.until("trs80.whole && [...trs80.motion.values()].every((m) => m.f === 0)", 10000);
  for (const [v, name] of [["recorder", "Recorder"], ["screen", "Screen"], ["keyboard", "Keyboard"]]) {
    if (v === "keyboard") await h.pressText("#helper-strip button", "Computer");
    await h.choose("#band .menu-btn", "Whole system");
    await h.until("!app.viewer.isFlying()", 5000);
    const p = await spot(`o !== d.screen && d.viewOf(o) === "${v}"`);
    h.verify(`a double-click on the ${v === "screen" ? "display" : v}'s body goes to the ${name} view`, !!p && (await viewAfter(p)) === v && (await h.js("app.stage.mode")) === "3d", p);
  }

  // Show me (a view) pressed while the camera still flies to 2D: it ends in 3D, at that view
  await h.press('#band [data-mode="2d"]');
  await h.sleep(150);
  await h.js("app.stage.goTo('angle')");
  await h.until("!app.stage.moving && !app.viewer.isFlying()", 5000);
  h.verify("a view chosen during the flight to 2D lands in 3D, on it", (await h.js("[app.stage.mode, app.stage.view, document.getElementById('view2d').hidden].join()")) === "3d,angle,true", await h.js("[app.stage.mode, app.stage.view]"));
}
