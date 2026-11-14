# How it worked

**Date:** 2026-11-12. The circuit facts are from RetroStack's reference *The TRS-80 Model I, as established* (`[rs-info]`: `docs/video.md`, `keyboard.md`, `cassette.md`, `revisions.md`), which checks its claims against the KiCad netlists of RetroStack's board reconstructions, the 1978 Technical Manual and the ROM images. Where a fact is from general knowledge and not yet checked against a primary source, it says *to confirm*. The period sources (`[tm-1978]`, `[trh]`) are the next step.

## 1. The system

| Unit | Catalogue no. | What is in it |
|---|---|---|
| Keyboard unit ("the computer") | 26-1001 | The mainboard (Z80, ROM, RAM, video, keyboard and cassette circuits) and the keyboard, in one moulded case; power from an external supply. Revisions A, D/E (the same board) and G in the US, two Japanese boards `[rs-info revisions]` |
| Video Display | 26-1201 | A black-and-white RCA television without tuner or speaker, in Radio Shack's case; 12-inch tube (the CHM records "11-inch" diagonal); about 41–42 × 30.5 × 33 cm, 12–14 lb `[chm-102667566]`, `[chm-102766382]` |
| Cassette recorder | 14-841 (Realistic CTR-41) at launch; the simulator's is a CTR-80, 26-1205 (decisions D5) | A stock portable recorder: data in and out through the DIN cable, the motor switched by a relay in the computer |
| Power supply | – | An external transformer box *(to confirm: catalogue no., outputs)* |
| Expansion Interface (later) | 26-1140 | Up to 32 KB more RAM, a floppy controller, a printer port, an RS-232 option, a real-time clock interrupt; sits under the monitor `[reed-m1]` |

## 2. The memory map

*(To confirm against the Technical Manual; the addresses below are the standard ones every emulator uses.)*

| Address | What | Note |
|---|---|---|
| 0000–0FFF | ROM, Level I BASIC (4 KB) | |
| 0000–2FFF | ROM, Level II BASIC (12 KB) | in place of Level I |
| 37E0–37FF | Expansion Interface devices | absent on a bare machine |
| **3800–3BFF** | **The keyboard**, read as memory | §4 |
| **3C00–3FFF** | **The video RAM**, 1,024 bytes, 64 × 16 | §3 |
| 4000–4FFF / 7FFF | User RAM, 4 KB or 16 KB | up to FFFF (48 KB) with the Expansion Interface |
| Port FF | Cassette out, cassette motor, 32/64-column mode; cassette in on read | §5 |

**There are no I/O chips for the screen or the keyboard.** The screen is a kilobyte of RAM that the video circuit reads on its own; the keyboard is a matrix of switches wired onto the address and data buses. This is the machine's "own idea" in hardware.

## 3. The screen

From `[rs-info video]`:

