// SPDX-License-Identifier: Apache-2.0
//
// The release videos, `pnpm video`: short clips of the machine at work, for posts, in one or
// more languages. 1920 x 1080, H.264 in MP4, with the machine's sound in AAC. After the Altair
// 8800 simulator's tools/video.mjs.
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
//
// The sound is the page's own, taken where the page would play it: each frame, the page hands
// its sound (js/audio/tape-sound.js) the tape's pulses and the amplifier's levels for the
// machine time just run. Here those are rendered into a track at their place on the frame
// clock, not played, so the sound keeps to the picture however slowly the frames are taken.
// As on the page, there is sound at the real speed only: Fast tape and Type in faster are silent.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** The sound track's sample rate, and its loudness against the page's full scale. */
const RATE = 48000;
const GAIN = 0.55;

/** Run in the page when recording starts: the camera's drift, frame-by-frame time, and the sound taken. */
const RECORDER = `(async () => {
  const rec = { drift: [0, 0, 1], pilot: null };
  // the sound: the page's TapeSound.frame, rendered into chunks at their time instead of played
  const { TapeSound } = await import("./js/audio/tape-sound.js");
  const { render } = await import("./js/audio/amplifier.js");
  const { CLOCK_HZ } = await import("./js/sim/machine.js");
  const RATE = ${RATE}, HALF = Math.max(1, Math.round((227 / CLOCK_HZ) * RATE));
  const chunks = [];
  let cursor = 0, hp = { x: 0, y: 0 }, t0 = 0;
  TapeSound.prototype.frame = function (offsets, amp, duration) {
    if (duration <= 0) return;
    const n = Math.max(1, Math.round(duration * RATE)), d = new Float32Array(n);
    for (const o of offsets) {
      const i = Math.round(o * RATE);
      for (let k = 0; k < HALF && i + k < n; k++) d[i + k] += 0.8;
      for (let k = HALF; k < 2 * HALF && i + k < n; k++) d[i + k] -= 0.9;
    }
    if (amp) {
      const a = render(amp, RATE, hp);
      for (let i = 0; i < n && i < a.length; i++) d[i] += a[i] * 0.9;
    } else hp = { x: 0, y: 0 };
    // the machine time just run ends now; a frame's picture is taken after its time has run,
    // so the sound goes one frame earlier. Back to back with the last chunk where it meets it.
    let at = (performance.now() - t0) / 1000 - duration - rec.frameS;
    if (Math.abs(at - cursor) < 0.05) at = cursor;
    chunks.push([Math.round(at * RATE), d]);
    cursor = at + duration;
  };
  // the track, so many seconds long: 16-bit PCM, base64
  rec.audio = (secs, gain) => {
    const N = Math.round(secs * RATE), mix = new Float32Array(N);
    for (const [s, d] of chunks) for (let i = Math.max(0, -s); i < d.length && s + i < N; i++) mix[s + i] += d[i];
    const pcm = new Int16Array(N);
    for (let i = 0; i < N; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, mix[i] * gain)) * 32767);
    const bytes = new Uint8Array(pcm.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
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
    rec.frameS = dt;
    const [a, u, z] = rec.drift;
    if (a || u || z !== 1) rec.orbit(a * dt, u * dt, z ** dt);
    rec.pilot?.();
    __clock.advance(dt * 1000);
  };
  // Bricks played by the screen: the bat's arrow held towards the ball, as a player watching it would
  let held = null;
  const hold = (key) => {
    if (key === held) return;
    if (held) trs80.hostKeys.up({ key: held, code: held });
    if (key) trs80.hostKeys.down({ key, code: key });
    held = key;
  };
  // Worm played by the screen: the shortest way through free cells from the head to the food,
  // or, with none, the free neighbour with the most room round it
  rec.worm = (on) => {
    if (!on) return void ((rec.pilot = null), hold(null));
    const STEPS = [[-64, "ArrowUp"], [64, "ArrowDown"], [-1, "ArrowLeft"], [1, "ArrowRight"]];
    rec.pilot = () => {
      const v = trs80.machine.vram, free = (i) => i >= 128 && i < 960 && (v[i] === 32 || v[i] === 42);
      // the head is @, 64: kept as 0, as the Model I's video RAM has no bit 6
      const head = v.indexOf(0, 128), food = v.indexOf(42, 64);
      if (head < 0) return hold(null);
      if (food > 0) {
        // each cell reached keeps the first step that reached it (0: not reached yet)
        const first = new Int16Array(1024), queue = [];
        for (const [d] of STEPS) if (free(head + d)) { first[head + d] = d; queue.push(head + d); }
        while (queue.length) {
          const c = queue.shift();
          if (c === food) return hold(STEPS.find(([d]) => d === first[c])[1]);
          for (const [d] of STEPS) if (free(c + d) && !first[c + d] && c + d !== head) { first[c + d] = first[c]; queue.push(c + d); }
        }
      }
      let best = null, most = -1;
      for (const [d, key] of STEPS) {
        if (!free(head + d)) continue;
        const seen = new Set([head, head + d]), q = [head + d];
        while (q.length && seen.size < 200) { const c = q.shift(); for (const [e] of STEPS) if (free(c + e) && !seen.has(c + e)) { seen.add(c + e); q.push(c + e); } }
        if (seen.size > most) { most = seen.size; best = key; }
      }
      hold(best);
    };
  };
  rec.bricks = (on) => {
    if (!on) return void ((rec.pilot = null), hold(null));
    rec.pilot = () => {
      const v = trs80.machine.vram;
      let ball = -1, bat = -1;
      // the ball: one lit block below the wall; the bat: its eight cells on line 14
      for (let r = 6; r < 14 && ball < 0; r++) for (let c = 1; c < 63; c++) {
        const b = v[r * 64 + c];
        if (b >= 128 && (b & 63) && !((b & 63) & ((b & 63) - 1))) { ball = c * 2 + ((b & 42) ? 1 : 0); break; }
      }
      for (let c = 0; c < 64; c++) if (v[14 * 64 + c] === 131) { bat = c * 2 + 8; break; }
      if (ball < 0 || bat < 0) return hold(null);
      hold(ball < bat - 2 ? "ArrowLeft" : ball > bat + 2 ? "ArrowRight" : null);
    };
  };
  // keys typed in a clip go at a person's pace, not Type it in's eight times
  trs80.fastTyping = false;
  window.__rec = rec;
  rec.frameS = 0;
  __clock.start();
  t0 = performance.now();
})()`;

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
 * @property {(on: boolean) => Promise<void>} bricks plays Bricks: holds the arrow that takes the bat to the ball, each frame
 * @property {(on: boolean) => Promise<void>} worm plays Worm: holds the arrow of the shortest safe way to the food, each frame
 * @property {(notes: string, beat?: number) => Promise<void>} play plays keys of the visitor's in time: "D D F G2" (a letter, and its length in beats)
 */

