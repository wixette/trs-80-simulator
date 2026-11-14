// SPDX-License-Identifier: Apache-2.0
//
// The Model I's keyboard matrix: which switch each key closes, and its legends. From
// RetroStack's netlist-checked reference [rs-info] (docs/keyboard.md): eight rows, selected
// by address lines A0-A7 when the CPU reads 3800H-3BFFH, return eight columns on D0-D7.
//
//   3801H  row 0   @  A  B  C  D  E  F  G
//   3802H  row 1   H  I  J  K  L  M  N  O
//   3804H  row 2   P  Q  R  S  T  U  V  W
//   3808H  row 3   X  Y  Z  (bits 3-7 not wired)
//   3810H  row 4   0  1  2  3  4  5  6  7
//   3820H  row 5   8  9  :  ;  ,  -  .  /
//   3840H  row 6   ENTER CLEAR BREAK UP DOWN LEFT RIGHT SPACE
//   3880H  row 7   SHIFT (both SHIFT keys are one switch)
//
// The shifted legends are the keycaps' (the 1978 keyboard): ! " # $ % & ' ( ) * + < = > ?
// over 1-9 : ; , - . / ; 0 and @ have none. The numeric keypad is wired in parallel with
// 0-9, the period and ENTER, so the computer cannot tell them apart [rs-info].
//
// model/params/keyboard.json places these keys in 3D; tests/model.test.js holds the two
// to the same rows and bits.

/**
 * @typedef {object} Key
 * @property {string} name the key's name: its legend for a character, else ENTER, CLEAR, BREAK, UP, DOWN, LEFT, RIGHT, SPACE, SHIFT
 * @property {string} char the character it types unshifted ("" for a key that types none)
 * @property {string} shifted the character it types with SHIFT ("" for none)
 * @property {number} row 0-7
 * @property {number} bit 0-7
 */

const ROWS = [
  ["@", "A", "B", "C", "D", "E", "F", "G"],
  ["H", "I", "J", "K", "L", "M", "N", "O"],
  ["P", "Q", "R", "S", "T", "U", "V", "W"],
  ["X", "Y", "Z"],
  ["0", "1", "2", "3", "4", "5", "6", "7"],
  ["8", "9", ":", ";", ",", "-", ".", "/"],
  ["ENTER", "CLEAR", "BREAK", "UP", "DOWN", "LEFT", "RIGHT", "SPACE"],
  ["SHIFT"],
];

/** The shifted characters, by the unshifted key. */
const SHIFTED = /** @type {Record<string, string>} */ ({
  1: "!", 2: '"', 3: "#", 4: "$", 5: "%", 6: "&", 7: "'", 8: "(", 9: ")",
  ":": "*", ";": "+", ",": "<", "-": "=", ".": ">", "/": "?",
});

/** @type {readonly Key[]} every key of the matrix, row by row */
export const KEYS = ROWS.flatMap((names, row) =>
  names.map((name, bit) => ({
    name,
    char: name.length === 1 ? name : name === "SPACE" ? " " : name === "ENTER" ? "\n" : "",
    shifted: SHIFTED[name] ?? "",
    row,
    bit,
  })),
);

/** SHIFT: row 7, bit 0. */
export const SHIFT = /** @type {const} */ ({ row: 7, bit: 0 });

/** @type {ReadonlyMap<string, Key>} */
const BY_NAME = new Map(KEYS.map((k) => [k.name, k]));

/** A key by its name. @param {string} name @returns {Key | undefined} */
export const keyNamed = (name) => BY_NAME.get(name);

/** The key at a matrix position. @param {number} row @param {number} bit @returns {Key | undefined} */
export const keyAt = (row, bit) => KEYS.find((k) => k.row === row && k.bit === bit);

/** The address that reads one row. @param {number} row */
export const rowAddress = (row) => 0x3800 | (1 << row);

/**
 * @typedef {object} Stroke
 * @property {number} row
 * @property {number} bit
 * @property {boolean} shift whether SHIFT is held with it
 */

/**
 * Every character the keyboard can type, to the keystroke that types it. A character on
 * two keys (none on the Model I) takes the unshifted one.
 * @type {ReadonlyMap<string, Stroke>}
 */
export const STROKES = (() => {
  /** @type {Map<string, Stroke>} */
  const map = new Map();
  for (const k of KEYS) if (k.char) map.set(k.char, { row: k.row, bit: k.bit, shift: false });
  for (const k of KEYS) if (k.shifted && !map.has(k.shifted)) map.set(k.shifted, { row: k.row, bit: k.bit, shift: true });
  return map;
})();
