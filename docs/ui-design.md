# UI design

This document holds the principles the simulator's page is laid out by, and the reasons for them. Where a control ends up, and what it looks like, is the code's business. These rules decide it, so that the next change can follow them, or argue with them in the open. They follow the Altair 8800 simulator's, adapted to a machine with a screen and a keyboard.

**If a change needs to break a principle, change the principle here first, with its reason.**
- Principles are P1, P2, …
- Decisions are U1, U2, …

The machine's own decisions (D1, D2, …) are in [../design/decisions.md](../design/decisions.md).

**Status:** draft for v0.0.1, 2026-11-14.

## Part 1. Principles

### P1. The machine is the one primary surface

It is always on screen, in 3D or in 2D, and nothing covers it. The **picture** on the Video Display is always visible, in any view and with any tool open: it is the machine's state, as the Altair's lamps are.

### P2. A control has one home

If a control is wanted somewhere else, move it, or make both places visible at once. Don't make a second copy.

*Not copies:*
- keyboard shortcuts, which take no room;
- the stage band's **helper buttons** for POWER and RESET in 3D (U4). On the machine both are on the keyboard unit's rear, hard to find and to click in 3D. The helpers are another way to reach the same controls, as the 8800's Switch Board Helper is, and they are shown only in 3D. In 2D the flat drawings carry the controls themselves.

### P3. Tools live in one dock, one at a time

The lessons and the four instruments (Video RAM, Keyboard, Cassette, CPU & Memory) share one dock under the stage. You choose which one it shows, how big it is, and whether it is open at all.

### P4. Occasional actions go in menus and dialogs

Space that is always there is for things that change while you watch: the screen, the reels, the bytes, the registers. Choosing a tape, typing in a sample program and About go in the top bar.

### P5. Each surface keeps its voice

| Surface | Case | Font |
|---|---|---|
| The machine: the screen, key legends, the recorder's keys, BASIC | UPPER CASE as the machine has it | the machine's own (the character generator, the legends) |
| The instrument: top bar, stage band, dock, tools, lessons, status line | Sentence case | Roboto Flex; bytes, addresses and code in monospace |

### P6. Unavailable is greyed and explained, never hidden

A control that cannot be used right now stays where it is, greyed. When used, it answers in the status line with the reason. *Step* with the computer off says "Switch the computer on first". *Take apart* while it runs says "Switch the computer off first".

### P7. One status line, always visible

It says what just happened, and why something is greyed. It keeps one line's height: a longer message rises over the foot of the dock, so the stage never changes size because of a message.

### P8. A link is a public contract, from 1.0.0

Once released, a link field is never renamed, dropped or read differently. Until 1.0.0 the format may still change, and the README says so. It lives in one module with nothing of the page in it, and its own test pins it down.

### P9. A phone gets the same app, not a different one

Same regions, same order: the stage across the width, the dock below, the top bar packed down. Nothing depends on hover, and nothing needs a precise drag. On a phone 2D is the way to type, so the toggle says so the first time a phone opens the page in 3D.

### P10. One component for each kind of thing

Each kind of control is one component, used the same way everywhere:
- **Menu:** choosing one thing. Items only; one open at a time; an item that cannot be used is greyed, with why at its right.
- **Dialog:** anything that needs explaining. A title band with its close button, then the body, then the actions at the bottom right.
- **Icon button:** always with a tooltip and a screen-reader name.
- **Tabs:** the dock's, and the lesson bar. They follow the WAI-ARIA tabs pattern.
- **Segmented button:** 2D | 3D.
- **Chip:** *Show me*, *Type it*.
- **Empty state:** guidance that matters only until something happens, shown inside the empty area.

Icons are Material Symbols, as inline SVG. There are no icon fonts, and no fonts or scripts from a CDN: the page needs no network but its own site. Every control can be reached with Tab and has a visible focus ring. Motion (camera flights, the cross-fade) honours `prefers-reduced-motion`.

### P11. Material 3's tokens, not its components

Every control takes its colours, corners, type and states from one set of design tokens in `css/theme.css`. These are Material 3's roles in a dark scheme. No Material library is loaded.

