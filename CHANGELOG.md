# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md)). Versions 0.0.x are pre-releases. The decisions cited (D1, U10, …) are in [design/decisions.md](design/decisions.md) and [docs/ui-design.md](docs/ui-design.md).

## 0.0.1

The first pre-release. Every feature of the machine works, and six lessons are complete.

**The machine**
- Level II BASIC v1.2 on an emulated Z80 at 1.77408 MHz, with exact T-states (D2, D3).
  - The Z80 core passes ZEXDOC in all 67 groups (`pnpm test:zexdoc`).
  - The memory map, the 7-bit video RAM with bit 6 rebuilt, and the keyboard matrix with ghost keys (D14).
  - RESET as a non-maskable interrupt, and 32-column mode.
- The keyboard:
  - the visitor's keys are the Model I's, held as long as they are held;
  - SHIFT is worked out for each character;
  - fast typing is put in letter by letter (D17);
  - typed text waits for the program to read the keys (D15).
- The cassette (D5, D7, D13, D16):
  - pulses at Level II's own timing, with the CTR-80's six keys and the computer's motor relay;
  - `CSAVE`, `CLOAD` and `SYSTEM` tapes; `.cas` and `.wav` in and out;
  - Fast tape, and the tape's sound;
  - our own sample tapes, recorded at run time by a second Model I.
- The character set: xtrs's "CG 1", with the 2 × 3 block graphics (D4).

**The page**
- The desk in 3D, built from parameters (D8), with Views (Desk, Keyboard, Screen, Recorder, Rear, Inside) and See inside, the chips lit by their memory traffic.
  - The machine's own controls are clickable where they are, with helpers for POWER and RESET (U4).
  - Taking it apart works only with the computer off; *Put it all back* is one press (D11, U3).
- The 2D view: flat drawings of the machine's own faces, from the same parameters (D10).
  - A `[2D | 3D]` toggle with a camera flight and a cross-fade (U1). 3D is the way in.
  - On a desktop the drawn keyboard is a drawer, so the screen gets the whole height (U10).
- The dock's five tools: Lessons, Video RAM (with the cell inspector), Keyboard, Cassette and CPU & Memory.
  - CPU & Memory shows the registers, the flags, a Z80 disassembler, the memory map and a dump.
  - It can pause, step one instruction, run to an address, and slow the clock to 1/1,000.
- Six lessons, with teacher notes, each run end to end in the tests.
- The top bar: Tapes, Programs, About. One status line.
- A layout for phones, upright and on their side (P9). English only, every text a message.

**Tools**
- `pnpm check` runs the reference check, the strict JSDoc type check and the tests: the machine, the cassette, the disassembler, the lessons, the model's node contract, the messages, the stamps and the vendored files.
- `pnpm build:model` rebuilds the 3D model with Blender; `pnpm vendor` takes the pinned dependencies.
- CI runs the checks and REUSE on every push. GitHub Pages deploys `main` once they pass.
