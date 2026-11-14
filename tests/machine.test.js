// SPDX-License-Identifier: Apache-2.0
//
// The Model I's memory map, video RAM, keyboard matrix and Level II BASIC: acceptance
// areas MEM, KEY, BAS and VID (design/v0.0.1.md, §6). Expected values are from RetroStack's
// reference [rs-info] (video.md, keyboard.md) and Level II's own screens, as cited.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockRows, CELL_H, glyph, setCell } from "../js/sim/charset.js";
import { KEYS, rowAddress, SHIFT, STROKES } from "../js/sim/keymap.js";
import { KEY_DOWN_T, KEY_UP_T } from "../js/sim/keys.js";
import { CLOCK_HZ, Machine, REGIONS, videoReadBack } from "../js/sim/machine.js";
import { boot, NO_ROM, ready } from "./boot.js";

describe("MEM: the memory map", () => {
  it("MEM-1: ROM at 0000H-2FFFH cannot be written", () => {
    const m = new Machine({ rom: new Uint8Array(0x3000).fill(0x5a) });
    m.write(0x0000, 0x00);
    m.write(0x2fff, 0x00);
    assert.equal(m.read(0x0000), 0x5a);
    assert.equal(m.read(0x2fff), 0x5a);
  });

  it("MEM-2: nothing answers at 3000H-37FFH or above the RAM on a bare machine: the bus reads FFH", () => {
    const m = new Machine();
    for (const a of [0x3000, 0x37e8, 0x37ff, 0x8000, 0xffff]) {
      m.write(a, 0x12);
      assert.equal(m.read(a), 0xff, a.toString(16));
    }
  });

  it("MEM-3: 16 KB of user RAM at 4000H-7FFFH; 4 KB ends at 4FFFH", () => {
    const m = new Machine();
    m.write(0x4000, 1);
    m.write(0x7fff, 2);
    assert.deepEqual([m.read(0x4000), m.read(0x7fff)], [1, 2]);
    const small = new Machine({ ramKb: 4 });
    small.write(0x4fff, 3);
    small.write(0x5000, 4);
    assert.deepEqual([small.read(0x4fff), small.read(0x5000)], [3, 0xff]);
  });

  it("MEM-4: the video RAM keeps seven bits; bit 6 reads back as NOR(bit 5, bit 7) [rs-info video]", () => {
    for (let b = 0; b < 256; b++) {
      const b5 = (b >> 5) & 1;
      const b7 = (b >> 7) & 1;
      const want = (b & 0xbf) | (b5 || b7 ? 0 : 0x40);
      assert.equal(videoReadBack(b), want, b.toString(16));
    }
    const m = new Machine();
    m.write(0x3c00, 0x61); // "a": lower case cannot be stored
    assert.equal(m.read(0x3c00), 0x21, "61H reads back as 21H, !");
    assert.equal(m.vram[0], 0x21, "bit 6 is not stored");
  });

  it("MEM-5: peek reads what the CPU would, without counting traffic or keyboard reads", () => {
    const m = new Machine({ rom: new Uint8Array(0x3000).fill(0x77) });
    m.write(0x4100, 9);
    m.takeTraffic();
    assert.deepEqual([m.peek(0x0100), m.peek(0x4100), m.peek(0x3000)], [0x77, 9, 0xff]);
    assert.deepEqual(m.takeTraffic(), { romA: 0, romB: 0, keyboard: 0, videoRead: 0, videoWrite: 0, ramRead: 0, ramWrite: 0 });
    assert.equal(m.anyScanT, -1);
  });

  it("MEM-6: the regions cover the 64 KB once, in order, with the board's chips named", () => {
    let next = 0;
    for (const r of REGIONS) {
      assert.equal(r.start, next, r.id);
      next = r.end + 1;
    }
    assert.equal(next, 0x10000);
    assert.equal(REGIONS.find((r) => r.id === "video")?.chips.length, 7, "seven 2102s [rs-info video]");
    assert.equal(REGIONS.find((r) => r.id === "ram")?.chips.length, 8, "eight 4116s");
  });
});

