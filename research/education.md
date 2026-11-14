# Education: the idea, the task and the ladder

**Date:** 2026-11-12. What the Model I teaches well, the one real task it did, and the steps from the whole machine down to one bit. The lessons (`js/lessons/`, `lessons/`) are built on it. Keys are in [bibliography.md](bibliography.md).

## 1. Its own idea

**The screen and the keyboard are memory.** On the Model I there is no display controller and no keyboard chip to hide them: a kilobyte of RAM *is* the screen, and a matrix of switches *is* a block of addresses. A student who writes 65 at address 15360 sees an `A` in the corner; one who reads address 14400 while holding an arrow sees a bit come back. That is the idea behind every later home computer, game console and graphics card (a frame buffer).

A second idea it carries well is **the appliance computer**: sold assembled, in shops, with BASIC in ROM and a screen, to people who had never built a computer. Compare the Altair 8800 two years earlier: a kit with switches and lamps, and no screen and no keyboard.

It also teaches, visibly, how **text and pictures are bits**: a character code drawn through a character generator, and a graphics block as six bits. This is in every introductory curriculum (the "data and representation" strands of AP Computer Science Principles and the UK computing curriculum, for example), usually taught on paper.

## 2. What it hides, and how the simulator opens it

- **The CPU and the bus** are hidden behind BASIC. The simulator adds a view the real machine never had: the CPU & Memory tool (registers, the next instruction, memory, pause and step), and the chips lit on the board.
- **Storage** on cassette is slow and analog. It is fun to hear, and the Cassette tool shows the sound as pulses, bits and bytes.
- **Networks, colour and sound** are absent.

## 3. The one real task

**"Draw with `SET`, then look at the memory."** Type a short graphics program, as owners learned it from David Lien's *User's Manual for Level I* (1977), the manual in the box `[lien-l1]`; then watch the same picture as bytes in the video RAM. `SET`, `RESET` and `POINT` work the same in Level II.

- **In a class period:** the program is three to six lines. The student's own part is to draw an initial or a shape with their own `SET` loop, then to predict which byte from 3C00H changes, and check.
- **Why it mattered:** on the Altair the same act (a pattern on the output) takes bytes toggled in by switches; here it is one line typed on a keyboard and shown on a television. The step from 1975 to 1977 is the lesson.

## 4. The zoom ladder

**The screen:**

| Rung | What the student sees | New idea |
|---|---|---|
| 1. The system | Keyboard unit, Video Display, cassette recorder on a desk | A computer you switch on and type into |
| 2. The keyboard unit opened | The main board under the keys | The computer is a board of chips |
| 3. The video RAM | Seven chips, a kilobyte; the screen as a 64 × 16 grid of bytes beside the picture | **The screen is memory** |
| 4. One byte, one cell | A byte through the character generator (5 × 7 dots in a 6 × 12 cell), or six bits as a 2 × 3 block | Text and pictures are bits |
| 5. The missing chip | Bit 6 rebuilt by a gate: why there is no lower case | A design decision costing $1.50 in parts `[reed-uc]` |

**The keyboard:** a key → its row and column → the address line that selects the row → the bit that comes back → the ROM's arithmetic → the character on the screen.

**The CPU:** a program in memory → the instruction at PC → fetched, decoded, executed → registers and memory change → the next one.

Every rung is documented at circuit level `[rs-info]`, `[tm-1978]`. The ladder stops at the gate: transistors and the analog cassette circuit stay out.

## 5. Misconceptions it can correct

- "The picture on the screen is stored as a picture somewhere." It is codes, drawn afresh sixty times a second.
- "The keyboard sends letters." It closes contacts; the ROM works out the letter.
- "Old computers had no screens." The Altair didn't; two years later the TRS-80 did.
- "Upper case only was a technical limit." It was a price decision `[reed-uc]`.
- "Programs and data are different kinds of thing." In memory both are bytes; lesson 6 runs bytes `POKE`d as data.

## 6. Evidence

Radio Shack's 1979 catalogue claimed more TRS-80s in classrooms than any other computer (promotional); Network I (1980) linked a teacher's machine to 16 students' `[reed-net1]`. The Computer History Museum shows a TRS-80 in a classroom `[chm-classroom]`. No study of teaching with a TRS-80 simulator was found.
