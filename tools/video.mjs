// SPDX-License-Identifier: Apache-2.0
//
// The release videos, `pnpm video`: short clips of the machine at work, for posts, in one or
// more languages. 1920 x 1080, H.264 in MP4, silent. After the Altair 8800 simulator's
// tools/video.mjs.
//
//     pnpm video                            English, into ~/Downloads/trs-80-simulator-v<version>-media/videos/en/
//     pnpm video --lang en,zh               each language into its own folder
//     pnpm video --only apart --fps 60
//
// Frame by frame, not in real time: before the page loads, its clock (requestAnimationFrame,
// performance.now, Date.now, setTimeout, setInterval) is replaced by one this tool moves on
// by exactly one frame at a time, then takes the frame. Everything that moves runs on that
// clock: the Z80, which runs the T-states a frame's time is worth at 1.77 MHz, the typist's
// keys, the tape, the camera's flights and the parts coming apart. So a clip is smooth, and
// the machine runs at its own speed in it, however slowly the frames are taken. Needs ffmpeg
// and Chrome (or CHROME set to its path).

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { findChrome, ROOT, serve, sleep, start } from "../tests/browser/harness.mjs";
import { HELPERS } from "./page-helpers.mjs";

const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** A 1280 x 720 page at one and a half times: 1920 x 1080 frames, its words big enough to read. */
const SIZE = { width: 1280, height: 720, scale: 1.5 };

/** Installed before the page's own scripts: a clock that runs in real time until started. */
const CLOCK = `(() => {
  const real = { now: performance.now.bind(performance), date: Date.now, frame: window.requestAnimationFrame.bind(window),
    timeout: window.setTimeout.bind(window), clear: window.clearTimeout.bind(window),
    interval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window) };
  let manual = false, t = 0, dateAt = 0, nextId = 1e6, frames = [];
  const timers = new Map();
  performance.now = () => (manual ? t : real.now());
  Date.now = () => (manual ? Math.round(dateAt + t) : real.date());
  window.requestAnimationFrame = (cb) => {
    if (manual) { frames.push(cb); return ++nextId; }
    return real.frame((ts) => (manual ? frames.push(cb) : cb(ts)));
  };
  const later = (cb, ms, args, every) => {
    if (!manual) return (every ? real.interval : real.timeout)(cb, ms, ...args);
    const id = ++nextId;
    timers.set(id, { cb, at: t + Math.max(1, ms || 0), args, every: every ? Math.max(1, ms || 0) : 0 });
    return id;
  };
  window.setTimeout = (cb, ms, ...args) => later(cb, ms, args, false);
  window.setInterval = (cb, ms, ...args) => later(cb, ms, args, true);
  window.clearTimeout = (id) => (timers.has(id) ? timers.delete(id) : real.clear(id));
  window.clearInterval = (id) => (timers.has(id) ? timers.delete(id) : real.clearInterval(id));
  window.__clock = {
    start() { t = real.now(); dateAt = real.date() - t; manual = true; },
    // moves time on: every timer due by then, in order, then the frame
    advance(ms) {
      const end = t + ms;
      for (let guard = 0; guard < 200000; guard++) {
        let first = null;
        for (const [id, timer] of timers) if (timer.at <= end && (!first || timer.at < first[1].at)) first = [id, timer];
        if (!first) break;
        const [id, timer] = first;
        t = Math.max(t, timer.at);
        if (timer.every) timer.at += timer.every; else timers.delete(id);
        try { timer.cb(...timer.args); } catch (e) { console.error(e); }
      }
      t = end;
      const due = frames;
      frames = [];
      for (const cb of due) cb(t);
    },
  };
})();`;

/** Run in the page when recording starts: the camera's drift, and frame-by-frame time. */
const RECORDER = `(() => {
  const rec = { drift: [0, 0, 1] };
  // turns the camera by degrees across (+: to the machine's right) and up, and scales its distance
  rec.orbit = (across, up, zoom) => {
    const v = app.viewer;
    if (!v || v.isFlying()) return;
    const c = v.camera, target = v.controls.target, o = c.position.clone().sub(target), r = o.length() * zoom;
    const theta = Math.atan2(o.x, o.z) + (across * Math.PI) / 180;
    const phi = Math.min(Math.max(Math.acos(o.y / o.length()) - (up * Math.PI) / 180, 0.1), 1.9);
    c.position.copy(target).add(o.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)).multiplyScalar(r));
    c.lookAt(target);
    app.stage.fitted = null;
  };
  rec.frame = (dt) => {
    const [a, u, z] = rec.drift;
    if (a || u || z !== 1) rec.orbit(a * dt, u * dt, z ** dt);
    __clock.advance(dt * 1000);
  };
  // keys typed in a clip go at a person's pace, not Type it in's eight times
  trs80.fastTyping = false;
  window.__rec = rec;
  __clock.start();
})();`;

