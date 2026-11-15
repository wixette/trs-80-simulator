# Teacher notes

Six lessons on the TRS-80 Model I, one track for both audiences.
- Each lesson is written for students of about 11 to 14.
- Its *Going further* asides carry the computer science for older students, or for a first course in computer organisation.
- No programming is needed beforehand. Students type short BASIC lines, and every step has a **Type it** button that types it for them on the Model I's own keys.

Each lesson takes one class period of 40–50 minutes. Lessons 1 and 2 can share one period with a confident class.

The steps live in the simulator's Lessons tab. Each step ticks itself when the machine shows it done, so a teacher can see at a glance how far a student has got. Lessons 3 to 6 each have a task that students do on their own: a prediction to write down before they look.

**Before the class:** open the simulator in a recent browser (Chrome, Edge, Safari or Firefox) on each machine; nothing is installed. On tablets and phones, the 2D view (top right) is the place to type.

## 1. Meet the TRS-80

**Students leave knowing:**
- a computer is a processor, memory, and ways in and out;
- in 1977 a computer could be bought in a shop, ready to use;
- BASIC is a program kept in the computer's ROM.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| The whole system | 5 min | A photo, then the whole system in 3D | Radio Shack showed it on 3 August 1977. The complete system was $599.95 `[reed-m1]`. Compare the Altair 8800 of 1975: a kit, with switches and lamps and no screen. |
| The keyboard is the computer | 3 min | The keyboard unit | One board, under the keys. Ask: where is the computer in a laptop? In a phone? |
| Look inside | 5 min | Views ▸ Inside, from below | The board hangs upside down. Hover over the chips: the Z80, the ROMs, the RAM. With the power off, students can take it apart (Views ▸ Taken apart, or click a part): it comes apart in the real order. |
| The Video Display | 2 min | The display | A television without a tuner. 64 × 16 capital letters. |
| The cassette recorder | 2 min | The recorder | No disk: programs went onto audio tape. |
| Switch it off and on | 3 min | `MEMORY SIZE?` | The page opens with the machine on. Two POWER buttons: the computer's, and the display's. Off, the memory is gone; on again, the ROM starts BASIC at once. |
| READY | 5 min | ENTER, then `READY` | BASIC is in ROM, so the computer is ready at once. Microsoft wrote this BASIC (Level II, 1978). |

