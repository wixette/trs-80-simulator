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
- the **helper strip** at the stage's foot (U4): the computer's POWER and RESET, the display's POWER and the recorder's six keys. On the machine they are at the keyboard unit's rear, or small, and hard to find and to click in 3D. The helpers are another way to reach the same controls, as the 8800's Switch Board Helper is, in both views.

### P3. Tools live in one dock, one at a time

The lessons, the four instruments (Video RAM, Keyboard, Cassette, CPU & Memory) and the references share one dock under the stage. You choose which one it shows, how big it is, and whether it is open at all.

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
│                                          [⌂] [− +] [Desk ▾] [◉ Show ▾]  [2D | 3D]       │  stage band
│ ╭─────────────────────────────────────────────────────────────────────────────────────╮ │
│ │                  THE STAGE: the desk in 3D, or the flat views in 2D                 │ │
│ │                                                                  [Put it all back]  │ │
│ ╰─────────────────────────────────────────────────────────────────────────────────────╯ │
│        [⏻ Computer|↺ Reset] [⏻ Display] │ [● RECORD|◀◀|▶ PLAY|▶▶|■ STOP|⏏ EJECT]          │  helper strip
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
- **The 3D view's own tools** (⌂, zoom, Views, Show, Put it all back) show only in 3D. In 2D the band holds the Recorder and Keyboard toggles and the 2D | 3D toggle. The helper strip (U4) is under the stage in both.

*Rejected:* the toggle in the top bar, which is for occasional actions (P4) and is full on phones; the 2D view as a tool in the dock, which would put the machine in two places.

### U2. The 3D views and Show

- **Views** (a menu naming the view on show): Desk (the way in: from the front, a little above the desk, the screen face on enough to read and the keyboard under it to type at), Three-quarter (the whole system from the front left), Keyboard (straight on from the front and well above, the keys filling the stage to read and click), Screen, Recorder, Rear, Inside. ⌂ goes to Desk, with everything shown and every part back.
- **Show** (a menu, its button the chosen preset's icon, amber when not Everything): **Everything**, or **See inside**. See inside turns the keyboard unit's case to outlined glass, and the camera looks up from below, where the main board's parts hang (it is mounted upside down). The ROM and RAM chips glow by their share of the memory traffic, and the video RAM chips flash on writes. The machine keeps running under any Show.
- **The camera:** drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom; damped and limited, so the machine can't be lost. The 3D view's focus has two states: reached by Tab, it shows the amber focus ring, and the arrows orbit, + and − zoom and Home resets; otherwise it has no focus, and every key is the machine's. A click or a tap on the view never focuses it, and lets go of whatever had the focus: pressing the machine is typing at it. (A click then a key used to light the ring as `:focus-visible` and take + − and the arrows from BASIC.)
- **Labels:** hovering a part (or tapping it on a phone) shows its name and one line on what it does, after 400 ms, beside the pointer.

### U3. Taking it apart

With the computer off, a click on a unit takes it out along its path. Anything in its way comes out first, in order: the cables, the case top, the keyboard, then the main board, which lifts, comes forward and turns over. A second click puts it back. **Put it all back** stands on the stage whenever anything is out. POWER refuses while anything is out, and names it. Going to 2D puts the machine back together first and says so (D11).

### U4. The helper strip

The machine's controls that are hard to reach are clickable where they are: the computer's POWER switch on the rear, RESET inside the expansion opening, the display's POWER button, C and B on its front (a drag sideways or the wheel turns them, a double-click puts them back to the middle), and the recorder's six keys. The **helper strip** reaches the ones that are hard to find or to hit, in 3D and in 2D: *Computer* (POWER, lit green while on) and *Reset*, *Display* (its POWER), and the recorder's RECORD, REWIND, PLAY, FAST-F, STOP and EJECT, latched down as the machine latches them. They are the same operations as clicking the machine (P2).

- **Where:** a strip of its own, centred at the stage's foot, just above the dock, as the 8800's Switch Board Helper is. It is in the layout, not over the machine, so it never covers a drawing.
- **Not parts of the machine:** the strip is the instrument's, so it is not in the band (which is the view's) nor in the top bar (which is for occasional actions, P4), where it read as one level with Tapes and Programs.
- **Folding:** a tab on its top edge folds it away, leaving the tab, and the choice is remembered.
- **Narrow windows:** the buttons keep their icons and lose their names, which stay as tooltips and for screen readers.

### U5. Typing

- **The machine starts switched on**, the computer and the display, waiting at `MEMORY SIZE?`: a first visit opens on a live machine, not on one to work out how to start, and See inside shows its chips at work. After that both are as the visitor left them. Switching off and on is lesson 1's step, and taking the machine apart still needs it off (U3), which a refusal says.