**One colour, one meaning:**
- **The screen's phosphor white** is the brightest thing on the page.
- **Amber:** what to press, and the one action a place is for.
- **Green:** on, and done (a lesson step's tick, POWER lit).
- **Blue:** the story and the asides in lessons.
- **Red:** refused, or a fault.

The canvas drawings, the 2D views and the 3D scene read the same tokens.

## Part 2. The layout

```
┌ [logo] TRS-80 Simulator   [▤ Tapes ▾] [▶ Programs ▾]                                [ⓘ] ┐  top bar
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ [⏻ Computer] [⏻ Display] [↺ Reset]       [⌂] [− +] [Desk ▾] [◉ Show ▾]  [2D | 3D]       │  stage band
│                                                                                         │
│                    THE STAGE: the desk in 3D, or the flat views in 2D                   │
│                                                                    [Put it all back]    │
├══════════════════════════════════════ drag ═════════════════════════════════════════════┤
│ Lessons   Video RAM   Keyboard   Cassette   CPU & Memory                              ▾ │  dock
│ …                                                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ READY. Type on your keyboard: Esc is BREAK, Enter is ENTER.                             │  status line
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

The page is a fixed frame of top bar, stage, dock and status line. The page itself never scrolls.
- **The dock sits below the stage,** as in the 8800 and AGT-30 simulators. The desk is a wide subject, and the tools (a 64-column grid, a memory dump) want the width.
- **The dock can be resized** by its top edge, and folds to its tab bar. Growing it shrinks the stage, and the 3D view refits.
- **The stage keeps at least 240 px** on a desktop. On a phone it keeps at least 40 % of the height in 2D, where the keyboard is.

## Part 3. Decisions

### U1. 3D is the way in; 2D and 3D are one toggle

The stage shows the machine in 3D or in 2D, chosen from a `[2D | 3D]` segmented button at the stage band's right (as the 8800's U7).
- **3D is the default** on a first visit. After that the choice is remembered, and a link can carry it as `#view=3d` or `#view=2d`. A link's view wins over the remembered one.
- **Going to 2D, the camera flies** to face the screen, then the flat views cross-fade in (as AGT-30's Screen). Going back, they fade out and the camera flies back to where it was. With `prefers-reduced-motion`, both are a cut.
- **A double-click on the CRT in 3D** goes to 2D. A single click does nothing there, so that clicks and drags turn the camera.
- **Under 2D the 3D scene stops rendering.** The machine keeps running.
- **The 3D view's own tools** (⌂, zoom, Views, Show, Put it all back) show only in 3D. The helper buttons (U4) show only in 3D too. Elsewhere the band holds nothing but the toggle.

*Rejected:* the toggle in the top bar, which is for occasional actions (P4) and is full on phones; the 2D view as a tool in the dock, which would put the machine in two places.

### U2. The 3D views and Show

- **Views** (a menu naming the view on show): Desk (the way in, the whole system three-quarter on), Keyboard, Screen, Rear, Inside. ⌂ goes to Desk, with everything shown and every part back.
- **Show** (a menu, its button the chosen preset's icon, amber when not Everything): **Everything**, or **See inside**. See inside turns the keyboard unit's case to outlined glass, and the camera looks up from below, where the main board's parts hang (it is mounted upside down). The ROM and RAM chips glow by their share of the memory traffic, and the video RAM chips flash on writes. The machine keeps running under any Show.
- **The camera:** drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom; damped and limited, so the machine can't be lost. With the 3D view focused (by Tab), the arrows orbit, + and − zoom, and Home resets.
- **Labels:** hovering a part (or tapping it on a phone) shows its name and one line on what it does, after 400 ms, beside the pointer.

### U3. Taking it apart

With the computer off, a click on a unit takes it out along its path. Anything in its way comes out first, in order: the cables, the case top, the keyboard, then the main board, which lifts, comes forward and turns over. A second click puts it back. **Put it all back** stands on the stage whenever anything is out. POWER refuses while anything is out, and names it. Going to 2D puts the machine back together first and says so (D11).

### U4. POWER, RESET and the display, in 3D

The machine's controls are clickable where they are: the computer's POWER switch on the rear, RESET inside the expansion opening, and the display's POWER button, C and B on its front. The stage band's left holds **helpers** for the three that are hard to reach in 3D: *Computer* (POWER, lit green while on), *Display* (its POWER) and *Reset*. They are the same operations as clicking the model (P2).

### U5. Typing

- **The visitor's keyboard is the Model I's** whenever the stage has the focus, which it has by default. Not while a menu, a dialog or a text box has it.
- **A held key holds the Model I's key,** so games that poll the keys play. Several keys at once work.
- **SHIFT is worked out for each character:** a typed `"` is the Model I's SHIFT 2, whatever the visitor's layout.
- **Special keys:** Esc is BREAK; Delete (or Home) is CLEAR; Backspace is ←; the arrows are the arrows; Enter is ENTER.
- **A key legend** in the status line's first message, and in the 2D view's band, names the special keys.
- **The Model I's own keys** can be clicked or tapped, in 3D and in 2D. SHIFT clicked latches for the next key.

### U6. The dock's five tabs

1. **Lessons:** the lesson bar (numbered tabs, one lesson at a time), then the lesson's steps (U7).
2. **Video RAM:** the 64 × 16 grid of bytes, live, cells flashing on write. Click a cell, here or on the screen in 2D, to inspect it: its address, its byte as read back with bit 6 marked as rebuilt, and either the character's 6 × 12 dots from the character generator, row by row, or the 2 × 3 blocks by bit.
3. **Keyboard:** the 8 × 8 matrix, keys lit while down. The rows the program reads light as it reads them, with each read's address and byte, and reads a second.
4. **Cassette:** the tape in the recorder (its name and what it holds, how to load it), the position and length, Fast tape, and the tape under the head: pulses, bits, bytes, and what each byte is (leader, sync, name, block, address, data, checksum, entry).
5. **CPU & Memory:** the registers (AF, BC, DE, HL, IX, IY, SP, PC, the alternate set, I, R) and the flags by letter (S Z H P/V N C). The next instruction disassembled. A memory map strip (ROM, unused, keyboard, video, RAM) lit where the CPU reads and writes. A memory dump that can follow PC, SP or HL. Pause, Step, Run to (an address), and a clock speed (real, 1/10, 1/100, 1/1,000). Paused, everything else waits too: the screen, the tape, the keys.

The first visit opens the dock on Lessons. After that the dock remembers its tab and its height. What the machine does never switches the dock's tab by itself. A tab that changes while not shown gets an activity dot.

### U7. A lesson's page

The design follows the 8800's U11.
- **"Lesson 3 of 6"**, its title and a one-line lead; then its steps, numbered, each a title and its text.
- **A step's chips:** *Type it* types the step's keys on the Model I's own keyboard, visibly; *Show me* points at what the step is about (a 3D view and a Show, or a tool and its selection). A chip never switches the computer on or works the recorder by itself: the visitor does those.
- **A step ticks itself done** when the machine shows it, checked against the machine's state (the screen, the video RAM, a tape).
- **Going further:** a step may end with an aside for computer-science readers, blue, folded by default.
- **Show me never takes the dock away from the lesson.** A tool it points at opens in a split beside the lesson on a wide dock, or as a sheet over the stage's foot on a narrow one, closed with one press.
- The lesson open, and each step's tick, are remembered per browser.

### U8. The top bar

- **Left (the machine):** the logo and title; **Tapes** (insert a blank tape; our sample tapes; open a `.cas` or `.wav` file…; eject; save the tape as `.cas` or `.wav`); **Programs** (our sample BASIC programs, typed in for you on the Model I's keys).
- **Right (the app):** About.
- On a phone the menus keep their icons and lose their names.

### U9. About

A dialog holding:
- the logo, the version and what the simulator is;
- what it simplifies (the colours of the glass, Fast tape, the board's parts as blocks);
- credits: sources, people and libraries;
- the licences, one per line, the Level II ROM's notice among them;
- a link to the source repository;
- "not affiliated with Tandy or RadioShack".
