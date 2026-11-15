// SPDX-License-Identifier: Apache-2.0
//
// The Realistic CTR-80 as a device (design/decisions.md, D5): its six keys, the
// tape moving past the head, and the computer's hold on the motor through the REM jack.
//
// - PLAY latches down; RECORD latches down with PLAY (as on the real deck, it needs both).
//   STOP releases them; EJECT, stopped, takes the tape out.
// - The tape moves at playing speed only while PLAY is down **and** the computer's motor
//   relay is closed (port FF bit 2): Level II starts the tape for CLOAD and CSAVE itself.
// - REWIND and FAST-F wind the tape regardless of the relay: owners pulled the REM plug to
//   wind, which this simulator does for them (D16; a simplification, said where it is met).
//
// The machine sees the tape through its hooks: `pulseSince(t)` and `activeAt(t)` for its
// flip-flop, `portWrite(value, t)` for recording, `setRelay(on, t)` for the motor.

import { GAP_T, PULSE_T, Tape } from "./cassette.js";
import { CLOCK_HZ } from "./machine.js";

/** Winding speed, relative to playing (est: a C-60 winds end to end in about a minute). */
export const WIND = 30;
/** Counter counts per second of tape at playing speed (est: a three-digit reel counter). */
const COUNTS_PER_S = 1.6;

/** @typedef {"stop" | "play" | "record" | "rewind" | "fast"} Mode */

export class Recorder {
  constructor() {
    /** @type {Tape | null} */
    this.tape = null;
    /** @type {Mode} */
    this.mode = "stop";
    /** The computer's motor relay (REM). */
    this.relay = false;
    /** Tape position, T-states of playing time from the tape's start. */
    this.pos = 0;
    /** @private machine time at which pos was last set */
    this.t0 = 0;
    /** @private the next pulse to reach the head */
    this.next = 0;
    /** @private recording in progress: where it started, its pulses, the last level @type {{ from: number, pulses: number[], level: number } | null} */
    this.rec = null;
    /** @type {(() => void) | null} called when the state changes (keys, tape, motor) */
    this.onChange = null;
    /** @type {((t: number) => void) | null} each pulse played or recorded, at its machine time */
    this.onPulse = null;
  }

  /** True while the tape moves past the head at playing speed. */
  get running() {
    return !!this.tape && this.relay && (this.mode === "play" || this.mode === "record");
  }

  /** How long the tape's recordings run, T-states (the visitor's tape length). */
  get length() {
    return this.tape ? this.tape.end : 0;
  }

  /** True while a recording is being made. */
  get recording() {
    return !!this.rec;
  }

  /**
   * The recording being made, as far as it has got: where on the tape it started, and its
   * pulses (not to be changed). It goes onto the tape when the recording ends; until then the
   * tape still holds what was there before.
   * @returns {{ from: number, pulses: readonly number[] } | null}
   */
  get pending() {
    return this.rec ? { from: this.rec.from, pulses: this.rec.pulses } : null;
  }

  /** The counter's three digits at machine time t: it counts while the tape plays or winds. @param {number} t */
  counterAt(t) {
    return Math.floor((this.at(t) / CLOCK_HZ) * COUNTS_PER_S) % 1000;
  }

  /** Position now, at machine time t. @param {number} t */
  at(t) {
    return this.running ? this.pos + (t - this.t0) : this.pos;
  }

  /** @private settles pos at time t before any change of state @param {number} t */
  settle(t) {
    this.pos = this.at(t);
    this.t0 = t;
  }

  /** @param {Mode} mode @param {number} t */
  press(mode, t) {
    this.settle(t);
    this.finishRecording(t);
    if ((mode === "play" || mode === "record") && !this.tape) {
      this.mode = "stop";
    } else {
      this.mode = mode;
    }
    if (this.mode === "record" && this.relay) this.startRecording();
    if (this.tape) this.next = this.tape.indexAt(this.pos);
    this.onChange?.();
  }

  /** STOP. @param {number} t */
  stop(t) {
    this.press("stop", t);
  }