**Questions students ask:**
- *How many were sold?* Sources differ, and it is worth saying so. "100,000 computers in 1978" (Matthew Reed, [The TRS-80 Model I](https://www.trs-80.org/model-1.html)) or "well over 100,000" ([The Introduction of the TRS-80, part 2](https://www.trs-80.org/trs80-introduction-part2.html)), against "55,000 in its first year" ([Wikipedia, TRS-80](https://en.wikipedia.org/wiki/TRS-80)).
- *Why "Trash-80"?* A nickname of its users, which Tandy disliked. Its causes (unreliable connectors in the add-on Expansion Interface, a keyboard that bounced) are folklore more than fact.
- *Why did it stop being sold?* From 1 January 1981, new US rules limited the radio interference a computer could give off. The Model I could not meet them, and Tandy judged a redesign too costly `[reed-m1]`.

## 2. Talk to BASIC

**Students leave knowing:**
- a program is a list of instructions, followed in order;
- loops repeat;
- variables are named places in memory.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| Do a sum | 3 min | `PRINT 2+2` | A command done at once. |
| Print words | 3 min | `PRINT "HELLO"` | Text goes between quotation marks. |
| Your first program | 8 min | `10 PRINT "HELLO"` / `20 GOTO 10` | Numbered lines are stored, not done. `RUN` starts them. An endless loop. |
| Stop it | 2 min | BREAK (Esc) | |
| Look at the program | 3 min | `LIST` | The program is in memory. |
| Count with a loop | 8 min | `FOR I=1 TO 10` | Ask students to change it: count to 20, print cubes. |
| Ask a question | 8 min | `INPUT` | `N$` holds text. Students write a two-question program. |

*Going further:* BASIC stores the program in memory from 42E9H, with each keyword packed into one byte (a token). In lesson 6, students can find it with the CPU & Memory tool.

## 3. The screen is memory

**Students leave knowing:**
- the screen is 1,024 bytes at 3C00H (15360), 64 to a row;
- a byte becomes a picture in one of two ways: a character from the character generator, or 2 × 3 blocks;
- `SET(X,Y)` changes bits in those bytes.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| A letter is a byte | 8 min | `POKE 15900,65` puts an A on the screen | 65 is A's code. 15360 + 8 × 64 + 28 = 15900. The Video RAM tab shows the byte, its bits, and the dots the character generator makes of it. |
| Draw a box with SET | 8 min | A four-line program | The screen is also 128 × 48 blocks: 64 × 2 across, 16 × 3 down. The way owners learned `SET`, from David Lien's manual in the box (1977, for Level I; `SET` works the same in Level II). |
| Find the corner | 8 min | SET(10,10) is in byte 15557 (3CC5H) | Column 10 ÷ 2 = 5; row 10 ÷ 3 = 3, remainder 1, the middle band. |
| **Your prediction** | 8 min | `SET(0,0)` | Students write down a byte and a bit before they look: 3C00H, bits 7 and 0. Then each draws their initial with `SET`, writing each block's byte first. |
| The missing chip | 5 min | `POKE 15360,193` reads back 129 | Seven video RAM chips, not eight: bit 6 is rebuilt from bits 5 and 7. That is why there is no lower case. The saving was $1.50 in parts, $5 in the shop `[reed-uc]`. |

*Misconception to correct:* "The picture is stored as a picture." It is codes, drawn afresh 60 times a second.

## 4. The keyboard is memory

**Students leave knowing:**
- a key is a switch;
- the keys are wired in rows and columns and read as bytes;
- the ROM, not the keyboard, decides what a key means.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| Switches in rows | 5 min | The Keyboard tool | 8 rows of 8. BASIC reads every row, many times a second, while it waits for a key. |
| Read a row yourself | 8 min | `PRINT PEEK(14400);` again and again | 14400 is 3840H: the arrows' row. ↑ 8, ↓ 16, ← 32, → 64, SPACE 128. |
| **Two keys at once** | 8 min | ↑ and → together | Students predict before they press: 8 + 64 = 72. Bits add up. |
| Draw with the arrows | 10 min | A sketch pad | The program reads the keys itself, the way a game does. |
| Ghost keys | 5 min | A, B and I give J | No diodes: current runs round a rectangle of switches. |

*Misconception to correct:* "The keyboard sends letters." It closes contacts. The ROM does the arithmetic: a letter's code is its row × 8 + its column + 40H.

## 5. Programs as sound

**Students leave knowing:**
- data can be stored as sound;
- bits are pulses in time;
- bytes need a start (the sync byte) to be read back.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| A program to keep | 3 min | Two lines | Without a tape, it would be lost at power off. |
| A blank tape, and RECORD | 3 min | Tapes ▸ Blank tape, then RECORD | RECORD needs PLAY too. The tape waits: the computer runs the motor. |
| Save it | 10 min | `CSAVE "T"` | The Cassette tab shows pulses, bits and bytes. Each bit takes 2 ms: a clock pulse, then a second pulse halfway for a 1. That is 500 bits a second. The leader of zeros, then A5H, the sync byte. |
| Rewind | 2 min | REWIND | |
| Load it back | 8 min | `NEW`, PLAY, `CLOAD "T"` | Untick Fast tape to hear it and to load at the real speed. |
| It is back | 5 min | `LIST` | Tapes ▸ Save tape as .wav gives the sound itself: play it, open it in an audio editor, and find the pulses. |

## 6. Inside the CPU

**Students leave knowing:**
- the CPU fetches, decodes and executes one instruction after another;
- programs and data are both bytes in memory;
- a register is the CPU's own memory.

| Step | Time | What happens | Talking points |
|---|---|---|---|
| Make room | 3 min | Off and on; `MEMORY SIZE?` 32000 | BASIC keeps out of memory above 32000. |
| Put a program in memory | 5 min | 14 numbers `POKE`d from 32000 | They are machine code: the Z80's own instructions. |
| Read it as the CPU will | 8 min | CPU & Memory at 7D00H | The same bytes, as instructions: `LD HL,3C00H` … `LDIR`, `RET`. |
| Tell BASIC where it is | 3 min | `POKE 16526,0:POKE 16527,125` | 7D00H, the low byte first. |
| Stop at the start | 3 min | Run to 7D00, then `X=USR(0)` | |
| **One instruction at a time** | 10 min | Step | Students predict each register before they press Step. `LDIR` copies one byte per step: HL and DE go up, BC down. |
| Full speed | 3 min | Run | 1,023 bytes in about 12 ms. |
| Watch the chips | 5 min | Inside, from below, `X=USR(0)` | ROM A glows while BASIC runs; the RAM chips while the program runs from them. |

*Going further:* why can the same bytes be both data and instructions? This is the stored-program idea. Compare the Altair 8800, where a program went in through the switches one byte at a time.

## Sources

Keys such as `[reed-m1]` are in [../research/bibliography.md](../research/bibliography.md). The machine's facts are in [../research/how-it-worked.md](../research/how-it-worked.md), and its history, with the places where sources disagree, in [../research/history.md](../research/history.md).
- `[reed-m1]`: Matthew Reed, ["The TRS-80 Model I"](https://www.trs-80.org/model-1.html).
- `[reed-uc]`: Matthew Reed, ["Why was the Model I uppercase only?"](https://www.trs-80.org/why-was-the-model-i-uppercase-only.html).
