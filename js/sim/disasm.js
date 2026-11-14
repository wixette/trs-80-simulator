// SPDX-License-Identifier: Apache-2.0
//
// A Z80 disassembler for the CPU & Memory tool: one instruction at an address, in Zilog's
// mnemonics, numbers in hex with an H as the Model I's manuals write them (LD HL,3C00H).
// Relative jumps show where they go. Undocumented instructions the core runs (IXH, SLL,
// ED aliases) are named as the usual references do, and marked.
//
// The decoding follows the opcode's fields, as Zilog's tables are laid out: x = bits 7-6,
// y = bits 5-3, z = bits 2-0, p = y >> 1, q = y & 1 (C. Dinu, "Decoding Z80 opcodes",
// z80.info, after Zilog's Z80 CPU User Manual, UM0080).

/**
 * @typedef {object} Instruction
 * @property {number} addr
 * @property {number} length 1-4 bytes
 * @property {number[]} bytes
 * @property {string} text e.g. "LD HL,3C00H"
 * @property {boolean} undocumented
 * @property {number} [target] the address a jump, call or relative jump goes to
 * @property {number} [mem] the address a fixed memory operand names, (nn)
 */

const R = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
const RP = ["BC", "DE", "HL", "SP"];
const RP2 = ["BC", "DE", "HL", "AF"];
const CC = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"];
const ALU = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND ", "XOR ", "OR ", "CP "];
const ROT = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"];
const IM = ["0", "0", "1", "2", "0", "0", "1", "2"];
const BLOCK = [
  ["LDI", "CPI", "INI", "OUTI"],
  ["LDD", "CPD", "IND", "OUTD"],
  ["LDIR", "CPIR", "INIR", "OTIR"],
  ["LDDR", "CPDR", "INDR", "OTDR"],
];

/** A byte or word in hex, with H; a leading 0 when it starts with a letter (0FFH). @param {number} v @param {number} digits */
export function hex(v, digits) {
  const s = v.toString(16).toUpperCase().padStart(digits, "0");
  return `${/^[A-F]/.test(s) ? "0" : ""}${s}H`;
}

/** A signed displacement, +5 or -3. @param {number} d */
const disp = (d) => (d < 128 ? `+${d}` : `-${256 - d}`);

/**
 * The instruction at `addr`.
 * @param {(addr: number) => number} read reads memory with no side effect
 * @param {number} addr
 * @returns {Instruction}
 */
