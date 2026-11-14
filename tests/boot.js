// SPDX-License-Identifier: Apache-2.0
//
// A headless Model I for the tests: the machine with Level II, the clock, and a typist.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Clock } from "../js/sim/clock.js";
import { Typist } from "../js/sim/keys.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";

export const ROM_FILE = fileURLToPath(new URL("../roms/level2-v12.bin", import.meta.url));
/** A reason to skip the tests that need the ROM, or false. */
export const NO_ROM = !existsSync(ROM_FILE) && "roms/level2-v12.bin is missing (pnpm vendor)";

/** The Level II image. */
export const rom = () => new Uint8Array(readFileSync(ROM_FILE));

/**
 * A Model I with Level II, switched on, with a clock and a typist.
 * @param {{ ramKb?: 4 | 16 }} [options]
 */
export function boot(options = {}) {
  const m = new Machine({ rom: rom(), ...options });
  const typist = new Typist(m);
  const clock = new Clock(m, [typist]);
  m.power(true);
  /** Runs `seconds` of machine time. @param {number} seconds */
  const run = (seconds) => clock.step(seconds);
  /** Types text, runs until it is all typed, then a moment more. @param {string} text @param {number} [after] */
  const type = (text, after = 0.3) => {
    typist.type(text);
    for (let i = 0; i < 3000 && typist.busy; i++) run(0.01);
    run(after);
  };
  /** The screen's lines that are not blank. */
  const screen = () => m.screenText().filter(Boolean);
  return { m, typist, clock, run, type, screen };
}

/** Boots to READY: 1.5 s to MEMORY SIZE?, then ENTER. @param {{ ramKb?: 4 | 16 }} [options] */
export function ready(options) {
  const b = boot(options);
  b.run(1.5);
  b.type("\n", 1.5); // Level II sizes the memory first, about 0.6 s on 16 KB
  return b;
}

export { CLOCK_HZ };
