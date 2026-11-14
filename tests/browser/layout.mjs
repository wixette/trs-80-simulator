// SPDX-License-Identifier: Apache-2.0
//
// The page fits the window at every width, whichever dock tab is open: nothing wider than the
// window, so the page narrows with it (the body's one column is minmax(0, 1fr)). On a phone
// the top bar, the band and the strip fit, and the dock starts open; a short window starts
// with it folded. The dock's height chosen by its handle is kept, never shrunk for good.

const TABS = ["vram", "keyboard", "cassette", "cpu", "lessons", "refs"];

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  /** The widest box on the page against the window's width, and what is too wide. */
  const fit = () =>
    h.js(`(() => { const w = innerWidth; const wide = [...document.querySelectorAll('#topbar, #band, #stage-view, #helper-strip, #dock, #status')]
      .filter((e) => e.getBoundingClientRect().right > w + 1).map((e) => e.id + ':' + Math.round(e.getBoundingClientRect().width));
      return { w, page: document.documentElement.scrollWidth, wide }; })()`);
  await h.viewport(1600, 900);
  await h.open();
  await h.until("app.desk() !== null", 30000);
  for (const tab of TABS) {
    await h.press(`#tab-${tab}`);
    for (const w of [1100, 700, 480]) {
      await h.viewport(w, 900);
      const f = await fit();
      h.verify(`${tab} open, ${w} px: the page fits the window`, f.wide.length === 0 && f.page <= w, f);
    }
    await h.viewport(1600, 900);
  }
  for (const [w, hh] of [[390, 844], [360, 740]]) {
    await h.viewport(w, hh, true);
    await h.open();
    const f = await fit();
    h.verify(`a ${w} px phone: the page fits`, f.wide.length === 0, f);
    const strip = await h.js("(() => { const s = document.getElementById('helper-strip').getBoundingClientRect(); return s.right <= innerWidth && s.left >= 0; })()");
    h.verify(`a ${w} px phone: the helper strip fits`, strip);
  }
  await h.viewport(820, 420);
  await h.open();
  h.verify("a short window starts with the dock folded", await h.js("app.dock.folded"));

  // the dock's chosen height survives a window too small for it
  await h.viewport(1440, 900);
  await h.open();
  const handle = await h.centre("#dock-handle");
  await h.drag(handle, { x: handle.x, y: handle.y - 120 });
  const chosen = await h.js("app.dock.height");
  await h.viewport(1440, 520);
  await h.viewport(1440, 900);
  h.verify("a short window squeezes the dock, but the height chosen comes back", Math.abs((await h.js("app.dock.height")) - chosen) <= 1, [chosen, await h.js("app.dock.height")]);
  await h.open({ keep: true });
  h.verify("and is kept after a reload", Math.abs((await h.js("app.dock.height")) - chosen) <= 1);
}
