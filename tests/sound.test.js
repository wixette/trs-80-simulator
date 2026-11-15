// SPDX-License-Identifier: Apache-2.0
//
// Sound from the cassette output (design/v0.0.3.md, S1): the amplifier plays the levels
// written to port FFH while the motor is off, and our tone routine, POKEd in from BASIC and
// called with USR, plays a note at its pitch.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Amplifier, level, render } from "../js/audio/amplifier.js";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { TONE_ADDR, TONE_BYTES, toneLines } from "../js/sim/tone.js";
import { NO_ROM, ready } from "./boot.js";

/** Rising zero crossings per second of a sampled wave. @param {Float32Array} s @param {number} rate */
function pitch(s, rate) {
  const ups = [];
  for (let i = 1; i < s.length; i++) if (s[i - 1] < 0 && s[i] >= 0) ups.push(i);
  return ups.length > 2 ? ((ups.length - 1) * rate) / (ups[ups.length - 1] - ups[0]) : 0;
}

describe("SND: the amplifier on the cassette output", () => {
  it("SND-1: port FFH's bits 0 and 1 are the output's level about the rest level; a held level is silent", () => {
    assert.deepEqual([0, 1, 2, 3].map(level), [0, 0.39, -0.46, 0]);
    const hp = { x: 0, y: 0 };
    const held = render({ t0: 0, t1: CLOCK_HZ, from: 0.39, steps: [] }, 8000, hp);
    assert.ok(Math.abs(held[held.length - 1]) < 0.001, "the coupling lets a steady level die away");
  });

  it("SND-2: writes while the motor runs are the tape's, not the amplifier's", () => {
    const a = new Amplifier();
    a.write(1, 100, true);
    a.write(2, 200, true);
    assert.equal(a.take(0, 1000), null);
    a.write(1, 1100, false);
    const f = a.take(1000, 2000);
    assert.deepEqual(f?.steps, [{ t: 1100, v: 0.39 }]);
  });

  it("SND-3: a square wave written at 500 Hz is heard at 500 Hz", () => {
    const a = new Amplifier();
    const half = CLOCK_HZ / 1000;
    for (let i = 0; i < 200; i++) a.write(i % 2 ? 2 : 1, Math.round(i * half), false);
    const f = /** @type {import("../js/audio/amplifier.js").Levels} */ (a.take(0, Math.round(200 * half)));
    assert.ok(Math.abs(pitch(render(f, 44100, { x: 0, y: 0 }), 44100) - 500) < 2);
  });
});

describe("SND: our tone routine, from BASIC", { skip: NO_ROM }, () => {
  it("SND-4: the loader POKEs the routine above BASIC's top of memory, and USR(76) for 440 cycles plays A (440 Hz) for about a second", () => {
    const b = ready();
    const program = [...toneLines(10, 10), "100 POKE 32752,184:POKE 32753,1:X=USR(76)", "110 PRINT \"DONE\""];
    b.type(program.join("\n") + "\n");
    const amp = new Amplifier();
    b.m.on.port = (v, t) => amp.write(v, t, b.m.motor);
    const t0 = b.m.t;
    b.type("RUN\n", 0);
    for (let i = 0; i < 400 && !b.screen().includes("DONE"); i++) b.run(0.01);
    assert.ok(b.screen().includes("DONE"), b.screen().join("\n"));
    for (let i = 0; i < TONE_BYTES.length; i++) assert.equal(b.m.read(TONE_ADDR + i), TONE_BYTES[i]);
    const f = /** @type {import("../js/audio/amplifier.js").Levels} */ (amp.take(t0, b.m.t));
    const notes = f.steps.filter((s, i) => s.v > 0 && i > 0);
    const hz = pitch(render(f, 44100, { x: 0, y: 0 }), 44100);
    assert.ok(Math.abs(hz - 440) < 6, `${hz} Hz`);
    const secs = (notes[notes.length - 1].t - notes[0].t) / CLOCK_HZ;
    assert.ok(secs > 0.95 && secs < 1.05, `${secs} s`);
    // BASIC carries on with its strings and stack below the routine
    b.type('A$="HELLO"+"THERE":PRINT A$\n');
    assert.ok(b.screen().includes("HELLOTHERE"));
    for (let i = 0; i < TONE_BYTES.length; i++) assert.equal(b.m.read(TONE_ADDR + i), TONE_BYTES[i]);
  });
});
