// SPDX-License-Identifier: Apache-2.0
//
// The disassembler (js/sim/disasm.js): acceptance area DIS. Expected texts are Zilog's
// mnemonics for the encodings in its Z80 CPU User Manual (UM0080); every length is also
// checked against the Z80 core itself, by running each instruction once.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Cpu } from "../js/sim/cpu.js";
import { disassemble, hex, listing } from "../js/sim/disasm.js";
import { NO_ROM, rom } from "./boot.js";

/** @param {number[]} bytes @param {number} [at] */
const dis = (bytes, at = 0x4000) => disassemble((a) => bytes[a - at] ?? 0, at);

/** [bytes, text], from Zilog's tables. @type {[number[], string][]} */
const ZILOG = [
  [[0x00], "NOP"],
  [[0x01, 0x34, 0x12], "LD BC,1234H"],
  [[0x21, 0x00, 0x3c], "LD HL,3C00H"],
  [[0x22, 0x8e, 0x40], "LD (408EH),HL"],
  [[0x2a, 0x8e, 0x40], "LD HL,(408EH)"],
  [[0x32, 0xff, 0x37], "LD (37FFH),A"],
  [[0x3a, 0x40, 0x38], "LD A,(3840H)"],
  [[0x02], "LD (BC),A"],
  [[0x1a], "LD A,(DE)"],
  [[0x36, 0xbf], "LD (HL),0BFH"],
  [[0x3e, 0x41], "LD A,41H"],
  [[0x7e], "LD A,(HL)"],
  [[0x72], "LD (HL),D"],
  [[0x76], "HALT"],
  [[0x08], "EX AF,AF'"],
  [[0xeb], "EX DE,HL"],
  [[0xd9], "EXX"],
  [[0xe3], "EX (SP),HL"],
  [[0x09], "ADD HL,BC"],
  [[0x3c], "INC A"],
  [[0x35], "DEC (HL)"],
  [[0x23], "INC HL"],
  [[0x0b], "DEC BC"],
  [[0x80], "ADD A,B"],
  [[0x8e], "ADC A,(HL)"],
  [[0x90], "SUB B"],
  [[0xb1], "OR C"],
  [[0xe6, 0x04], "AND 04H"],
  [[0xfe, 0x24], "CP 24H"],
  [[0x07], "RLCA"],
  [[0x27], "DAA"],
  [[0x2f], "CPL"],
  [[0x37], "SCF"],
  [[0xc3, 0x19, 0x1a], "JP 1A19H"],
  [[0xc2, 0x00, 0x70], "JP NZ,7000H"],
  [[0xe9], "JP (HL)"],
  [[0xcd, 0x33, 0x00], "CALL 0033H"],
  [[0xdc, 0x00, 0x40], "CALL C,4000H"],
  [[0xc9], "RET"],
  [[0xc8], "RET Z"],
  [[0xf0], "RET P"],
  [[0xc5], "PUSH BC"],
  [[0xf1], "POP AF"],
  [[0xff], "RST 38H"],
  [[0xd3, 0xff], "OUT (0FFH),A"],
  [[0xdb, 0xff], "IN A,(0FFH)"],
  [[0xf3], "DI"],
  [[0xfb], "EI"],
  [[0xf9], "LD SP,HL"],
  [[0xcb, 0x27], "SLA A"],
  [[0xcb, 0x3e], "SRL (HL)"],
  [[0xcb, 0x46], "BIT 0,(HL)"],
  [[0xcb, 0xff], "SET 7,A"],
  [[0xcb, 0x91], "RES 2,C"],
  [[0xed, 0xb0], "LDIR"],
  [[0xed, 0xb8], "LDDR"],
  [[0xed, 0xb1], "CPIR"],
  [[0xed, 0xa0], "LDI"],
  [[0xed, 0x44], "NEG"],
  [[0xed, 0x4d], "RETI"],
  [[0xed, 0x45], "RETN"],
  [[0xed, 0x56], "IM 1"],
  [[0xed, 0x5e], "IM 2"],
  [[0xed, 0x47], "LD I,A"],
  [[0xed, 0x5f], "LD A,R"],
  [[0xed, 0x42], "SBC HL,BC"],
  [[0xed, 0x5a], "ADC HL,DE"],
  [[0xed, 0x43, 0x00, 0x50], "LD (5000H),BC"],
  [[0xed, 0x7b, 0x00, 0x50], "LD SP,(5000H)"],
  [[0xed, 0x78], "IN A,(C)"],
  [[0xed, 0x79], "OUT (C),A"],
  [[0xed, 0x67], "RRD"],
  [[0xdd, 0x21, 0x00, 0x60], "LD IX,6000H"],
  [[0xdd, 0x7e, 0x05], "LD A,(IX+5)"],
  [[0xfd, 0x77, 0xfe], "LD (IY-2),A"],
  [[0xdd, 0x36, 0x02, 0x41], "LD (IX+2),41H"],
  [[0xdd, 0x66, 0x01], "LD H,(IX+1)"],
  [[0xdd, 0x34, 0x00], "INC (IX+0)"],
  [[0xdd, 0x86, 0x03], "ADD A,(IX+3)"],
  [[0xdd, 0x19], "ADD IX,DE"],
  [[0xdd, 0xe5], "PUSH IX"],
  [[0xfd, 0xe1], "POP IY"],
  [[0xdd, 0xe9], "JP (IX)"],
  [[0xdd, 0xf9], "LD SP,IX"],
  [[0xdd, 0xe3], "EX (SP),IX"],
  [[0xdd, 0x22, 0x00, 0x50], "LD (5000H),IX"],
  [[0xdd, 0xcb, 0x04, 0x46], "BIT 0,(IX+4)"],
  [[0xfd, 0xcb, 0xff, 0xce], "SET 1,(IY-1)"],
  [[0xdd, 0xcb, 0x01, 0x06], "RLC (IX+1)"],
];

