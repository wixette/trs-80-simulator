// SPDX-License-Identifier: Apache-2.0
//
// The TRS-80 Model I itself: what is on its address and data buses, and port FF. No DOM,
// no three.js. Sources: RetroStack's netlist-checked reference [rs-info] (docs/video.md,
// keyboard.md, cassette.md) and research/how-it-worked.md, §2-6.
//
//   0000H-2FFFH  ROM, Level II BASIC (12 KB): ROM A (Z33) 0000H-1FFFH, ROM B (Z34) 2000H-2FFFH
//   3000H-37FFH  nothing on a bare machine (the Expansion Interface answers at 37E0H-37FFH)
//   3800H-3BFFH  the keyboard: address lines A0-A7 select rows, D0-D7 return their keys
//   3C00H-3FFFH  the video RAM, 1,024 bytes: seven bits stored, bit 6 rebuilt as NOR(5, 7)
//   4000H-7FFFH  user RAM, 16 KB (4000H-4FFFH with 4 KB)
//   8000H-FFFFH  nothing (the Expansion Interface's RAM)
//   port FFH     out: bits 0-1 the cassette's level, bit 2 the motor relay, bit 3 32 columns
//                in:  bit 7 the cassette flip-flop, cleared by any write to port FFH
//
// There is no interrupt on a bare Model I: the ROM times its keyboard debounce and its
// cassette bits by counting instructions, so machine time here is the CPU's T-states.

import { Cpu } from "./cpu.js";

/**
 * The CPU's clock, 1.77408 MHz: the 10.6445 MHz crystal divided by six [rs-info],
 * research/data/machine_facts.json, cpu.
 */
export const CLOCK_HZ = 1_774_080;

/** The byte the video RAM gives back: seven bits kept, bit 6 rebuilt as NOR(bit 5, bit 7) [rs-info video]. @param {number} b */
export const videoReadBack = (b) => (b & 0xbf) | (b & 0xa0 ? 0 : 0x40);

/** Where the video RAM starts, and its size. */
export const VIDEO = 0x3c00;
/** Level II's keyboard driver, which scans the matrix [rs-info keyboard]: its first and last addresses. */
const KEYBOARD_DRIVER = [0x03e3, 0x045f];
export const VIDEO_SIZE = 1024;

/**
 * The memory map, for the CPU & Memory tool. `chip` names the parts on the main board
 * (model/params/board.json) that answer there.
 * @typedef {{ id: "romA" | "romB" | "none" | "ei" | "keyboard" | "video" | "ram" | "high", start: number, end: number, chips: string[] }} Region
 * @type {readonly Region[]}
 */
export const REGIONS = [
  { id: "romA", start: 0x0000, end: 0x1fff, chips: ["z33"] },
  { id: "romB", start: 0x2000, end: 0x2fff, chips: ["z34"] },
  { id: "none", start: 0x3000, end: 0x37df, chips: [] },
  { id: "ei", start: 0x37e0, end: 0x37ff, chips: [] },
  { id: "keyboard", start: 0x3800, end: 0x3bff, chips: [] },
  { id: "video", start: 0x3c00, end: 0x3fff, chips: ["z45", "z46", "z47", "z48", "z61", "z62", "z63"] },
  { id: "ram", start: 0x4000, end: 0x7fff, chips: ["z13", "z14", "z15", "z16", "z17", "z18", "z19", "z20"] },
  { id: "high", start: 0x8000, end: 0xffff, chips: [] },
];

/**
 * @typedef {object} MachineEvents
 * @property {(addr: number, byte: number) => void} [video] a byte written to the video RAM, as read back
 * @property {(value: number, t: number) => void} [port] a write to port FFH, at machine time t
 * @property {(on: boolean) => void} [motor] the cassette motor relay closed or opened
 * @property {(on: boolean) => void} [mode32] 32-column mode on or off
 * @property {(rows: number, value: number) => void} [scan] the keyboard was read: the rows selected (A0-A7, a bit mask) and the byte returned
 * @property {(on: boolean) => void} [power] the computer switched on or off
 */

