// SPDX-License-Identifier: Apache-2.0
//
// The whole desk, as the page works it: the computer, the Video Display, the CTR-80, the
// typist and the visitor's keyboard, the clock, and the machine taken apart. It holds the
// rules every view obeys (docs/ui-design.md, U3-U5; design/decisions.md, D11), so that the
// 3D view, the 2D view, the tools and the lessons all ask one place:
//
// - the computer switches on only when it is whole, and only with a ROM;
// - nothing comes out while it is on; a click takes out what is in the way first;
// - the recorder's keys need a tape; REWIND and FAST-F wind whatever the relay (D16);
// - Fast tape runs the machine 32 times faster while the tape moves.
//
// No DOM and no three.js: what it has to say goes out as a message key and its values
// (`say`), which the page words (js/l10n/en.js). tests/system.test.js walks its rules.

import { Assembly } from "./assembly.js";
import { casFromTape, Tape } from "./cassette.js";
import { Clock } from "./clock.js";
import { HostKeys } from "./host-keys.js";
import { Typist } from "./keys.js";
import { CLOCK_HZ, Machine } from "./machine.js";
import { Recorder } from "./recorder.js";
import { tapeInfo } from "./system-tape.js";

/** Fast tape's factor (D16): a 9 KB game loads in about 5 s instead of 2 min 42 s. */
export const FAST_TAPE = 32;
/** "Type it" types at this many times the machine's speed, so a listing goes in quickly. */
export const FAST_TYPING = 8;
/** Seconds a unit takes to come out; to go back with the rest, after Put it all back. */
export const OUT_S = 0.8;
export const BACK_S = 0.12;

/** @typedef {"record" | "play" | "rewind" | "fastf" | "stop" | "eject"} DeckKey */
/** @typedef {{ key: string, params?: Record<string, string | number> }} Message */
/** @typedef {{ f: number, target: number, rate: number }} Motion how far out a unit is, where it is going, and how fast (per second) */

/** Where C and B start, and a double-click puts them back: the middle of their turn. */
export const CONTROL_MID = 0.5;

export class System {
  /**
   * @param {object} options
   * @param {Uint8Array | null} options.rom Level II, or null if it is missing
   * @param {readonly import("./assembly.js").Step[]} options.takeApart model/params/machine.json, take_apart.order
   */
  constructor({ rom, takeApart }) {
    this.machine = new Machine({ rom: rom ?? undefined });
    this.hasRom = !!rom;
    this.deck = new Recorder();
    this.machine.tape = this.deck;
    this.typist = new Typist(this.machine);
    this.hostKeys = new HostKeys(this.machine);
    this.clock = new Clock(this.machine, [this.typist, this.hostKeys]);
    this.assembly = new Assembly(takeApart);
    /** @type {Map<string, Motion>} */
    this.motion = new Map(this.assembly.units.map((u) => [u, { f: 0, target: 0, rate: 1 / OUT_S }]));
    this.display = { on: false, contrast: CONTROL_MID, brightness: CONTROL_MID };
    this.fastTape = true;
    this.fastTyping = true;
    /** The memory traffic of the last frame, for the chips and the memory map. @type {import("./machine.js").Traffic} */
    this.traffic = this.machine.takeTraffic();
    /** What the visitor should be told. @type {(m: Message) => void} */
    this.say = () => {};
    /** Something the views show changed: power, the deck, the tape, the box. @type {(() => void)[]} */
    this.onChange = [];
    this.deck.onChange = () => this.changed();
    this.machine.on.motor = (on) => {
      if (on) this.say({ key: this.deck.running ? "motor.on" : "motor.onIdle" });
      else if (this.deck.mode === "play" || this.deck.mode === "record") this.say({ key: "motor.off" });
      this.changed();
    };
  }

  /** @private */
  changed() {
    for (const f of this.onChange) f();
  }

  // ---- power ------------------------------------------------------------------------------

  /** Whether every unit is in, and nothing moving. */
  get whole() {
    return [...this.motion.values()].every((m) => m.f === 0 && m.target === 0);
  }

