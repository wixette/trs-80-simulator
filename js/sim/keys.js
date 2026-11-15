// SPDX-License-Identifier: Apache-2.0
//
// Typing on the Model I: switches closed and opened at machine times (T-states).
//
// Level II debounces the keys by delay loops (18.8 ms and 51.3 ms [rs-info keyboard]), so
// a key must stay down, and then up, long enough in *machine* time, however slowly the
// page's frames come: 70 ms each, measured in T-states. Characters are typed through the
// Model I's own keys (js/sim/keymap.js), so a typed `"` is SHIFT 2 and `@` is unshifted.
//
// Like a person reading the screen, the typist waits for the program before each key
// (D15): a queued keystroke starts only once the keyboard has been read since it fell due,
// at row 0 (the ROM's scan for a key) or at the key's own row (a game reading the keys
// itself; for a shifted character, SHIFT's row, which goes down first). While BASIC is busy
// (setting up after MEMORY SIZE?, storing a line, loading a tape) it does not read the
// keyboard, and a key pressed then is lost on the real machine too; the typist waits instead,
// up to 10 s. (A running BASIC program is not busy in this sense: Level II scans every row
// between statements, for BREAK.)
//
// A key held by hand (a click or a touch on one in 3D or 2D) goes down at once and up when let
// go, after KEY_DOWN_T and once the program has read its row (D18), apart from the typed queue.

import { CLOCK_HZ } from "./machine.js";
import { SHIFT, STROKES } from "./keymap.js";

/** How long a key is held down, and then kept up before the next, in T-states. */
export const KEY_DOWN_T = Math.round(0.07 * CLOCK_HZ);
export const KEY_UP_T = Math.round(0.07 * CLOCK_HZ);
/** How long a keystroke waits for its own row while the program reads only other rows. */
export const GATE_MAX_T = Math.round(0.5 * CLOCK_HZ);
/** The longest a key let go is kept down waiting for the program to read its row (D18). */
export const READ_MAX_T = Math.round(0.5 * CLOCK_HZ);

/**
 * Whether the program has read a key's row since the key went down (D18). A program that
 * reads the row itself (a game's PEEK, its own machine code) must have read it: Level II's
 * keyboard driver, which scans every row between statements for BREAK, counts only for a
 * program that takes its keys from the driver (INKEY$, INPUT). A switch matrix with no scan
 * times (a test's) has always been read.
 * @param {{ rowScanT?: number[], ownScanT?: number[] }} m @param {number} row @param {number} since
 */
export function readSince(m, row, since) {
  const own = m.ownScanT?.[row] ?? -1;
  const scans = own >= 0 && own > since - READ_MAX_T ? m.ownScanT : m.rowScanT;
  return !scans || scans[row] > since;
}

/** The longest a keystroke waits while the program reads no keys at all. */
export const GATE_IDLE_MAX_T = Math.round(10 * CLOCK_HZ);

/** @typedef {import("./keymap.js").Stroke} Stroke */
/** @typedef {{ at: number, down: boolean, row: number, bit: number, gate?: boolean }} SwitchEvent a switch change; `gate` marks a keystroke's start, which waits for the program */

/**
 * @typedef {object} Switches
 * @property {(row: number, bit: number) => void} keyDown
 * @property {(row: number, bit: number) => void} keyUp
 * @property {number} t machine time, T-states
 * @property {number} scanT when row 0 was last read
 * @property {number[]} rowScanT when each row was last read
 * @property {number[]} [ownScanT] when each row was last read by the program itself (D18)
 * @property {number} anyScanT when the keyboard was last read at all
 */

/** Normalises text for typing: upper case, line ends as "\n". @param {string} text */
const normal = (text) => text.toUpperCase().replace(/\r\n?/g, "\n");

/** A queue of keystrokes, each held and released for whole intervals of machine time. */
export class Typist {
  /** @param {Switches} machine */
  constructor(machine) {
    /** @private */
    this.m = machine;
    /** @private @type {SwitchEvent[]} */
    this.events = [];
    /** @private when the last queued event happens */
    this.until = 0;
    /** @private keys held by hand (a click on a key), and when each went down @type {Map<string, number>} */
    this.held = new Map();
    /** @private keys held by hand and let go, waiting to be let up (KEY_DOWN_T, and a read: D18), apart from the typed queue, which may wait on the program @type {{ at: number, since: number, row: number, bit: number }[]} */
    this.releases = [];
  }

  /** True while typed strokes are waiting (a key held by hand is not typing). */
  get busy() {
    return this.events.length > 0;
  }

