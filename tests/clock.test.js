// SPDX-License-Identifier: Apache-2.0
//
// The clock: real time in slices, slower speeds, pause, one instruction, Run to (acceptance
// area DBG), and the ROM's loader (D2).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { Clock, SLICE_T } from "../js/sim/clock.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { checkRom, LEVEL2_SHA256 } from "../js/sim/roms.js";
import { NO_ROM, rom } from "./boot.js";

/** A machine running a tiny program from RAM: JP 4000H at 0000H; at 4000H: INC A; JR 4000H. */
function loop() {
  const r = new Uint8Array(0x3000);
  r.set([0xc3, 0x00, 0x40]);
  const m = new Machine({ rom: r });
  m.power(true);
  m.ram.set([0x3c, 0x18, 0xfd]);
  return m;
}

describe("the clock", () => {
  it("DBG-1: runs the machine time asked for, ticking devices before each slice of at most 1 ms", () => {
    const m = loop();
    let ticks = 0;
    const clock = new Clock(m, [{ tick: () => ticks++, next: () => Infinity }]);
    clock.step(0.05);
    assert.ok(m.t >= 0.05 * CLOCK_HZ && m.t < 0.05 * CLOCK_HZ + 20, String(m.t));
    assert.ok(ticks >= Math.floor((0.05 * CLOCK_HZ) / SLICE_T), String(ticks));
  });

  it("DBG-2: does nothing while the computer is off", () => {
    const m = new Machine();
    new Clock(m).step(0.1);
    assert.equal(m.t, 0);
  });

  it("DBG-3: a slower speed runs that fraction of real time a frame, carrying fractions of a T-state", () => {
    const clock = new Clock(loop());
    clock.speed = 0.001;
    let total = 0;
    for (let i = 0; i < 1000; i++) total += clock.tStatesFor(1 / 60);
    assert.equal(total, Math.floor((1000 / 60) * CLOCK_HZ * 0.001));
  });

  it("DBG-4: paused, nothing runs; one step runs one instruction, with the devices ticked", () => {
    const m = loop();
    let ticks = 0;
    const clock = new Clock(m, [{ tick: () => ticks++, next: () => Infinity }]);
    assert.equal(clock.stepOnce(), 0, "not paused: no step");
    clock.pause();
    clock.step(0.1);
    assert.equal(m.t, 0);
    assert.equal(clock.stepOnce(), 10, "JP nn: 10 T-states [Zilog]");
    assert.equal(m.pc, 0x4000);
    assert.equal(clock.stepOnce(), 4, "INC A: 4 T-states");
    assert.equal(m.registers().a, 1);
    assert.equal(ticks, 2);
  });

  it("DBG-5: Run to pauses before the instruction at a stop address, and says so", () => {
    const m = loop();
    const clock = new Clock(m);
    /** @type {number[]} */
    const stops = [];
    clock.onStop = (pc) => stops.push(pc);
    clock.stops.add(0x4001);
    clock.step(0.01);
    assert.equal(clock.paused, true);
    assert.equal(m.pc, 0x4001);
    assert.deepEqual(stops, [0x4001]);
    assert.equal(m.registers().a, 1, "INC A ran once, JR did not");
    clock.resume();
    clock.step(0.01);
    assert.equal(m.registers().a, 2, "resumed, it runs on to the stop again");
  });
});

describe("the ROM", () => {
  it("roms/level2-v12.bin is the image roms/NOTICE names (D2)", { skip: NO_ROM }, async () => {
    assert.equal((await checkRom(rom())).status, "ok");
    assert.ok(readFileSync(new URL("../roms/NOTICE", import.meta.url), "utf8").includes(LEVEL2_SHA256));
  });

  it("a short file is refused; another 12 KB image runs, flagged as other", async () => {
    assert.equal((await checkRom(new Uint8Array(100))).status, "missing");
    const other = await checkRom(new Uint8Array(12288));
    assert.equal(other.status, "other");
    assert.equal(other.rom?.length, 12288);
  });

  it("the ROM cannot be changed while the computer is on", () => {
    const m = new Machine();
    assert.equal(m.setRom(new Uint8Array(0x3000).fill(0x11)), true);
    m.power(true);
    assert.equal(m.setRom(new Uint8Array(0x3000).fill(0x22)), false);
    assert.equal(m.read(0x0000), 0x11);
    m.power(false);
    assert.equal(m.setRom(new Uint8Array(0x3000).fill(0x22)), true);
    assert.equal(m.read(0x0000), 0x22);
  });
});
