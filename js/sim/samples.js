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
 * still asks MEMORY SIZE?, or is about to (just switched on, not yet READY); it reads
 * its line as a number, and throws anything else away as it asks again; else BREAK to stop whatever runs; then NEW, so no old line is left in, and the
 * listing, which ends with RUN. Keys between braces are keys ({ENTER}, {BREAK}).
 * @param {string[]} screen the screen's lines
 * @param {string} listing
 * @param {boolean} [starting] the machine was switched on a moment ago
 * @returns {{ asking: boolean, keys: string }}
 */
export function typeIn(screen, listing, starting = false) {
  // just switched on, before it asks (the screen still clearing, or blank), ENTER waits for the
  // question (the typist waits for the ROM to read the keyboard); a program that cleared the
  // screen gets its BREAK
  const last = screen.filter((l) => l.trim()).at(-1);
  const asking = (starting && !screen.includes("READY")) || /^MEMORY SIZE\?/.test(last ?? "");
  return { asking, keys: `${asking ? "{ENTER}" : "{BREAK}"}NEW\n${listing}` };
}

/**
 * A visitor's BASIC file, read for Type in a BASIC file (design/v0.0.3.md, S3): its lines, to
 * type in, or why it cannot be. Plain text only (a program saved by BASIC itself, as tokens, is
 * not), with a UTF-8 byte-order mark and an end-of-file Ctrl-Z forgiven; every line numbered,
 * but for a last RUN; ↑, the power operator, written as ^ or [, typed with the ↑ key ({UP},
 * as typeKeys reads it; a brace in the file itself has no key, so is refused).
 * @param {Uint8Array} bytes
 * @param {(text: string) => string[]} untypable the characters the Model I's keyboard lacks
 * @returns {{ text: string } | { error: "notText" | "noNumbers" | "untypable", chars?: string }}
 */
export function parseListing(bytes, untypable) {
  let b = bytes;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.subarray(3);
  const eof = b.indexOf(0x1a);
  if (eof >= 0) b = b.subarray(0, eof);
  // tokens: a program saved by BASIC itself ends its lines with 00H (Disk BASIC's file starts FFH)
  if (b[0] === 0xff || b.some((x) => x < 0x20 && x !== 0x0a && x !== 0x0d && x !== 0x09)) return { error: "notText" };
  // text, as UTF-8: a letter the Model I lacks (é, say) is named as one it cannot type
  const text = new TextDecoder().decode(b);
  const lines = text.replace(/\t/g, " ").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const numbered = (/** @type {string} */ l) => /^\d+/.test(l);
  const last = lines.at(-1);
  if (last !== undefined && /^RUN$/i.test(last) && lines.length > 1) lines.length -= 1;
  if (!lines.length || !lines.every(numbered)) return { error: "noNumbers" };
  const all = lines.join("\n") + "\n";
  const bad = untypable(all.replace(/[\^[]/g, ""));
  if (bad.length) return { error: "untypable", chars: bad.join(" ") };
  return { text: all.replace(/[\^[]/g, "{UP}") };
}
