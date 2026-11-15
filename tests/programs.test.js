// SPDX-License-Identifier: Apache-2.0
//
// Our programs (design/v0.0.3.md, S2): each is all on the Model I's keyboard; its tape in
// tapes/ is what a Model I of our own records today (pnpm tapes); and loaded from that tape
// with CLOAD, it runs: the visitor's part played by keys at given times, and what should
// then be on the screen checked. Errors anywhere fail it.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Amplifier } from "../js/audio/amplifier.js";
import { casFromTape, tapeFromCas } from "../js/sim/cassette.js";
import { Clock } from "../js/sim/clock.js";
import { keyNamed } from "../js/sim/keymap.js";
import { Typist } from "../js/sim/keys.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { Recorder } from "../js/sim/recorder.js";
import { recordSampleTape } from "../js/sim/sample-tapes.js";
import { tapeInfo } from "../js/sim/system-tape.js";
import { LONG, parseListing, SAMPLES, SECTIONS } from "../js/sim/samples.js";
import { typeKeys } from "../js/lessons/lessons.js";
import { System } from "../js/sim/system.js";
import { NO_ROM, rom } from "./boot.js";

/**
 * What the visitor does after RUN, and what must then be so.
 * @typedef {[number, "type" | "hold" | "release", string]} Act seconds after RUN, what, which text or key
 * @typedef {{ secs: number, acts?: Act[], expect: (screen: string[], m: Machine, notes: number) => boolean | string }} Scenario
 */

/** Lit graphics cells on the screen. @param {Machine} m */
const lit = (m) => [...m.vram].filter((v) => v & 0x80 && v & 0x3f).length;

/** @type {Record<string, Scenario>} */
const SCENARIOS = {
  hello: { secs: 4, acts: [[1, "type", "ADA\n"]], expect: (s) => s.filter((l) => l.includes("HELLO, ADA!")).length === 13 },
  guess: { secs: 6, acts: [[1, "type", "50\n"]], expect: (s) => s.some((l) => /TOO (LOW|HIGH)\.|YES!/.test(l)) },
  wave: { secs: 8, expect: (_, m) => lit(m) > 100 },
  kaleido: { secs: 10, expect: (_, m) => lit(m) > 40 },
  bounce: { secs: 3, expect: (_, m) => lit(m) === 1 },
  keys: { secs: 4, acts: [[1, "hold", "UP"], [3, "release", "UP"]], expect: (_, m) => lit(m) > 10 },
  notes: { secs: 4, acts: [[1, "type", "1\n"]], expect: (s) => s.some((l) => l.startsWith("TYPE FIVE SHORT NOTES")) },
  lander: { secs: 25, acts: [[1, "hold", "SPACE"], [1.4, "release", "SPACE"]], expect: (s, _, notes) => (s.some((l) => l.includes("CRASH! YOU HIT AT SPEED")) && notes > 100) || s.join(" | ") },
  worm: { secs: 20, acts: [[1, "type", " "]], expect: (s, _, notes) => (s.some((l) => l.includes("GAME OVER")) && notes > 100) || s.join(" | ") },
  bricks: { secs: 70, acts: [[1, "type", " "]], expect: (s, _, notes) => (s.some((l) => l.includes("GAME OVER")) && s.some((l) => l.startsWith("BRICKS   SCORE")) && notes > 100) || s.join(" | ") },
  meteors: { secs: 20, acts: [[1, "hold", "SPACE"], [1.4, "release", "SPACE"]], expect: (s, _, notes) => (s.some((l) => l.includes("B O O M !")) && notes > 50) || s.join(" | ") },
  clock: { secs: 12, acts: [[4, "type", "9,30,0\n"]], expect: (s, m) => (s.some((l) => l.includes("CLOCK")) && lit(m) > 60) || s.join(" | ") },
  calendar: { secs: 8, acts: [[3, "type", "8,1977\n"]], expect: (s) => (s.some((l) => l.includes("AUGUST 1977")) && s.some((l) => l.includes("SUN     MON"))) || s.join(" | ") },
  biorhythm: { secs: 40, acts: [[1, "type", "7,20,1969\n"], [5, "type", "11,15,2026\n"]], expect: (s) => s.some((l) => l.startsWith("BIORHYTHM: DAY 20937 OF YOUR LIFE")) || s.join(" | ") },
  banner: { secs: 25, acts: [[3, "type", "HELLO\n"]], expect: (s, m) => lit(m) > 100 || s.join(" | ") },
  musicbox: { secs: 20, acts: [[8, "type", "1"]], expect: (s, _, notes) => (s.some((l) => l.includes("ODE TO JOY")) && notes > 500) || `${notes} | ${s.join(" | ")}` },
  organ: { secs: 11, acts: [[8, "hold", "A"], [9, "release", "A"]], expect: (s, _, notes) => (s.some((l) => l.includes("PLAY THE KEYS")) && notes > 100) || `${notes} | ${s.join(" | ")}` },
  lighthouse: {
    secs: 90,
    acts: /** @type {Act[]} */ ([[2, "type", "\n"], ..."E,GET LANTERN,W,N,E,GET MATCHES,LIGHT LANTERN,D,GET KEY,U,W,OPEN DOOR,N,GET OIL,U,U,FILL LAMP,LIGHT LAMP".split(",").map((c, i) => [6 + i * 4, "type", `${c}\n`])]),
    expect: (s, _, notes) => (s.some((l) => l.startsWith("YOU SAVED THE SHIP IN 18 MOVES")) && notes > 100) || s.join(" | "),
  },
  race: { secs: 24, acts: [[1, "type", "\n"], [12, "type", "\n"]], expect: (s) => s.some((l) => l.startsWith("MACHINE CODE: ABOUT 1/45 SECOND")) },
};