/** @typedef {{ name: string, setup: string, script: (t: Take) => Promise<void> }} Scene */

/** @type {Scene[]} */
const SCENES = [
  {
    // the page at a glance: switched on, a first line of BASIC typed on its keys, the views of
    // the 3D model, then 2D with the recorder and the keyboard drawn out, and back to 3D
    name: "01-switch-on-and-tour",
    setup: `fold(); trs80.power(false); trs80.displayPower(false); await view("angle");`,
    async script(t) {
      await t.drift(-1.5, 0.2);
      await t.hold(1.2);
      await t.run(`trs80.power(true); trs80.displayPower(true)`);
      await t.hold(2.2);
      await t.drift(0);
      await t.view("screen", 1.4);
      await t.type("\n");
      await t.hold(0.6);
      await t.type('PRINT "HELLO FROM 1977"\n');
      await t.hold(1);
      await t.view("keyboard", 2);
      await t.view("recorder", 2);
      await t.view("inside", 1.2);
      await t.drift(5, 0.3);
      await t.hold(2);
      await t.drift(0);
      await t.view("desk", 2);
      await t.run(`app.stage.setMode("2d")`);
      await t.until("!app.stage.moving", 6);
      await t.hold(1.2);
      await t.run(`document.querySelector('#band [data-drawer="rec"]').click()`);
      await t.hold(1.4);
      await t.run(`document.querySelector('#band [data-drawer="kbd"]').click()`);
      await t.hold(1.8);
      await t.run(`app.stage.setMode("3d")`);
      await t.until("!app.stage.moving && !app.viewer.isFlying()", 6);
      await t.hold(1.5);
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
    // a game of Worm: the worm steered to the food, growing as it eats
    name: "03-a-game-of-worm",
    setup: `fold(); await ready(); await program("worm", true); await view("screen");`,
    async script(t) {
      await t.hold(1.5);
      await t.tap(" ");
      await t.worm(true);
      await t.hold(22);
      await t.worm(false);
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
      // at the real speed long enough to hear the tape, then Fast tape (silent, as on the page)
      await t.hold(9);
      await t.run(`trs80.setFastTape(true)`);
      await t.hold(1.5);
      await t.until("!trs80.machine.motor", 20);
      await t.view("screen", 1.6);
      await t.type("RUN\n");
      await t.hold(2.5);
    },
  },
  {
    // a game of Bricks, its bounces heard through the amplifier
    name: "07-a-game-of-bricks",
    setup: `fold(); await ready(); await program("bricks", true); await view("screen");`,
    async script(t) {
      await t.hold(1.5);
      await t.tap(" ");
      await t.bricks(true);
      await t.hold(22);
      await t.bricks(false);
      await t.hold(1);
    },
  },
  {
    // the Music box playing Ode to Joy, each note named and lit on the screen's keyboard
    name: "08-music-box",
    setup: `fold(); await ready(); await program("musicbox", true); await view("screen");`,
    async script(t) {
      await t.hold(1.5);
      await t.tap("1");
      await t.drift(0.6, 0, 0.995);
      await t.hold(9);
      await t.drift(0);
      await t.view("desk", 1.8);
      await t.until(`trs80.machine.screenText().some((l) => l.includes("PRESS A KEY"))`, 20);
      await t.hold(1.5);
    },
  },
  {
    // a program saved with CSAVE: RECORD down, the motor started by the computer, its sound,
    // and the pulses being written in the Cassette tool
    name: "09-save-to-tape",
    setup: `await ready(); await program("wave", true); await sleep(1500); typeKeys(trs80, "{BREAK}"); await typed(); await type("CLS\\n");
      const { Tape } = await import("./js/sim/cassette.js"); trs80.insertTape(new Tape("BLANK"));
      dockHeight(330); tab("cassette"); trs80.setFastTape(false); await view("recorder");`,
    async script(t) {
      await t.hold(1);
      await t.run(`trs80.deckKey("record")`);
      await t.hold(0.8);
      await t.type('CSAVE "W"\n');
      await t.until("!trs80.machine.motor", 30);
      await t.hold(3.5);
    },
  },
  {
    // the 2D view, and the Video RAM tool beside it as the Kaleidoscope fills the screen's memory
    name: "10-2d-and-video-ram",
    setup: `await ready(); dockHeight(250); tab("vram"); app.stage.setMode("2d"); await sleep(1500); await program("kaleido", true);`,
    async script(t) {
      await t.hold(12);
    },
  },
  {
    // 2D only: the Organ played on the keyboard drawn out under the screen, each key going down
    // as it sounds, the note lit on the machine's own screen; the recorder drawn out beside
    name: "11-organ-in-2d",
    setup: `fold(); await ready(); await program("organ", true); await until(() => trs80.machine.screenText().some((l) => l.includes("PLAY THE KEYS")));
      app.stage.setMode("2d"); await sleep(1500);
      for (const d of ["rec", "kbd"]) if (!app.stage.flat.drawerOpen(d)) document.querySelector('#band [data-drawer="' + d + '"]').click();
      await sleep(800);`,
    async script(t) {
      await t.hold(1);
      // Ode to Joy: A is C, S D, D E, F F, G G, H A, J B, K the C above
      await t.play("D D F G G F D S A A S D D1.5 S0.5 S2");
      await t.play("D D F G G F D S A A S D S1.5 A0.5 A2");
      await t.hold(1.5);
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
    const silent = join(dir, `.${scene.name}.video.mp4`);
    const wav = join(dir, `.${scene.name}.wav`);
    let frames = 0;
    try {
      await h.send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });
      await h.viewport(SIZE.width, SIZE.height, false, SIZE.scale);
      await h.open();
      await h.js(`(async () => { ${HELPERS} ${scene.setup} })()`);
      await sleep(800);
      await h.js(RECORDER);
      const encoder = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "ignore", "inherit"] });
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
        bricks: async (on) => void (await h.js(`__rec.bricks(${on})`)),
        worm: async (on) => void (await h.js(`__rec.worm(${on})`)),
        async play(notes, beat = 0.42) {
          for (const n of notes.split(/\s+/).filter(Boolean)) {
            const key = n[0].toLowerCase(), beats = Number(n.slice(1) || 1);
            if (key === "-") {
              await hold(beat * beats);
              continue;
            }
            const ev = JSON.stringify({ key, code: `Key${key.toUpperCase()}` });
            await h.js(`trs80.hostKeys.down(${ev})`);
            await hold(beat * beats - 0.08);
            await h.js(`trs80.hostKeys.up(${ev})`);
            await hold(0.08);
          }
        },
      };
      await scene.script(take);
      await take.bricks(false);
      await take.worm(false);
      encoder.stdin.end();
      await encoded;
      // the sound, as long as the picture, put with it
      writeFileSync(wav, wavFile(Buffer.from(String(await h.js(`__rec.audio(${frames / FPS}, ${GAIN})`)), "base64")));
      await new Promise((resolve, reject) => {
        const mux = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], { stdio: ["ignore", "ignore", "inherit"] });
        mux.on("exit", (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve(undefined)));
      });
    } catch (e) {
      h.errors.push(String(e));
    } finally {
      await h.stop();
      rmSync(silent, { force: true });
      rmSync(wav, { force: true });
    }
    if (h.errors.length) failed++;
    console.log(`${lang}/${scene.name}.mp4  ${(frames / FPS).toFixed(1)} s${h.errors.length ? `  ERROR ${h.errors.join("; ")}` : ""}`);
  }
}
server.close();

/** A mono 16-bit WAV file round PCM samples. @param {Buffer} pcm */
function wavFile(pcm) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}
process.exitCode = failed ? 1 : 0;
