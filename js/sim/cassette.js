// SPDX-License-Identifier: Apache-2.0
//
// The cassette tape and its format. No DOM, no audio.
//
// A tape here is what the ROM wrote, as pulses: the T-state positions along the tape where
// a pulse starts. The ROM makes each pulse with three writes to port FF: level 1 (+0.85 V),
// level 2 (0 V) about 227 T-states later, then rest (0.46 V) 227 later: PULSE_T in all.
// Reading, the input's comparator holds the flip-flop's set input for as long as the pulse
// lasts, so a write to port FF clears the flip-flop only when no pulse is under the head.
// That matters: after the sync byte the ROM clears it about 10 T-states after the next data
// pulse begins, and with a pulse taken as an instant the bit is lost and CLOAD fails
// (design/decisions.md, D13; tests/cassette.test.js, TAP-20 and TAP-21, which load through it).
//
// Level II (500 baud) writes every bit as a clock pulse and, for a 1, a data pulse about
// half a cell later [rs-info cassette]. Measured from its own CSAVE: cells of 3,570 T-states
// inside a byte, 3,700-3,774 at a byte's end, and 5,594 after the sync byte A5H while the
// ROM gets ready to read the rest; the data pulse 1,777-1,780 after its clock.
//
// A .cas file is the bytes the ROM writes (a leader of zeros, A5H, then the program), the
// form every TRS-80 emulator exchanges; encode() and decode() convert.

import { CLOCK_HZ } from "./machine.js";

/** A pulse's length on the tape, from its rise to the return to rest (measured: 454). */
export const PULSE_T = 454;
/** Level II's timing, in T-states, measured from its CSAVE (with margin where it varies). */
export const CELL_T = 3570;
export const HALF_T = 1778;
/** The last cell of a byte (the ROM's own: 3,700-3,774). */
export const BYTE_END_T = 3800;
/** The cell after the sync byte (the ROM's own: 5,594). */
export const SYNC_END_T = 5700;
/** A data pulse comes within this of its clock pulse. */
const DATA_WINDOW_T = 2600;
/** A silence longer than this ends a recording (blocks are separated by it). */
export const GAP_T = CELL_T * 20;

/** A tape: a name and its pulses, sorted, as positions in T-states from its start. */
export class Tape {
  /** @param {string} name @param {number[]} [pulses] */
  constructor(name, pulses = []) {
    /** What the visitor knows it by: a file's name, or our sample's. */
    this.name = name;
    /** @type {number[]} */
    this.pulses = pulses;
  }

  /** Where the last recording ends, T-states from the tape's start. */
  get end() {
    return this.pulses.length ? this.pulses[this.pulses.length - 1] : 0;
  }

  /** The first pulse at or after position p. @param {number} p */
  indexAt(p) {
    let lo = 0;
    let hi = this.pulses.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.pulses[mid] < p) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Replaces whatever was between from and to with new pulses (recording over the tape).
   * @param {number} from @param {number} to @param {number[]} pulses inside [from, to]
   */
  overwrite(from, to, pulses) {
    const a = this.indexAt(from);
    const b = this.indexAt(to);
    // not splice(a, n, ...pulses): a long recording (a CSAVE of 11 KB or more) has more pulses
    // than a call may take arguments
    this.pulses = this.pulses.slice(0, a).concat(pulses, this.pulses.slice(b));
  }

  /** Every recording on the tape, decoded to bytes (one array per block). */
  blocks() {
    /** @type {number[][]} */
    const out = [];
    let start = 0;
    for (let i = 1; i <= this.pulses.length; i++) {
      if (i === this.pulses.length || this.pulses[i] - this.pulses[i - 1] > GAP_T) {
        out.push(decode(this.pulses.slice(start, i)));
        start = i;
      }
    }
    return out.filter((b) => b.length);
  }
}

/**
 * Pulses (one recording) to bits: a pulse within DATA_WINDOW_T of a clock pulse is a 1.
 * Each bit with the position of its clock pulse.
 * @param {number[]} pulses
 * @returns {{ at: number, one: boolean }[]}
 */
export function bitsOf(pulses) {
  /** @type {{ at: number, one: boolean }[]} */
  const bits = [];
  let i = 0;
  while (i < pulses.length) {
    const next = pulses[i + 1];
    const one = next !== undefined && next - pulses[i] < DATA_WINDOW_T;
    bits.push({ at: pulses[i], one });
    i += one ? 2 : 1;
  }
  return bits;
}

/**
 * Where the bytes start in a recording's bits: the sync byte A5H after a run of zeros, as
 * the ROM finds it, shifting bit by bit (a recording's first bits may be noise). Returns
 * the bit index of the leader's first whole byte before the sync, or 0 with no sync.
 * @param {{ one: boolean }[]} bits
 */
export function syncBit(bits) {
  const A5 = [1, 0, 1, 0, 0, 1, 0, 1];
  for (let s = 8; s + 8 <= bits.length; s++) {
    if (!A5.every((b, k) => bits[s + k].one === !!b)) continue;
    let z = s;
    while (z > 0 && !bits[z - 1].one) z--;
    if (s - z < 8) continue; // no leader before it
    return s - Math.floor((s - z) / 8) * 8;
  }
  return 0;
}

/**
 * Pulses (one recording) to bytes, from the leader before the sync byte on.
 * @param {number[]} pulses
 * @returns {number[]}
 */
export function decode(pulses) {
  const bits = bitsOf(pulses);
  /** @type {number[]} */
  const bytes = [];
  for (let b = syncBit(bits); b + 8 <= bits.length; b += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = (v << 1) | (bits[b + k].one ? 1 : 0);
    bytes.push(v);
  }
  return bytes;
}

/**
 * Bytes to pulses at Level II's timing, starting at `at` (most significant bit first).
 * @param {ArrayLike<number>} bytes @param {number} at
 * @returns {number[]}
 */
export function encode(bytes, at) {
  /** @type {number[]} */
  const out = [];
  let t = at;
  let leader = true;
  for (let i = 0; i < bytes.length; i++) {
    const sync = leader && bytes[i] === 0xa5;
    if (bytes[i] !== 0) leader = false;
    for (let k = 7; k >= 0; k--) {
      out.push(t);
      if ((bytes[i] >> k) & 1) out.push(t + HALF_T);
      t += k > 0 ? CELL_T : sync ? SYNC_END_T : BYTE_END_T;
    }
  }
  return out;
}

/**
 * A tape holding a .cas file's bytes, after a second of blank leader tape.
 * @param {string} name @param {ArrayLike<number>} cas
 */
export function tapeFromCas(name, cas) {
  return new Tape(name, encode(cas, Math.round(CLOCK_HZ)));
}

/**
 * A tape's first recording as a .cas file (what the ROM wrote, from the leader on).
 * @param {Tape} tape
 * @returns {Uint8Array}
 */
export function casFromTape(tape) {
  const first = tape.blocks()[0] ?? [];
  return new Uint8Array(first);
}

