// SPDX-License-Identifier: Apache-2.0
//
// The dock (U6): its six tabs in order, Lessons the default on a first visit, the tab kept
// after a reload; a lesson's Show me points at the view; the Sound button is remembered.

const ORDER = ["Video RAM", "Keyboard", "Cassette", "CPU & Memory", "Lessons", "References"];

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.desk() !== null", 30000);
  const tabs = await h.js("[...document.querySelectorAll('#dock-tabs .dock-tab')].map((b) => b.textContent.trim())");
  h.verify("the tabs: the instruments, then Lessons and References", JSON.stringify(tabs) === JSON.stringify(ORDER), tabs);
  h.verify("a first visit opens on Lessons", (await h.js("app.dock.current")) === "lessons");
  await h.press("#tab-cpu");
  await h.open({ keep: true });
  h.verify("the tab is kept after a reload", (await h.js("app.dock.current")) === "cpu");
  await h.press("#dock-fold");
  h.verify("the fold button folds it", await h.js("app.dock.folded"));
  await h.press("#tab-lessons");
  h.verify("choosing a tab opens it again", !(await h.js("app.dock.folded")) && (await h.js("app.dock.current")) === "lessons");

  // a lesson's Show me: lesson 1's Look inside step, the Inside view
  const shown = await h.js(`(() => { const b = [...document.querySelectorAll('#pane-lessons button')].filter((x) => /Show me/.test(x.textContent)); return b.length; })()`);
  h.verify("lesson 1 has Show me chips", shown > 0);
  await h.js("document.querySelectorAll('#pane-lessons .step')[2]?.scrollIntoView()");
  const inside = await h.js(`(() => { const s = document.querySelectorAll('#pane-lessons .step')[2]; const b = s && [...s.querySelectorAll('button')].find((x) => /Show me/.test(x.textContent)); if (!b) return null; b.id ||= 'check-show'; return '#' + b.id; })()`);
  // from 2D, as on a phone: the camera lands on the step's view, not the one before 2D
  await h.press('#band [data-mode="2d"]');
  await h.until("app.stage.mode === '2d' && !app.stage.moving", 5000);
  if (inside) await h.press(inside);
  await h.until("app.stage.mode === '3d' && !app.stage.moving", 6000);
  h.verify("Look inside's Show me, from 2D, goes to Inside, from below", (await h.until("app.stage.view === 'inside' && app.stage.glass", 5000)) && (await h.js("app.stage.fitted")) === "inside", await h.js("[app.stage.view, app.stage.fitted]"));
  await h.press('#band [data-mode="2d"]');
  h.verify("and the 2D | 3D toggle still works after it", await h.until("app.stage.mode === '2d'", 5000));

  // Sound, on the top bar, remembered
  await h.press("#sound");
  h.verify("Sound turns off", (await h.js("document.getElementById('sound').getAttribute('aria-pressed')")) === "false");
  await h.open({ keep: true });
  h.verify("and stays off after a reload", (await h.js("document.getElementById('sound').getAttribute('aria-pressed')")) === "false");
}