/**
 * The cassette recorder, as the computer sees it through the DIN cable (EAR, AUX, REM).
 * @typedef {object} TapePort
 * @property {(t: number) => boolean} pulseSince whether a pulse reached the computer since the last call
 * @property {(t: number) => boolean} activeAt whether a pulse is under the head at t
 * @property {(value: number, t: number) => void} portWrite the computer wrote port FFH
 * @property {(on: boolean, t: number) => void} setRelay the motor relay (REM)
 */

/**
 * Memory traffic by region since it was last cleared, for lighting the chips and the
 * memory map. Opcode fetches count as reads.
 * @typedef {{ romA: number, romB: number, keyboard: number, videoRead: number, videoWrite: number, ramRead: number, ramWrite: number }} Traffic
 */

/** @returns {Traffic} */
const noTraffic = () => ({ romA: 0, romB: 0, keyboard: 0, videoRead: 0, videoWrite: 0, ramRead: 0, ramWrite: 0 });

export class Machine {
  /**
   * @param {object} [options]
   * @param {Uint8Array} [options.rom] 12 KB at 0000H; without it the CPU reads FFH there
   * @param {4 | 16} [options.ramKb]
   */
  constructor({ rom, ramKb = 16 } = {}) {
    /** @readonly */
    this.rom = new Uint8Array(0x3000).fill(0xff);
    if (rom) this.rom.set(rom.subarray(0, 0x3000));
    /** The first address past the user RAM. @readonly */
    this.ramTop = 0x4000 + ramKb * 1024;
    /** @readonly */
    this.ram = new Uint8Array(0x10000 - 0x4000);
    /** The video RAM as stored: seven bits, bit 6 always 0. @readonly */
    this.vram = new Uint8Array(VIDEO_SIZE);
    /** The keyboard matrix: one byte per row, a set bit a closed switch. @readonly */
    this.rows = new Uint8Array(8);
    /** @type {MachineEvents} */
    this.on = {};
    /** Machine time in T-states since power on. */
    this.t = 0;
    this.powered = false;
    /** The last byte written to port FFH. */
    this.portFF = 0;
    this.motor = false;
    this.mode32 = false;
    /** When the keyboard's row 0 was last read (the ROM reads it while waiting for a key), T-states. */
    this.scanT = -1;
    /** When the keyboard was last read at all, T-states. */
    this.anyScanT = -1;
    /** When each keyboard row was last read, by the ROM or by a program reading the keys itself, T-states. */
    this.rowScanT = [-1, -1, -1, -1, -1, -1, -1, -1];
    /** When each row was last read by the program itself (PEEK, or its own machine code), not by Level II's keyboard driver, T-states. */
    this.ownScanT = [-1, -1, -1, -1, -1, -1, -1, -1];
    /** @type {Traffic} */
    this.traffic = noTraffic();
    /** @type {TapePort | null} */
    this.tape = null;
    /** The cassette input flip-flop: set by a pulse from the tape, cleared by OUT (FFH). */
    this.tapeLatch = false;
    /** @private */
    this.cpu = new Cpu({
      read: (a) => this.read(a),
      write: (a, v) => this.write(a, v),
      input: (p) => this.input(p),
      output: (p, v) => this.output(p, v),
    });
  }

  /**
   * Puts a ROM image in place (12 KB at 0000H). Only with the power off, as on the real
   * machine, where changing ROMs meant switching off and opening the case (D2).
   * @param {Uint8Array} rom
   * @returns {boolean} false, and nothing changed, if the computer is on
   */
  setRom(rom) {
    if (this.powered) return false;
    this.rom.fill(0xff);
    this.rom.set(rom.subarray(0, 0x3000));
    return true;
  }

  /** Reads and clears the memory traffic. @returns {Traffic} */
  takeTraffic() {
    const t = this.traffic;
    this.traffic = noTraffic();
    return t;
  }

