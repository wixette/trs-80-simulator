// SPDX-License-Identifier: Apache-2.0
//
// Our own machine-code program on a system tape (D7: no third-party software ships).
// Loaded with SYSTEM, name SCREEN, then "/" to run it.
//
// It writes every byte from 00H to FFH into the video RAM in turn, all 1,024 cells: the
// whole character set and the 2 x 3 block graphics, put there by the CPU with no BASIC in
// between. Then it waits for BREAK (row 6, bit 2: 3840H) and returns to BASIC's READY.
//
//   7000  21 00 3C     LD   HL,3C00H    the video RAM
//   7003  01 00 04     LD   BC,0400H    1,024 cells
//   7006  16 00        LD   D,00H
//   7008  72      loop LD   (HL),D
//   7009  14           INC  D
//   700A  23           INC  HL
//   700B  0B           DEC  BC
//   700C  78           LD   A,B
//   700D  B1           OR   C
//   700E  20 F8        JR   NZ,loop
//   7010  3A 40 38 wait LD  A,(3840H)   keyboard row 6
//   7013  E6 04        AND  04H         BREAK
//   7015  28 F9        JR   Z,wait
//   7017  C3 19 1A     JP   1A19H       Level II: READY

import { systemTape } from "./system-tape.js";

export const SCREEN_PROGRAM = {
  name: "SCREEN",
  addr: 0x7000,
  entry: 0x7000,
  bytes: [
    0x21, 0x00, 0x3c, 0x01, 0x00, 0x04, 0x16, 0x00, 0x72, 0x14, 0x23, 0x0b, 0x78, 0xb1, 0x20, 0xf8,
    0x3a, 0x40, 0x38, 0xe6, 0x04, 0x28, 0xf9, 0xc3, 0x19, 0x1a,
  ],
};

/** The sample as a .cas file's bytes. */
export function screenProgramCas() {
  const p = SCREEN_PROGRAM;
  return systemTape(p.name, [{ addr: p.addr, bytes: p.bytes }], p.entry);
}
