// SPDX-License-Identifier: Apache-2.0
//
// Tapes as sound files. No DOM: the page passes a file's bytes.
//
// Reading: a .wav (PCM 8, 16, 24 or 32 bits, or 32-bit float; mono or stereo, mixed) is the
// tape's sound. A Model I pulse is a short swing up and down (about 128 µs each way), every
// 2 ms for a clock pulse and 1 ms after it for a 1. A pulse is found where the signal's size
// rises past half the recent peak, after it has fallen below a quarter of it (hysteresis),
// and no sooner than MIN_GAP_T after the last one: so either polarity works, a recording
// at any level works, and the swing back of one pulse is not taken for the next. Its rise
// becomes a pulse's position on the tape, in T-states, which is all the machine reads.
//
// Kesteloot's trs80-cassette (MIT) decodes recordings the same way, and was the reference.
//
// Writing: each pulse is drawn as the port's levels make it: up for
// half of PULSE_T, down for the other half, at rest between; 8-bit mono, 22,050 Hz.

import { PULSE_T } from "./cassette.js";
import { CLOCK_HZ } from "./machine.js";

/** The shortest time between two pulses taken as different (a 1's data pulse is 1,778 later). */
const MIN_GAP_T = 1000;

/** @typedef {{ rate: number, samples: Float32Array }} Sound mono, -1..1 */

/**
 * A .wav file's sound, mixed to mono.
 * @param {Uint8Array} bytes
 * @returns {Sound}
 */
export function parseWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (/** @type {number} */ o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a .wav file (no RIFF/WAVE header)");
  let fmt = null;
  let data = null;
  for (let o = 12; o + 8 <= bytes.length;) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === "fmt ") {
      fmt = { format: v.getUint16(o + 8, true), channels: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the sub-format GUID
      if (fmt.format === 0xfffe && size >= 40) fmt.format = v.getUint16(o + 32, true);
    }
    else if (id === "data") data = { at: o + 8, size: Math.min(size, bytes.length - o - 8) };
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error("a .wav file without its fmt or data chunk");
  const { format, channels, rate, bits } = fmt;
  const float = format === 3;
  if (!float && format !== 1) throw new Error(`a .wav file in format ${format}: only PCM and float are read`);
  if (!channels || !rate) throw new Error("a .wav file with no channels or no sample rate");
  const width = bits / 8;
  const frames = Math.floor(data.size / (width * channels));
  const samples = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const o = data.at + (f * channels + c) * width;
      if (float) sum += bits === 64 ? v.getFloat64(o, true) : v.getFloat32(o, true);
      else if (bits === 8) sum += (bytes[o] - 128) / 128;
      else if (bits === 16) sum += v.getInt16(o, true) / 32768;
      else if (bits === 24) sum += ((bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) << 8 >> 8) / 8388608;
      else if (bits === 32) sum += v.getInt32(o, true) / 2147483648;
      else throw new Error(`a .wav file with ${bits}-bit samples`);
    }
    samples[f] = sum / channels;
  }
  return { rate, samples };
}

/**
 * The pulses in a tape's sound, as positions in T-states.
 * @param {Sound} sound
 * @returns {number[]}
 */
export function pulsesFromSound({ rate, samples }) {
  // the signal's middle: a slow average (a recording may sit off zero)
  const n = samples.length;
  const minGap = Math.max(1, Math.round((MIN_GAP_T / CLOCK_HZ) * rate));
  const decay = Math.exp(-1 / (0.05 * rate)); // the peak follower forgets in about 50 ms
  const dcRate = 1 / (0.02 * rate);
  /** @type {number[]} */
  const out = [];
  let dc = 0;
  let peak = 0;
  let armed = true;
  let last = -Infinity;
  for (let i = 0; i < n; i++) {
    dc += (samples[i] - dc) * dcRate;
    const a = Math.abs(samples[i] - dc);
    peak = Math.max(a, peak * decay);
    // silence below about -50 dBFS: a recording made very quietly (-34 dBFS, say) still reads
    if (peak < 0.003) {
      armed = true; // silence
      continue;
    }
    if (armed && a > peak * 0.5 && i - last >= minGap) {
      // the rise: back up to where the swing began, between samples
      const prev = Math.abs(samples[i - 1] - dc) || 0;
      const frac = a > prev ? (a - peak * 0.5) / (a - prev) : 0;
      out.push(Math.round(((i - Math.min(1, frac)) / rate) * CLOCK_HZ));
      last = i;
      armed = false;
    } else if (!armed && a < peak * 0.25 && i - last >= minGap / 2) armed = true;
  }
  return out;
}

/**
 * A tape's pulses as a .wav file: 8-bit mono, with half a second of quiet at each end.
 * @param {number[]} pulses T-states
 * @param {number} [rate]
 * @returns {Uint8Array}
 */
export function wavFromPulses(pulses, rate = 22050) {
  const pad = Math.round(rate / 2);
  const end = pulses.length ? pulses[pulses.length - 1] : 0;
  const frames = pad * 2 + Math.ceil((end / CLOCK_HZ) * rate);
  const out = new Uint8Array(44 + frames).fill(128, 44);
  const half = Math.max(1, Math.round((PULSE_T / 2 / CLOCK_HZ) * rate));
  for (const p of pulses) {
    const s = pad + Math.round((p / CLOCK_HZ) * rate);
    for (let k = 0; k < half; k++) {
      if (s + k < frames) out[44 + s + k] = 128 + 100;
      if (s + half + k < frames) out[44 + s + half + k] = 128 - 100;
    }
  }
  const v = new DataView(out.buffer);
  /** @param {number} o @param {string} s */
  const put = (o, s) => {
    for (let k = 0; k < 4; k++) out[o + k] = s.charCodeAt(k);
  };
  put(0, "RIFF");
  v.setUint32(4, 36 + frames, true);
  put(8, "WAVE");
  put(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); // bytes a second
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  put(36, "data");
  v.setUint32(40, frames, true);
  return out;
}
