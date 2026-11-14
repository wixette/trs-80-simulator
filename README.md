<p align="center"><img src="images/logo.svg" alt="TRS-80 Simulator logo" width="96"></p>

# TRS-80 Simulator

[![Tests](https://github.com/wixette/trs-80-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/trs-80-simulator/actions/workflows/test.yml)

The **TRS-80 Model I** (1977) in 3D in your browser: switch it on, type Level II BASIC, load tapes, open it up, and watch the screen and keyboard work as memory. It is the Tandy Radio Shack machine of 1977, not the later Color Computer.

**[▶ Try it online](https://wixette.github.io/trs-80-simulator/)**: nothing to install, on a desktop or a phone.

> **v0.0.1 is a pre-release.** Everything below works, and the lessons are complete. The layout and the link format may still change before 1.0.0.

## What you can do

- **Look round the whole system in 3D:** the keyboard unit with the computer inside, the Video Display, the CTR-80 cassette recorder, the power supply and the cables. The **Inside, from below** view turns the case to glass: the main board hangs upside down under the keys, and its chips light up as the machine works.
- **Switch to 2D:** the machine's own faces, flat. The screen at full size, the recorder's keys, and the keyboard. On a phone, this is where you type.
- **Use Level II BASIC,** Microsoft's 12 KB BASIC, running on an emulated Z80 at the Model I's 1.77 MHz. Type on your own keyboard (Esc is BREAK, Enter is ENTER). Held keys work, so games play.
- **Save and load programs on tape:** `CSAVE` and `CLOAD`, `SYSTEM` for machine code. The recorder's motor is run by the computer, as it was. Open your own `.cas` or `.wav` files, and save any tape as either.
- **Take it apart,** with the power off, in the order the real one comes apart.
- **Watch the machine's idea at work,** in five tools under the stage:
  - **Lessons:** six of them, below.
  - **Video RAM:** the screen as 1,024 bytes, live. Pick one to see its bits become dots or blocks.
  - **Keyboard:** the 8 × 8 matrix of switches, and the program reading it row by row.
  - **Cassette:** the tape under the head, as pulses, bits and bytes, and what each byte is.
  - **CPU & Memory:** the Z80's registers, the next instructions, the memory map and a memory dump. Pause, step one instruction at a time, run to an address, or slow the clock down a thousand times.

## The lessons

For a middle-school class, or a first course in computer science. Every step can be typed for you, and ticks itself when the machine shows it done.

1. **Meet the TRS-80:** a computer you could buy in a shop in 1977, and its parts.
2. **Talk to BASIC:** `PRINT`, a first program, a loop, `INPUT`.
3. **The screen is memory:** a letter is a byte; draw with `SET`, then find the picture in memory.
4. **The keyboard is memory:** keys are switches in rows, read as bytes.
5. **Programs as sound:** save a program to tape, see its bits, load it back.
6. **Inside the CPU:** machine code put in with `POKE`, then stepped through one instruction at a time.

Teacher notes, with timings and the questions students ask: [lessons/teacher-notes.md](lessons/teacher-notes.md).

## Try it in a minute

1. Open the simulator.
2. Press **Computer** and **Display** at the top left of the stage.
3. At `MEMORY SIZE?` press Enter.
4. Type `PRINT "HELLO"` and press Enter.

Then open **Programs** for a few of ours: type one in, or load it from its tape.

## Run it locally

There is nothing to build. Serve the folder over HTTP:

```
git clone https://github.com/wixette/trs-80-simulator.git
cd trs-80-simulator
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## For developers

How the simulator is checked, built and released is in [docs/development.md](docs/development.md):
- the rules the code follows: [docs/conventions.md](docs/conventions.md);
- the page's design: [docs/ui-design.md](docs/ui-design.md);
- the machine's decisions: [design/decisions.md](design/decisions.md);
- the 3D model: [model/README.md](model/README.md).

The machine's sources are in [research/](research/).

## Licences

- The simulator's code is under the [Apache License 2.0](LICENSE).
- The 3D model, the lessons, the docs and the research notes are under [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt).
- **Level II BASIC** in `roms/` is not ours: its copyright is Microsoft's and Tandy's. It is carried as a historical artifact, as other open emulators carry it. [roms/NOTICE](roms/NOTICE) says where it came from, and offers to remove it on request.
- Third-party material keeps its own licence: the Z80 core (MIT), xtrs's character set, three.js (MIT), the fonts (OFL 1.1), the icons (Apache-2.0) and the photographs. Each is listed in [docs/licensing.md](docs/licensing.md) and declared per file in `REUSE.toml`.

"TRS-80" names the machine simulated. This project is not affiliated with Tandy Corporation or RadioShack.

## Credits

- **RetroStack**'s reconstructions of the Model I: the boards, the case and *The TRS-80 Model I, as established*, a netlist-checked reference that the machine and the model are built from.
- **Lawrence Kesteloot**'s TRS-80 emulator, the reference for reading real tapes, and the second source for the ROM.
- **Matthew Reed**'s [TRS-80.org](https://www.trs-80.org/), for the history.
- **Molly Howell**'s `Z80.js`.
- **Tim Mann**'s xtrs, for the character set.
- The photographers credited in [images/photos/CREDITS.md](images/photos/CREDITS.md).
