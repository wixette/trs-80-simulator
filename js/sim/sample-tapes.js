// SPDX-License-Identifier: Apache-2.0
//
// Our sample tapes (D7), recorded the way an owner made one: a Model I of its own, with
// the same ROM, types the program in and CSAVEs it onto a blank tape, so that nothing but
// the ROM's own output is on the tape. Well under a second each.

import { Tape } from "./cassette.js";
import { Clock } from "./clock.js";
import { Typist } from "./keys.js";
import { Machine } from "./machine.js";
import { Recorder } from "./recorder.js";
import { program } from "./samples.js";

/**
 * @param {Uint8Array} rom Level II
 * @param {import("./samples.js").Sample} sample
 * @param {string} name the tape's name, for the visitor
 * @returns {Tape}
 */
export function recordSampleTape(rom, sample, name) {
  const m = new Machine({ rom });
  const deck = new Recorder();
  m.tape = deck;
  const typist = new Typist(m);
  const clock = new Clock(m, [typist]);
  /** @param {string} text */
  const type = (text) => {
    typist.type(text);
    for (let s = 0; typist.busy && s < 120; s += 0.05) clock.step(0.05);
    typist.clear();
    clock.step(0.3);
  };
  m.power(true);
  clock.step(1.5);
  type("\n");
  clock.step(1.5);
  type(program(sample));
  const tape = new Tape(name);
  deck.insert(tape);
  deck.press("record", m.t);
  type(`CSAVE "${sample.letter}"\n`);
  clock.step(0.5);
  for (let s = 0; s < 60 && m.motor; s += 0.25) clock.step(0.25);
  deck.stop(m.t);
  deck.eject(m.t);
  return tape;
}
