# Contributing

Thank you for helping. Issues and pull requests are welcome: a bug with the steps that show it, a fact about the Model I with its source, a translation that reads better, a lesson that teaches better.

## Before a pull request

```
pnpm install
pnpm check            # unit tests, the strict type check, the reference check: what CI runs
pnpm test:browser     # the page in a headless Chrome (needs Chrome): before anything that touches the page
```

- **Branches:** work on a branch of your own; `main` is what the site serves. A release is built on `dev-v<x.y.z>` and reaches `main` by a pull request ([docs/development.md](docs/development.md)).
- **The rules the code follows** are in [docs/conventions.md](docs/conventions.md): plain JavaScript modules checked by TypeScript's checker, no build step, no framework.
- **A fix comes with a test** that fails without it: a unit test in `tests/` where the logic is pure or runs on the headless machine, else a browser check in `tests/browser/`.
- **Facts about the machine** cite their source ([research/bibliography.md](research/bibliography.md)); the machine's design decisions are in [design/decisions.md](design/decisions.md).

## Words on the page

Every text of the page is a message in `js/l10n/en.js`, and every message is in all ten languages (`js/l10n/<locale>.js`, the lessons in `lessons.<locale>.js`). A test holds each language to English's keys, placeholders and `code`. A new message needs its nine translations; a native speaker's better wording is always welcome. The machine's own words (`READY`, BREAK, the key legends) stay as the machine has them.

## A program of our own

Our programs are in `js/programs/<section>.js`, each a Level II listing in the style of 1977–80, our own (never a copy of a particular commercial program). To add one:

1. Write it and try it on the headless Model I: `node tools/basic.mjs prog.bas --secs 20 --at "2:type:YES\n" --notes`.
2. Add it to its section, its title and description to `js/l10n/en.js` and the nine other languages.
3. Record its tape: `pnpm tapes <id>`.
4. Give it a scenario in `tests/programs.test.js`: the keys a player presses, and what must then be on the screen.

## Licences

Code is Apache-2.0; docs, lessons and the model are CC BY-SA 4.0 ([docs/licensing.md](docs/licensing.md)). By contributing you agree your contribution is under the same licence as the files it changes. No third-party software or ROM images beyond what `roms/NOTICE` lists.