  /** The CPU's read: counts traffic and, for the keyboard, when each row was read. @param {number} addr */
  read(addr) {
    if (addr < 0x3000) {
      if (addr < 0x2000) this.traffic.romA++;
      else this.traffic.romB++;
      return this.rom[addr];
    }
    if (addr < 0x3800) return 0xff;
    if (addr < VIDEO) return this.readKeyboard(addr);
    if (addr < 0x4000) {
      this.traffic.videoRead++;
      return videoReadBack(this.vram[addr - VIDEO]);
    }
    if (addr < this.ramTop) {
      this.traffic.ramRead++;
      return this.ram[addr - 0x4000];
    }
    return 0xff;
  }

  /**
   * What the CPU would read at an address, with no side effect: for the tools. The keyboard
   * shows what all its selected rows return.
   * @param {number} addr
   */
  peek(addr) {
    addr &= 0xffff;
    if (addr < 0x3000) return this.rom[addr];
    if (addr < 0x3800) return 0xff;
    if (addr < VIDEO) return this.matrix(addr & 0xff);
    if (addr < 0x4000) return videoReadBack(this.vram[addr - VIDEO]);
    if (addr < this.ramTop) return this.ram[addr - 0x4000];
    return 0xff;
  }

  /**
   * The CPU's write. ROM, the keyboard and the empty space ignore it.
   * @param {number} addr
   * @param {number} value
   */
  write(addr, value) {
    if (addr >= VIDEO && addr < 0x4000) {
      this.traffic.videoWrite++;
      this.vram[addr - VIDEO] = value & 0xbf;
      this.on.video?.(addr, videoReadBack(value));
    } else if (addr >= 0x4000 && addr < this.ramTop) {
      this.traffic.ramWrite++;
      this.ram[addr - 0x4000] = value;
    }
  }

  /**
   * What the keyboard puts on the data bus for a set of selected rows. With no diodes in
   * the matrix [rs-info keyboard], current runs from a selected row through any closed
   * switch to its column, and on through any other closed switch on that column to another
   * row, which then pulls its own columns too: with three keys down at three corners of a
   * rectangle, the fourth corner reads as down (a ghost key).
   * @param {number} sel the rows selected, A0-A7
   */
  matrix(sel) {
    let rows = sel;
    let cols = 0;
    for (;;) {
      let c = cols;
      for (let r = 0; r < 8; r++) if (rows & (1 << r)) c |= this.rows[r];
      let more = rows;
      for (let r = 0; r < 8; r++) if (this.rows[r] & c) more |= 1 << r;
      if (c === cols && more === rows) return cols;
      cols = c;
      rows = more;
    }
  }

  /** @private @param {number} addr */
  readKeyboard(addr) {
    const sel = addr & 0xff;
    if (sel & 0x01) this.scanT = this.t;
    this.anyScanT = this.t;
    for (let r = 0; r < 8; r++) if (sel & (1 << r)) this.rowScanT[r] = this.t;
    // Level II's keyboard driver (03E3H-045FH) scans every row between statements, for BREAK
    const pc = this.cpu.pc;
    if (pc < KEYBOARD_DRIVER[0] || pc > KEYBOARD_DRIVER[1]) for (let r = 0; r < 8; r++) if (sel & (1 << r)) this.ownScanT[r] = this.t;
    this.traffic.keyboard++;
    const v = this.matrix(sel);
    this.on.scan?.(sel, v);
    return v;
  }

  /** Pulses from the tape since the last look set the flip-flop. @private */
  pollTape() {
    if (this.tape?.pulseSince(this.t)) this.tapeLatch = true;
  }

  /** @param {number} port */
  input(port) {
    if ((port & 0xff) === 0xff) {
      this.pollTape();
      return (this.tapeLatch ? 0x80 : 0) | 0x7f;
    }
    return 0xff;
  }