describe("KEY: the keyboard matrix", () => {
  it("KEY-1: 53 keys on 8 rows; the rows as rs-info lists them", () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7].map((r) => KEYS.filter((k) => k.row === r).map((k) => k.name).join(" "));
    assert.deepEqual(rows, [
      "@ A B C D E F G",
      "H I J K L M N O",
      "P Q R S T U V W",
      "X Y Z",
      "0 1 2 3 4 5 6 7",
      "8 9 : ; , - . /",
      "ENTER CLEAR BREAK UP DOWN LEFT RIGHT SPACE",
      "SHIFT",
    ]);
    assert.deepEqual(SHIFT, { row: 7, bit: 0 });
  });

  it("KEY-2: each key reads back on its row's address, and with all rows selected", () => {
    const m = new Machine();
    for (const k of KEYS) {
      m.keyDown(k.row, k.bit);
      assert.equal(m.read(rowAddress(k.row)), 1 << k.bit, k.name);
      assert.equal(m.read(0x38ff), 1 << k.bit, `${k.name}: all rows`);
      m.keyUp(k.row, k.bit);
      assert.equal(m.read(rowAddress(k.row)), 0, `${k.name} released`);
    }
  });

  it("KEY-3: two rows selected at once read as the OR of both", () => {
    const m = new Machine();
    m.keyDown(0, 1); // A
    m.keyDown(1, 2); // J
    assert.equal(m.read(0x3803), 0b110);
  });

  it("KEY-4: no diodes: three keys at the corners of a rectangle make the fourth read down (a ghost) [rs-info keyboard]", () => {
    const m = new Machine();
    m.keyDown(0, 1); // A: row 0, column 1
    m.keyDown(0, 2); // B: row 0, column 2
    m.keyDown(1, 1); // I: row 1, column 1
    assert.equal(m.read(rowAddress(1)), 0b110, "row 1 reads I and the ghost of J");
    m.keyUp(0, 1);
    assert.equal(m.read(rowAddress(1)), 0b010, "with A up, the ghost is gone");
    m.keyDown(6, 3); // UP and SPACE together: one row, no ghost
    m.keyDown(6, 7);
    assert.equal(m.read(rowAddress(6)), 0b10001000);
  });

  it("KEY-5: shifted characters are the keycaps' (1978 keyboard): \" is SHIFT 2, @ unshifted, ? is SHIFT /", () => {
    assert.deepEqual(STROKES.get('"'), { row: 4, bit: 2, shift: true });
    assert.deepEqual(STROKES.get("@"), { row: 0, bit: 0, shift: false });
    assert.deepEqual(STROKES.get("?"), { row: 5, bit: 7, shift: true });
    assert.deepEqual(STROKES.get("\n"), { row: 6, bit: 0, shift: false });
    assert.equal(STROKES.has("["), false);
  });

  it("KEY-6: a keystroke is held 70 ms and released 70 ms, in machine time (Level II's debounce is 18.8 and 51.3 ms [rs-info keyboard])", () => {
    assert.equal(KEY_DOWN_T, Math.round(0.07 * CLOCK_HZ));
    assert.equal(KEY_UP_T, Math.round(0.07 * CLOCK_HZ));
    assert.ok(KEY_DOWN_T / CLOCK_HZ > 0.0513);
  });
});

