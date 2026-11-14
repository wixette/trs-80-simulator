// SPDX-License-Identifier: Apache-2.0
//
// The Model I's character generator, as the hardware uses it (design/decisions.md, D4).
//
// The video circuit reads a byte from the video RAM (seven bits stored, bit 6 rebuilt as
// NOR(bit 5, bit 7)). With bit 7 clear, the byte addresses the MCM6670 character generator
// (Z29): xtrs's "CG 1", 12 lines of 6 dots. With bit 7 set the chip is bypassed, and
// discrete logic lights a 2 x 3 grid of blocks from bits 0-5, each block 3 dots wide and 4
// lines tall: bit 0 top left, bit 1 top right, bit 2 middle left ... bit 5 bottom right
// [rs-info video].

import { CG1 } from "./charset-data.js";

/** Dots in a cell, across and down. */
export const CELL_W = 6;
export const CELL_H = 12;

/**
 * A graphics byte's 2 x 3 blocks, as 12 rows of 6 dots (bit 0 the leftmost dot).
 * @param {number} code
 * @returns {number[]}
 */
export function blockRows(code) {
  const rows = [];
  for (let line = 0; line < CELL_H; line++) {
    const band = Math.floor(line / 4); // 0, 1, 2: the top, middle and bottom blocks
    let r = 0;
    if (code & (1 << (band * 2))) r |= 0b000111;
    if (code & (1 << (band * 2 + 1))) r |= 0b111000;
    rows.push(r);
  }
  return rows;
}

/** Every byte's 12 rows, bit 0 the leftmost dot. @type {readonly (readonly number[])[]} */
export const GLYPHS = Array.from({ length: 256 }, (_, code) => (code & 0x80 ? blockRows(code) : [...CG1[code & 0x7f]]));

/** The 12 rows the screen shows for a byte as the video RAM gives it back. @param {number} code */
export const glyph = (code) => GLYPHS[code & 0xff];

/**
 * Which SET block a byte's bit lights: its column (0 left, 1 right) and band (0 top, 1
 * middle, 2 bottom). SET(x, y) lights bit (y mod 3) x 2 + (x mod 2) of the byte at
 * 3C00H + (y div 3) x 64 + (x div 2) [rs-info video].
 * @param {number} bit 0-5
 */
export const blockOf = (bit) => ({ col: bit & 1, band: bit >> 1 });

/** The video RAM cell and bit SET(x, y) lights. @param {number} x 0-127 @param {number} y 0-47 */
export function setCell(x, y) {
  return { cell: Math.floor(y / 3) * 64 + (x >> 1), bit: (y % 3) * 2 + (x & 1) };
}
