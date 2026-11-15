# Development

How to run, check, change and release the simulator. Related documents:
- the rules the code follows: [conventions.md](conventions.md)
- the page's design: [ui-design.md](ui-design.md)
- the plan, release by release: [../design/roadmap.md](../design/roadmap.md)
- the machine's decisions: [../design/decisions.md](../design/decisions.md)

## Running it

There is nothing to build. Serve the repository's root over HTTP:

```
pnpm serve           # or: python3 -m http.server 8000
```

Then open <http://localhost:8000/>. `pnpm serve` tells the browser not to cache, so an edited module is always the one loaded. Browsers do not load modules from `file://`, so opening `index.html` from disk does not work.

**Options in the address** (developer options, not linked from the page):

| Option | What it does |
|---|---|
| `?selftest` | Runs the page's acceptance checks and shows a tick or a cross for each; publishes `window.__selftest = { done, passed, failed }` |
| `?debug` | Exposes the machine to the console as `trs80`, and the page as `app` |

The page's own link format (`#view=3d`, `#view=2d`) is described in [ui-design.md](ui-design.md) (P8). From 1.0.0 it is frozen: a field is never renamed, dropped or read differently, only added.

## Requirements

- **Node.js 24** (22 or later works) and **pnpm**, pinned in `package.json`; `corepack enable` installs it. These are for the checks only: `pnpm install` fetches three.js for the tests and TypeScript's checker, and the page does not use them.
- **Blender 4.2 or later**, for `pnpm build:model` only (`BLENDER` names its binary if it is not in `/Applications`).

## Checks

```
pnpm install
pnpm check         # all three below, in order
pnpm check:refs    # no private references, local paths or broken links
pnpm typecheck     # the JSDoc types, checked strictly; nothing is compiled
pnpm test          # the machine, the cassette, the lessons, the model's contract, vendor/
pnpm test:zexdoc   # the Z80 core against ZEXDOC, all 67 groups (fetches it once; over a minute)
reuse lint         # every file's licence is declared (REUSE.toml, LICENSES/)
```

`reuse` is a Python tool; without installing it, `uvx --from 'reuse[charset-normalizer]' reuse lint` runs it.

CI runs all but ZEXDOC on every push and pull request.

### The browser checks

```
pnpm test:browser              # every check, a few minutes
pnpm test:browser boot tape    # just these
```

`tests/browser/` drives the page itself in a headless Chrome, with real mouse and key events: booting and typing, the keys going to BASIC after a click on the 3D view, Programs and its dialogs, the cassette end to end (CSAVE, REWIND, CLOAD), the 3D views and taking it apart, the 2D view and its drawers, the layout at every width and on phones, the dock, the dialogs, the ten languages, and `?selftest`. They need Chrome (or `CHROME` set to its path) and a GPU for the 3D view, so they are **run by hand before a release**, not in CI, as the Altair 8800 simulator's are. Each check starts a fresh browser profile and opens the page with `?debug`, which gives it the handles `trs80` (the System) and `app` (the stage, dock, 2D view, viewer and lessons).

## Screenshots and videos

```
pnpm shots                  # into ~/Downloads/trs-80-simulator-v<version>-media/shots/en/
pnpm shots --lang en,zh     # in English and Simplified Chinese, each into its own folder
pnpm shots --readme         # and the README's pictures, into screenshots/ (needs ffmpeg)
pnpm shots --only screen    # the shots whose names hold "screen"
pnpm video --lang en,zh     # short clips, into .../videos/<lang>/ (needs ffmpeg)
pnpm video --only apart --fps 60
```

`tools/shots.mjs` opens the page in a headless Chrome (the browser checks' harness), sets each shot up through the page as a visitor would leave it, and writes a JPEG, 1600 × 900 at twice the pixels. The shots, and which of them the README shows, are listed in the tool: the README's pictures, and a set for posts (the machine from several sides, inside, taken apart, games on its screen, the tools, a phone). Retake the README's before a release.

`tools/video.mjs` records eleven short clips for posts, 1920 × 1080 in MP4 with sound: a tour (switched on, a line typed, the 3D views, 2D with its drawers, back to 3D), the Kaleidoscope, a game of Worm, taken apart, inside while it runs, a program loaded from tape, a game of Bricks, the Music box, a program saved with `CSAVE`, the 2D view with the Video RAM tool, and the Organ played in 2D, its keys going down. The games are played by reading the screen, as a player would: Worm takes the shortest safe way to the food, Bricks holds the bat under the ball. It replaces the page's clock before the page loads and moves it on one frame at a time, so the machine, the typing, the tape and the camera all run at their own speed in the clip however slowly the frames are taken. The sound is the page's own (the tape's pulses and the amplifier on the cassette lead), rendered into a track at its place on that clock rather than played, so it keeps to the picture; as on the page, Fast tape and Type in faster are silent. Each scene is a script in the tool. The setups shared by both tools, which name no label in any language, are in `tools/page-helpers.mjs`.

## The vendored files

`pnpm vendor` copies three.js, the font and the icons from `node_modules`, and takes the Z80 core, xtrs's characters and the ROM at their pinned commits, refusing any file whose SHA-256 differs. Where GitHub cannot be reached, `pnpm vendor --from <folder>` takes the same files from a local folder, under the same check. Then it writes the generated files. `tests/vendor.test.js` fails while anything is out of date.

## The 3D model

```
pnpm build:model    # Blender, headless: model/params -> model/trs80-model-i.glb
```

The `.glb` is committed (design/decisions.md, D9). `tests/model.test.js` fails if it no longer has every part the page uses. Check renders go to `model/blender/out/`, which git ignores. The params for the boards and keys are generated from the part lists in `research/data/` by `pnpm params`.

## Branches, versions and releases

- **`main` takes changes only by pull request.** Work goes on a branch named for the release it builds, `dev-v<x.y.z>`, and reaches `main` only when that release is ready.
- **The version lives in one place:** `package.json`. Set it with `pnpm version <x.y.z>`, which also writes the `?v=` stamps. It does not commit or tag (`.npmrc`).
- **A release is a pull request named for its version.** It is tagged `vX.Y.Z` on its merge commit, and its changes are listed in `CHANGELOG.md`. Versions 0.0.x are marked as pre-releases on GitHub.
- **Each push to `main` deploys** the site to GitHub Pages once its tests have passed.

## Deploying behind a cache

Every file the page names carries `?v=<version>`, so a cache may keep those files for ever. Only `index.html` (and `/`) must be revalidated:

| What | `Cache-Control` |
|---|---|
| `index.html`, `/` | `no-cache` |
| Everything asked for with `?v=` | `public, max-age=31536000, immutable` |

GitHub Pages keeps everything for 10 minutes, so a release reaches everyone there within 10 minutes.