  /** The characters of a text this keyboard cannot type (it has no lower case: those are typed as capitals). @param {string} text */
  untypable(text) {
    return [...new Set([...normal(text)].filter((c) => !STROKES.has(c)))];
  }

  /**
   * Queues text, upper-cased; characters the keyboard lacks are skipped.
   * @param {string} text
   * @returns {number} the characters queued
   */
  type(text) {
    let n = 0;
    for (const c of normal(text)) {
      const s = STROKES.get(c);
      if (!s) continue;
      this.stroke(s);
      n++;
    }
    return n;
  }

  /** Queues one keystroke at a matrix position, with or without SHIFT. @param {Stroke} s */
  stroke(s) {
    let at = Math.max(this.until, this.m.t);
    if (s.shift) this.events.push({ at, down: true, ...SHIFT, gate: true });
    this.events.push({ at, down: true, row: s.row, bit: s.bit, gate: !s.shift });
    at += KEY_DOWN_T;
    this.events.push({ at, down: false, row: s.row, bit: s.bit });
    if (s.shift) this.events.push({ at, down: false, ...SHIFT });
    this.until = at + KEY_UP_T;
  }

  /**
   * A key held by hand (a click or a touch on a key): down now, up at release, but never
   * sooner than KEY_DOWN_T after it went down, nor before the program has read its row (for up
   * to READ_MAX_T, D18), so the program always sees it.
   * @param {number} row @param {number} bit
   */
  hold(row, bit) {
    this.releases = this.releases.filter((r) => r.row !== row || r.bit !== bit);
    this.m.keyDown(row, bit);
    this.held.set(`${row}.${bit}`, this.m.t);
  }

  /** Whether a key is held by hand now (SHIFT latched, in 3D or 2D alike). @param {number} row @param {number} bit */
  isHeld(row, bit) {
    return this.held.has(`${row}.${bit}`);
  }

  /** @param {number} row @param {number} bit */
  release(row, bit) {
    const since = this.held.get(`${row}.${bit}`) ?? this.m.t;
    this.held.delete(`${row}.${bit}`);
    const at = Math.max(this.m.t, since + KEY_DOWN_T);
    this.releases.push({ at, since, row, bit });
    this.until = Math.max(this.until, at + KEY_UP_T);
  }

  /** Applies every event due by now; called before each slice the clock runs. */
  tick() {
    if (this.releases.length) {
      const t = this.m.t;
      const due = this.releases.filter((r) => t >= r.at && (readSince(this.m, r.row, r.since) || t >= r.since + READ_MAX_T));
      for (const r of due) this.m.keyUp(r.row, r.bit);
      if (due.length) this.releases = this.releases.filter((r) => !due.includes(r));
    }
    while (this.events.length && this.events[0].at <= this.m.t) {
      const first = this.events[0];
      if (first.gate) {
        const seen = Math.max(this.m.scanT, this.m.rowScanT[first.row]);
        const waited = this.m.t - first.at;
        const otherRows = this.m.anyScanT >= first.at;
        if (seen < first.at && waited < (otherRows ? GATE_MAX_T : GATE_IDLE_MAX_T)) return;
        // it starts now: everything still queued moves on by the wait
        for (const e of this.events) e.at += waited;
        this.until += waited;
        first.gate = false;
      }
      const e = /** @type {SwitchEvent} */ (this.events.shift());
      if (e.down) this.m.keyDown(e.row, e.bit);
      else this.m.keyUp(e.row, e.bit);
    }
  }

  /** T-states until the next event, or Infinity. */
  next() {
    const typed = this.events.length ? Math.max(0, this.events[0].at - this.m.t) : Infinity;
    // a release waiting for a read is checked at each slice (1 ms at most)
    const hand = this.releases.length ? Math.max(0, Math.min(...this.releases.map((r) => (this.m.t < r.at ? r.at : r.since + READ_MAX_T))) - this.m.t) : Infinity;
    return Math.min(typed, hand);
  }

  /** Drops everything queued, and opens every switch it closed. */
  clear() {
    for (const e of this.events) if (!e.down) this.m.keyUp(e.row, e.bit);
    for (const r of this.releases) this.m.keyUp(r.row, r.bit);
    this.releases = [];
    for (const k of this.held.keys()) {
      const [row, bit] = k.split(".").map(Number);
      this.m.keyUp(row, bit);
    }
    this.held.clear();
    this.events = [];
    this.until = 0;
  }
}
