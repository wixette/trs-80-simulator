# Development

How to run, check, change and release the simulator. Related documents:
- the rules the code follows: [conventions.md](conventions.md)
- the page's design: [ui-design.md](ui-design.md)
- the release being built: [../design/v0.0.1.md](../design/v0.0.1.md)
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

The page's own link format (`#view=3d`, `#view=2d`) is described in [ui-design.md](ui-design.md). It is not frozen before 1.0.0.

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
