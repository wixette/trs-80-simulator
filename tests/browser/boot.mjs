// SPDX-License-Identifier: Apache-2.0
//
// A first visit: the machine is on at MEMORY SIZE? (U5), ENTER on the visitor's own keyboard
// answers it, BASIC runs what is typed, and the strip's POWER and RESET work.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  h.verify("the page loads with its 3D model", await h.until("app.desk() !== null", 30000));
  h.verify("the machine starts on, at MEMORY SIZE?", (await h.js("trs80.machine.powered && trs80.display.on")) && (await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000)));
  h.verify("the status line welcomes the visitor", /MEMORY SIZE\?/.test(await h.status()));
  await h.key("Enter");
  h.verify("ENTER answers MEMORY SIZE? with all the memory: READY", await h.until("trs80.machine.screenText().some((l) => l === 'READY')", 20000));
  await h.typeHost('PRINT 2+2\n');
  h.verify("PRINT 2+2 typed on the host's keys prints 4", await h.until("trs80.machine.screenText().some((l) => l === ' 4')", 15000), await h.screen());
  await h.typeHost('10 PRINT "HI"\nRUN\n');
  h.verify("a program typed in runs", await h.until("trs80.machine.screenText().some((l) => l === 'HI')", 15000), await h.screen());
  // the strip's POWER: off and on again, back to MEMORY SIZE?
  await h.pressText("#helper-strip button", "Computer");
  h.verify("the strip's Computer switches it off", await h.until("!trs80.machine.powered", 3000));
  await h.pressText("#helper-strip button", "Computer");
  h.verify("and on again, at MEMORY SIZE?", await h.until("trs80.machine.powered && trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000));
  // RESET with BASIC running: the program stops, BASIC is kept
  await h.key("Enter");
  await h.until("trs80.machine.screenText().some((l) => l === 'READY')", 20000);
  await h.typeHost("10 GOTO 10\nRUN\n");
  await h.sleep(1500);
  await h.pressText("#helper-strip button", "Reset");
  h.verify("RESET stops a running program, back at READY", await h.until("trs80.machine.screenText().filter((l) => l.trim()).at(-2) === 'READY'", 8000), await h.screen());
  // remembered: off stays off after a reload
  await h.pressText("#helper-strip button", "Computer");
  await h.open({ keep: true });
  h.verify("switched off, it stays off after a reload", !(await h.js("trs80.machine.powered")));

  // ?selftest: the page's own checks, which a visitor can run, all pass
  await h.send("Page.navigate", { url: `${h.base}?debug&selftest` });
  await h.until("window.__selftest?.done", 30000);
  const st = await h.js("window.__selftest");
  h.verify("?selftest: the page's own checks all pass", st?.failed?.length === 0 && st.passed.length > 0, st?.failed);

  // no ROM, starting in 2D: the status line says so, and what the visitor chose is kept
  await h.js("localStorage.setItem('trs80.power', JSON.stringify({ computer: true, display: true })); localStorage.setItem('trs80.view', '2d')");
  await h.block("*level2-v12.bin*");
  await h.open({ keep: true });
  await h.sleep(800);
  h.verify("without the ROM, the status line says so, even starting in 2D", !/Switch on/.test(await h.status()) && /Level II/.test(await h.status()) && !(await h.js("trs80.machine.powered")), await h.status());
  await h.js("trs80.displayPower(true)");
  h.verify("and the power remembered is kept, not the forced off", JSON.parse(await h.js("localStorage.getItem('trs80.power')")).computer === true);
}
