// SPDX-License-Identifier: Apache-2.0
//
// CPU-1: the vendored Z80 core runs ZEXDOC, Frank Cringle's exerciser of the documented
// instructions, to the end with no error (design/decisions.md, D3). ZEXDOC is GPL, so it
// is not in the repository: this test fetches it at a pinned commit into tests/.cache/
// (ignored by git) and checks its SHA-256. It takes over a minute, so it runs only when
// asked: `pnpm test:zexdoc`.
//
// It runs under a stand-in for CP/M: the program at 0100H, the BDOS at 0005H (a jump to a
// stub at F000H, which also tells the program where its stack goes), and 0000H ends the
// run. The stub prints through OUT (1) and ends through OUT (2).

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Cpu } from "../js/sim/cpu.js";

const SOURCE = "https://raw.githubusercontent.com/anotherlin/z80emu/1c418fa0d719abab9273131113defbe276101d95/testfiles/zexdoc.com";
const SHA256 = "34923a7ed82285d3038b2d54bd64899e12173eebb61f9d07b4fc72e78af2ae8f";
const CACHE = fileURLToPath(new URL(".cache/zexdoc.com", import.meta.url));

/** @returns {Promise<Uint8Array>} */
async function zexdoc() {
  if (!existsSync(CACHE)) {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`${SOURCE}: ${res.status}`);
    mkdirSync(fileURLToPath(new URL(".cache/", import.meta.url)), { recursive: true });
    writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
  }
  const data = readFileSync(CACHE);
  assert.equal(createHash("sha256").update(data).digest("hex"), SHA256, "zexdoc.com is not the pinned file");
  return new Uint8Array(data);
}

test("CPU-1: the Z80 core passes ZEXDOC, all 67 groups (D3)", { skip: !process.env.ZEXDOC && "pnpm test:zexdoc runs it (over a minute)", timeout: 30 * 60_000 }, async () => {
  const mem = new Uint8Array(0x10000);
  mem.set(await zexdoc(), 0x0100);
  mem.set([0xc3, 0x00, 0xf0], 0x0005); // 0005: JP F000H; (0006) = F000H, the stack's top
  // F000: the BDOS stub. C=2: print E. C=9: print the string at DE up to "$".
  // prettier-ignore
  mem.set([
    0x79,             //         LD A,C
    0xfe, 0x02,       //         CP 2
    0x28, 0x06,       //         JR Z,char     (F00B)
    0xfe, 0x09,       //         CP 9
    0x28, 0x06,       //         JR Z,string   (F00F)
    0xc9,             //         RET
    0x00,             //         (pad)
    0x7b,             // char:   LD A,E
    0xd3, 0x01,       //         OUT (1),A
    0xc9,             //         RET
    0x1a,             // string: LD A,(DE)
    0xfe, 0x24,       //         CP "$"
    0xc8,             //         RET Z
    0xd3, 0x01,       //         OUT (1),A
    0x13,             //         INC DE
    0x18, 0xf7,       //         JR string
  ], 0xf000);
  let out = "";
  let done = false;
  const cpu = new Cpu({
    read: (a) => mem[a],
    write: (a, v) => {
      mem[a] = v;
    },
    input: () => 0xff,
    output: (p, v) => {
      if ((p & 0xff) === 1) {
        out += String.fromCharCode(v);
        if (v === 10) process.stdout.write(`  ${out.split("\n").at(-2)}\n`);
      } else if ((p & 0xff) === 2) done = true;
    },
  });
  cpu.reset();
  mem.set([0xc3, 0x00, 0x01], 0x0000); // the reset vector jumps to 0100H...
  cpu.step();
  mem.set([0xd3, 0x02, 0x76], 0x0000); // ...and a jump back to 0000H ends the run: OUT (2),A; HALT
  while (!done) cpu.step();
  assert.match(out, /Tests complete/);
  assert.doesNotMatch(out, /ERROR/, out);
  assert.equal(out.match(/\.\.\s*OK\r?$/gm)?.length, 67, "67 groups");
});
