// SPDX-License-Identifier: Apache-2.0
//
// The cassette, through the page: a blank tape from Tapes, RECORD from the strip, CSAVE; the
// counter counts and the RECORD/BATTERY lamp lights while it records; REWIND, PLAY, CLOAD
// brings the program back. Fast tape in the Tapes menu and the Cassette tab are one switch.

/** @param {import("./harness.mjs").Harness} h */
export default async function (h) {
  await h.viewport(1440, 900);
  await h.open();
  await h.until("app.desk() !== null", 30000);
  await h.until("trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l))", 20000);
  await h.key("Enter");
  await h.until("trs80.machine.screenText().some((l) => l === 'READY')", 20000);
  await h.typeHost('10 PRINT "TAPE OK"\n');

  await h.choose("#tapes", "Blank tape");
  h.verify("Tapes ▸ Blank tape puts a tape in", await h.until("trs80.deck.tape !== null", 2000));
  await h.pressText("#helper-strip .deck-key", "RECORD");
  h.verify("RECORD latches RECORD and PLAY", (await h.js("trs80.deck.mode")) === "record");
  await h.typeHost('CSAVE "A"\n');
  h.verify("CSAVE starts the motor: the tape records", await h.until("trs80.deck.running && trs80.deck.recording", 5000));
  h.verify("the 3D RECORD/BATTERY lamp lights while it records", await h.until("app.desk().recLamp.emissiveIntensity > 0", 3000));
  h.verify("CSAVE ends at READY", await h.until("!trs80.deck.running && trs80.machine.screenText().filter((l) => l.trim()).at(-2) === 'READY'", 60000), await h.screen());
  h.verify("the counter counted", (await h.js("trs80.deck.counterAt(trs80.machine.t)")) > 0);
  h.verify("the lamp is out once the motor stops", await h.until("app.desk().recLamp.emissiveIntensity === 0", 3000));

  await h.pressText("#helper-strip .deck-key", "STOP");
  await h.pressText("#helper-strip .deck-key", "REWIND");
  h.verify("REWIND winds back to 000", await h.until("trs80.deck.mode === 'stop' && trs80.deck.counterAt(trs80.machine.t) === 0", 20000));
  await h.typeHost("NEW\n");
  await h.pressText("#helper-strip .deck-key", "PLAY");
  await h.typeHost("CLOAD\n");
  h.verify("CLOAD reads it back", await h.until("!trs80.deck.running && trs80.machine.screenText().filter((l) => l.trim()).at(-2) === 'READY'", 60000), await h.screen());
  await h.typeHost("LIST\n");
  h.verify("LIST shows the program that was saved", await h.until("trs80.machine.screenText().some((l) => l === '10 PRINT \"TAPE OK\"')", 10000), await h.screen());

  // Fast tape: one switch in two places
  await h.press("#tab-cassette");
  const before = await h.js("trs80.fastTape");
  await h.choose("#tapes", "Fast tape");
  h.verify("Fast tape in the Tapes menu turns it over", (await h.js("trs80.fastTape")) === !before);
  h.verify("and the Cassette tab's switch follows", await h.until(`document.querySelector('#pane-cassette .switch').getAttribute('aria-checked') === '${!before}'`, 2000));
  await h.press("#pane-cassette .switch");
  h.verify("the tab's switch turns it back", (await h.js("trs80.fastTape")) === before);
  h.verify("the tab says Fast tape is the simulator's", /Simulator only/.test(await h.js("document.getElementById('pane-cassette').textContent")));
}
