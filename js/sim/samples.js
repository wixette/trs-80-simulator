// SPDX-License-Identifier: Apache-2.0
//
// Our own short Level II programs (D7), typed in for the visitor through the Model I's
// keys, as an owner typed a listing from a magazine. Every character is on the Model I's
// keyboard; tests/cassette.test.js checks that, and that each one runs. Their titles and
// descriptions are messages (`sample.<id>.title`, `.about` in js/l10n/en.js); the listing
// is the machine's own text.

/** @typedef {{ id: string, letter: string, text: string }} Sample `letter`: its CSAVE name on our sample tape */

/** @param {string[]} lines */
const listing = (lines) => lines.join("\n") + "\n";

/** @type {readonly Sample[]} */
export const SAMPLES = [
  {
    id: "set",
    letter: "S",
    text: listing([
      "10 CLS",
      "20 FOR X=0 TO 127:SET(X,0):SET(X,47):NEXT X",
      "30 FOR Y=0 TO 47:SET(0,Y):SET(127,Y):NEXT Y",
      "40 FOR I=0 TO 47:SET(I*2.6,I):NEXT I",
      "50 GOTO 50",
      "RUN",
    ]),
  },
  {
    id: "poke",
    letter: "P",
    text: listing([
      "10 CLS",
      "20 FOR I=0 TO 255:POKE 15360+128+I,I:NEXT I",
      '30 PRINT @ 704,"EVERY BYTE FROM 0 TO 255, POKED INTO THE SCREEN"',
      "40 GOTO 40",
      "RUN",
    ]),
  },
  {
    id: "bounce",
    letter: "B",
    text: listing([
      "10 CLS:X=10:Y=10:A=1:B=1",
      "20 SET(X,Y):FOR D=1 TO 15:NEXT D:RESET(X,Y)",
      "30 X=X+A:Y=Y+B",
      "40 IF X<1 OR X>126 THEN A=-A",
      "50 IF Y<1 OR Y>46 THEN B=-B",
      "60 GOTO 20",
      "RUN",
    ]),
  },
  {
    id: "keys",
    letter: "K",
    text: listing([
      "10 CLS:X=64:Y=24",
      "20 SET(X,Y):K=PEEK(14400)",
      "30 IF K AND 8 THEN Y=Y-1",
      "40 IF K AND 16 THEN Y=Y+1",
      "50 IF K AND 32 THEN X=X-1",
      "60 IF K AND 64 THEN X=X+1",
      "70 IF K AND 128 THEN CLS",
      "80 X=(X+128) AND 127:Y=(Y+48)-INT((Y+48)/48)*48",
      "90 GOTO 20",
      "RUN",
    ]),
  },
];

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