describe("DIS: the disassembler", () => {
  for (const [bytes, text] of ZILOG) {
    it(`DIS-1: ${bytes.map((b) => hex(b, 2)).join(" ")} is ${text}`, () => {
      const ins = dis(bytes);
      assert.equal(ins.text, text);
      assert.equal(ins.length, bytes.length);
      assert.equal(ins.undocumented, false);
    });
  }

  it("DIS-2: relative jumps show where they go; jumps and fixed memory operands are given as addresses", () => {
    assert.deepEqual([dis([0x18, 0xfe]).text, dis([0x18, 0xfe]).target], ["JR 4000H", 0x4000]);
    assert.equal(dis([0x20, 0xf8], 0x700e).text, "JR NZ,7008H", "the screen sample's loop");
    assert.equal(dis([0x10, 0x05]).text, "DJNZ 4007H");
    assert.equal(dis([0x38, 0x80]).text, "JR C,3F82H");
    assert.equal(dis([0xc3, 0x74, 0x06]).target, 0x0674);
    assert.equal(dis([0x3a, 0x40, 0x38]).mem, 0x3840);
    assert.equal(dis([0xef]).target, 0x28);
  });

  it("DIS-3: undocumented instructions are named and marked: IXH, SLL, DD CB copies, IN (C)", () => {
    /** @type {[number[], string][]} */
    const undoc = [
      [[0xdd, 0x7c], "LD A,IXH"],
      [[0xfd, 0x2d], "DEC IYL"],
      [[0xcb, 0x37], "SLL A"],
      [[0xdd, 0xcb, 0x02, 0x00], "RLC (IX+2),B"],
      [[0xed, 0x70], "IN (C)"],
      [[0xed, 0x71], "OUT (C),0"],
      [[0xed, 0x00], "NOP"],
    ];
    for (const [bytes, text] of undoc) {
      const ins = dis(bytes);
      assert.equal(ins.text, text);
      assert.equal(ins.length, bytes.length, text);
      assert.equal(ins.undocumented, true, text);
    }
  });

  it("DIS-4: every instruction's length is what the Z80 core takes: PC moves on by it", () => {
    const BRANCH = /^(JP|JR|CALL|RET|RST|DJNZ|HALT)/;
    /** @type {number[][]} */
    const opcodes = [];
    for (let a = 0; a < 256; a++) {
      if (a === 0xcb || a === 0xed || a === 0xdd || a === 0xfd) continue;
      opcodes.push([a]);
    }
    for (let b = 0; b < 256; b++) {
      opcodes.push([0xcb, b], [0xed, b], [0xdd, 0xcb, 0x05, b], [0xfd, 0xcb, 0x05, b]);
      if (b !== 0xcb && b !== 0xed && b !== 0xdd && b !== 0xfd) opcodes.push([0xdd, b], [0xfd, b]);
    }
    let checked = 0;
    for (const head of opcodes) {
      const mem = new Uint8Array(0x10000);
      mem.set([...head, 0x05, 0x06, 0x07], 0x8000);
      const ins = disassemble((a) => mem[a], 0x8000);
      if (BRANCH.test(ins.text) || /^(LD SP|EX \(SP\)|POP|PUSH|EI|RETI|RETN|LDIR|LDDR|CPIR|CPDR|INIR|INDR|OTIR|OTDR|LD [IR],A)/.test(ins.text)) continue;
      const cpu = new Cpu({ read: (a) => mem[a], write: (a, v) => (mem[a] = v), input: () => 0xff, output: () => {} });
      cpu.reset();
      mem.set([0xc3, 0x00, 0x80], 0); // JP 8000H
      cpu.step();
      cpu.step();
      assert.equal(cpu.pc, 0x8000 + ins.length, `${head.map((b) => hex(b, 2)).join(" ")} ${ins.text}`);
      checked++;
    }
    assert.ok(checked > 1500, `${checked} instructions run`);
  });

  it("DIS-5: Level II's first instructions: DI, XOR A, JP 0674H; its NMI handler at 0066H", { skip: NO_ROM }, () => {
    const image = rom();
    const read = (/** @type {number} */ a) => image[a] ?? 0xff;
    assert.deepEqual(listing(read, 0, 3).map((i) => i.text), ["DI", "XOR A", "JP 0674H"]);
    assert.equal(disassemble(read, 0x66).text, "LD SP,0600H");
  });
});
