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

As in the Altair 8800 simulator: nothing comes out while the computer is on, and POWER refuses while anything is out, saying what. A machine whose board is out of its case is not a machine that can run. To watch it run inside, **See inside** turns the case to glass and leaves the machine running.
