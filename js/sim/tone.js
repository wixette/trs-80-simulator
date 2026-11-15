// SPDX-License-Identifier: Apache-2.0
//
// Our tone routine (design/v0.0.3.md, S1): the few bytes of machine code our music and game
// programs POKE in from DATA lines and call with USR, as the type-in music programs of the
// time did. BASIC alone cannot toggle port FFH fast enough for a note.
//
// The program first lowers BASIC's top of memory below the routine, so that neither its
// strings nor its stack can overwrite it: POKE 16561,255 : POKE 16562,126 : CLEAR 50 (top of
// memory 7EFFH). Then it POKEs these bytes at 7F00H (32512), the routine's address into USR's
// (16526, 16527), the number of cycles to play at 7FF0H (32752, 32753), and calls USR(P),
// P being the length of each half of the wave, in turns of the delay loop.
//
//   7F00  CD 7F 0A     CALL 0A7FH       Level II: USR's argument into HL
//   7F03  ED 5B F0 7F  LD   DE,(7FF0H)  cycles to play
//   7F07  3E 01  loop  LD   A,1         the output high (+0.85 V)
//   7F09  D3 FF        OUT  (FFH),A
//   7F0B  44           LD   B,H
//   7F0C  4D           LD   C,L
//   7F0D  0B     d1    DEC  BC
//   7F0E  78           LD   A,B
//   7F0F  B1           OR   C
//   7F10  20 FB        JR   NZ,d1
//   7F12  3E 02        LD   A,2         the output low (0 V)
//   7F14  D3 FF        OUT  (FFH),A
//   7F16  44           LD   B,H
//   7F17  4D           LD   C,L
//   7F18  0B     d2    DEC  BC
//   7F19  78           LD   A,B
//   7F1A  B1           OR   C
//   7F1B  20 FB        JR   NZ,d2
//   7F1D  1B           DEC  DE
//   7F1E  7A           LD   A,D
//   7F1F  B3           OR   E
//   7F20  20 E5        JR   NZ,loop
//   7F22  AF           XOR  A           back to rest, the motor off
//   7F23  D3 FF        OUT  (FFH),A
//   7F25  C9           RET
//
// Each turn of a delay loop takes 26 T-states, and a half wave 26 P + 33 or so, so a note of
// f Hz has P = (1,774,080 / 2f - 33) / 26: A (440 Hz) is 76, middle C (262 Hz) 129.

export const TONE_ADDR = 0x7f00;
export const TONE_CYCLES = 0x7ff0;

export const TONE_BYTES = [
  0xcd, 0x7f, 0x0a, 0xed, 0x5b, 0xf0, 0x7f, 0x3e, 0x01, 0xd3, 0xff, 0x44, 0x4d, 0x0b, 0x78, 0xb1, 0x20, 0xfb, 0x3e, 0x02, 0xd3, 0xff, 0x44,
  0x4d, 0x0b, 0x78, 0xb1, 0x20, 0xfb, 0x1b, 0x7a, 0xb3, 0x20, 0xe5, 0xaf, 0xd3, 0xff, 0xc9,
];

/**
 * The BASIC lines that put the routine in place, numbered from `first` by `step`.
 * @param {number} first @param {number} [step]
 * @returns {string[]}
 */
export function toneLines(first, step = 1) {
  const data = [];
  for (let i = 0; i < TONE_BYTES.length; i += 19) data.push(TONE_BYTES.slice(i, i + 19).join(","));
  const n = (/** @type {number} */ i) => first + i * step;
  return [
    `${n(0)} POKE 16561,255:POKE 16562,126:CLEAR 50`,
    `${n(1)} FOR I=32512 TO ${32512 + TONE_BYTES.length - 1}:READ B:POKE I,B:NEXT I:POKE 16526,0:POKE 16527,127`,
    ...data.map((d, i) => `${n(2 + i)} DATA ${d}`),
  ];
}