describe("BAS: Level II BASIC", { skip: NO_ROM }, () => {
  it("BAS-1: boots to MEMORY SIZE?; after ENTER, RADIO SHACK LEVEL II BASIC and READY", () => {
    const b = boot();
    b.run(1.5);
    assert.equal(b.screen().length, 1);
    assert.match(b.screen()[0], /^MEMORY SIZE\? _$/, "the prompt and Level II's cursor");
    b.type("\n", 1.5); // Level II sizes the memory first, about 0.6 s on 16 KB
    assert.deepEqual(b.screen().slice(0, 3), ["MEMORY SIZE?", "RADIO SHACK LEVEL II BASIC", "READY"]);
  });

  it("BAS-2: PRINT 2+2 typed on the keys prints 4, no letter dropped", () => {
    const b = ready();
    b.type("PRINT 2+2\n");
    assert.ok(b.screen().includes(">PRINT 2+2"), b.screen().join("|"));
    assert.ok(b.screen().includes(" 4"), b.screen().join("|"));
  });

  it("BAS-3: repeated letters and shifted symbols survive", () => {
    const b = ready();
    b.type('PRINT "HELLO (A=1)*2?"\n');
    assert.ok(b.screen().includes("HELLO (A=1)*2?"), b.screen().join("|"));
  });

  it("BAS-4: keys typed straight after MEMORY SIZE?'s ENTER wait for BASIC, and none is lost (D15)", () => {
    const b = boot();
    b.run(1.5);
    b.type('\nPRINT "HI"\n', 0.5);
    assert.ok(b.screen().includes('>PRINT "HI"'), b.screen().join("|"));
  });

  it("BAS-5: RESET is a non-maskable interrupt: Level II returns to READY and keeps the program", () => {
    const b = ready();
    b.type("10 PRINT 7\n");
    b.m.reset();
    b.run(1);
    b.type("LIST\n");
    assert.ok(b.screen().includes("10 PRINT 7"), b.screen().join("|"));
  });

  it("BAS-6: MEMORY SIZE? 32000 leaves memory above 32000 to the user (machine code by POKE and USR)", () => {
    const b = boot();
    b.run(1.5);
    b.type("32000\n", 0.5);
    b.type("PRINT MEM\n");
    const free = Number(b.screen().at(-3));
    assert.ok(free > 14000 && free < 32000 - 0x4000, `${free} bytes free below 32000`);
  });

  it("BAS-7: POKE 15360,193 then PEEK reads back 129: the video RAM keeps seven bits", () => {
    const b = ready();
    b.type("POKE 15360,193:PRINT PEEK(15360)\n");
    assert.ok(b.screen().includes(" 129"), b.screen().join("|"));
  });
});

describe("VID: the screen", () => {
  it("VID-1: a graphics byte lights 2 x 3 blocks of 3 dots by 4 lines, bit 0 top left to bit 5 bottom right", () => {
    assert.deepEqual(blockRows(0x80), new Array(CELL_H).fill(0));
    assert.deepEqual(blockRows(0xbf), new Array(CELL_H).fill(0b111111));
    assert.deepEqual(blockRows(0x81).slice(0, 5), [0b000111, 0b000111, 0b000111, 0b000111, 0]);
    assert.deepEqual(blockRows(0xa0).slice(7), [0, 0b111000, 0b111000, 0b111000, 0b111000]);
  });

  it("VID-2: characters come from the generator in 5 dots of a 6-dot cell; space is blank", () => {
    assert.deepEqual(glyph(0x20), new Array(CELL_H).fill(0));
    for (let c = 0x20; c < 0x60; c++) for (const row of glyph(c)) assert.equal(row & ~0x1f, 0, `${c.toString(16)}: within 5 dots`);
    assert.ok(glyph(0x41).some((r) => r !== 0), "A has dots");
  });

  it("VID-3: SET(x,y) lights bit (y mod 3)*2 + (x mod 2) of 3C00H + (y div 3)*64 + (x div 2)", { skip: NO_ROM }, () => {
    assert.deepEqual(setCell(0, 0), { cell: 0, bit: 0 });
    assert.deepEqual(setCell(127, 47), { cell: 1023, bit: 5 });
    const b = ready();
    b.type("CLS:SET(2,6):SET(5,7):SET(127,47)\n", 0.2);
    assert.equal(b.m.read(0x3c81), 0x81, "SET(2,6): row 2, column 1, bit 0");
    assert.equal(b.m.read(0x3c82) & 0x88, 0x88, "SET(5,7): row 2, column 2, bit 3");
    assert.equal(b.m.read(0x3fff) & 0xa0, 0xa0, "SET(127,47): the last cell, bit 5");
  });

  it("VID-4: PRINT CHR$(23) sets 32-column mode (port FFH bit 3); CLS clears it", { skip: NO_ROM }, () => {
    const b = ready();
    b.type("PRINT CHR$(23)\n");
    assert.equal(b.m.mode32, true);
    assert.equal(b.m.portFF & 0x08, 0x08);
    b.type("CLS\n");
    assert.equal(b.m.mode32, false);
  });
});