export function disassemble(read, addr) {
  /** @type {number[]} */
  const bytes = [];
  let pc = addr & 0xffff;
  const next = () => {
    const b = read(pc) & 0xff;
    bytes.push(b);
    pc = (pc + 1) & 0xffff;
    return b;
  };
  const n = () => hex(next(), 2);
  const word = () => {
    const lo = next();
    return lo | (next() << 8);
  };
  let undocumented = false;
  /** @type {number | undefined} */
  let target;
  /** @type {number | undefined} */
  let mem;
  const nn = () => {
    const w = word();
    return hex(w, 4);
  };
  const jumpTo = () => {
    target = word();
    return hex(target, 4);
  };
  const memAt = () => {
    mem = word();
    return `(${hex(mem, 4)})`;
  };
  const rel = () => {
    const d = next();
    target = (pc + (d < 128 ? d : d - 256)) & 0xffff;
    return hex(target, 4);
  };

  let op = next();
  /** IX or IY for a DD or FD prefix, or "" */
  let ix = "";
  if (op === 0xdd || op === 0xfd) {
    ix = op === 0xdd ? "IX" : "IY";
    op = next();
  }
  /** The displacement of an (IX+d), read when first needed. @type {number | null} */
  let d = null;
  const idx = () => {
    if (d === null) d = next();
    return `(${ix}${disp(d)})`;
  };
  /** A register by number; with a prefix, H, L and (HL) become IXH, IXL and (IX+d). @param {number} i @param {boolean} [plain] H and L stay themselves (beside an (IX+d)) */
  const r = (i, plain = false) => {
    if (!ix) return R[i];
    if (i === 6) return idx();
    if ((i === 4 || i === 5) && !plain) {
      undocumented = true;
      return `${ix}${i === 4 ? "H" : "L"}`;
    }
    return R[i];
  };
  const rp = (/** @type {number} */ p) => (ix && p === 2 ? ix : RP[p]);
  const rp2 = (/** @type {number} */ p) => (ix && p === 2 ? ix : RP2[p]);
  const hl = () => ix || "HL";

  /** @returns {string} */
  const decode = () => {
    if (op === 0xcb) return cb();
    if (op === 0xed) return ed();
    const x = op >> 6;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;
    if (x === 0) {
      switch (z) {
        case 0:
          if (y === 0) return "NOP";
          if (y === 1) return "EX AF,AF'";
          if (y === 2) return `DJNZ ${rel()}`;
          if (y === 3) return `JR ${rel()}`;
          return `JR ${CC[y - 4]},${rel()}`;
        case 1:
          return q ? `ADD ${hl()},${rp(p)}` : `LD ${rp(p)},${nn()}`;
        case 2:
          if (p === 0) return q ? "LD A,(BC)" : "LD (BC),A";
          if (p === 1) return q ? "LD A,(DE)" : "LD (DE),A";
          if (p === 2) return q ? `LD ${hl()},${memAt()}` : `LD ${memAt()},${hl()}`;
          return q ? `LD A,${memAt()}` : `LD ${memAt()},A`;
        case 3:
          return `${q ? "DEC" : "INC"} ${rp(p)}`;
        case 4:
          return `INC ${r(y)}`;
        case 5:
          return `DEC ${r(y)}`;
        case 6: {
          const dest = r(y);
          return `LD ${dest},${n()}`;
        }
        default:
          return ["RLCA", "RRCA", "RLA", "RRA", "DAA", "CPL", "SCF", "CCF"][y];
      }
    }
    if (x === 1) {
      if (op === 0x76) return "HALT";
      // with (IX+d) on one side, the other side's H and L are the real H and L
      const mixed = ix && (y === 6 || z === 6);
      return `LD ${r(y, !!mixed)},${r(z, !!mixed)}`;
    }
    if (x === 2) return `${ALU[y]}${r(z)}`;
    switch (z) {
      case 0:
        return `RET ${CC[y]}`;
      case 1:
        if (q === 0) return `POP ${rp2(p)}`;
        return ["RET", "EXX", `JP (${hl()})`, `LD SP,${hl()}`][p];
      case 2:
        return `JP ${CC[y]},${jumpTo()}`;
      case 3:
        switch (y) {
          case 0:
            return `JP ${jumpTo()}`;
          case 2:
            return `OUT (${n()}),A`;
          case 3:
            return `IN A,(${n()})`;
          case 4:
            return `EX (SP),${hl()}`;
          case 5:
            return "EX DE,HL";
          case 6:
            return "DI";
          case 7:
            return "EI";
        }
        return "?";
      case 4:
        return `CALL ${CC[y]},${jumpTo()}`;
      case 5:
        if (q === 0) return `PUSH ${rp2(p)}`;
        return p === 0 ? `CALL ${jumpTo()}` : "?";
      case 6:
        return `${ALU[y]}${n()}`;
      default:
        target = y * 8;
        return `RST ${hex(y * 8, 2)}`;
    }
  };

  /** The CB page: rotations, shifts and bits; with a prefix, DD CB d op. */
  const cb = () => {
    if (ix) d = next();
    const o = next();
    const x = o >> 6;
    const y = (o >> 3) & 7;
    const z = o & 7;
    const operand = ix ? `(${ix}${disp(/** @type {number} */ (d))})` : R[z];
    // DD CB d op with z != 6 also copies the result to a register (undocumented)
    const copy = ix && z !== 6 ? `,${R[z]}` : "";
    if (copy) undocumented = true;
    if (x === 0) {
      if (y === 6) undocumented = true; // SLL
      return `${ROT[y]} ${operand}${copy}`;
    }
    if (x === 1) return `BIT ${y},${operand}`;
    return `${x === 2 ? "RES" : "SET"} ${y},${operand}${copy}`;
  };

  /** The ED page. */
  const ed = () => {
    const o = next();
    const x = o >> 6;
    const y = (o >> 3) & 7;
    const z = o & 7;
    const p = y >> 1;
    const q = y & 1;
    if (x === 1) {
      switch (z) {
        case 0:
          if (y === 6) undocumented = true;
          return y === 6 ? "IN (C)" : `IN ${R[y]},(C)`;
        case 1:
          if (y === 6) undocumented = true;
          return y === 6 ? "OUT (C),0" : `OUT (C),${R[y]}`;
        case 2:
          return `${q ? "ADC" : "SBC"} HL,${RP[p]}`;
        case 3:
          return q ? `LD ${RP[p]},${memAt()}` : `LD ${memAt()},${RP[p]}`;
        case 4:
          if (y !== 0) undocumented = true;
          return "NEG";
        case 5:
          if (y !== 0 && y !== 1) undocumented = true;
          return y === 1 ? "RETI" : "RETN";
        case 6:
          if (y !== 0 && y !== 2 && y !== 3) undocumented = true;
          return `IM ${IM[y]}`;
        default:
          return ["LD I,A", "LD R,A", "LD A,I", "LD A,R", "RRD", "RLD", "NOP", "NOP"][y];
      }
    }
    if (x === 2 && z <= 3 && y >= 4) return BLOCK[y - 4][z];
    undocumented = true;
    return "NOP";
  };

  let text = decode();
  if (ix && !text.includes(ix)) {
    // a DD or FD before an instruction that has no HL to replace does nothing: the CPU
    // takes it as an instruction of its own, 4 T-states long, and runs the next byte after
    text = `DEFB ${hex(bytes[0], 2)}`;
    bytes.length = 1;
    undocumented = true;
    target = undefined;
    mem = undefined;
  }
  /** @type {Instruction} */
  const ins = { addr: addr & 0xffff, length: bytes.length, bytes, text, undocumented };
  if (target !== undefined) ins.target = target;
  if (mem !== undefined) ins.mem = mem;
  return ins;
}

/**
 * Instructions from an address, one after another.
 * @param {(addr: number) => number} read
 * @param {number} addr
 * @param {number} count
 * @returns {Instruction[]}
 */
export function listing(read, addr, count) {
  /** @type {Instruction[]} */
  const out = [];
  let a = addr & 0xffff;
  for (let i = 0; i < count; i++) {
    const ins = disassemble(read, a);
    out.push(ins);
    a = (a + ins.length) & 0xffff;
  }
  return out;
}
