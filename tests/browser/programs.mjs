// SPDX-License-Identifier: Apache-2.0
//
// Programs (U8, design/v0.0.3.md S2-S3): one catalogue in sections; each program's dialog
// offers Type it in and Put its tape in, of equal weight, and Type in faster, on at first for
// a long listing. Type it in answers MEMORY SIZE? first, or BREAKs a running program, then
// NEW, so no old line is left in. Find original programs says where the era's own are; Open
// a listing types a visitor's plain-text listing in, and turns away what is not one.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000);
  await h.press("#programs");
  const menu = await h.js("[...document.querySelectorAll('.menu [role^=menuitem], .menu .menu-divider-label, .menu [role=separator]')].map((b) => b.textContent)");
  h.verify("Programs is in sections, Learn first", Array.isArray(menu) && menu.some((x) => x === "Learn"), menu);
  const items = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("and ends with Find original programs and Open a listing", Array.isArray(items) && items.at(-2) === "Find original programs…" && items.at(-1) === "Open a listing…", items);
  await h.key("Escape");
  await h.press("#tapes");
  const tapes = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Tapes holds no programs: tapes themselves, and Fast tape", Array.isArray(tapes) && !tapes.some((x) => /CLOAD/.test(x)) && tapes.some((x) => x.startsWith("Fast tape")), tapes);
  await h.key("Escape");

  await h.choose("#programs", "Sine wave");
  h.verify("a program opens its dialog", await h.until("document.querySelector('dialog[open]')", 2000));
  const buttons = await h.js("[...document.querySelectorAll('dialog .dialog-actions .btn')].map((b) => [b.textContent, b.className])");
  h.verify("its two ways in are equal choices, Type it in first", buttons?.length === 2 && buttons[0][0].startsWith("Type it in") && buttons.every((/** @type {string[]} */ b) => /tonal/.test(b[1]) && !/filled/.test(b[1])), buttons);
  h.verify("the dialog shows the listing", /SIN\(X\/F\)/.test(await h.js("document.querySelector('dialog .program-listing')?.textContent ?? ''")));
  h.verify("a short listing is typed at the usual speed at first", (await h.js("document.querySelector('dialog .program-faster .switch').getAttribute('aria-checked')")) === "false");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("Type it in at MEMORY SIZE? says it answers it first", /MEMORY SIZE\?/.test(await h.status()));
  await h.typed();
  h.verify("the program runs: its curve is drawn", await h.until("[...trs80.machine.vram].filter((v) => v & 0x80 && v & 0x3f).length > 40", 20000));

  await h.choose("#programs", "Sketch with the arrows");
  await h.press("dialog .program-faster .switch");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("over a running program it says it BREAKs first", /BREAK/.test(await h.status()));
  h.verify("Type in faster runs the machine 64 times as fast while it types", await h.until("trs80.clock.boost === 64", 3000));
  await h.typed();
  h.verify("and back to the real speed when it is typed", await h.until("trs80.clock.boost === 1", 3000));
  await h.choose("#programs", "Bouncing block");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  await h.typed();
  await h.js("import('./js/lessons/lessons.js').then((m) => m.typeKeys(trs80, '{BREAK}LIST\\n'))");
  await h.typed();
  const screen = await h.screen();
  h.verify("NEW first: the shorter program leaves none of the longer one's lines", screen.includes("60 GOTO 20") && !screen.some((l) => /^[7-9]0 /.test(l)), screen);

  await h.choose("#programs", "Bouncing block");
  await h.pressText("dialog .dialog-actions .btn", "Put its tape in");
  h.verify("Put its tape in puts our recorded tape in the recorder", await h.until("trs80.deck.tape?.name.startsWith('Bouncing block') && trs80.deck.tape.pulses.length > 1000", 5000));

  // the era's own programs
  await h.choose("#programs", "Find original programs");
  const links = await h.js("[...document.querySelectorAll('dialog .originals-links a')].map((a) => [a.textContent, a.target])");
  h.verify("Find original programs names the archives, each opening apart", Array.isArray(links) && links.length === 3 && links.every((/** @type {string[]} */ l) => l[1] === "_blank"), links);
  await h.key("Escape");

  // a listing of the visitor's
  /** Hands the listing input a file. @param {string} name @param {string} text */
  const give = (name, text) =>
    h.js(`(() => { const i = document.querySelector('input[type=file][accept^=".bas"]'); const d = new DataTransfer(); d.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)})); i.files = d.files; i.dispatchEvent(new Event("change")); })()`);
  await give("tokens.bas", "\xff\x80\x42");
  h.verify("a tokenised file is turned away, saying why", await h.until("/plain-text listing/.test(document.getElementById('status').textContent)", 3000));
  await give("hi.bas", '10 print "from a listing"\r\n20 goto 10\r\n');
  await h.typed();
  await h.js("import('./js/lessons/lessons.js').then((m) => m.typeKeys(trs80, 'RUN\\n'))");
  h.verify("a plain-text listing is typed in, in capitals, and runs", await h.until("trs80.machine.screenText().filter((l) => l === 'FROM A LISTING').length > 3", 20000), await h.screen());

  // switched off: Type it in is greyed with why, and says why when chosen
  await h.pressText("#helper-strip button", "Computer");
  await h.choose("#programs", "Bouncing block");
  const off = await h.js("(() => { const b = document.querySelector('dialog .dialog-actions .btn'); return [b.getAttribute('aria-disabled'), b.textContent]; })()");
  h.verify("off, Type it in is greyed, saying switch on first", off?.[0] === "true" && /switch on first/.test(off[1]), off);
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("chosen anyway, the status line says why", /Switch the computer on/.test(await h.status()));
}
