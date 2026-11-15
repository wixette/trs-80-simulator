// SPDX-License-Identifier: Apache-2.0
//
// Runs a BASIC listing on the headless Model I, for writing and checking our programs
// (design/v0.0.3.md): types it in at MEMORY SIZE?'s READY, runs it, presses keys at given
// times, and prints the screen, any error, and the notes it played through the amplifier.
//
//     node tools/basic.mjs prog.bas                     run 5 s, print the screen
//     node tools/basic.mjs --id worm --secs 20          one of our programs, by its id
//     node tools/basic.mjs prog.bas --at "2:type:42\n" --at "3:hold:LEFT" --at "4:release:LEFT" --at "5:shot"
//     node tools/basic.mjs prog.bas --notes             also list the notes played
//
// Times are seconds of machine time from RUN. Keys are the Model I's names (A, SPACE, UP,
// ENTER, BREAK, SHIFT...). The listing may end with RUN or not; it is run either way.
// Needs roms/level2-v12.bin (pnpm vendor).

import { readFileSync } from "node:fs";
import { Amplifier } from "../js/audio/amplifier.js";
import { keyNamed } from "../js/sim/keymap.js";
import { CLOCK_HZ } from "../js/sim/machine.js";
import { NO_ROM, ready } from "../tests/boot.js";

const args = process.argv.slice(2);
/** @type {{ at: number, what: string, arg: string }[]} */
const actions = [];
let secs = 5;
let notes = false;
let file = "";
let id = "";
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--secs") secs = Number(args[++i]);
  else if (a === "--notes") notes = true;
  else if (a === "--id") id = args[++i];
  else if (a === "--at") {
    const [at, what, ...rest] = args[++i].split(":");
    actions.push({ at: Number(at), what, arg: rest.join(":").replace(/\\n/g, "\n") });
  } else file = a;
}
if (NO_ROM) {
  console.error(NO_ROM);
  process.exit(2);
}
let text;
if (id) {
  const { SAMPLES } = await import("../js/sim/samples.js");
  const sm = SAMPLES.find((s) => s.id === id);
  if (!sm) throw new Error(`no program ${id}`);
  text = sm.text;
} else text = readFileSync(file, "utf8");
const listing = text.replace(/\r\n?/g, "\n").replace(/\n?RUN\n?$/, "").trim() + "\n";

const b = ready();
const started = performance.now();
b.typist.type(`NEW\n${listing}`);
for (let i = 0; i < 60000 && b.typist.busy; i++) b.run(0.05);
b.run(0.5);
const typedSecs = b.m.t / CLOCK_HZ;
const typedIn = (performance.now() - started) / 1000;
const errorsWhileTyping = b.screen().filter((l) => /ERROR|^\?/.test(l));
const amp = new Amplifier();
b.m.on.port = (v, t) => amp.write(v, t, b.m.motor);
b.typist.type("RUN\n");
for (let i = 0; i < 300 && b.typist.busy; i++) b.run(0.01);
const t0 = b.m.t;
const now = () => (b.m.t - t0) / CLOCK_HZ;
actions.sort((x, y) => x.at - y.at);
/** Prints the screen. @param {string} label */
const shot = (label) => {
  console.log(`---- screen at ${now().toFixed(2)} s${label ? ` (${label})` : ""} ----`);
  const lines = b.m.screenText();
  let last = lines.length;
  while (last > 0 && !lines[last - 1].trim()) last--;
  for (const l of lines.slice(0, last)) console.log(`|${l}`);
};
for (const act of actions) {
  while (now() < act.at) b.run(Math.min(0.05, act.at - now() + 1e-6));
  const key = keyNamed(act.arg);
  if (act.what === "type") b.typist.type(act.arg);
  else if (act.what === "hold" && key) b.typist.hold(key.row, key.bit);
  else if (act.what === "release" && key) b.typist.release(key.row, key.bit);
  else if (act.what === "shot") shot(act.arg);
  else throw new Error(`can't ${act.what} ${act.arg}`);
}
while (now() < secs) b.run(Math.min(0.05, secs - now() + 1e-6));
shot("end");
const errors = b.m.screenText().filter((l) => /\?[A-Z/]{1,2} ERROR|ERROR IN \d+/.test(l));
console.log(`---- typed in ${listing.length} characters in ${typedSecs.toFixed(0)} s of machine time (${typedIn.toFixed(1)} s here); ran ${secs} s`);
if (errorsWhileTyping.length) console.log(`---- errors while typing: ${errorsWhileTyping.join(" / ")}`);
if (errors.length) console.log(`---- ERRORS: ${errors.join(" / ")}`);
if (notes) {
  const f = amp.take(t0, b.m.t);
  // group the rising edges into notes: a run of near-equal periods
  const ups = (f?.steps ?? []).filter((s) => s.v > 0).map((s) => s.t);
  /** @type {{ at: number, hz: number, secs: number }[]} */
  const out = [];
  let start = 0;
  for (let i = 1; i <= ups.length; i++) {
    const p = ups[i] - ups[i - 1];
    const p0 = ups[start + 1] - ups[start];
    if (i === ups.length || Math.abs(p - p0) > p0 * 0.03 || p > CLOCK_HZ / 30) {
      if (i - start > 3) out.push({ at: (ups[start] - t0) / CLOCK_HZ, hz: CLOCK_HZ / p0, secs: (ups[i - 1] - ups[start]) / CLOCK_HZ });
      start = i;
    }
  }
  console.log(`---- notes: ${out.length ? "" : "none"}`);
  for (const n of out) console.log(`  ${n.at.toFixed(2)} s  ${n.hz.toFixed(1)} Hz  ${n.secs.toFixed(2)} s`);
}
