// SPDX-License-Identifier: Apache-2.0
//
// The release screenshots, `pnpm shots`: the README's pictures, and a set for posts. After the
// Altair 8800 simulator's tools/shots.mjs.
//
//     pnpm shots                     into ~/Downloads/trs-80-simulator-v<version>-media/shots/
//     pnpm shots --only tape         the shots whose name holds "tape"
//     pnpm shots --readme            and the README's, into screenshots/ (1600 px wide)
//     pnpm shots --lang en,zh        in these languages, each into its own folder (U11)
//
// Headless Chrome with its GPU (tests/browser/harness.mjs), 1600 x 900 at twice the pixels,
// written as JPEGs. Each shot opens the page afresh, as a first visit, and sets it up through
// the page's own handles (?debug), as a visitor would leave it. The README's copies need
// ffmpeg, to scale them.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { findChrome, ROOT, serve, sleep, start } from "../tests/browser/harness.mjs";

const QUALITY = 90;
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** The sizes a shot is taken at. */
const SIZES = {
  desktop: { width: 1600, height: 900, phone: false, scale: 2 },
  phone: { width: 390, height: 844, phone: true, scale: 3 },
};

// Helpers the setups use, run in the page: the machine answered at MEMORY SIZE?, a sample
// typed in as Type it in types it, a view, a tab, the dock's height or fold.
const HELPERS = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (f, ms = 30000) => { const end = Date.now() + ms; while (!f() && Date.now() < end) await sleep(100); };
  const { typeKeys } = await import("./js/lessons/lessons.js");
  const samples = await import("./js/sim/samples.js");
  const { t } = await import("./js/l10n/l10n.js");
  const typed = async () => { await until(() => !trs80.typist.busy, 90000); await sleep(600); };
  const ready = async () => {
    await until(() => trs80.machine.screenText().some((l) => /^MEMORY SIZE\\?/.test(l)));
    typeKeys(trs80, "{ENTER}");
    await until(() => trs80.machine.screenText().includes("READY"));
  };
  const program = async (id) => {
    const sm = samples.SAMPLES.find((x) => x.id === id);
    const { asking, keys } = samples.typeIn(trs80.machine.screenText(), sm.text);
    typeKeys(trs80, keys);
    trs80.say({ key: asking ? "program.typingMemory" : "program.typing", params: { title: t("sample." + id + ".title") } });
    await typed();
  };
  const type = async (text) => { trs80.type(text); await typed(); };
  const view = async (v) => { app.stage.goTo(v); await sleep(200); await until(() => !app.viewer.isFlying(), 8000); await sleep(400); };
  const tab = (id) => app.dock.show(id);
  const dockHeight = (px) => { app.dock.folded = false; app.dock.choose(px); };
  const fold = () => { app.dock.folded = true; app.dock.apply(); };
  await until(() => app.desk() !== null);
`;

/**
 * A shot: its file name, its size, its setup (run in the page with HELPERS), how long to let
 * it settle, and its name in screenshots/ if the README shows it.
 * @typedef {{ name: string, size?: keyof typeof SIZES, setup: string, wait?: number, readme?: string }} Shot
 */

/** @type {Shot[]} */
const SHOTS = [
  // the first picture: the desk in 3D, a sample drawn on the screen, the lessons below
  { name: "app-3d-lessons", readme: "app", setup: `await ready(); await program("wave"); dockHeight(330); tab("lessons"); await view("desk");` },
  // the 2D view: the display, the recorder and the keyboard, flat
  { name: "2d-drawers", readme: "2d", setup: `await ready(); await program("wave"); fold(); app.stage.setMode("2d"); await sleep(1500);
      if (!app.flat.drawerOpen("rec")) app.flat.toggleDrawer("rec"); if (!app.flat.drawerOpen("kbd")) app.flat.toggleDrawer("kbd");` },
  // inside, from below: the chips lit as a program runs
  { name: "3d-inside", readme: "inside", wait: 2500, setup: `await ready(); await program("bounce"); fold(); await view("inside");` },
  // taken apart
  { name: "3d-apart", readme: "apart", wait: 6000, setup: `fold(); trs80.power(false); await view("apart");` },
  { name: "3d-three-quarter", setup: `await ready(); await program("wave"); fold(); await view("angle");` },
  { name: "3d-keyboard", setup: `await ready(); await program("keys"); fold(); await view("keyboard");` },
  // the tools
  { name: "tool-vram", readme: "vram", setup: `await ready(); await program("kaleido"); dockHeight(470); tab("vram"); await sleep(800);
      document.querySelectorAll("#pane-vram .vram-cell")[200]?.click();` },
  { name: "tool-tape", readme: "tape", wait: 500, setup: `await ready(); dockHeight(470); tab("cassette");
      const { tapeFromCas } = await import("./js/sim/cassette.js"); const { screenProgramCas } = await import("./js/sim/system-samples.js");
      trs80.setFastTape(false); trs80.insertTape(tapeFromCas("SCREEN (machine code)", screenProgramCas())); trs80.deckKey("play");
      await type("SYSTEM\\n"); await type("SCREEN\\n"); await sleep(5000);` },
  { name: "tool-cpu", readme: "cpu", setup: `await ready(); await program("wave"); dockHeight(470); tab("cpu"); await sleep(500);
      trs80.clock.pause();` },
  // on a phone: 2D, where a phone types
  { name: "phone-2d", size: "phone", setup: `await ready(); await program("wave"); app.stage.setMode("2d"); await sleep(1500);` },
];

const { values: opts } = parseArgs({
  options: {
    out: { type: "string", default: join(homedir(), "Downloads", `trs-80-simulator-v${VERSION}-media`, "shots") },
    only: { type: "string", default: "" },
    lang: { type: "string", default: "en" },
    readme: { type: "boolean", default: false },
  },
});
const chrome = findChrome();
if (!chrome) {
  console.error("Chrome was not found: set CHROME to its path.");
  process.exit(2);
}
if (opts.readme) mkdirSync(join(ROOT, "screenshots"), { recursive: true });
const server = await serve();
let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = join(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  for (const shot of SHOTS.filter((s) => s.name.includes(opts.only))) {
    const h = await start(chrome, server.url, `&lang=${encodeURIComponent(lang)}`);
    try {
      const size = SIZES[shot.size ?? "desktop"];
      await h.viewport(size.width, size.height, size.phone, size.scale);
      await h.open();
      await h.js(`(async () => { ${HELPERS} ${shot.setup} })()`);
      await sleep(shot.wait ?? 1500);
      const image = await h.send("Page.captureScreenshot", { format: "jpeg", quality: QUALITY });
      const bytes = Buffer.from(image.result.data, "base64");
      writeFileSync(join(dir, `${shot.name}.jpg`), bytes);
      if (opts.readme && shot.readme && lang === "en") {
        // the README's copy, 1600 pixels wide: sharp on GitHub, and light
        const made = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-i", "pipe:0", "-vf", "scale=1600:-2", "-q:v", "3", join(ROOT, "screenshots", `${shot.readme}.jpg`)], { input: bytes });
        if (made.status) h.errors.push(`ffmpeg: ${made.stderr}`);
      }
    } catch (e) {
      h.errors.push(String(e));
    } finally {
      await h.stop();
    }
    if (h.errors.length) failed++;
    console.log(`${lang}/${shot.name}.jpg${h.errors.length ? `  ERROR ${h.errors.join("; ")}` : ""}`);
  }
}
server.close();
process.exitCode = failed ? 1 : 0;
