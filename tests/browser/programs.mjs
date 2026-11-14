// SPDX-License-Identifier: Apache-2.0
//
// Programs (U8): one catalogue; each program's dialog offers Type it in and Put its tape in,
// of equal weight. Type it in answers MEMORY SIZE? first, or BREAKs a running program, then
// NEW, so no old line is left in.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000);
  await h.press("#programs");
  const items = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Programs lists each sample once, the machine code last", Array.isArray(items) && items.length === 5 && /machine code/.test(items[4]), items);
  await h.key("Escape");
  await h.press("#tapes");
  const tapes = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Tapes holds no samples: tapes themselves, and Fast tape", Array.isArray(tapes) && !tapes.some((x) => /CLOAD/.test(x)) && tapes.some((x) => x.startsWith("Fast tape")), tapes);
  await h.key("Escape");

  await h.choose("#programs", "Draw with SET");
  h.verify("a program opens its dialog", await h.until("document.querySelector('dialog[open]')", 2000));
  const buttons = await h.js("[...document.querySelectorAll('dialog .dialog-actions .btn')].map((b) => [b.textContent, b.className])");
  h.verify("its two ways in are equal choices, Type it in first", buttons?.length === 2 && buttons[0][0].startsWith("Type it in") && buttons.every((/** @type {string[]} */ b) => /tonal/.test(b[1]) && !/filled/.test(b[1])), buttons);
  h.verify("the dialog shows the listing", /SET\(X,0\)/.test(await h.js("document.querySelector('dialog .program-listing')?.textContent ?? ''")));
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("Type it in at MEMORY SIZE? says it answers it first", /MEMORY SIZE\?/.test(await h.status()));
  await h.typed();
  h.verify("the program runs: its frame is drawn", await h.until("trs80.machine.vram[0] === 0xbf || (trs80.machine.vram[0] & 0x80) !== 0", 20000));

  await h.choose("#programs", "Sketch with the arrows");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("over a running program it says it BREAKs first", /BREAK/.test(await h.status()));
  await h.typed();
  await h.choose("#programs", "Draw with SET");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  await h.typed();
  await h.js("import('./js/lessons/lessons.js').then((m) => m.typeKeys(trs80, '{BREAK}LIST\\n'))");
  await h.typed();
  const screen = await h.screen();
  h.verify("NEW first: the shorter program leaves none of the longer one's lines", screen.includes("50 GOTO 50") && !screen.some((l) => /^[6-9]0 /.test(l)), screen);

  // the machine-code program: only its tape
  await h.choose("#programs", "Fill the screen");
  const only = await h.js("[...document.querySelectorAll('dialog .dialog-actions .btn')].map((b) => b.textContent)");
  h.verify("machine code offers only its tape", only?.length === 1 && only[0].startsWith("Put its tape in"), only);
  await h.pressText("dialog .dialog-actions .btn", "Put its tape in");
  h.verify("and puts it in the recorder", await h.until("trs80.deck.tape?.name.startsWith('SCREEN')", 3000));

  // switched off: Type it in is greyed with why, and says why when chosen
  await h.pressText("#helper-strip button", "Computer");
  await h.choose("#programs", "Bouncing block");
  const off = await h.js("(() => { const b = document.querySelector('dialog .dialog-actions .btn'); return [b.getAttribute('aria-disabled'), b.textContent]; })()");
  h.verify("off, Type it in is greyed, saying switch on first", off?.[0] === "true" && /switch on first/.test(off[1]), off);
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("chosen anyway, the status line says why", /Switch the computer on/.test(await h.status()));
}
