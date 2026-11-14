// SPDX-License-Identifier: Apache-2.0
//
// Runs the machine in real time, or slower, or one instruction at a time. Each animation
// frame runs the T-states that frame's wall time is worth at 1.77408 MHz (times `speed`),
// in slices short enough that queued keystrokes and tape pulses land on time; the devices
// (the typist, the computer's keyboard, the tape) are ticked before each slice.
//
// - Whole slices, never skipped: the ROM times everything by counting instructions.
// - Catch-up after a stall is capped, so the machine slows rather than races.
// - Paused while the page is hidden, and when the visitor pauses it (the CPU & Memory
//   tool), or when it reaches a stop address (Run to).
//
// requestAnimationFrame and document.hidden are optional: Node drives step() directly.

import { CLOCK_HZ } from "./machine.js";

/** At most this much wall time is caught up after a stall. */
const MAX_CATCH_UP_S = 4 / 60;
/** The longest slice between device ticks: 1 ms of machine time. */
export const SLICE_T = Math.round(CLOCK_HZ / 1000);

/**
 * @typedef {object} Runnable
 * @property {(t: number, stops?: ReadonlySet<number>) => number} run
 * @property {() => number} stepInstruction
 * @property {number} t
 * @property {boolean} powered
 * @property {number} pc where the next instruction is
 */

/** @typedef {{ tick: () => void, next: () => number }} Device ticked before each slice; `next` says how soon it next has something to do, in T-states */

export class Clock {
  /**
   * @param {Runnable} machine
   * @param {Device[]} [devices]
   */
  constructor(machine, devices = []) {
    /** @private */
    this.m = machine;
    /** @private */
    this.devices = devices;
    /** The visitor's speed, relative to the real machine: 1, 0.1, 0.01 or 0.001. */
    this.speed = 1;
    /** A factor on top of the speed, while the tape runs fast (Fast tape). */
    this.boost = 1;
    /** Paused: nothing runs until resume() or stepOnce(). */
    this.paused = false;
    /** Run to: the machine pauses before running an instruction at any of these addresses. @type {Set<number>} */
    this.stops = new Set();
    /** Called when the machine reaches a stop, with its address. @type {((pc: number) => void) | null} */
    this.onStop = null;
    /** @private */
    this.raf = 0;
    /** @private */
    this.last = 0;
    /** @private fractional T-states carried between frames at slow speeds */
    this.carry = 0;
    /** Wall-clock milliseconds the last frame's machine work took. */
    this.lastWorkMs = 0;
    /** Called after each frame's run. @type {(() => void)[]} */
    this.onFrame = [];
  }

  /** @param {Device} d */
  add(d) {
    this.devices.push(d);
  }

  /**
   * Runs `tStates` of machine time now, ticking the devices between slices. Stops early
   * at a stop address (and pauses).
   * @param {number} tStates
   */
  runFor(tStates) {
    const end = this.m.t + tStates;
    while (this.m.t < end && !this.paused) {
      let slice = Math.min(SLICE_T, end - this.m.t);
      for (const d of this.devices) {
        d.tick();
        slice = Math.min(slice, Math.max(1, d.next()));
      }
      const ran = this.m.run(slice, this.stops);
      if (ran === 0) break; // switched off
      if (ran < slice && this.stops.size) {
        this.paused = true;
        this.onStop?.(this.m.pc);
      }
    }
  }

  /** Runs `seconds` of machine time now. @param {number} seconds */
  step(seconds) {
    this.runFor(Math.round(seconds * CLOCK_HZ));
  }

  /** One instruction, with the devices ticked first; only while paused. @returns {number} its T-states */
  stepOnce() {
    if (!this.paused || !this.m.powered) return 0;
    for (const d of this.devices) d.tick();
    return this.m.stepInstruction();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.last = 0;
  }

  /** The T-states a frame of `dt` seconds is worth at the current speed, carrying fractions. @param {number} dt */
  tStatesFor(dt) {
    const exact = dt * CLOCK_HZ * this.speed * this.boost + this.carry;
    const whole = Math.floor(exact);
    this.carry = exact - whole;
    return whole;
  }

  start() {
    if (this.raf) return;
    this.last = 0;
    const frame = (/** @type {number} */ now) => {
      this.raf = requestAnimationFrame(frame);
      const hidden = typeof document !== "undefined" && document.hidden;
      const dt = this.last && !hidden ? Math.min((now - this.last) / 1000, MAX_CATCH_UP_S) : 0;
      this.last = now;
      const t0 = performance.now();
      if (dt > 0 && !this.paused) this.runFor(this.tStatesFor(dt));
      this.lastWorkMs = performance.now() - t0;
      for (const f of this.onFrame) f();
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
