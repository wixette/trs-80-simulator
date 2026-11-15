// SPDX-License-Identifier: Apache-2.0
//
// The lessons, end to end (design/v0.0.1.md, §3): acceptance area LES. Each lesson runs on a
// headless Model I with the real ROM, in order: each step's keys typed on the Model I's keys
// ("Type it"), the visitor's own part done where a step has one, and then its check must
// pass. Lessons follow on from one another, as a class would take them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { has } from "../js/l10n/l10n.js";
import { LESSONS, typeKeys } from "../js/lessons/lessons.js";
import { SAMPLES } from "../js/sim/samples.js";
import { System } from "../js/sim/system.js";
import { NO_ROM, rom } from "./boot.js";

const TAKE_APART = JSON.parse(readFileSync(new URL("../model/params/machine.json", import.meta.url), "utf8")).take_apart.order;

describe("LES: the lessons", () => {
  it("LES-0: every lesson and step has its words, and every program it opens is one of ours; every step that types has keys the Model I has", () => {
    /** @type {string[]} */
    const missing = [];
    for (const l of LESSONS) {
      for (const k of ["title", "lead"]) if (!has(`lesson.${l.id}.${k}`)) missing.push(`lesson.${l.id}.${k}`);
      for (const st of l.steps) {
        for (const k of ["title", "text"]) if (!has(`lesson.${l.id}.${st.id}.${k}`)) missing.push(`lesson.${l.id}.${st.id}.${k}`);
        if (st.more && !has(`lesson.${l.id}.${st.id}.more`)) missing.push(`lesson.${l.id}.${st.id}.more`);
        if (st.program && !SAMPLES.some((sm) => sm.id === st.program)) missing.push(`program ${st.program}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("LES-1 to 7: every step of every lesson can be done, in order, and its check then passes; none ticks before its turn", { skip: NO_ROM, timeout: 120_000 }, () => {
    const s = new System({ rom: rom(), takeApart: TAKE_APART });
    /** @type {string[]} */
    const notDone = [];
    /** Steps whose check may pass before their turn, by design: the box drawn just before covers the corner. */
    const AHEAD = ["screen.corner"];
    /** @type {string[]} */
    const early = [];
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        step.before?.(s);
        if (step.type) {
          typeKeys(s, step.type);
          for (let i = 0; s.typist.busy && i < 2400; i++) {
            s.frame(0.05);
            s.clock.step(0.05);
          }
        }
        step.act?.(s);
        for (let i = 0; step.done && i < 160 && !step.done(s); i++) {
          s.frame(0.25);
          s.clock.step(0.25);
        }
        if (step.done && !step.done(s)) notDone.push(`${lesson.id}.${step.id}: ${s.machine.screenText().filter(Boolean).slice(-3).join(" | ")}`);
        // the page checks every step of the lesson open, all the time: none further on may pass yet
        for (const later of lesson.steps.slice(lesson.steps.indexOf(step) + 1)) {
          const id = `${lesson.id}.${later.id}`;
          if (later.done?.(s) && !AHEAD.includes(id) && !early.includes(id)) early.push(id);
        }
      }
    }
    assert.deepEqual(notDone, []);
    assert.deepEqual(early, [], "LES-7: ticked before their turn");
  });
});