/**
 * What a scene's script can do, frame-exact. Page code runs between frames, as a visitor's
 * presses would.
 * @typedef {object} Take
 * @property {(js: string) => Promise<unknown>} run runs page code now
 * @property {(seconds: number) => Promise<void>} hold records this long
 * @property {(seconds?: number) => Promise<void>} settle records until the camera has landed and the parts are at rest
 * @property {(across: number, up?: number, zoom?: number) => Promise<void>} drift turns the camera on its own: degrees across and up, and a zoom, a second
 * @property {(view: string, seconds?: number) => Promise<void>} view flies to a view, and records the flight and a little after
 * @property {(text: string) => Promise<void>} type types on the Model I's keys, and records until it is typed
 * @property {(key: string, seconds?: number) => Promise<void>} tap presses a key of the visitor's (an arrow, " ") for a moment
 * @property {(js: string, seconds?: number) => Promise<void>} until records until page code is true (or for at most so long)
 */

/** @typedef {{ name: string, setup: string, script: (t: Take) => Promise<void> }} Scene */

/** @type {Scene[]} */
const SCENES = [
  {
    // switched on, at MEMORY SIZE?, ENTER, and a first line of BASIC typed on its keys
    name: "01-switch-on-and-type",
    setup: `fold(); trs80.power(false); trs80.displayPower(false); await view("angle");`,
    async script(t) {
      await t.drift(-1.5, 0.2);
      await t.hold(1.5);
      await t.run(`trs80.power(true); trs80.displayPower(true)`);
      await t.hold(2.5);
      await t.drift(0);
      await t.view("screen", 1.6);
      await t.type("\n");
      await t.hold(0.8);
      await t.type('PRINT "HELLO FROM 1977"\n');
      await t.hold(1);
      await t.type("PRINT 2+2\n");
      await t.drift(0, 0, 1.03);
      await t.hold(2.5);
    },
  },
  {
    // the Kaleidoscope: graphics characters POKEd into the video RAM, mirrored four ways
    name: "02-kaleidoscope",
    setup: `fold(); await ready(); await program("kaleido", true); await view("screen");`,
    async script(t) {
      await t.drift(1.2, 0.3);
      await t.hold(4);
      await t.drift(0);
      await t.view("desk", 1.8);
      await t.drift(-2);
      await t.hold(4);
    },
  },
  {
    // a game of Worm, steered round the field
    name: "03-a-game-of-worm",
    setup: `fold(); await ready(); await program("worm", true); await view("screen");`,
    async script(t) {
      await t.hold(1);
      await t.tap(" ");
      await t.hold(2);
      for (const [key, after] of /** @type {[string, number][]} */ ([["ArrowDown", 1.1], ["ArrowLeft", 1.6], ["ArrowUp", 1.1], ["ArrowRight", 2.2], ["ArrowDown", 0.9], ["ArrowLeft", 1.4]])) {
        await t.tap(key);
        await t.hold(after);
      }
      await t.hold(1.5);
    },
  },
  {
    // taken apart, every unit out in order, looked round, put back
    name: "04-take-apart",
    setup: `fold(); trs80.power(false); await view("angle");`,
    async script(t) {
      await t.drift(2);
      await t.hold(1.2);
      await t.drift(0);
      await t.view("apart", 0.5);
      await t.settle(25);
      await t.drift(9, 0, 0.995);
      await t.hold(5);
      await t.drift(0);
      await t.view("desk", 0.5);
      await t.settle(12);
      await t.hold(1);
    },
  },
  {
    // inside, from below: the case as glass, the chips lit by their memory traffic
    name: "05-inside-while-it-runs",
    setup: `fold(); await ready(); await program("bounce"); await view("inside");`,
    async script(t) {
      await t.drift(6, 0.4);
      await t.hold(7);
      await t.drift(0);
      await t.hold(0.5);
    },
  },
  {
    // a program loaded from its tape at the real speed, the Cassette tool showing the pulses
    name: "06-load-from-tape",
    setup: `await ready(); dockHeight(330); tab("cassette"); trs80.setFastTape(false); await view("recorder");
      app.lessons.openProgram("lander"); await sleep(300);
      document.querySelectorAll("dialog .dialog-actions .btn")[0].click(); await until(() => trs80.deck.tape?.pulses.length > 0);`,
    async script(t) {
      await t.hold(1);
      await t.run(`trs80.deckKey("play")`);
      await t.hold(0.6);
      await t.type("CLOAD\n");
      await t.hold(6);
      await t.run(`trs80.setFastTape(true)`);
      await t.hold(1.5);
      await t.until("!trs80.machine.motor", 20);
      await t.view("screen", 1.6);
      await t.type("RUN\n");
      await t.hold(2.5);
    },
  },
];

