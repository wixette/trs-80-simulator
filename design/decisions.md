# Decisions

The machine's decisions, numbered so that the code can cite them (D1, D2, …). Each says what was decided, why, and what was rejected. The page's own decisions (U1, U2, …) are in [../docs/ui-design.md](../docs/ui-design.md). A decision that changes records what it supersedes.

## D1. The reference machine: a Model I of about 1979

**A Model I keyboard unit of about 1979: Level II BASIC, 16 KB, main board revision G, ALPS keyboard with the 12-key numeric keypad.**

- **Sources.** RetroStack's open reconstructions (MIT) are of exactly this machine: the rev G main board in KiCad, the ALPS keyboard with all 65 switch positions, and the case with its keypad opening. It is the best-documented Model I there is.
- **The lessons don't depend on it.** The video RAM and the keyboard behave the same on every board revision. Level I's `SET` works the same in Level II.
- **It is the common one.** Most surviving and photographed machines have the keypad.

*Later:* the 1977 launch machine (Level I, 4 KB, no keypad, a plaque where the keypad went). In the model it differs by one part.

*Rejected:* the 1977 unit as the reference, which has the better story but worse sources; the rev A board, whose video timing differs and which no lesson needs; the Hi-Tek keyboard, which has no reconstruction.

## D2. Level II BASIC v1.2 ships in `roms/`, under a notice

- **`roms/level2-v12.bin`**: RetroStack's ROM A (8 KB at 0000H) and the first 4 KB of ROM B (at 2000H), joined: 12,288 bytes. It is byte for byte identical to the copy in Lawrence Kesteloot's emulator, a second, independent source. It boots with `MEMORY SIZE?` and `RADIO SHACK LEVEL II BASIC`.
- **`roms/NOTICE`**, as the Altair 8800 simulator's for its 4K BASIC: the file is not under the repository's licence, the copyright is Microsoft's and Tandy's, it says where the file came from and gives its size and hashes, and it offers to remove the file on request. REUSE gives `roms/**` the licence `LicenseRef-HistoricalROM`.
- **The simulator works without it:** if the file is missing or its hash differs, the page says so and runs a copy the visitor supplies, read locally and never uploaded. A ROM cannot be changed while the computer is on, as on the real machine, where changing ROMs meant switching off and opening the case.
- **Why v1.2, not v1.3:** v1.2 has two independent sources and the familiar boot screen. v1.3 changed the boot text to `MEM SIZE?` and `R/S L2 BASIC`, and no second source for its bytes was found. Which version a 1979 unit carried is not established.

*Rejected:* visitors supplying the ROM, which breaks "a first result within a minute"; an open re-implementation of BASIC, which would not run the ROM's own keyboard and cassette routines, the very routines the lessons open up.

## D3. The Z80 core is DrGoldfire's `Z80.js`, pinned and unchanged

- **Molly Howell's (DrGoldfire's) `Z80.js`**, MIT, at commit `2207d7c`, with its LICENSE, checked by SHA-256 (`tools/vendor.mjs`). The upstream file defines a function and exports nothing, so the vendored `z80.module.js` is that file **unchanged** with one line appended, `export { Z80 };`, and `tests/vendor.test.js` checks exactly that.
- **Why it fits:** the Model I has no interrupts and times its keyboard debounce and cassette bits by counting instructions, so the core must return exact T-states for every instruction. It does, and it passes ZEXDOC in full (`pnpm test:zexdoc`, all 67 groups).
- **The seam:** `js/sim/cpu.js` sees it through four callbacks (`mem_read`, `mem_write`, `io_read`, `io_write`) and `run_instruction`, so another core would be a change to one wrapper.
- **Its known issue:** the undocumented X and Y flags after `BIT n,(HL)` are not the hardware's. The Level II ROM does not depend on them, and ZEXDOC does not test them.
- **ZEXDOC is not committed** (GPL). The opt-in test fetches it at a pinned commit into `tests/.cache/` and checks its SHA-256 first.

*Rejected:* Kesteloot's `z80-emulator` (MIT). It is proven on the Model I, but it needs a TypeScript compile to vendor and brings three more packages.

## D4. The screen's characters are xtrs's Model I set, "CG 1"

The Model I draws text through a Motorola MCM6670 character generator (Z29): 5 × 7 dots in a 6 × 12 cell. No clean dump of the chip was found.

