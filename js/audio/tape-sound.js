// SPDX-License-Identifier: Apache-2.0
//
// The machine's sound: every pulse that passes the head, or that the computer writes while
// recording, as the short swing it is on tape; and the amplifier on the cassette output, which
// plays port FFH while the motor is off (js/audio/amplifier.js). Through Web Audio, at the real
// speed only (Fast tape would be a whistle). The browser allows sound only after the visitor has clicked
// something, so the context starts on the first press (unlock).

import { CLOCK_HZ } from "../sim/machine.js";
import { render } from "./amplifier.js";

/** The pulse's shape: +0.85 V for 227 T-states, then 0 V for 227 (about the rest level 0.46 V). */
const HALF_S = 227 / CLOCK_HZ;
/** Schedule this far ahead, seconds. */
const LEAD_S = 0.06;

export class TapeSound {
  constructor() {
    /** @private @type {AudioContext | null} */
    this.ctx = null;
    /** @private @type {GainNode | null} */
    this.gain = null;
    /** @private when the next buffer may start, in the context's time */
    this.next = 0;
    this.volume = 0.35;
    this.muted = false;
    /** @private the amplifier's coupling, carried from frame to frame */
    this.hp = { x: 0, y: 0 };
  }

  /** Starts audio (call from a click). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = /** @type {typeof AudioContext | undefined} */ (window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext);
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.gain.connect(this.ctx.destination);
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : this.volume;
  }

  /**
   * Plays one frame: the tape's pulses at these offsets (seconds from the frame's start), and
   * the amplifier's levels, within a frame lasting `duration` seconds.
   * @param {number[]} offsets
   * @param {import("./amplifier.js").Levels | null} amp
   * @param {number} duration
   */
  frame(offsets, amp, duration) {
    const ctx = this.ctx;
    if (!ctx || !this.gain || ctx.state !== "running" || duration <= 0) return;
    const rate = ctx.sampleRate;
    const n = Math.max(1, Math.round(duration * rate));
    const buf = ctx.createBuffer(1, n, rate);
    const data = buf.getChannelData(0);
    const half = Math.max(1, Math.round(HALF_S * rate));
    for (const o of offsets) {
      const i = Math.round(o * rate);
      for (let k = 0; k < half && i + k < n; k++) data[i + k] += 0.8;
      for (let k = half; k < 2 * half && i + k < n; k++) data[i + k] -= 0.9;
    }
    if (amp) {
      const a = render(amp, rate, this.hp);
      for (let i = 0; i < n && i < a.length; i++) data[i] += a[i] * 0.9;
    } else this.hp = { x: 0, y: 0 };
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    const at = Math.max(ctx.currentTime + LEAD_S, this.next);
    // if the schedule has drifted far ahead (a stalled tab), start again close to now
    const start = at - ctx.currentTime > 0.5 ? ctx.currentTime + LEAD_S : at;
    src.start(start);
    this.next = start + duration;
  }
}