  /** EJECT (stops first). @param {number} t @returns {Tape | null} the tape taken out */
  eject(t) {
    this.press("stop", t);
    const tape = this.tape;
    this.tape = null;
    this.pos = 0;
    this.onChange?.();
    return tape;
  }

  /** Puts a tape in, at its start: a recording on the tape taken out is finished on it first. @param {Tape} tape @param {number} [t] machine time */
  insert(tape, t = 0) {
    if (this.rec) {
      this.settle(t);
      this.finishRecording(t);
    }
    this.tape = tape;
    this.mode = "stop";
    this.pos = 0;
    this.next = 0;
    this.onChange?.();
  }

  /** The machine's motor relay (port FF bit 2). @param {boolean} on @param {number} t */
  setRelay(on, t) {
    this.settle(t);
    this.finishRecording(t);
    this.relay = on;
    if (on && this.mode === "record") this.startRecording();
    if (this.tape) this.next = this.tape.indexAt(this.pos);
    this.onChange?.();
  }

  /** Winds the tape for REWIND and FAST-F; call each frame. @param {number} dtSeconds @param {number} t */
  wind(dtSeconds, t) {
    if (!this.tape || (this.mode !== "rewind" && this.mode !== "fast")) return;
    this.settle(t);
    const d = dtSeconds * CLOCK_HZ * WIND;
    // FAST-F stops a second past the last pulse, or where the tape already is if it has played
    // further than that (never winding back)
    const end = Math.max(this.tape.end + CLOCK_HZ, CLOCK_HZ * 2, this.pos);
    this.pos = this.mode === "rewind" ? Math.max(0, this.pos - d) : Math.min(end, this.pos + d);
    if (this.pos === 0 || this.pos === end) this.mode = "stop";
    this.next = this.tape.indexAt(this.pos);
    this.onChange?.();
  }

  /**
   * The machine's read of its flip-flop: did a pulse pass the head since the last call?
   * @param {number} t machine time
   */
  pulseSince(t) {
    if (!this.tape || !this.running || this.mode !== "play") return false;
    const p = this.at(t);
    let hit = false;
    const pulses = this.tape.pulses;
    while (this.next < pulses.length && pulses[this.next] <= p) {
      this.onPulse?.(t - (p - pulses[this.next]));
      this.next++;
      hit = true;
    }
    return hit;
  }

  /** A write to port FF: a pulse is recorded where the level rises to 1 (+0.85 V). @param {number} value @param {number} t */
  portWrite(value, t) {
    if (!this.rec || !this.running) return;
    const level = value & 3;
    if (level === 1 && this.rec.level !== 1) {
      this.rec.pulses.push(this.at(t));
      this.onPulse?.(t);
    }
    this.rec.level = level;
  }

  /**
   * Is a pulse under the head now? While one is, the input holds the flip-flop set, and a
   * write to port FF cannot clear it (D13). @param {number} t
   */
  activeAt(t) {
    if (!this.tape || !this.running || this.mode !== "play") return false;
    const p = this.at(t);
    const i = this.tape.indexAt(p + 1) - 1;
    return i >= 0 && p - this.tape.pulses[i] < PULSE_T;
  }

  /** @private */
  startRecording() {
    if (this.rec) return;
    // the motor takes a moment to run up to speed: a recording made just after another (two
    // CSAVEs, the motor stopped between) starts a gap past it, and is a recording of its own
    const pulses = this.tape?.pulses ?? [];
    const i = this.tape ? this.tape.indexAt(this.pos) - 1 : -1;
    if (i >= 0 && this.pos - pulses[i] <= GAP_T) this.pos = pulses[i] + GAP_T + 1;
    this.rec = { from: this.pos, pulses: [], level: 0 };
  }

  /** @private @param {number} t */
  finishRecording(t) {
    if (!this.rec || !this.tape) return;
    const to = Math.max(this.at(t), this.rec.from);
    this.tape.overwrite(this.rec.from, to, this.rec.pulses);
    this.rec = null;
  }
}