  /**
   * The computer's POWER switch. Refused while the machine is apart (D11) or with no ROM.
   * @param {boolean} on
   * @returns {boolean} whether it changed
   */
  power(on) {
    const m = this.machine;
    if (on === m.powered) return false;
    if (on && !this.whole) {
      const unit = this.assembly.outUnits()[0] ?? [...this.motion].find(([, v]) => v.target > 0)?.[0] ?? "";
      this.say({ key: "power.apart", params: { unit } });
      return false;
    }
    if (on && !this.hasRom) {
      this.say({ key: "power.noRom" });
      return false;
    }
    this.typist.clear();
    this.hostKeys.releaseAll();
    this.clock.resume();
    this.clock.stops.clear();
    m.power(on);
    this.say({ key: on ? (this.display.on ? "power.on" : "power.onDark") : "power.off" });
    this.changed();
    return true;
  }

  /** The Video Display's POWER button. @param {boolean} on */
  displayPower(on) {
    if (on === this.display.on) return;
    this.display.on = on;
    this.say({ key: on ? (this.machine.powered ? "display.on" : "display.onNoComputer") : "display.off" });
    this.changed();
  }

  /**
   * The Video Display's C and B controls, each 0..1.
   * @param {"contrast" | "brightness"} which
   * @param {number} value
   */
  setControl(which, value) {
    this.display[which] = Math.min(1, Math.max(0, value));
    this.say({ key: `display.${which}`, params: { value: Math.round(this.display[which] * 100) } });
    this.changed();
  }

  /** C or B back to the middle, where it starts: a double-click on it. @param {"contrast" | "brightness"} which */
  resetControl(which) {
    this.setControl(which, CONTROL_MID);
  }

  /** Fast tape (D16), from the Tapes menu or the Cassette tab: on, the machine runs 32 times faster while the tape moves. @param {boolean} on */
  setFastTape(on) {
    this.fastTape = on;
    this.say({ key: on ? "tape.fastOn" : "tape.fastOff" });
    this.changed();
  }

  /** The RESET button. */
  reset() {
    if (!this.machine.powered) {
      this.say({ key: "reset.off" });
      return false;
    }
    this.clock.resume();
    this.machine.reset();
    this.say({ key: "reset.done" });
    return true;
  }

  /** Puts a ROM in place, the visitor's own (D2). Only with the computer off. @param {Uint8Array} rom */
  setRom(rom) {
    if (!this.machine.setRom(rom)) return false;
    this.hasRom = true;
    return true;
  }

  // ---- the recorder -----------------------------------------------------------------------

  /** One of the CTR-80's six keys. @param {DeckKey} key */
  deckKey(key) {
    const d = this.deck;
    const t = this.machine.t;
    if (key !== "stop" && key !== "eject" && !d.tape) {
      this.say({ key: "deck.noTape" });
      return false;
    }
    if (key === "record") d.press("record", t);
    else if (key === "play") d.press("play", t);
    else if (key === "rewind") d.press("rewind", t);
    else if (key === "fastf") d.press("fast", t);
    else if (key === "stop") d.stop(t);
    else if (d.tape) d.eject(t);
    else {
      this.say({ key: "deck.empty" });
      return false;
    }
    this.say({ key: `deck.${key}` });
    return true;
  }

  /**
   * Puts a tape in the recorder, after taking out any other, and says what is on it and
   * how to load it (D7).
   * @param {Tape} tape
   */
  insertTape(tape) {
    this.deck.eject(this.machine.t);
    this.deck.insert(tape);
    const info = tape.pulses.length ? tapeInfo(casFromTape(tape)) : null;
    const long = tape.end / CLOCK_HZ > 30;
    const params = { name: tape.name, length: mmss(tape.end) };
    if (!info) this.say({ key: "tape.blank", params });
    else if (info.kind === "basic") this.say({ key: long ? "tape.basicLong" : "tape.basic", params: { ...params, letter: info.name } });
    else if (info.kind === "system") this.say({ key: long ? "tape.systemLong" : "tape.system", params: { ...params, program: info.name } });
    else this.say({ key: "tape.unknown", params });
    this.changed();
  }

  /** What the tape in the recorder holds, from its first recording, or null for none or blank. */
  tapeInfo() {
    const tape = this.deck.tape;
    return tape && tape.pulses.length ? tapeInfo(casFromTape(tape)) : null;
  }