  /**
   * @param {number} port
   * @param {number} value
   */
  output(port, value) {
    if ((port & 0xff) !== 0xff) return;
    this.pollTape(); // a pulse that came before this write is cleared by it...
    this.portFF = value;
    // ...unless it is under the head now: its comparator holds the flip-flop set (D13)
    this.tapeLatch = !!this.tape?.activeAt(this.t);
    this.tape?.portWrite(value, this.t);
    this.on.port?.(value, this.t);
    const motor = (value & 0x04) !== 0;
    if (motor !== this.motor) {
      this.motor = motor;
      this.tape?.setRelay(motor, this.t);
      this.on.motor?.(motor);
    }
    const m32 = (value & 0x08) !== 0;
    if (m32 !== this.mode32) {
      this.mode32 = m32;
      this.on.mode32?.(m32);
    }
  }

  /** @param {number} row @param {number} bit */
  keyDown(row, bit) {
    this.rows[row] |= 1 << bit;
  }

  /** @param {number} row @param {number} bit */
  keyUp(row, bit) {
    this.rows[row] &= ~(1 << bit);
  }

  /**
   * Power on or off. On: memory cleared (D12), the CPU from 0000H, port FFH at 0.
   * @param {boolean} on
   */
  power(on) {
    if (on === this.powered) return;
    this.powered = on;
    if (this.motor) {
      // no power, no relay; and a fresh start opens it too
      this.tape?.setRelay(false, this.t);
      this.motor = false;
      this.on.motor?.(false);
    }
    if (this.mode32) {
      this.mode32 = false;
      this.on.mode32?.(false);
    }
    if (on) {
      this.ram.fill(0);
      this.vram.fill(0);
      for (let i = 0; i < VIDEO_SIZE; i++) this.on.video?.(VIDEO + i, videoReadBack(0));
      this.t = 0;
      this.portFF = 0;
      this.tapeLatch = false;
      this.scanT = this.anyScanT = -1;
      this.rowScanT.fill(-1);
      this.ownScanT.fill(-1);
      this.traffic = noTraffic();
      this.cpu.reset();
    }
    this.on.power?.(on);
  }

  /** The RESET button: a non-maskable interrupt. Level II restarts at READY and keeps the program. */
  reset() {
    if (this.powered) this.cpu.nmi();
  }

  /**
   * Runs whole instructions for at least `tStates` T-states, if powered.
   * @param {number} tStates
   * @param {ReadonlySet<number>} [stops] addresses to stop at, before running the instruction there
   * @returns {number} the T-states run; fewer than asked if it reached a stop
   */
  run(tStates, stops) {
    if (!this.powered) return 0;
    const start = this.t;
    const end = start + tStates;
    if (stops && stops.size) {
      while (this.t < end) {
        if (this.t > start && stops.has(this.cpu.pc)) break;
        this.t += this.cpu.step();
      }
    } else {
      while (this.t < end) this.t += this.cpu.step();
    }
    return this.t - start;
  }

  /** Runs one instruction, if powered. @returns {number} its T-states */
  stepInstruction() {
    if (!this.powered) return 0;
    const n = this.cpu.step();
    this.t += n;
    return n;
  }

  /** Where the next instruction is. */
  get pc() {
    return this.cpu.pc;
  }

  /** @returns {import("./cpu.js").Registers} */
  registers() {
    return this.cpu.registers();
  }

  /**
   * The screen as text, for tests and checks: 16 lines of 64 characters, graphics as "#" (a
   * blank one as a space, as it looks), control codes as the letters the character generator
   * shows for them; trailing spaces trimmed.
   * @returns {string[]}
   */
  screenText() {
    const lines = [];
    for (let r = 0; r < 16; r++) {
      let s = "";
      for (let c = 0; c < 64; c++) {
        const b = videoReadBack(this.vram[r * 64 + c]);
        s += b >= 0x80 ? ((b & 0x3f) === 0 ? " " : "#") : String.fromCharCode(b < 0x20 ? b + 0x40 : b);
      }
      lines.push(s.trimEnd());
    }
    return lines;
  }
}
