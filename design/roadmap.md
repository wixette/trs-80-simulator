# The road to 1.0.0

**Agreed:** 2026-11-15. Each release is built on its own branch, `dev-v<x.y.z>`, and reaches `main` by a pull request only when it is ready (docs/development.md).

| Release | What it is |
|---|---|
| **v0.0.1** | The first pre-release ([v0.0.1.md](v0.0.1.md)). **Feature frozen.** What remains before it is released: the unit tests checked and brought up to date; a set of browser checks, run by hand before a release and not in CI, as the Altair 8800 simulator's are; a thorough code review; a first, short README with screenshots, taken by a tool, as the 8800 simulator's are |
| **v0.0.2** | The interface in ten languages, as the Altair 8800 simulator's |
| **v0.0.3** | Programs worth running, then the lessons rewritten round them ([v0.0.3.md](v0.0.3.md)): sound from the cassette port, a catalogue for learning, games, utilities and music, and where to find the era's own software |
| **v1.0.0** | Built on v0.0.3 ([v1.0.0.md](v1.0.0.md)). **Feature frozen:** a review of the code and the docs, and fixes, only; the README in full, with the screenshots for it, as the 8800 simulator's |

## Where it stands

- **v0.0.1:** released 2026-11-15 as a pre-release ([the release](https://github.com/wixette/trs-80-simulator/releases/tag/v0.0.1)).
- **v0.0.2:** released 2026-11-15 as a pre-release ([the release](https://github.com/wixette/trs-80-simulator/releases/tag/v0.0.2)). The page in ten languages (docs/ui-design.md, U11): the language button, the choice from the address, the visitor or the browser, one message file per language, tests that hold each to English's keys, placeholders and code, and a browser check that no English is left on the page and each fits a phone.
- **v0.0.3:** released 2026-11-15 as a pre-release ([the release](https://github.com/wixette/trs-80-simulator/releases/tag/v0.0.3); [v0.0.3.md](v0.0.3.md)). Checked by the owner in Chrome, Safari, Firefox and Chrome on an iPhone. Sound from the cassette lead; 19 programs of our own in four sections, each with its tape and a test that runs it from the tape; Type in faster; Find original programs; Type in a BASIC file; each lesson ends with a program; the ten languages for all of it.
- **v1.0.0:** on `dev-v1.0.0`, checked by the owner, version 1.0.0, waiting for the release ([v1.0.0.md](v1.0.0.md)): the code and the docs reviewed, area by area, and what was found fixed, each with a test; the README for newcomers; screenshots and clips for posts in English and Chinese.

## Decided

- **From v0.0.3 to v1.0.0, features are frozen** (2026-11-15): the work is reviewing and fixing the code and the docs.
- **No share link in 1.0.0** (2026-11-15). A link that carries the whole machine cannot be short: the state is the memory, 16 KB and more, with the tape.
- **The teacher notes stay in English** (2026-11-15): [../lessons/teacher-notes.md](../lessons/teacher-notes.md) is not translated in v0.0.2; the page and the lessons are.