  // ---- taking it apart --------------------------------------------------------------------

  /**
   * A click on a unit: out, with whatever is in its way first; or, if it is out, back,
   * with whatever sits on it first. Refused while the computer is on (D11).
   * @param {string} unit
   */
  toggleUnit(unit) {
    if (this.machine.powered) {
      this.say({ key: "apart.poweredOn" });
      return false;
    }
    const m = this.motion.get(unit);
    if (!m) return false;
    const out = m.target === 0;
    const plan = out ? this.assembly.planOut(unit) : this.assembly.planIn(unit);
    for (const u of plan) {
      const v = /** @type {Motion} */ (this.motion.get(u));
      v.target = out ? 1 : 0;
      v.rate = 1 / OUT_S;
    }
    this.say({ key: out ? "apart.out" : "apart.in", params: { unit } });
    this.changed();
    return true;
  }

  /** Takes every unit out, in order (the 3D Taken apart view). */
  takeAllApart() {
    if (this.machine.powered) {
      this.say({ key: "apart.poweredOn" });
      return false;
    }
    for (const v of this.motion.values()) {
      v.target = 1;
      v.rate = 1 / OUT_S;
    }
    this.say({ key: "apart.all" });
    this.changed();
    return true;
  }

  /** Put it all back: everything goes back quickly, in order. */
  putAllBack() {
    for (const v of this.motion.values()) {
      v.target = 0;
      v.rate = 1 / BACK_S;
    }
    this.say({ key: "apart.back" });
    this.changed();
  }

  /** Puts everything back at once (going to 2D, which always shows a whole machine). @returns {boolean} whether anything was out */
  putBackNow() {
    let any = false;
    for (const [u, v] of this.motion) {
      if (v.f || v.target) any = true;
      v.f = v.target = 0;
      this.assembly.set(u, 0);
    }
    if (any) this.changed();
    return any;
  }

  /**
   * Moves the units one at a time, in the order the machine allows: out, the first in order
   * whose requirements are wholly out; back, the last in order whose dependants are wholly
   * in. Called each frame; nothing ever passes through anything.
   * @param {number} dt seconds
   * @returns {boolean} whether anything moved
   */
  stepMotion(dt) {
    const units = this.assembly.units;
    const order = this.assembly.order;
    /** @param {string} u */
    const mo = (u) => /** @type {Motion} */ (this.motion.get(u));
    // going back first: the last unit going in whose dependants are all in
    for (let i = units.length - 1; i >= 0; i--) {
      const m = mo(units[i]);
      if (m.f <= m.target) continue;
      const blocked = order.some((s) => s.requires.includes(units[i]) && mo(s.unit).f > 0);
      if (blocked) continue;
      m.f = Math.max(m.target, m.f - dt * m.rate);
      this.assembly.set(units[i], m.f);
      if (m.f === 0) this.changed();
      return true;
    }
    for (const s of order) {
      const m = mo(s.unit);
      if (m.f >= m.target) continue;
      if (s.requires.some((r) => mo(r).f < 1)) continue;
      m.f = Math.min(m.target, m.f + dt * m.rate);
      this.assembly.set(s.unit, m.f);
      if (m.f === 1) this.changed();
      return true;
    }
    return false;
  }

  // ---- each frame -------------------------------------------------------------------------

  /**
   * The desk's own motion for a frame: the deck's winding, the speed boosts and the units
   * moving. The clock runs the machine itself.
   * @param {number} dt seconds of wall time
   */
  frame(dt) {
    this.deck.wind(dt * (this.fastTape ? FAST_TAPE : 1), this.machine.t);
    this.clock.boost = this.deck.running && this.fastTape ? FAST_TAPE : this.typist.busy && this.fastTyping ? FAST_TYPING : 1;
    this.stepMotion(dt);
    this.traffic = this.machine.takeTraffic();
  }

  /** Types text on the Model I's keys, as a person would (D15). @param {string} text */
  type(text) {
    if (!this.machine.powered) {
      this.say({ key: "type.off" });
      return 0;
    }
    return this.typist.type(text);
  }
}

/** T-states of tape at playing speed, as m:ss. @param {number} t */
export function mmss(t) {
  const s = Math.round(t / CLOCK_HZ);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
