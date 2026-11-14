// SPDX-License-Identifier: Apache-2.0
//
// The Z80, as the machine sees it: the vendored core (design/decisions.md, D3) behind a
// bus of four callbacks. Swapping the core changes this file only.

import { Z80 } from "../../vendor/z80js/z80.module.js";

/** @typedef {import("../../vendor/z80js/z80.module.js").Z80State} Z80State */
/** @typedef {import("../../vendor/z80js/z80.module.js").Z80Instance} Z80Instance */
/** @typedef {import("../../vendor/z80js/z80.module.js").Z80Core} Z80Core */

/**
 * @typedef {object} Bus
 * @property {(addr: number) => number} read
 * @property {(addr: number, value: number) => void} write
 * @property {(port: number) => number} input
 * @property {(port: number, value: number) => void} output
 */

/**
 * The registers as a programmer reads them: 8-bit registers and 16-bit pairs, the flags
 * as F's bits (S Z Y H X P/V N C, bit 7 to bit 0), the alternate set primed.
 * @typedef {object} Registers
 * @property {number} a @property {number} f @property {number} b @property {number} c
 * @property {number} d @property {number} e @property {number} h @property {number} l
 * @property {number} a_ @property {number} f_ @property {number} b_ @property {number} c_
 * @property {number} d_ @property {number} e_ @property {number} h_ @property {number} l_
 * @property {number} ix @property {number} iy @property {number} sp @property {number} pc
 * @property {number} i @property {number} r
 * @property {number} im interrupt mode, 0-2
 * @property {boolean} iff1 interrupts enabled
 * @property {boolean} halted
 */

/** @param {Z80State["flags"]} f */
const packFlags = (f) => (f.S << 7) | (f.Z << 6) | (f.Y << 5) | (f.H << 4) | (f.X << 3) | (f.P << 2) | (f.N << 1) | f.C;

export class Cpu {
  /** @param {Bus} bus */
  constructor(bus) {
    /** @type {Z80Core} */
    const core = { mem_read: bus.read, mem_write: bus.write, io_read: bus.input, io_write: bus.output };
    // Z80.js's constructor checks `this === window`, which throws where there is no window
    // (Node, workers). A stand-in global is lent for that one call.
    const g = /** @type {Record<string, unknown>} */ (globalThis);
    const lend = !("window" in g);
    if (lend) g.window = {};
    try {
      const Make = /** @type {new (core: Z80Core) => Z80Instance} */ (/** @type {unknown} */ (Z80));
      /** @private */
      this.z = new Make(core);
    } finally {
      if (lend) delete g.window;
    }
  }

  /** The Z80's reset: PC 0000H, interrupts off, mode 0. */
  reset() {
    this.z.reset();
  }

  /** Runs one instruction. @returns {number} its T-states */
  step() {
    return this.z.run_instruction();
  }

  /** The non-maskable interrupt: the Model I's RESET button. */
  nmi() {
    this.z.interrupt(true, 0);
  }

  /** Where the next instruction is. */
  get pc() {
    return this.z.getState().pc;
  }

  /** @returns {Registers} */
  registers() {
    const s = this.z.getState();
    return {
      a: s.a, f: packFlags(s.flags), b: s.b, c: s.c, d: s.d, e: s.e, h: s.h, l: s.l,
      a_: s.a_prime, f_: packFlags(s.flags_prime), b_: s.b_prime, c_: s.c_prime, d_: s.d_prime, e_: s.e_prime, h_: s.h_prime, l_: s.l_prime,
      ix: s.ix, iy: s.iy, sp: s.sp, pc: s.pc, i: s.i, r: s.r, im: s.imode, iff1: !!s.iff1, halted: s.halted,
    };
  }
}
