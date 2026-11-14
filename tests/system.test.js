// SPDX-License-Identifier: Apache-2.0
//
// The desk's rules (js/sim/system.js; docs/ui-design.md, U3-U5; design/decisions.md, D11,
// D16): acceptance area APP.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Tape, tapeFromCas } from "../js/sim/cassette.js";
import { screenProgramCas } from "../js/sim/system-samples.js";
import { FAST_TAPE, System } from "../js/sim/system.js";
import { NO_ROM, rom } from "./boot.js";

const TAKE_APART = JSON.parse(readFileSync(new URL("../model/params/machine.json", import.meta.url), "utf8")).take_apart.order;

/** A desk, with what it says recorded. @param {Uint8Array | null} [r] */
function desk(r = new Uint8Array(0x3000)) {
  const s = new System({ rom: r, takeApart: TAKE_APART });
  /** @type {string[]} */
  const said = [];
  s.say = (m) => said.push(m.key);
  return { s, said };
}

/** Runs the units' motion until it rests. @param {System} s */
const settle = (s) => {
  for (let i = 0; i < 10000 && s.stepMotion(0.05); i++);
};

describe("APP: the desk's rules", () => {
  it("APP-1: the computer will not switch on while anything is out, and says what is out", () => {
    const { s, said } = desk();
    s.toggleUnit("case.top");
    settle(s);
    assert.ok(s.assembly.isOut("cables") && s.assembly.isOut("case.top"), "the cables came out first");
    assert.equal(s.power(true), false);
    assert.equal(said.at(-1), "power.apart");
    s.putAllBack();
    settle(s);
    assert.ok(s.whole);
    assert.equal(s.power(true), true);
  });

  it("APP-2: nothing comes out while the computer is on", () => {
    const { s, said } = desk();
    s.power(true);
    assert.equal(s.toggleUnit("case.top"), false);
    assert.equal(said.at(-1), "apart.poweredOn");
    assert.equal(s.takeAllApart(), false);
    assert.ok(s.whole);
  });

  it("APP-3: units move one at a time, never one before what it needs out; back in the reverse order", () => {
    const { s } = desk();
    s.takeAllApart();
    /** @type {string[]} */
    const firsts = [];
    for (let i = 0; i < 10000 && s.stepMotion(0.05); i++) {
      for (const st of s.assembly.order) {
        const f = /** @type {{ f: number }} */ (s.motion.get(st.unit)).f;
        if (f > 0 && !firsts.includes(st.unit)) firsts.push(st.unit);
        if (f > 0) for (const r of st.requires) assert.equal(s.motion.get(r)?.f, 1, `${st.unit} moved before ${r} was out`);
      }
    }
    assert.deepEqual(firsts, ["cables", "case.top", "keyboard", "board.main"]);
    s.toggleUnit("keyboard");
    settle(s);
    assert.ok(s.assembly.isIn("keyboard") && s.assembly.isIn("board.main"), "the board went back first, then the keyboard");
    assert.ok(s.assembly.isOut("case.top"));
  });

  it("APP-4: going to 2D puts it back at once", () => {
    const { s } = desk();
    s.takeAllApart();
    s.stepMotion(0.3);
    assert.equal(s.putBackNow(), true);
    assert.ok(s.whole);
    assert.equal(s.putBackNow(), false);
  });

  it("APP-5: no ROM, no power; a ROM of one's own is taken only with the computer off", () => {
    const { s, said } = desk(null);
    assert.equal(s.power(true), false);
    assert.equal(said.at(-1), "power.noRom");
    assert.equal(s.setRom(new Uint8Array(0x3000)), true);
    assert.equal(s.power(true), true);
    assert.equal(s.setRom(new Uint8Array(0x3000)), false);
  });

  it("APP-6: the recorder's keys need a tape; EJECT empty says so", () => {
    const { s, said } = desk();
    assert.equal(s.deckKey("play"), false);
    assert.equal(said.at(-1), "deck.noTape");
    assert.equal(s.deckKey("eject"), false);
    s.insertTape(new Tape("blank"));
    assert.equal(said.at(-1), "tape.blank");
    assert.equal(s.deckKey("record"), true);
    assert.equal(s.deck.mode, "record");
  });

  it("APP-7: inserting a tape says what is on it: a system tape names its program", () => {
    const { s, said } = desk();
    s.insertTape(tapeFromCas("screen.cas", screenProgramCas()));
    assert.equal(said.at(-1), "tape.system");
    assert.equal(s.tapeInfo()?.kind, "system");
  });

  it("APP-8: Fast tape runs the machine 32 times faster only while the tape moves (D16)", () => {
    const { s } = desk();
    s.power(true);
    s.insertTape(tapeFromCas("t", screenProgramCas()));
    s.deckKey("play");
    s.frame(0.016);
    assert.equal(s.clock.boost, 1, "PLAY down, relay open: no boost");
    s.machine.output(0xff, 0x04);
    s.frame(0.016);
    assert.equal(s.clock.boost, FAST_TAPE);
    s.fastTape = false;
    s.frame(0.016);
    assert.equal(s.clock.boost, 1);
  });

  it("APP-9: switching on clears queued typing and a pause", () => {
    const { s } = desk();
    s.power(true);
    s.clock.pause();
    s.type("HELLO");
    s.power(false);
    s.power(true);
    assert.equal(s.typist.busy, false);
    assert.equal(s.clock.paused, false);
  });

  it("APP-10: typing with the computer off is refused", () => {
    const { s, said } = desk();
    assert.equal(s.type("X"), 0);
    assert.equal(said.at(-1), "type.off");
  });

  it("APP-11: with Level II, power on reaches MEMORY SIZE?", { skip: NO_ROM }, () => {
    const { s } = desk(rom());
    s.power(true);
    s.clock.step(1.5);
    assert.match(s.machine.screenText()[0], /^MEMORY SIZE\?/);
  });
});
