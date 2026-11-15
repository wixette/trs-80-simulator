// SPDX-License-Identifier: Apache-2.0
//
// Programs (U8, design/v0.0.3.md S2-S3): one catalogue in sections; each program's dialog
// offers Type it in and Put its tape in, of equal weight, and Type in faster, on at first for
// a long listing. Type it in answers MEMORY SIZE? first, or BREAKs a running program, then
// NEW, so no old line is left in. Find original programs says where the era's own are; Open
// in a BASIC file types a visitor's program, written out as text, in, and turns away what is not one.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000);
  await h.press("#programs");
  const items = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Programs lists the four sections, then Find original programs and Type in a BASIC file", JSON.stringify(items) === JSON.stringify(["Learn", "Games", "Utilities", "Music", "Find original programs…", "Type in a BASIC file…"]), items);
  await h.key("ArrowRight");
  await h.sleep(200);
  const beside = await h.js("(() => { const [m, s] = document.querySelectorAll('.menu'); return s ? [s.getBoundingClientRect().left >= m.getBoundingClientRect().right - 4, [...s.querySelectorAll('[role^=menuitem]')].map((b) => b.textContent), document.activeElement?.textContent] : null; })()");
  h.verify("→ opens Learn beside the menu, its first program focused", beside?.[0] === true && beside[1][0] === "Hello" && beside[2] === "Hello", beside);
  await h.key("ArrowLeft");
  h.verify("← goes back to Learn", (await h.js("[document.querySelectorAll('.menu').length, document.activeElement?.textContent]")).join() === "1,Learn");
  await h.key("Escape");
  await h.press("#tapes");
  const tapes = await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)");
  h.verify("Tapes holds no programs: tapes themselves, and Fast tape", Array.isArray(tapes) && !tapes.some((x) => /CLOAD/.test(x)) && tapes.some((x) => x.startsWith("Fast tape")), tapes);
  await h.key("Escape");

  await h.choose("#programs", "Learn ▸ Sine wave");
  h.verify("a program opens its dialog", await h.until("document.querySelector('dialog[open]')", 2000));
  const buttons = await h.js("[...document.querySelectorAll('dialog .dialog-actions .btn')].map((b) => [b.textContent, b.className])");
  h.verify("its two ways in: Put its tape in, then Type it in, recommended: last, filled, with the focus", buttons?.length === 2 && buttons[0][0].startsWith("Put its tape in") && /tonal/.test(buttons[0][1]) && buttons[1][0].startsWith("Type it in") && /filled/.test(buttons[1][1]) && (await h.js("document.activeElement?.textContent ?? ''")).startsWith("Type it in"), buttons);
  h.verify("the dialog shows the listing", /SIN\(X\/F\)/.test(await h.js("document.querySelector('dialog .program-listing')?.textContent ?? ''")));
  h.verify("a short listing is typed at the usual speed at first", (await h.js("document.querySelector('dialog .program-faster .switch').getAttribute('aria-checked')")) === "false");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("Type it in at MEMORY SIZE? says it answers it first", /MEMORY SIZE\?/.test(await h.status()));
  await h.typed();
  h.verify("the program runs: its curve is drawn", await h.until("[...trs80.machine.vram].filter((v) => v & 0x80 && v & 0x3f).length > 40", 20000));

  await h.choose("#programs", "Learn ▸ Sketch with the arrows");
  await h.press("dialog .program-faster .switch");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("over a running program it says it BREAKs first", /BREAK/.test(await h.status()));
  h.verify("Type in faster runs the machine 64 times as fast while it types", await h.until("trs80.clock.boost === 64", 3000));
  await h.typed();
  h.verify("and back to the real speed when it is typed", await h.until("trs80.clock.boost === 1", 3000));
  await h.choose("#programs", "Learn ▸ Bouncing block");
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  await h.typed();
  await h.js("import('./js/lessons/lessons.js').then((m) => m.typeKeys(trs80, '{BREAK}LIST\\n'))");
  await h.typed();
  const screen = await h.screen();
  h.verify("NEW first: the shorter program leaves none of the longer one's lines", screen.includes("60 GOTO 20") && !screen.some((l) => /^[7-9]0 /.test(l)), screen);

  await h.choose("#programs", "Learn ▸ Bouncing block");
  await h.pressText("dialog .dialog-actions .btn", "Put its tape in");
  h.verify("Put its tape in puts our recorded tape in the recorder", await h.until("trs80.deck.tape?.name.startsWith('Bouncing block') && trs80.deck.tape.pulses.length > 1000", 5000));

  // on a phone, a section takes the menu's place, under a row going back
  await h.viewport(390, 844, true);
  await h.sleep(800);
  await h.press("#programs");
  await h.sleep(200);
  await h.pressText(".menu [role^=menuitem]", "Games");
  await h.sleep(200);
  const phone = await h.js("[document.querySelectorAll('.menu').length, [...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)]");
  h.verify("on a phone, Games opens in the menu's place, under a row going back", phone?.[0] === 1 && phone[1][0] === "Games" && phone[1].includes("Worm") && !phone[1].includes("Learn"), phone);
  await h.pressText(".menu .menu-back", "Games");
  await h.sleep(200);
  h.verify("and that row goes back", (await h.js("[...document.querySelectorAll('.menu [role^=menuitem]')].map((b) => b.textContent)")).includes("Learn"));
  await h.key("Escape");
  await h.viewport(1440, 900);

  // the era's own programs
  await h.choose("#programs", "Find original programs");
  const links = await h.js("[...document.querySelectorAll('dialog .originals-links a')].map((a) => [a.textContent, a.target])");
  h.verify("Find original programs names the archives, each opening apart", Array.isArray(links) && links.length === 3 && links.every((/** @type {string[]} */ l) => l[1] === "_blank"), links);
  await h.key("Escape");

  // a listing of the visitor's
  /** Hands the listing input a file. @param {string} name @param {string} text */
  const give = (name, text) =>
    h.js(`(() => { const i = document.querySelector('input[type=file][accept^=".bas"]'); const d = new DataTransfer(); d.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)})); i.files = d.files; i.dispatchEvent(new Event("change")); })()`);
  await h.js(`(() => { const i = document.querySelector('input[type=file][accept^=".bas"]'); const d = new DataTransfer(); d.items.add(new File([new Uint8Array([0xff, 0x80, 0x42])], "tokens.bas")); i.files = d.files; i.dispatchEvent(new Event("change")); })()`);
  h.verify("a tokenised file is turned away, saying why", await h.until("/not a BASIC text file/.test(document.getElementById('status').textContent)", 3000));
  await give("hi.bas", '10 print "from a listing"\r\n20 goto 10\r\n');
  await h.typed();
  await h.js("import('./js/lessons/lessons.js').then((m) => m.typeKeys(trs80, 'RUN\\n'))");
  h.verify("a BASIC text file is typed in, in capitals, and runs", await h.until("trs80.machine.screenText().filter((l) => l === 'FROM A LISTING').length > 3", 20000), await h.screen());

  // switched off: Type it in is greyed with why, and says why when chosen
  await h.pressText("#helper-strip button", "Computer");
  await h.choose("#programs", "Learn ▸ Bouncing block");
  const off = await h.js("(() => { const b = [...document.querySelectorAll('dialog .dialog-actions .btn')].find((x) => x.textContent.startsWith('Type it in')); return [b.getAttribute('aria-disabled'), b.textContent]; })()");
  h.verify("off, Type it in is greyed, saying switch on first", off?.[0] === "true" && /switch on first/.test(off[1]), off);
  await h.pressText("dialog .dialog-actions .btn", "Type it in");
  h.verify("chosen anyway, the status line says why", /Switch the computer on/.test(await h.status()));
}
