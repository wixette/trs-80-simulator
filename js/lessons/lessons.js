// SPDX-License-Identifier: Apache-2.0
//
// The lessons (design/v0.0.1.md, §3; docs/ui-design.md, U7), as data: for each step, what
// to type (on the Model I's own keys: "Type it"), what to look at ("Show me": a view, a Show
// or a tool, never the machine itself), and a check on the machine that ticks the step done.
// Their words are messages (js/l10n/lessons.en.js, `lesson.<lesson>.<step>.*`); a listing is
// the machine's own text, and stays here. No DOM: tests/lessons.test.js runs every lesson end
// to end on a headless machine, doing the visitor's part (`act`) where a step needs one.
//
// Text keys between braces are keys, not characters: {BREAK}, {CLEAR}, {ENTER}.

import { Tape } from "../sim/cassette.js";
import { setCell } from "../sim/charset.js";
import { keyNamed } from "../sim/keymap.js";

/** @typedef {import("../sim/system.js").System} System */
/**
 * @typedef {object} Show what "Show me" points at
 * @property {"3d" | "2d"} [mode]
 * @property {"desk" | "angle" | "keyboard" | "screen" | "recorder" | "inside" | "apart"} [view] a 3D view
 * @property {"vram" | "keyboard" | "cassette" | "cpu"} [tool] a tool, beside the lesson
 * @property {number} [cell] the Video RAM tool's cell to pick
 * @property {number} [address] the CPU & Memory tool's dump to show, and its Run to field
 */
/**
 * @typedef {object} Step
 * @property {string} id
 * @property {string} [type] keys for "Type it"
 * @property {string} [listing] a program, shown as the machine's text
 * @property {string} [program] one of our programs (js/sim/samples.js), to open from the step
 * @property {{ src: string, credit: string, href: string }} [photo] a photograph (images/photos/CREDITS.md), its credit a message key
 * @property {Show} [show]
 * @property {boolean} [more] it has a "Going further" aside
 * @property {(s: System) => boolean} [done] the machine shows the step done
 * @property {(s: System) => void} [before] the visitor's own part before "Type it", for the end-to-end test
 * @property {(s: System) => void} [act] the visitor's own part after it
 */
/** @typedef {{ id: string, steps: Step[] }} Lesson */

/** Whether SET(x, y)'s block is lit. @param {System} s @param {number} x @param {number} y */
const lit = (s, x, y) => {
  const { cell, bit } = setCell(x, y);
  const v = s.machine.vram[cell];
  return (v & 0x80) !== 0 && (v & (1 << bit)) !== 0;
};
/** The screen's lines. @param {System} s */
const screen = (s) => s.machine.screenText();
/** Whether a line on the screen matches. @param {System} s @param {RegExp} re */
const shows = (s, re) => screen(s).some((l) => re.test(l));
/** How many lines on the screen match. @param {System} s @param {RegExp} re */
const count = (s, re) => screen(s).filter((l) => re.test(l)).length;
/** A 16-bit word in memory. @param {System} s @param {number} a */
const word = (s, a) => s.machine.peek(a) | (s.machine.peek(a + 1) << 8);
/** Holds a key for a while, as the visitor would. @param {System} s @param {string} name @param {number} seconds */
const hold = (s, name, seconds) => {
  const k = /** @type {import("../sim/keymap.js").Key} */ (keyNamed(name));
  s.machine.keyDown(k.row, k.bit);
  s.clock.step(seconds);
  s.machine.keyUp(k.row, k.bit);
};
/** Graphics bytes lit with at least one block. @param {System} s */
const blocks = (s) => [...s.machine.vram].filter((v) => v & 0x80 && v & 0x3f).length;

const BOX = ["10 CLS", "20 FOR X=10 TO 50:SET(X,10):SET(X,30):NEXT X", "30 FOR Y=10 TO 30:SET(10,Y):SET(50,Y):NEXT Y", "40 GOTO 40"].join("\n");
const SKETCH = [
  "10 CLS:X=64:Y=24",
  "20 SET(X,Y):K=PEEK(14400)",
  "30 IF K AND 8 THEN Y=Y-1",
  "40 IF K AND 16 THEN Y=Y+1",
  "50 IF K AND 32 THEN X=X-1",
  "60 IF K AND 64 THEN X=X+1",
  "70 IF K AND 128 THEN CLS",
  "80 X=(X+128) AND 127:Y=(Y+48)-INT((Y+48)/48)*48",
  "90 GOTO 20",
].join("\n");
const FILL = ["10 FOR I=0 TO 13:READ B:POKE 32000+I,B:NEXT I", "20 DATA 33,0,60,17,1,60,1,255,3,54,191,237,176,201"].join("\n");
/** The fill program's bytes (lesson 6), at 32000 (7D00H). */
export const FILL_BYTES = [33, 0, 60, 17, 1, 60, 1, 255, 3, 54, 191, 237, 176, 201];
export const FILL_AT = 32000;

