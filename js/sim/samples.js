// SPDX-License-Identifier: Apache-2.0
//
// Our own Level II programs (D7), in js/programs/ by section, typed in for the visitor through
// the Model I's keys, as an owner typed a listing from a magazine, or put in on their tapes. Every character is on the Model I's
// keyboard; tests/cassette.test.js checks that, and that each one runs. Their titles and
// descriptions are messages (`sample.<id>.title`, `.about` in js/l10n/en.js); the listing
// is the machine's own text.

/**
 * @typedef {"learn" | "games" | "utilities" | "music"} Section
 * @typedef {object} Sample
 * @property {string} id
 * @property {Section} section where Programs lists it (design/v0.0.3.md, S2)
 * @property {string} letter its CSAVE name on its tape
 * @property {string} text the listing, ending with RUN
 */

import { GAMES } from "../programs/games.js";
import { LEARN } from "../programs/learn.js";
import { MUSIC } from "../programs/music.js";
import { UTILITIES } from "../programs/utilities.js";

/** Programs' sections, in the menu's order. @type {readonly Section[]} */
export const SECTIONS = ["learn", "games", "utilities", "music"];

/** @type {readonly Sample[]} */
export const SAMPLES = [...LEARN, ...GAMES, ...UTILITIES, ...MUSIC];

/** A listing this long or longer is typed in faster at first (S2): at the usual speed it takes over a minute. */
export const LONG = 1200;

/** A sample's listing without its RUN, as it is stored. @param {Sample} s */
export const program = (s) => s.text.replace(/RUN\n$/, "");

/**
 * What Type it in types (docs/ui-design.md, U8), as an owner did: ENTER first if the machine
 * still asks MEMORY SIZE? (it reads its line as a number, and throws anything else away as it
 * asks again), else BREAK to stop whatever runs; then NEW, so no old line is left in, and the
 * listing, which ends with RUN. Keys between braces are keys ({ENTER}, {BREAK}).
 * @param {string[]} screen the screen's lines
 * @param {string} listing
 * @returns {{ asking: boolean, keys: string }}
 */
export function typeIn(screen, listing) {
  const asking = /^MEMORY SIZE\?/.test(screen.filter((l) => l.trim()).at(-1) ?? "");
  return { asking, keys: `${asking ? "{ENTER}" : "{BREAK}"}NEW\n${listing}` };
}
