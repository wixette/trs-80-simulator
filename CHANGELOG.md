# Changelog

What changed in each release. Versions follow `package.json` and are tagged `vX.Y.Z` ([docs/development.md](docs/development.md)). Versions 0.0.x are pre-releases. The decisions cited (D1, U10, …) are in [design/decisions.md](design/decisions.md) and [docs/ui-design.md](docs/ui-design.md).

## 0.0.3

Programs worth running, then the lessons rewritten round them (design/v0.0.3.md).

- **Sound,** as owners had it: the cassette lead into an amplifier. While the motor is off, what a program writes to port 255 is played. A small machine-code tone routine (`js/sim/tone.js`), POKEd in from BASIC and called with `USR`, plays notes.
- **Programs in sections.** **Learn:** Hello, Guess my number, Sine wave, Kaleidoscope, Bouncing block, Sketch with the arrows, Notes to tape, BASIC against machine code. **Games:** Moon lander, Worm, Bricks, Meteors, The lighthouse (a text adventure). **Utilities:** Clock, Calendar, Biorhythm, Banner. **Music:** Music box, Organ. All our own, in the style of 1977–80.
- **Programs has two levels:** a submenu for each section, beside the menu on a desktop and in its place on a phone. In a program's dialog, **Type it in**, the way we recommend, is the filled button on the right.
- **Type in faster,** on at first for a long listing: up to 64 times the machine's speed while it types.
- **Find original programs:** where the era's software is archived, what of it runs here, and how to load it.
- **Quick taps reach games** (D18): a key let go is held until the program has read it, so a tap between a game's reads still steers it.
- **Open a listing:** a plain-text BASIC listing of your own, typed in on the Model I's keys.
- **The lessons** each end with one of the programs to open, run and read; lesson 5 adds data on tape and music. The lessons' bar is centred and keeps on screen; the first photo stands beside its text; Show me always answers, the stage's edge glowing.
- **References** start with further reading; what the simulator simplifies is last, folded.

**Tools**
- `tools/basic.mjs` runs a listing on the headless Model I: keys at given times, the screen, the notes played. `pnpm tapes` records our programs' tapes into `tapes/`; a test holds each to a fresh recording, and runs every program from its tape.

## 0.0.2

The page in ten languages.

- **Ten languages,** as the Altair 8800 simulator's: English, Español, Français, Deutsch, Italiano, Português (Brasil), 简体中文, 繁體中文, 日本語 and 한국어. Everything of the page's own is translated, the six lessons included; the machine's own words (BREAK, `READY`, BASIC, the key legends) stay as the machine has them, and the teacher notes stay in English (U11).
- **The language button,** in the top bar between Sound and About: a translate icon and the language's short name. Its menu lists each language as it names itself; a choice is remembered, and the page opens again in it.
- **Which language a visit uses:** the address's `?lang=`, else the one chosen before, else the browser's, else English.
- **The dock opens smaller,** at 30% of the window's height rather than 40%, so the stage has more room (at 1440 × 900, 418 px rather than 328). Its handle still sets any height, and that is remembered.
- **The default view is named Whole system,** not Desk: the scene draws no desk, and in other languages the word means only the furniture. The tips and the first lesson say the computer or the whole system instead.

**Tools**
- `tests/l10n.test.js` holds every language to English's keys, placeholders and code. A new browser check opens each language, finds no English of the page's own left on it, and fits a 360 px phone. `pnpm shots --lang de,zh` takes the screenshots in any language.

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
  - Fast tape (the simulator's own: 32 times faster while the tape moves), and the tape's sound;
  - the tape counter and the RECORD/BATTERY lamp, live in 3D and 2D;
  - our own sample tapes, recorded at run time by a second Model I.
- The character set: xtrs's "CG 1", with the 2 × 3 block graphics (D4).

**The page**
- The machine starts switched on, at `MEMORY SIZE?` (U5).
- The desk in 3D, built from parameters (D8), with Views: Desk, Three-quarter, Keyboard, Screen, Recorder, **Inside, from below** (the case as glass, the chips lit by their memory traffic) and **Taken apart**.
  - The machine's own controls are clickable where they are: POWER, RESET, the display's POWER, C and B (a double-click puts them back to the middle), the recorder's keys. A helper strip under the stage reaches them too (U4).
  - Taking it apart works only with the computer off; *Put it all back* is one press (D11, U3).
- The 2D view: flat drawings of the machine's own faces, from the same parameters (D10).
  - A `[2D | 3D]` toggle with a camera flight and a cross-fade (U1). 3D is the way in.
  - The recorder and the keyboard are drawers (U10); the recorder is drawn as tall as the display, its printing large enough to read.
- The dock's six tabs: Video RAM (with the cell inspector), Keyboard, Cassette, CPU & Memory, Lessons and References (U6).
  - CPU & Memory shows the registers, the flags, a Z80 disassembler, the memory map and a dump.
  - It can pause, step one instruction, run to an address, and slow the clock to 1/1,000.
- Six lessons, with teacher notes, each run end to end in the tests.
- The top bar: Tapes, Programs, Sound and About. Each sample program, from Programs, can be typed in on the Model I's keys (answering `MEMORY SIZE?`, or BREAKing what runs, then `NEW`, first) or put in the recorder on its tape (U8). One status line.
- A layout for phones, upright and on their side (P9). English only, every text a message.

**Tools**
- `pnpm check` runs the reference check, the strict JSDoc type check and the tests: the machine, the cassette, the disassembler, the lessons, the model's node contract, the messages, the stamps and the vendored files.
- `pnpm build:model` rebuilds the 3D model with Blender; `pnpm vendor` takes the pinned dependencies.
- CI runs the checks and REUSE on every push. GitHub Pages deploys `main` once they pass.
- `pnpm test:browser`: the page itself in a headless Chrome, driven with real mouse and key events, run by hand before a release. `pnpm shots` takes the screenshots, the README's among them.