/** A Model I at READY with a recorder, our tape in it; CLOADs it, RUNs it, and plays the scenario. @param {Uint8Array} cas @param {Scenario} sc */
function play(cas, sc) {
  const m = new Machine({ rom: rom() });
  const deck = new Recorder();
  m.tape = deck;
  const typist = new Typist(m);
  const clock = new Clock(m, [typist]);
  const amp = new Amplifier();
  m.power(true);
  clock.step(1.5);
  /** @param {string} text */
  const type = (text) => {
    typist.type(text);
    for (let s = 0; typist.busy && s < 60; s += 0.01) clock.step(0.01);
  };
  type("\n");
  clock.step(1.5);
  deck.insert(tapeFromCas("ours", cas));
  deck.press("play", m.t);
  type("CLOAD\n");
  clock.step(0.5);
  for (let s = 0; s < 300 && m.motor; s += 0.5) clock.step(0.5);
  deck.stop(m.t);
  const loaded = m.screenText().filter(Boolean);
  m.on.port = (v, t) => amp.write(v, t, m.motor);
  type("RUN\n");
  const t0 = m.t;
  const at = () => (m.t - t0) / CLOCK_HZ;
  for (const [when, what, arg] of sc.acts ?? []) {
    while (at() < when) clock.step(0.01);
    const k = keyNamed(arg);
    if (what === "type") typist.type(arg);
    else if (k) (what === "hold" ? typist.hold : typist.release).call(typist, k.row, k.bit);
  }
  while (at() < sc.secs) clock.step(0.05);
  const levels = amp.take(t0, m.t);
  return { m, loaded, screen: m.screenText(), notes: levels ? levels.steps.length : 0 };
}