- **xtrs's CG 1** for codes 00H–7FH: the standard Model I set without the lower-case kit, transcribed by Tim Mann from Motorola's MCM667x data sheet, with the arrows. It is under xtrs's licence, whose text is kept with the data.
- **Taken from the source, not copied by hand:** `tools/vendor.mjs` takes `trs_chars.c` and its LICENSE at a pinned commit and generates `js/sim/charset-data.js` (CG 1 only), with the licence at its head.
- **The 2 × 3 graphics** (80H–BFH, and their copies above) are not in the chip. `js/sim/charset.js` makes them, as the Model I's discrete logic did.
- **The glyph is found the hardware's way:** the generator's address is the stored 7-bit byte, with bit 6 rebuilt as NOR(bit 5, bit 7).
- *Open:* Mann drew the arrows from memory. No period photo of a Model I screen showing them was found.

## D5. The cassette recorder is a Realistic CTR-80 (26-1205)

Radio Shack launched the Model I with the CTR-41, but no usable photo or dimensions of it were found. The CTR-80 (about 1979) is right for the reference machine (D1). Radio Shack documented the two side by side, and the computer's side is the same: one DIN cable to EAR, AUX and REM, and the motor relay on the main board. The page names it the CTR-80, and never "the TRS-80's original recorder". The CTR-80A (26-1206) has the same body with another badge.

## D6. The Expansion Interface stays out

The Expansion Interface (26-1140, 1978) added RAM, disks, a printer port and a timer interrupt. It is not the machine's own idea: the screen and the keyboard as memory, and the appliance computer, live in the keyboard unit, and Level II runs on a bare 16 KB machine. The model keeps the keyboard unit's expansion opening and its edge connector (`part.j4`), whose label says what plugged in there.

## D7. Visitors bring their own tapes; no third-party software ships

- A visitor opens their own `.cas` or `.wav` file, read locally and never uploaded. The Cassette tool says what a tape holds: a BASIC program and its name, or machine code with its name, blocks, load and entry addresses and any bad checksum. It also says how to load it: `CLOAD`, or `SYSTEM`, the name at `*?`, then `/`.
- **No third-party software ships:** no commercial tapes, no archive downloads, no links that fetch them. The only third-party program is Level II itself (D2), which the machine cannot run without.
- **Our own samples only,** Apache-licensed, so that `CLOAD` and `SYSTEM` can be tried at once. The BASIC samples are typed in and `CSAVE`d at run time by a second, headless Model I, so nothing but the ROM's own output is on a tape. One machine-code sample is written out with its listing.

## D8. The model is built from parameters, not imported meshes

RetroStack publishes the case as STL and the boards in KiCad (MIT). Dimensions are **read off them into `model/params/`**, and every part is **built by script** from those params (`model/blender/scripts/`). None of RetroStack's files is committed.
- **Moving parts need pivots and names.** A printable STL is one fused mesh: no node names, no part origins, no motion axes.
- **Budget.** RetroStack's keycap set alone is about 240 k triangles; procedural keys are about 15 k.
- **One source of truth.** Every dimension sits in the params with its source and confidence, and the tests check the model against them.

## D9. The model is in plain git, not LFS

The `.glb` is the only binary the model makes, and it is under 5 MB. GitHub Pages deploys the repository as it is, and an LFS pointer would be served in its place. Every clone and fork would also need LFS set up. `.gitattributes` marks `*.glb` binary.

*Revisit* if the model passes about 10 MB or is rebuilt every week.

## D10. 2D is flat views of the machine itself

The 2D view is **three flat drawings of the machine's own faces**, each control where it is on the machine:
- the Video Display from the front (its POWER button, C and B, the screen);
- the CTR-80 from above (its six keys, the counter, the door with the cassette and its turning reels, the RECORD lamp);
- the keyboard unit from above.

How they are drawn:
- **From the same parameters as the 3D model**, so that the two cannot drift apart.
- **The picture is a canvas** at full resolution in the drawing's screen opening, so text stays sharp.
- **POWER and RESET** are on the keyboard unit's rear. The top view puts them together at the left of the silver band behind the keys, POWER then RESET, each with an icon, since a top view cannot show the rear.
- **The display is the largest part.** The keyboard is drawn tight, at about a third of the height at most. Nothing in the drawings can be selected or dragged.
- **The 3D model's colours and labels:** the same logos and the same font (Michroma), and the two ENTER keys cream.

*Rejected:* helper button strips, which teach nothing about where the controls are; photographs or high-fidelity renders, which are heavier, carry licences to track, and repeat what the 3D model already shows.

## D11. Taking it apart needs the computer off

As in the Altair 8800 simulator: nothing comes out while the computer is on, and POWER refuses while anything is out, saying what. A machine whose board is out of its case is not a machine that can run. To watch it run inside, the view **Inside, from below** turns the case to glass and leaves the machine running.

## D12. Memory starts cleared at power on

