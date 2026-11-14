// SPDX-License-Identifier: Apache-2.0
//
// Dialogs (U9): About opens with Close focused and References beside it; Escape, ✕ and a click
// on the scrim close it, but a press inside released outside (selecting text) does not.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.press("#about");
  h.verify("About opens", await h.until("document.querySelector('dialog[open]')", 2000));
  h.verify("its Close has the focus", /Close/.test(await h.js("document.activeElement?.textContent ?? ''")));
  h.verify("it shows the version", await h.until("/\\d+\\.\\d+\\.\\d+/.test(document.querySelector('dialog .version')?.textContent ?? '')", 3000));
  await h.key("Escape");
  h.verify("Escape closes it", !(await h.js("document.querySelector('dialog[open]')")));

  await h.press("#about");
  const text = await h.centre("dialog .dialog-text");
  await h.drag(text, { x: 20, y: 20 });
  h.verify("a press inside released outside leaves it open", await h.js("!!document.querySelector('dialog[open]')"));
  await h.clickAt(20, 20);
  h.verify("a click on the scrim closes it", !(await h.js("document.querySelector('dialog[open]')")));

  await h.press("#about");
  await h.pressText("dialog .dialog-actions .btn", "References");
  h.verify("its References button opens the References tab", (await h.js("app.dock.current")) === "refs" && !(await h.js("document.querySelector('dialog[open]')")));
  await h.press("#about");
  await h.press("dialog .dialog-head .btn");
  h.verify("its ✕ closes it", !(await h.js("document.querySelector('dialog[open]')")));
}