/** @type {readonly Lesson[]} */
export const LESSONS = [
  {
    id: "meet",
    steps: [
      {
        id: "system",
        show: { mode: "3d", view: "desk" },
        photo: { src: "images/photos/Radio_Shack_Tandy_TRS-80_Model_I_System.jpg", credit: "photo.system.credit", href: "https://commons.wikimedia.org/wiki/File:Radio_Shack_Tandy_TRS-80_Model_I_System.JPG" },
      },
      { id: "computer", show: { mode: "3d", view: "keyboard" } },
      { id: "inside", show: { mode: "3d", view: "inside" }, more: true },
      { id: "display", show: { mode: "3d", view: "screen" } },
      { id: "recorder", show: { mode: "3d", view: "recorder" } },
      {
        id: "on",
        show: { mode: "3d", view: "desk" },
        done: (s) => s.machine.powered && s.display.on && shows(s, /^MEMORY SIZE\?/),
        act: (s) => {
          s.power(true);
          s.displayPower(true);
          s.clock.step(1.5);
        },
      },
      { id: "ready", type: "\n", done: (s) => shows(s, /^READY/), more: true },
      { id: "play", program: "lander" },
    ],
  },
  {
    id: "basic",
    steps: [
      { id: "print", type: "PRINT 2+2\n", done: (s) => shows(s, /^>PRINT 2\+2/) && shows(s, /^ 4$/) },
      { id: "words", type: 'PRINT "HELLO"\n', done: (s) => shows(s, /^>PRINT "HELLO"/) && shows(s, /^HELLO$/) },
      { id: "program", type: 'NEW\n10 PRINT "HELLO"\n20 GOTO 10\nRUN\n', listing: '10 PRINT "HELLO"\n20 GOTO 10', done: (s) => count(s, /^HELLO$/) >= 8, more: true },
      { id: "break", type: "{BREAK}", done: (s) => shows(s, /^BREAK IN 10|^BREAK IN 20/) },
      { id: "list", type: "LIST\n", done: (s) => shows(s, /^10 PRINT "HELLO"/) && shows(s, /^20 GOTO 10/) },
      { id: "loop", type: "NEW\n10 FOR I=1 TO 10\n20 PRINT I, I*I\n30 NEXT I\nRUN\n", listing: "10 FOR I=1 TO 10\n20 PRINT I, I*I\n30 NEXT I", done: (s) => shows(s, /^ 10 +100/), more: true },
      {
        id: "input",
        type: 'NEW\n10 INPUT "YOUR NAME";N$\n20 PRINT "HELLO, ";N$\nRUN\n',
        listing: '10 INPUT "YOUR NAME";N$\n20 PRINT "HELLO, ";N$',
        done: (s) => shows(s, /^HELLO, \S/),
        act: (s) => {
          s.type("ADA\n");
          for (let i = 0; i < 200 && s.typist.busy; i++) s.clock.step(0.05);
          s.clock.step(0.3);
        },
        more: true,
      },
      { id: "guess", program: "guess" },
    ],
  },
  {
    id: "screen",
    steps: [
      { id: "byte", type: "CLS:POKE 15900,65\n", show: { tool: "vram", cell: 540 }, done: (s) => s.machine.peek(15900) === 65, more: true },
      { id: "box", type: `${BOX}\nRUN\n`, listing: BOX, done: (s) => lit(s, 10, 10) && lit(s, 50, 10) && lit(s, 10, 30) && lit(s, 50, 30) && lit(s, 30, 30) },
      { id: "corner", show: { tool: "vram", cell: 3 * 64 + 5 }, done: (s) => (s.machine.vram[3 * 64 + 5] & 0x80) !== 0, more: true },
      { id: "predict", type: "{BREAK}SET(0,0)\n", show: { tool: "vram", cell: 0 }, done: (s) => (s.machine.vram[0] & 0x81) === 0x81 },
      { id: "seven", type: "POKE 15360,193:PRINT PEEK(15360)\n", show: { tool: "vram", cell: 0 }, done: (s) => shows(s, /^ 129$/), more: true },
      { id: "kaleido", program: "kaleido", show: { tool: "vram" } },
    ],
  },
  {
    id: "keyboard",
    steps: [
      { id: "switches", show: { tool: "keyboard" }, more: true },
      {
        id: "peek",
        type: "NEW\n10 PRINT PEEK(14400);\n20 GOTO 10\nRUN\n",
        listing: "10 PRINT PEEK(14400);\n20 GOTO 10",
        show: { tool: "keyboard" },
        done: (s) => shows(s, /(^| )(8|16|32|64|128) /),
        act: (s) => {
          s.clock.step(0.5);
          hold(s, "SPACE", 1);
        },
      },
      {
        id: "two",
        show: { tool: "keyboard" },
        done: (s) => shows(s, /(^| )72 /),
        act: (s) => {
          const up = /** @type {import("../sim/keymap.js").Key} */ (keyNamed("UP"));
          s.machine.keyDown(up.row, up.bit);
          hold(s, "RIGHT", 1);
          s.machine.keyUp(up.row, up.bit);
        },
        more: true,
      },
      { id: "sketch", type: `{BREAK}NEW\n${SKETCH}\nRUN\n`, listing: SKETCH, done: (s) => blocks(s) >= 12, act: (s) => hold(s, "RIGHT", 2.5) },
      { id: "ghost", show: { tool: "keyboard" }, more: true },
      { id: "worm", program: "worm", show: { tool: "keyboard" } },
    ],
  },
  {
    id: "tape",
    steps: [
      { id: "program", type: '{BREAK}NEW\n10 PRINT "SAVED ON TAPE"\n20 PRINT "AND LOADED BACK"\n', listing: '10 PRINT "SAVED ON TAPE"\n20 PRINT "AND LOADED BACK"', done: (s) => word(s, 0x42e9) !== 0 && s.machine.peek(0x42ed) === 0xb2 },
      {
        id: "blank",
        show: { tool: "cassette" },
        done: (s) => !!s.deck.tape && s.deck.mode === "record",
        act: (s) => {
          s.insertTape(new Tape("blank"));
          s.deckKey("record");
        },
      },
      { id: "csave", type: 'CSAVE "T"\n', show: { tool: "cassette" }, done: (s) => !!s.deck.tape && s.deck.tape.pulses.length > 1000 && !s.machine.motor && shows(s, /^READY/), more: true },
      {
        id: "rewind",
        show: { mode: "3d", view: "recorder" },
        done: (s) => !!s.deck.tape && s.deck.at(s.machine.t) === 0 && s.deck.tape.pulses.length > 0,
        act: (s) => {
          s.deckKey("rewind");
          for (let i = 0; i < 400 && s.deck.mode === "rewind"; i++) s.frame(0.05);
        },
      },
      {
        id: "cload",
        type: 'NEW\nCLOAD "T"\n',
        show: { tool: "cassette" },
        done: (s) => s.deck.at(s.machine.t) > 0 && !s.machine.motor && s.machine.peek(0x42ed) === 0xb2,
        act: (s) => s.deckKey("play"),
      },
      { id: "list", type: "LIST\n", done: (s) => shows(s, /^10 PRINT "SAVED ON TAPE"/), more: true },
      { id: "notes", program: "notes", show: { tool: "cassette" } },
      { id: "music", program: "musicbox", more: true },
    ],
  },
  {
    id: "cpu",
    steps: [
      {
        id: "size",
        type: "32000\n",
        done: (s) => word(s, 0x40b1) < FILL_AT && word(s, 0x40b1) > 0x4000 && shows(s, /^READY/),
        before: (s) => {
          s.power(false);
          s.power(true);
          s.clock.step(1.5);
        },
      },
      { id: "poke", type: `${FILL}\nRUN\n`, listing: FILL, done: (s) => FILL_BYTES.every((b, i) => s.machine.peek(FILL_AT + i) === b) },
      { id: "read", show: { tool: "cpu", address: FILL_AT }, more: true },
      { id: "usr", type: "POKE 16526,0:POKE 16527,125\n", done: (s) => s.machine.peek(16526) === 0 && s.machine.peek(16527) === 125 },
      {
        id: "stop",
        type: "X=USR(0)\n",
        show: { tool: "cpu", address: FILL_AT },
        done: (s) => s.clock.paused && s.machine.pc === FILL_AT,
        before: (s) => {
          s.clock.stops.add(FILL_AT);
          s.clock.resume();
        },
      },
      {
        id: "step",
        show: { tool: "cpu", address: FILL_AT },
        done: (s) => s.clock.paused && s.machine.vram[0] === 0xbf && s.machine.vram[2] === 0xbf,
        act: (s) => {
          for (let i = 0; i < 8; i++) s.clock.stepOnce();
        },
        more: true,
      },
      {
        id: "run",
        show: { tool: "cpu", address: FILL_AT },
        done: (s) => !s.clock.paused && [...s.machine.vram].filter((v) => v === 0xbf).length > 900,
        act: (s) => {
          s.clock.resume();
          s.clock.step(0.5);
        },
      },
      { id: "chips", type: "X=USR(0)\n", show: { mode: "3d", view: "inside" }, more: true },
      { id: "race", program: "race", show: { tool: "cpu", address: 32512 } },
    ],
  },
];

/**
 * Types a step's keys on the Model I's keyboard: characters through the typist, {BREAK} and
 * the like as keystrokes of their own.
 * @param {System} s
 * @param {string} text
 */
export function typeKeys(s, text) {
  for (const part of text.split(/(\{[A-Z]+\})/)) {
    const m = /^\{([A-Z]+)\}$/.exec(part);
    if (!m) {
      s.type(part);
      continue;
    }
    const k = keyNamed(m[1]);
    if (k && s.machine.powered) s.typist.stroke({ row: k.row, bit: k.bit, shift: false });
  }
}