- **1,024 bytes at 3C00–3FFF,** one per character, 64 columns × 16 rows, left to right, top to bottom. No attributes, no scroll register. The CPU writes a byte; the next frame shows it. (Writing during display causes the famous "snow"; *to confirm the mechanism*: RetroStack notes the CPU is *not* locked out, so the snow is the video and CPU sharing the RAM's address lines.)
- **Each cell is 6 dots × 12 lines,** so the picture is 384 × 192 dots, not square (about 2 : 1). The character generator (an MCM6670, `Z29`) gives 5 × 8 dots; the rest is spacing.
- **Seven bits stored, one rebuilt.** The video RAM is seven 2102 chips. Bit 6 is not stored but recomputed on the way out as `NOR(D5, D7)`. So `A` (41h) survives, but lower case (61h–7Ah) cannot be stored at all. **This is why the Model I has no lower case,** and it is the $1.50 saving of the history notes, visible as one missing chip on the board. A student can see it: `POKE 15360,193` reads back as 129.
- **Block graphics:** a byte with bit 7 set skips the character generator. Its bits 0–5 light a 2 × 3 grid of blocks in the cell; `SET(x, y)`, `RESET`, `POINT` address a 128 × 48 grid:
  `address = 3C00h + (y ÷ 3) × 64 + (x ÷ 2)`, `bit = 1 << ((y mod 3) × 2 + (x mod 2))`.
- **Six character-generator images exist** (the earliest with a "floating a"); which one to show is a decision for the design.
- **32-column mode:** a bit of port FF doubles the dot width, so only even columns show *(to confirm which bit)*.

## 4. The keyboard

From `[rs-info keyboard]`:

- **An 8 × 8 matrix on its own PCB.** Address lines A0–A7 drive the eight rows through open-collector inverters (74LS05); eight columns return on D0–D7 through tri-state buffers (74LS368), enabled when the CPU reads 3800–3BFF.
- **A read is the OR of every selected row.** Reading 3801h reads row 0 (`@ A B C D E F G`); 3880h reads row 7, SHIFT. Reading 38FFh would read them all at once.
- **No diodes and no debounce hardware.** Ghosting is real; debouncing is the ROM's job, by timed delays (18.8 ms and 51.3 ms, measured in T-states). This is why emulators drop the second `P` of `PRINT` when a key is "pressed" too briefly, and a design constraint for our on-screen keyboard.
- **The numeric keypad (on later units) is wired in parallel** with the main keys `0`–`9`, `.` and ENTER: software cannot tell them apart.
- **Both SHIFT keys are one switch.**
- The ROM turns the row and column into a character by arithmetic (`row × 8 + col + 40h` for the letters), which is short enough to show a student.

The keyboard is the second thread for the zoom ladder: key → its row and column → the address line that selects the row → the data bit that comes back → the ROM's arithmetic → the character.

## 5. The cassette

From `[rs-info cassette]`:

- **Out:** two bits of a latch on port FF drive a resistor ladder: three levels (0.46 V at rest, 0.85 V, 0 V). The ROM makes every pulse in software.
- **In:** an LM3900 amplifier sets a flip-flop; any write to port FF clears it; the ROM reads bit 7 of port FF to see whether a pulse came in its window. There is no UART; **the tape format is entirely software**: a 255-byte leader of zeros, a sync byte, then a clock pulse and a data pulse per bit.
- **Speeds:** 250 baud under Level I, 500 under Level II `[reed-m1]`.
- **The motor:** a relay (`K1`) on another latch bit, through the DIN socket's REM pins: the computer starts and stops the tape.

For the simulator the recorder is a sound source and sink. Kesteloot's `trs80-cassette` already decodes real cassette recordings into CAS files (MIT), and can be a reference.

## 6. The CPU and timing

- Z80 at 1.774 MHz (10.6445 MHz crystal ÷ 6, *to confirm*), the same CPU family as the 8080 the Altair simulator runs, plus its extra registers and instructions.
- **No timer interrupt on the bare machine** (the Expansion Interface adds a 40 Hz one, *to confirm*). Level I and II time everything (keyboard debounce, cassette bits) by counting instructions, so the emulator must count T-states faithfully. A cycle-counted Z80 is required, not a fast approximate one.
- The CPU is never halted for the video: the screen is read through multiplexers between CPU cycles `[rs-info video]`.

## 7. What a faithful simulator needs

| Part | Behaviour required | Source quality |
|---|---|---|
| Z80 | Every documented and undocumented instruction, exact T-states | Excellent: open cores with test suites exist (ZEXALL, FUSE tests) |
| Memory map | §2, with the 7-bit video RAM | Excellent: netlist-checked `[rs-info]` |
| Video | 64 × 16 (and 32 × 16), a period character generator, block graphics, the aspect ratio | Excellent: generator images are documented; ROM dumps exist |
| Keyboard | 8 × 8 matrix at 3800h, timing a press so the ROM sees it | Excellent `[rs-info keyboard]` |
| Cassette | Port FF out and in, the motor relay, the audio waveform | Good: the circuit and format are documented; real recordings exist |
| ROMs | Level I and Level II images | Available; how Level II ships here: [../design/decisions.md](../design/decisions.md), D2 |

**Everything the simulator needs is documented at circuit level.** None of it rests on a guess.
