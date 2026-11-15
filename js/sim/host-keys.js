// SPDX-License-Identifier: Apache-2.0
//
// The visitor's own keyboard as the Model I's (docs/ui-design.md, U5). A key held down
// holds the Model I key for as long as it is held, so a game that polls the matrix sees
// keys held, and several at once. Each key goes to the Model I key that types the same
// character (a `"` is SHIFT 2 on the Model I, whatever the visitor's layout), so the Model
// I's SHIFT is worked out from the keys held, not copied from the visitor's:
//
// - while character keys are held, SHIFT is down if any of them needs it (`@` on a US
//   keyboard is Shift 2, but the Model I's @ is unshifted, so SHIFT goes up);
// - otherwise SHIFT follows the visitor's Shift, alone or with ENTER, the arrows, BREAK
//   or CLEAR (SHIFT ← erases the line in Level II).
//
// A key is never released sooner than KEY_DOWN_T of machine time after it went down, so a
// quick tap still passes Level II's debounce. A key pressed while an earlier tap is still
// being held for that reason waits its turn, KEY_UP_T after the earlier one is let go: fast
// typing then reaches BASIC letter by letter, as Level II reads one key at a time, while keys
// that are really held together (a game's arrow and SPACE) are down together (D17).
//
// Nor is a key let go before the program has read its row since it went down, for up to
// READ_MAX_T: a game reads the keys only at moments of its loop (BASIC between drawing and
// beeping), and a quick tap that fell between two reads would be lost, though the Keyboard
// tool showed it pressed. A program that reads the row itself (PEEK, or its own machine code)
// must read it; Level II's keyboard driver, which scans every row between statements for
// BREAK, does not count for it, but does for a program that takes its keys from the driver
// (INKEY$, INPUT). On a real Model I the owner learned to hold a key a little longer;
// here every press is seen once. Keys pressed while the program reads no keys at all are
// still missed after READ_MAX_T, as on the real machine.

import { KEY_DOWN_T, KEY_UP_T, READ_MAX_T, readSince } from "./keys.js";
import { keyNamed, SHIFT, STROKES } from "./keymap.js";

export { READ_MAX_T };

/** The visitor's keys that are not characters, by `KeyboardEvent.key`, to Model I key names. */
export const SPECIAL_KEYS = /** @type {Record<string, string>} */ ({
  Enter: "ENTER",
  Backspace: "LEFT",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  Escape: "BREAK",
  Home: "CLEAR",
  Delete: "CLEAR",
  " ": "SPACE",
});

/** @typedef {{ keyDown: (row: number, bit: number) => void, keyUp: (row: number, bit: number) => void, t: number, rowScanT?: number[], ownScanT?: number[] }} Matrix `rowScanT`: when each row was last read; `ownScanT`: by the program itself, not Level II's keyboard driver */
/** @typedef {{ code: string, at: number, row: number, since: number }} Pending a release waiting for `at` and for the program to read `row` after `since` */
/** @typedef {{ row: number, bit: number, shift: boolean | null, since: number }} Held `shift` null: follows the visitor's Shift */

/** @param {number} row @param {number} bit */
const id = (row, bit) => `${row}.${bit}`;

export class HostKeys {
  /** @param {Matrix} machine */
  constructor(machine) {
    /** @private */
    this.m = machine;
    /** @private held keys, by the visitor's `KeyboardEvent.code` @type {Map<string, Held>} */
    this.held = new Map();
    /** @private releases waiting for KEY_DOWN_T to pass and the key's row to be read @type {Pending[]} */
    this.pending = [];
    /** @private keys waiting for an earlier tap to be let go; `released`: already let go by the visitor @type {{ code: string, key: { row: number, bit: number, shift: boolean | null }, released: boolean }[]} */
    this.queue = [];
    /** @private when this object last let a key go, machine time */
    this.lastUp = -Infinity;
    /** @private the visitor's Shift */
    this.shift = false;
    /** @private what this object has closed in the matrix @type {Set<string>} */
    this.closed = new Set();
  }

  /**
   * The Model I key for a key event, or null if the Model I has none.
   * @param {{ key: string }} e
   * @returns {{ row: number, bit: number, shift: boolean | null } | null}
   */
  lookup(e) {
    const name = SPECIAL_KEYS[e.key];
    if (name) {
      const k = keyNamed(name);
      return k ? { row: k.row, bit: k.bit, shift: null } : null;
    }
    if (e.key.length !== 1) return null;
    const s = STROKES.get(e.key.toUpperCase());
    return s ? { row: s.row, bit: s.bit, shift: s.shift } : null;
  }

