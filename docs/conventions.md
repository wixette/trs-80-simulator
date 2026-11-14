# Conventions

These rules keep the model, the parameters, the code and the tests consistent. Related documents:
- the page's principles: [ui-design.md](ui-design.md)
- licences: [licensing.md](licensing.md)
- working on the simulator: [development.md](development.md)
- the machine's decisions: [../design/decisions.md](../design/decisions.md)

## Units, axes and names

| Where | Unit |
|---|---|
| `model/params/*.json` | millimetres and degrees, with each value's `src` (its source) and `conf` (`doc`, `model`, `photo`, `est`, `design`) |
| three.js | metres; the model's build converts once |
| The machine | T-states of the Z80 at 1.77408 MHz for time; addresses and bytes as numbers, shown in hex with an `H` (3C00H) as the Model I's manuals write them |

- **The params' frame:** +X runs to the user's right, +Y away from the user, +Z up, in millimetres. The model is exported to glTF's frame (metres, +Y up, the user looking along −Z).
- **Node names** follow `<unit>.<part>[.<index>]`, in lower-case ASCII: `key.enter`, `part.z40`, `recorder.reel.left`. They are the contract between the params, the model and the page, and `tests/model.test.js` holds the page to it.
- **The machine's names** keep the manuals' spelling: Level II BASIC, `CLOAD`, `SYSTEM`, BREAK, CLEAR, ENTER, the Video Display, the CTR-80.

## Code

- **Plain JavaScript modules, no build step.** Copying the repository to a web server deploys it.
- **Types are JSDoc,** checked strictly by `pnpm typecheck` (TypeScript's checker with `checkJs` and `strict`; nothing is compiled). Type the code as you write it.
- **Vendored libraries:** three.js, Roboto Flex and Material Symbols are copied from `node_modules` into `vendor/`; the Z80 core, xtrs's characters and the ROM are pinned by commit and SHA-256 (`tools/vendor.mjs`). The page reaches them through its import map.
- **Version stamps:** every local file the page names, and every module in its import map, carries `?v=<version>`. `pnpm stamp` writes them; never edit them by hand.
- **Where code goes:**

  | Folder | Holds | Rule |
  |---|---|---|
  | `js/sim/` | the machine: CPU, memory, clock, keys, cassette, recorder, disassembler | no DOM, no three.js, no Web Audio; runs in Node |
  | `js/lessons/` | the lessons, as data, and their checks | no DOM |
  | `js/accept/` | the acceptance checks, shared by `node --test` and `?selftest` | no DOM |
  | `js/scene/` | the 3D view: viewer, the model's bindings, the CRT texture | three.js |
  | `js/flat/` | the 2D view: the flat drawings and the screen canvas | DOM |
  | `js/app/` | the page: top bar, stage, dock, tools, status line, About | DOM |
  | `js/ui/` | shared components: menu, dialog, tabs, icon button | DOM |
  | `js/l10n/` | message keys | data |

- **Comments say why,** and cite their source by key (`[reed-uc]`, `research/bibliography.md`) or a decision by number (D3, U4). A number in the code that comes from a document names its source next to it.
- **Licence headers:** every JavaScript, CSS and HTML file of ours starts with an SPDX header naming Apache-2.0. A file copied from another project keeps that project's copyright line.
- **Text:** every string a visitor sees is a message key in `js/l10n/en.js`. The machine's own text (the screen, BASIC listings, key legends) is data, not a message.
- **Generated files are never edited by hand.** These are `js/sim/charset-data.js`, `vendor/material-symbols/icons.js`, `vendor/z80js/z80.module.*`, `roms/level2-v12.bin`, `model/params/board.json` and `keyboard.json`, and `model/trs80-model-i.glb`.

## Tests

- **Node's own runner,** `pnpm test`: `tests/**/*.test.js` and `tools/*.test.mjs`, with `node:assert`. No browser, GPU or network. ZEXDOC, which needs the network once and over a minute, is opt-in: `pnpm test:zexdoc`.
- **Acceptance IDs by area**, as in [../design/v0.0.1.md](../design/v0.0.1.md) §6: `CPU`, `MEM`, `BAS`, `KEY`, `VID`, `TAP`, `DIS`, `DBG`, `MOD`, `LES`, `APP`.
  - Each statement is one test, named after its ID (`it("TAP-3: …")`).
  - A tolerance is a named constant, with its reason.
- **Tests are written from the sources,** not from the code's output. A test's expected value cites its source, or a decision when the value is ours.

## No developer pages

There is one page, `index.html`. The machine is verified by the Node tests and by `?selftest` on that page. Developer options in the address (`?selftest`, `?debug`) are documented in [development.md](development.md) and not linked from the page.

## References

The repository is public. Everything in it must be readable and followable by anyone:
- **Links** stay inside the repository or go to public URLs. A relative link must lead to a file that exists here.
- **No absolute local paths** anywhere.
- **No mention of private material,** such as unpublished repositories, private correspondence, or photos that could not be published.
- **Visitor-facing text** names the simulator and the machine, and nothing about how it is developed.

`pnpm check:refs` (`tools/check-refs.mjs`) checks all four, and CI runs it.