A real Model I's RAM comes up holding whatever its 4116s settle to. Level II sizes the memory and clears what it uses, and clears the screen, before anything is shown, so a visitor cannot tell. The simulator clears the RAM and the video RAM at power on, so that every start is the same and the tests are deterministic.

*Rejected:* random bytes at power on, as the Altair 8800 simulator does. There the front panel shows memory before any program has run; here the ROM runs first and nothing shows it.

## D13. A tape pulse lasts 454 T-states, and holds the input set while it is under the head

Level II makes each pulse with three writes to port FFH: up (+0.85 V), down (0 V) about 227 T-states later, then rest (0.46 V) 227 later [rs-info cassette]. Reading, the input's comparator holds the flip-flop's set input for as long as the pulse lasts, so a write to port FFH clears the flip-flop only when no pulse is under the head.

- **Why it matters:** after the sync byte the ROM clears the flip-flop about 10 T-states after the next data pulse begins. With a pulse taken as an instant, that bit is lost and every `CLOAD` fails.
- **Level II's timing, measured from its own `CSAVE`:** cells of 3,570 T-states within a byte, 3,700–3,774 at a byte's end, and 5,594 after the sync byte; the data pulse comes 1,777–1,780 after its clock pulse.
- **`.cas` files are encoded with those timings,** with margin where the ROM's own vary: 3,800 at a byte's end, and 5,700 after the sync byte.

## D14. Ghost keys are modelled

The Model I's keyboard matrix has no diodes [rs-info keyboard]. With three keys down at three corners of a rectangle of rows and columns, current runs from the selected row through the three switches, and the fourth corner reads as down. `Machine.matrix()` follows every path from the selected rows through closed switches. Two keys never ghost, and neither do keys on one row (the arrows and SPACE, as games use them), so play is unaffected. Lesson 4 can show the effect.

## D15. Typed keys wait for the program to read the keyboard

Typed text ("Type it", the Programs menu) is typed at a person's pace, 70 ms down and 70 ms up, in machine time (Level II debounces for 18.8 ms and 51.3 ms [rs-info keyboard]). A queued keystroke starts only once the keyboard has been read since it fell due: row 0, which the ROM scans while waiting for a key, or the key's own row, which a game reads itself.
- If the program reads only other rows, the key waits at most 0.5 s.
- If it reads no keys at all (BASIC sizing the memory after `MEMORY SIZE?`, storing a line, running a loop), the key waits up to 10 s, as a person watching the screen would.

The visitor's own keys are not gated: pressed while nothing reads the keys, they are missed, as on the real machine.

*Found while building:* without the gate, the first digits of a program typed straight after `MEMORY SIZE?` were lost.

## D16. REWIND and FAST-F wind whatever the motor relay says

On the CTR-80 the computer's REM plug stops the motor whenever the computer has not started it, so owners pulled the plug to wind the tape. Here REWIND and FAST-F wind regardless of the relay, and the Cassette tool says so the first time. PLAY and RECORD still move the tape only while the computer closes the relay.

**Fast tape** (on by default) runs the machine 32 times faster while the tape moves, and winds 32 times faster too. A 9 KB game that takes 2 minutes 42 seconds to load at the real speed takes about 5 seconds. Untick it for the real speed and the tape's sound.

## D17. Keys tapped faster than the debounce wait their turn

Level II reads one key at a time, and debounces it for tens of milliseconds. A visitor's key is held down for at least 70 ms of machine time (KEY_DOWN_T), so that a quick tap is seen. A key pressed while an earlier tap is still held for that reason, or less than 70 ms after it was let go (KEY_UP_T), waits its turn, then goes down. So fast typing, or text a browser sends all at once, reaches BASIC letter by letter. Keys that are really held together (an arrow and SPACE in a game) are down together, because neither is a tap waiting to be let go.

*Found while building:* keys arriving a few milliseconds apart overlapped in the matrix, and Level II kept only some of them.

## D18. A key let go is held until the program has read it

A game reads the keys only at moments of its loop: a BASIC game between moving, drawing and beeping, so a quick tap of the visitor's could start and end between two reads and be lost, though the Keyboard tool showed it pressed. On a real Model I the owner learned to hold a key a little longer. Here a key let go stays down until the program has read its row once since it went down, for up to half a second (READ_MAX_T). A program that reads the row itself (PEEK, or its own machine code) must read it; Level II's keyboard driver (03E3H–045FH) scans every row between statements, looking for BREAK, so its reads count only for a program that takes its keys from the driver (INKEY$, INPUT). A key waiting to be read holds up no other key.

*Found while checking v0.0.3:* in Worm, quick taps of the arrows turned the worm three times in sixteen; with this, sixteen in sixteen.