- **The visitor's keyboard is the Model I's** whenever the stage has the focus, which it has by default. Not while a menu, a dialog or a text box has it.
- **A held key holds the Model I's key,** so games that poll the keys play. Several keys at once work.
- **SHIFT is worked out for each character:** a typed `"` is the Model I's SHIFT 2, whatever the visitor's layout.
- **Special keys:** Esc is BREAK; Delete (or Home) is CLEAR; Backspace is ←; the arrows are the arrows; Enter is ENTER.
- **A key legend** in the status line's first message, and in the Keyboard tool, names the special keys.
- **The Model I's own keys** can be clicked or tapped, in 3D and in 2D. SHIFT clicked latches for the next key.

### U6. The dock's six tabs

1. **Lessons:** the lesson bar (numbered tabs, one lesson at a time), then the lesson's steps (U7).
2. **Video RAM:** the 64 × 16 grid of bytes, live, cells flashing on write. Click a cell, here or on the screen in 2D, to inspect it: its address, its byte as read back with bit 6 marked as rebuilt, and either the character's 6 × 12 dots from the character generator, row by row, or the 2 × 3 blocks by bit.
3. **Keyboard:** the 8 × 8 matrix, keys lit while down. The rows the program reads light as it reads them, with each read's address and byte, and reads a second.
4. **Cassette:** the tape in the recorder (its name and what it holds, how to load it), the position and length, Fast tape, and the tape under the head: pulses, bits, bytes, and what each byte is (leader, sync, name, block, address, data, checksum, entry).
5. **CPU & Memory:** the registers (AF, BC, DE, HL, IX, IY, SP, PC, the alternate set, I, R) and the flags by letter (S Z H P/V N C). The next instruction disassembled. A memory map strip (ROM, unused, keyboard, video, RAM) lit where the CPU reads and writes. A memory dump that can follow PC, SP or HL. Pause, Step, Run to (an address), and a clock speed (real, 1/10, 1/100, 1/1,000). Paused, everything else waits too: the screen, the tape, the keys.

6. **References:** what the simulator simplifies, what it is built on, further reading and the source, one column down the middle, as the 8800 simulator's References tab. About's *References* button opens it.

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

A dialog, short as the 8800 simulator's is, holding:
- the logo, the version and what the simulator is, and that it is a pre-release;
- links to the source and to report a problem;
- the licences, a line each, what then whose, the Level II ROM's notice among them;
- "not affiliated with Tandy or RadioShack";
- at the bottom right, *References* (a text button, which opens the References tab) and *Close* (filled, the one action it is for).

*(build)* What it simplifies and its credits made About too long to read at a glance: they are in the References tab, with further reading.

### U10. In 2D, the recorder and the keyboard are drawers

*(build)* The 2D view first put the keyboard unit under the display, as on the desk. With the dock open, that left the screen less than one screen pixel per dot even on a 1080p desktop, which is too small to read. So the drawn keyboard is a drawer, at every width: shown only while it is open, and the screen gets the stage's whole height while it is closed.
- **The recorder is a drawer too**, beside the display as on the desk: the helper strip (U4) has its keys, so a visitor may want the display's room instead. Closed, the display takes the row.
- **Their toggles**, *Recorder* and *Keyboard* on the band, are Material's tonal toggle buttons: grey while closed, filled amber (primary container) while open, as the selected half of 2D | 3D is. They are always there, so they always say which state each drawer is in. On a phone, their icons alone.
- **Each is remembered** as the visitor left it.
- **At first** the keyboard is closed, so that the screen has the stage (the machine starts switched on, U5), but on a touch screen held upright, where the visitor has no other way to type; the recorder is closed, as its keys are on the helper strip.
- **On an upright phone** the recorder, opened, stands beside the display as on a desktop, both smaller: laid over the display, it hid the display's own controls. On a phone on its side, the keyboard, opened, rises over the display.
- **The display is drawn for reading, not to measure** (`js/flat/layout.js`): at the monitor's own width, the glass is about a quarter wider than on the machine, and the black rim, the margins round it, the right-hand panel, the band under the case and the plinth are trimmed to make room. The 3D model keeps the measured proportions.
- **One scale for all three drawings**, as on the desk: the keyboard unit is a little narrower than the monitor, and the recorder much smaller, so the display takes the room the keyboard leaves rather than the keyboard filling the stage's width. On an upright phone the keyboard still takes the width, as its keys must be tapped.
- **Each key's legend is sized to fit its cap**, so BREAK, CLEAR and ENTER stay on their keys at any size.
- **The key legend** (Esc is BREAK, Delete is CLEAR…) is not on the band, where it took the stage's top left: the status line says it as the 2D view opens, and the Keyboard tool keeps it.

*Rejected:* a smaller default dock, which would take the lessons' room for a picture that would still be too small; showing the keyboard by the window's width alone, which made it appear on its own as a window narrowed, with a toggle that did nothing there.
