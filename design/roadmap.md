# The road to 1.0.0

**Agreed:** 2026-11-15. Each release is built on its own branch, `dev-v<x.y.z>`, and reaches `main` by a pull request only when it is ready (docs/development.md).

| Release | What it is |
|---|---|
| **v0.0.1** | The first pre-release ([v0.0.1.md](v0.0.1.md)). **Feature frozen.** What remains before it is released: the unit tests checked and brought up to date; a set of browser checks, run by hand before a release and not in CI, as the Altair 8800 simulator's are; a thorough code review; a first, short README with screenshots, taken by a tool, as the 8800 simulator's are |
| **v0.0.2** | The interface in ten languages, as the Altair 8800 simulator's |
| **v0.0.3** | More sample programs and tapes; the lessons improved |
| **v1.0.0** | Built on v0.0.3: the README in full, with the screenshots for it, as the 8800 simulator's |

## v0.0.1: where it stands

Ready for release, waiting for approval (2026-11-15):
- **Unit tests** checked and brought up to date: 243 pass (`pnpm check`), ZEXDOC opt-in.
- **Browser checks** (`pnpm test:browser`, [../tests/browser/](../tests/browser/)): 114 pass.
- **Code review:** done; its findings are fixed, each bug with a browser check.
- **README** with screenshots (`pnpm shots --readme`); CHANGELOG.md's 0.0.1 entry; REUSE lint clean; CI green.

Left for the release itself, once approved: a manual pass in Safari and Firefox and on a phone; the release pull request from `dev-v0.0.1` to `main`; the `v0.0.1` tag on its merge commit, marked as a pre-release.

## Decided

- **No share link in 1.0.0** (2026-11-15). A link that carries the whole machine cannot be short: the state is the memory, 16 KB and more, with the tape.
- **The teacher notes stay in English** (2026-11-15): [../lessons/teacher-notes.md](../lessons/teacher-notes.md) is not translated in v0.0.2; the page and the lessons are.
