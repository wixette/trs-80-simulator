// SPDX-License-Identifier: Apache-2.0
//
// The 2D view (U10): the toggle, the drawers and their toggles, the recorder's keys going down
// while pressed, C and B reset by a double-click, the counter and the lamp drawn live.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.desk() !== null", 30000);
  await h.press('#band [data-mode="2d"]');
  h.verify("2D shows after the toggle", await h.until("!document.getElementById('view2d').hidden && app.stage.mode === '2d'", 5000));
  h.verify("the recorder's drawer is closed at first", (await h.js("app.flat.drawerOpen('rec')")) === false);
  await h.pressText("#band button", "Recorder");
  h.verify("its toggle opens it", await h.until("app.flat.drawerOpen('rec') && document.querySelector('.flat-recorder').offsetWidth > 0", 2000));
  const sizes = await h.js("(() => { const d = document.querySelector('.flat-display').getBoundingClientRect(), r = document.querySelector('.flat-recorder').getBoundingClientRect(); return [d.height, r.height]; })()");
  h.verify("the recorder is as tall as the display", sizes && Math.abs(sizes[0] - sizes[1]) < 3, sizes);

  // STOP springs back, but goes down while held
  const stop = await h.centre('.flat-deckkey[data-deck="stop"]');
  await h.send("Input.dispatchMouseEvent", { type: "mousePressed", x: stop.x, y: stop.y, button: "left", buttons: 1, clickCount: 1 });
  await h.sleep(150);
  const held = await h.js("getComputedStyle(document.querySelector('.flat-deckkey[data-deck=stop]')).transform");
  await h.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: stop.x, y: stop.y, button: "left", buttons: 0, clickCount: 1 });
  await h.sleep(200);
  h.verify("a recorder key goes down while pressed", held !== "none", held);
  h.verify("and comes back up", (await h.js("getComputedStyle(document.querySelector('.flat-deckkey[data-deck=stop]')).transform")) === "none");

  // the counter and the lamp, drawn as the deck is
  await h.choose("#tapes", "Blank tape");
  await h.pressText("#helper-strip .deck-key", "FAST-F");
  h.verify("the 2D counter counts as the tape winds", await h.until("document.querySelector('.flat-counter').textContent !== '000'", 5000));
  await h.js("trs80.deckKey('stop'); trs80.deckKey('record'); trs80.deck.setRelay(true, trs80.machine.t)");
  h.verify("the 2D lamp lights while it records", await h.until("document.querySelector('.flat-recled').classList.contains('on')", 2000));
  await h.js("trs80.deck.setRelay(false, trs80.machine.t); trs80.deckKey('stop')");

  // B: a double-click puts it back
  await h.js("trs80.setControl('brightness', 0.1)");
  const b = await h.js("(() => { const r = document.querySelectorAll('.flat-knob')[1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()");
  await h.clickAt(b.x, b.y, 2);
  h.verify("a double-click on B puts it back to the middle", (await h.js("trs80.display.brightness")) === 0.5);

  // the keyboard drawer, and 3D again
  await h.pressText("#band button", "Keyboard");
  h.verify("the keyboard's toggle opens its drawer", await h.until("app.flat.drawerOpen('kbd')", 2000));
  await h.press('#band [data-mode="3d"]');
  h.verify("3D again", await h.until("app.stage.mode === '3d' && document.getElementById('view2d').hidden", 5000));
}