  /**
   * A key of the visitor's went down. Returns false if the Model I has no such key.
   * @param {{ key: string, code: string, repeat?: boolean }} e
   */
  down(e) {
    if (e.key === "Shift") {
      this.shift = true;
      this.apply();
      return true;
    }
    if (e.repeat && (this.held.has(e.code) || this.queue.some((q) => q.code === e.code))) return true;
    const k = this.lookup(e);
    if (!k) return false;
    if (this.debouncing() || this.queue.length || this.m.t < this.lastUp + KEY_UP_T) {
      // an earlier tap is still held for the debounce: this one waits its turn
      this.queue.push({ code: e.code, key: k, released: false });
      return true;
    }
    this.pending = this.pending.filter((p) => p.code !== e.code);
    this.held.set(e.code, { ...k, since: this.m.t });
    this.apply();
    return true;
  }

  /** A key of the visitor's went up. @param {{ key: string, code: string }} e */
  up(e) {
    if (e.key === "Shift") {
      this.shift = false;
      this.apply();
      return;
    }
    const q = this.queue.find((x) => x.code === e.code && !x.released);
    if (q) {
      q.released = true;
      return;
    }
    const h = this.held.get(e.code);
    if (!h) return;
    const p = { code: e.code, at: h.since + KEY_DOWN_T, row: h.row, since: h.since };
    if (this.due(p)) {
      this.held.delete(e.code);
      this.lastUp = this.m.t;
      this.apply();
    } else this.pending.push(p);
  }

  /** Lets go of everything (the page lost the focus). */
  releaseAll() {
    this.held.clear();
    this.pending = [];
    this.queue = [];
    // the machine's time may start again from 0 (a power cycle): no old key-up holds up the next
    this.lastUp = -Infinity;
    this.shift = false;
    this.apply();
  }

  /** @private Whether a tap is still held for the debounce (a key only waiting to be read holds up no other). */
  debouncing() {
    return this.pending.some((p) => this.m.t < p.at);
  }

  /** @private Whether a key let go may be released now: held long enough, and read since it went down (or waited long enough for that). @param {Pending} p */
  due(p) {
    const read = readSince(this.m, p.row, p.since);
    return this.m.t >= p.at && (read || this.m.t >= p.since + READ_MAX_T);
  }

  /** Releases keys held long enough, then presses the next waiting key; called before each slice the clock runs. */
  tick() {
    const due = this.pending.filter((p) => this.due(p));
    if (due.length) {
      this.pending = this.pending.filter((p) => !due.includes(p));
      for (const p of due) this.held.delete(p.code);
      this.lastUp = this.m.t;
      this.apply();
    }
    if (!this.debouncing() && this.queue.length && this.m.t >= this.lastUp + KEY_UP_T) {
      const q = /** @type {(typeof this.queue)[number]} */ (this.queue.shift());
      // pressed again: an earlier release of this key, still waiting, must not let this one go
      this.pending = this.pending.filter((p) => p.code !== q.code);
      this.held.set(q.code, { ...q.key, since: this.m.t });
      if (q.released) this.pending.push({ code: q.code, at: this.m.t + KEY_DOWN_T, row: q.key.row, since: this.m.t });
      this.apply();
    }
  }

  /** T-states until the next release or waiting key, or Infinity. */
  next() {
    // a release waiting for a read is checked at each slice, which is short (1 ms)
    const r = this.pending.length ? Math.min(...this.pending.map((p) => (this.m.t < p.at ? p.at : p.since + READ_MAX_T))) - this.m.t : Infinity;
    const q = this.queue.length && !this.debouncing() ? this.lastUp + KEY_UP_T - this.m.t : Infinity;
    return Math.max(0, Math.min(r, q));
  }

  /** The Model I keys held now, SHIFT included, as "row.bit". */
  get keys() {
    return new Set(this.closed);
  }

  /** @private puts the matrix in line with the keys held */
  apply() {
    const want = new Set();
    let chars = false;
    let shift = false;
    for (const h of this.held.values()) {
      want.add(id(h.row, h.bit));
      if (h.shift !== null) {
        chars = true;
        shift ||= h.shift;
      }
    }
    if (chars ? shift : this.shift) want.add(id(SHIFT.row, SHIFT.bit));
    for (const k of this.closed) {
      if (want.has(k)) continue;
      const [row, bit] = k.split(".").map(Number);
      this.m.keyUp(row, bit);
    }
    for (const k of want) {
      if (this.closed.has(k)) continue;
      const [row, bit] = k.split(".").map(Number);
      this.m.keyDown(row, bit);
    }
    this.closed = want;
  }
}
