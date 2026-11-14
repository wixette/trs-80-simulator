// SPDX-License-Identifier: Apache-2.0
//
// What a Level II tape holds. Two kinds, as Level II reads them after the leader of zeros
// and the sync byte A5H [rs-info cassette], [l2-ref]:
//
// A BASIC tape, written by CSAVE and read by CLOAD:
//   D3H D3H D3H name             the header, and a one-letter name
//   ...                          the program as it is in memory: lines and tokens
//
// A system tape, machine code read by SYSTEM (D7):
//   55H                          a system tape
//   6 bytes                      the name, padded with spaces (typed at the *? prompt)
//   3CH n lo hi d1 ... dn cs     a block of n bytes (0 means 256) loaded at hi:lo;
//                                cs = (lo + hi + d1 + ... + dn) mod 256
//   ...                          more blocks
//   78H lo hi                    the end, and the address "/" jumps to

/** @typedef {{ addr: number, bytes: ArrayLike<number> }} Block */
/**
 * @typedef {{ kind: "system", name: string, blocks: Block[], entry: number, bad: number[] }
 *   | { kind: "basic", name: string }
 *   | { kind: "unknown" }} TapeInfo
 */

/** Leader zeros before the sync byte, as the ROM's own CSAVE writes them. */
const LEADER = 255;

/**
 * The bytes of a system tape, as a .cas file.
 * @param {string} name up to 6 characters
 * @param {Block[]} blocks each split into blocks of at most 256 bytes
 * @param {number} entry
 * @returns {Uint8Array}
 */
export function systemTape(name, blocks, entry) {
  /** @type {number[]} */
  const out = new Array(LEADER).fill(0);
  out.push(0xa5, 0x55);
  for (const c of name.toUpperCase().slice(0, 6).padEnd(6, " ")) out.push(c.charCodeAt(0));
  for (const b of blocks) {
    for (let i = 0; i < b.bytes.length; i += 256) {
      const chunk = Array.from(b.bytes).slice(i, i + 256);
      const addr = b.addr + i;
      const lo = addr & 0xff;
      const hi = (addr >> 8) & 0xff;
      let cs = lo + hi;
      out.push(0x3c, chunk.length & 0xff, lo, hi);
      for (const d of chunk) {
        out.push(d);
        cs += d;
      }
      out.push(cs & 0xff);
    }
  }
  out.push(0x78, entry & 0xff, (entry >> 8) & 0xff);
  return new Uint8Array(out);
}

/**
 * What a tape's bytes hold: a system tape (its name, blocks, entry and the blocks with a
 * bad checksum), a BASIC tape (its name), or neither.
 * @param {ArrayLike<number>} bytes
 * @returns {TapeInfo}
 */
export function tapeInfo(bytes) {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (bytes[i] !== 0xa5) return { kind: "unknown" };
  i++;
  if (bytes[i] === 0xd3 && bytes[i + 1] === 0xd3 && bytes[i + 2] === 0xd3) return { kind: "basic", name: String.fromCharCode(bytes[i + 3] ?? 0x20) };
  if (bytes[i] !== 0x55) return { kind: "unknown" };
  i++;
  let name = "";
  for (let k = 0; k < 6; k++) name += String.fromCharCode(bytes[i + k] ?? 0x20);
  i += 6;
  /** @type {Block[]} */
  const blocks = [];
  /** @type {number[]} */
  const bad = [];
  while (i < bytes.length && bytes[i] === 0x3c) {
    const n = bytes[i + 1] || 256;
    const lo = bytes[i + 2];
    const hi = bytes[i + 3];
    const data = Array.from({ length: n }, (_, k) => bytes[i + 4 + k]);
    let cs = lo + hi;
    for (const d of data) cs += d;
    if ((cs & 0xff) !== bytes[i + 4 + n]) bad.push(blocks.length);
    blocks.push({ addr: lo | (hi << 8), bytes: data });
    i += 5 + n;
  }
  if (bytes[i] !== 0x78) return { kind: "unknown" };
  return { kind: "system", name: name.trimEnd(), blocks, entry: bytes[i + 1] | (bytes[i + 2] << 8), bad };
}

/**
 * What one byte of a recording is. The page words each role (js/l10n/en.js, `role.*`).
 * @typedef {object} ByteRole
 * @property {"leader" | "sync" | "basicHeader" | "basicName" | "basicProgram" | "systemHeader" | "systemName" | "blockStart" | "blockCount" | "blockAddrLo" | "blockAddrHi" | "blockData" | "blockChecksum" | "end" | "entryLo" | "entryHi" | "after" | "unknown"} role
 * @property {number} [block] the block, from 1
 * @property {number} [index] the letter of a name, from 1; the byte's count in a block
 * @property {number} [addr] the address a byte is loaded at, or the block's, or the entry
 * @property {string} [name] a BASIC tape's name
 */

/**
 * What each byte of a recording is, for showing a tape as it plays.
 * @param {ArrayLike<number>} bytes from the leader on (cassette.js, decode)
 * @returns {ByteRole[]}
 */
export function byteRoles(bytes) {
  /** @type {ByteRole[]} */
  const out = [];
  let i = 0;
  const rest = (/** @type {ByteRole["role"]} */ role) => {
    while (i < bytes.length) out[i++] = { role };
  };
  while (i < bytes.length && bytes[i] === 0) out[i++] = { role: "leader" };
  if (bytes[i] !== 0xa5) {
    rest("unknown");
    return out;
  }
  out[i++] = { role: "sync" };
  if (bytes[i] === 0xd3 && bytes[i + 1] === 0xd3 && bytes[i + 2] === 0xd3) {
    for (let k = 0; k < 3; k++) out[i++] = { role: "basicHeader" };
    out[i] = { role: "basicName", name: String.fromCharCode(bytes[i] ?? 0x20) };
    i++;
    rest("basicProgram");
    return out;
  }
  if (bytes[i] !== 0x55) {
    rest("unknown");
    return out;
  }
  out[i++] = { role: "systemHeader" };
  for (let k = 0; k < 6 && i < bytes.length; k++) out[i++] = { role: "systemName", index: k + 1 };
  let block = 0;
  while (i < bytes.length && bytes[i] === 0x3c) {
    block++;
    const n = bytes[i + 1] || 256;
    const addr = (bytes[i + 2] ?? 0) | ((bytes[i + 3] ?? 0) << 8);
    out[i++] = { role: "blockStart", block };
    out[i++] = { role: "blockCount", block, index: n };
    out[i++] = { role: "blockAddrLo", block, addr };
    out[i++] = { role: "blockAddrHi", block, addr };
    for (let k = 0; k < n && i < bytes.length; k++) out[i++] = { role: "blockData", block, addr: (addr + k) & 0xffff };
    if (i < bytes.length) out[i++] = { role: "blockChecksum", block };
  }
  if (bytes[i] === 0x78) {
    const entry = (bytes[i + 1] ?? 0) | ((bytes[i + 2] ?? 0) << 8);
    out[i++] = { role: "end" };
    if (i < bytes.length) out[i++] = { role: "entryLo", addr: entry };
    if (i < bytes.length) out[i++] = { role: "entryHi", addr: entry };
  }
  rest("after");
  return out;
}
