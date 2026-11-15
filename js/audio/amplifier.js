// SPDX-License-Identifier: Apache-2.0
//
// The amplifier on the cassette output (design/v0.0.3.md, S1). The Model I has no speaker:
// its cassette output, port FFH bits 0 and 1, is a level the program sets, and owners moved
// the recorder's AUX lead to a small amplifier to hear their games and music. Here the
// amplifier is always connected and on: while the cassette motor is off, the levels written
// to port FFH are played. Pure logic, no Web Audio, so the tests can hear it.

import { CLOCK_HZ } from "../sim/machine.js";

/**
 * The output's level for port FFH's bits 0 and 1, about the rest level (0.46 V): 01 is
 * +0.85 V, 10 is 0 V, 00 and 11 are the rest level [rs-info cassette].
 * @param {number} bits port FFH's value
 */
export const level = (bits) => [0, 0.39, -0.46, 0][bits & 3];

/**
 * One frame of the amplifier's input: the level held from the frame's start, and each change
 * at its machine time.
 * @typedef {{ t0: number, t1: number, from: number, steps: { t: number, v: number }[] }} Levels
 */

/**
 * The frame as samples: the levels as a stepped wave, through the amplifier's coupling
 * capacitor (a high-pass, so a level held still is silent, as on the real amplifier).
 * @param {Levels} f
 * @param {number} rate samples per second
 * @param {{ x: number, y: number }} hp the filter's state, carried from frame to frame
 * @returns {Float32Array}
 */
export function render(f, rate, hp) {
  const n = Math.max(1, Math.round(((f.t1 - f.t0) / CLOCK_HZ) * rate));
  const out = new Float32Array(n);
  // a one-pole high-pass at about 30 Hz
  const a = 1 / (1 + (2 * Math.PI * 30) / rate);
  let v = f.from;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = f.t0 + (i / rate) * CLOCK_HZ;
    while (k < f.steps.length && f.steps[k].t <= t) v = f.steps[k++].v;
    const y = a * (hp.y + v - hp.x);
    hp.x = v;
    hp.y = y;
    out[i] = y;
  }
  return out;
}

/** Collects the levels written to port FFH while the motor is off, frame by frame. */
export class Amplifier {
  constructor() {
    /** The level now. */
    this.v = 0;
    /** @private the level at the start of this frame */
    this.from = 0;
    /** @private @type {{ t: number, v: number }[]} */
    this.steps = [];
  }

  /**
   * A write to port FFH.
   * @param {number} value
   * @param {number} t machine time
   * @param {boolean} motor whether the cassette motor runs (then the tape is heard instead)
   */
  write(value, t, motor) {
    const v = motor ? 0 : level(value);
    if (v === this.v) return;
    this.v = v;
    this.steps.push({ t, v });
  }

  /**
   * The frame from t0 to t1, and a fresh one begun.
   * @param {number} t0 @param {number} t1
   * @returns {Levels | null} null when it was silent
   */
  take(t0, t1) {
    const f = { t0, t1, from: this.from, steps: this.steps };
    this.steps = [];
    this.from = this.v;
    return f.steps.length || f.from !== 0 ? f : null;
  }
}