const { values: opts } = parseArgs({
  options: {
    lang: { type: "string", default: "en" },
    out: { type: "string", default: join(homedir(), "Downloads", `trs-80-simulator-v${VERSION}-media`, "videos") },
    only: { type: "string", default: "" },
    fps: { type: "string", default: "30" },
  },
});
const FPS = Number(opts.fps);
const chrome = findChrome();
if (!chrome) {
  console.error("Chrome was not found: set CHROME to its path.");
  process.exit(2);
}
const server = await serve();
let failed = 0;
for (const lang of opts.lang.split(",")) {
  const dir = join(opts.out, lang);
  mkdirSync(dir, { recursive: true });
  for (const scene of SCENES.filter((s) => s.name.includes(opts.only))) {
    const h = await start(chrome, server.url, `&lang=${encodeURIComponent(lang)}`);
    const out = join(dir, `${scene.name}.mp4`);
    let frames = 0;
    try {
      await h.send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });
      await h.viewport(SIZE.width, SIZE.height, false, SIZE.scale);
      await h.open();
      await h.js(`(async () => { ${HELPERS} ${scene.setup} })()`);
      await sleep(800);
      await h.js(RECORDER);
      const encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "ignore", "inherit"] });
      const encoded = new Promise((r) => encoder.on("exit", r));
      const frame = async () => {
        await h.js(`__rec.frame(${1 / FPS})`);
        const shot = await h.send("Page.captureScreenshot", { format: "jpeg", quality: 95 });
        if (!encoder.stdin.write(Buffer.from(shot.result.data, "base64"))) await new Promise((r) => encoder.stdin.once("drain", r));
        frames++;
      };
      /** @param {number} seconds */
      const hold = async (seconds) => {
        for (let i = Math.round(seconds * FPS); i > 0; i--) await frame();
      };
      /** @type {Take} */
      const take = {
        run: (js) => h.js(js),
        hold,
        async settle(seconds = 10) {
          await frame();
          for (let i = seconds * FPS; i > 0 && (await h.js("app.viewer.isFlying() || [...trs80.motion.values()].some((m) => m.f !== m.target)")); i--) await frame();
        },
        drift: async (across, up = 0, zoom = 1) => void (await h.js(`__rec.drift = [${across}, ${up}, ${zoom}]`)),
        async view(v, seconds = 1.5) {
          await h.js(`app.stage.goTo(${JSON.stringify(v)})`);
          await hold(seconds);
        },
        async type(text) {
          await h.js(`trs80.type(${JSON.stringify(text)})`);
          await frame();
          for (let i = 60 * FPS; i > 0 && (await h.js("trs80.typist.busy")); i--) await frame();
        },
        async until(js, seconds = 30) {
          for (let i = seconds * FPS; i > 0 && !(await h.js(js)); i--) await frame();
        },
        async tap(key, seconds = 0.12) {
          const ev = JSON.stringify({ key, code: key === " " ? "Space" : key });
          await h.js(`trs80.hostKeys.down(${ev})`);
          await hold(seconds);
          await h.js(`trs80.hostKeys.up(${ev})`);
        },
      };
      await scene.script(take);
      encoder.stdin.end();
      await encoded;
    } catch (e) {
      h.errors.push(String(e));
    } finally {
      await h.stop();
    }
    if (h.errors.length) failed++;
    console.log(`${lang}/${scene.name}.mp4  ${(frames / FPS).toFixed(1)} s${h.errors.length ? `  ERROR ${h.errors.join("; ")}` : ""}`);
  }
}
server.close();
process.exitCode = failed ? 1 : 0;