describe("our programs", () => {
  it("each has a section, a letter, and a scenario here; the sections are the menu's", () => {
    for (const s of SAMPLES) {
      assert.ok(SECTIONS.includes(s.section), s.id);
      assert.match(s.letter, /^[A-Z]$/, s.id);
      assert.ok(SCENARIOS[s.id], `${s.id} has a scenario`);
      assert.match(s.text, /\nRUN\n$/, `${s.id} ends with RUN`);
    }
    assert.equal(new Set(SAMPLES.map((s) => s.id)).size, SAMPLES.length);
    assert.ok(LONG > 0);
  });

  for (const s of SAMPLES) {
    it(`"${s.id}": on the keyboard; its tape is today's recording; loaded, it runs`, { skip: NO_ROM }, () => {
      assert.deepEqual(new Typist(/** @type {any} */ ({})).untypable(s.text), [], "every character has a key");
      const file = new URL(`../tapes/${s.id}.cas`, import.meta.url);
      assert.ok(existsSync(file), `tapes/${s.id}.cas (pnpm tapes ${s.id})`);
      const cas = new Uint8Array(readFileSync(file));
      const fresh = casFromTape(recordSampleTape(rom(), s, s.id));
      assert.deepEqual(cas, fresh, `tapes/${s.id}.cas is out of date: pnpm tapes ${s.id}`);
      assert.deepEqual(tapeInfo(cas), { kind: "basic", name: s.letter });
      const r = play(cas, SCENARIOS[s.id]);
      assert.ok(!r.loaded.some((l) => /ERROR|^\?/.test(l)), r.loaded.join(" | "));
      const errors = r.screen.filter((l) => /\?[A-Z/]{1,2} ERROR|ERROR IN \d+/.test(l));
      assert.deepEqual(errors, [], r.screen.join(" | "));
      const ok = SCENARIOS[s.id].expect(r.screen, r.m, r.notes);
      assert.ok(ok === true, typeof ok === "string" ? ok : r.screen.join(" | "));
    });
  }
});

describe("a visitor's BASIC file (Type in a BASIC file)", () => {
  const typist = new Typist(/** @type {any} */ ({}));
  /** @param {string | number[]} x */
  const parse = (x) => parseListing(typeof x === "string" ? new TextEncoder().encode(x) : new Uint8Array(x), (t) => typist.untypable(t));
  it("LST-1: a listing as people keep them: CRLF, tabs, blank lines, a byte-order mark, a Ctrl-Z, a last RUN, lower case", () => {
    assert.deepEqual(parse("﻿10 print \"hi\"\r\n\r\n20\tgoto 10\r\nRUN\r\n\x1a\x1a"), { text: '10 print "hi"\n20 goto 10\n' });
  });
  it("LST-2: the power operator written ^ or [ is typed with the ↑ key", () => {
    assert.deepEqual(parse("10 PRINT 2^3, 2[3\n"), { text: "10 PRINT 2{UP}3, 2{UP}3\n" });
  });
  it("LST-3: turned away, saying why: tokens, no line numbers, an empty file, a character with no key", () => {
    assert.equal(/** @type {any} */ (parse([0xff, 0x80, 0x42])).error, "notText", "Disk BASIC's tokens");
    assert.equal(/** @type {any} */ (parse([0xe9, 0x42, 0x0a, 0x00, 0x93, 0x00])).error, "notText", "Level II's: lines end with 00H");
    assert.equal(/** @type {any} */ (parse("PRINT 1\n")).error, "noNumbers");
    assert.equal(/** @type {any} */ (parse("")).error, "noNumbers");
    assert.deepEqual(parse("10 REM CAFÉ {X}\n"), { error: "untypable", chars: "É { }" });
  });
  it("LST-4: ↑ typed in a listing is Level II's power operator", { skip: NO_ROM }, () => {
    const s = new System({ rom: rom(), takeApart: [] });
    s.power(true);
    s.clock.step(1.5);
    typeKeys(s, "{ENTER}" + /** @type {{ text: string }} */ (parse("10 PRINT 2^3\nRUN\n")).text + "RUN\n");
    for (let t = 0; s.typist.busy && t < 60; t += 0.05) s.clock.step(0.05);
    s.clock.step(1);
    assert.ok(s.machine.screenText().includes(" 8"), s.machine.screenText().join(" | "));
  });
});
