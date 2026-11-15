// SPDX-License-Identifier: Apache-2.0
//
// A small harness for the browser checks (run.mjs): it serves the repository, starts a
// headless Chrome on a fresh profile, and drives the page through the DevTools protocol as a
// visitor would, with real mouse and key events. After the Altair 8800 simulator's.
//
// No dependencies: Node's own http server and WebSocket. Chrome is found where it usually
// lives, or named by the CHROME environment variable. The page is opened with ?debug, which
// gives the checks its handles: `trs80` (the System) and `app` (stage, dock, flat, viewer,
// lessons, desk()) (docs/development.md).

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
  ".cas": "application/octet-stream",
  ".wav": "audio/wav",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Serves the repository on a free port, to this machine only, and not its hidden files.
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export function serve() {
  const server = createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(ROOT, path));
    const hidden = file.slice(ROOT.length).split(sep).some((p) => p.startsWith("."));
    if (!file.startsWith(ROOT + sep) || hidden || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => {
      const a = /** @type {import("node:net").AddressInfo} */ (server.address());
      done({ url: `http://127.0.0.1:${a.port}/`, close: () => server.close() });
    });
  });
}

/** Chrome, or Chromium, or null. @returns {string | null} */
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const paths = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
  for (const p of paths) if (existsSync(p)) return p;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [name], { encoding: "utf8" }).trim();
    } catch {
      // not this one
    }
  }
  return null;
}

/** @typedef {{ chrome: import("node:child_process").ChildProcess, profile: string, exited: boolean }} Live */
/** The browsers running now, so that an interrupted run can end them. @type {Set<Live>} */
const LIVE = new Set();
/** How long a DevTools call may take before the check fails, ms. */
const ANSWER_MS = 30000;

/** Ends every browser still running (an interrupted run). */
export function killAll() {
  for (const live of LIVE) {
    live.chrome.kill("SIGKILL");
    rmSync(live.profile, { recursive: true, force: true });
  }
  LIVE.clear();
}

/** @param {Live} live */
async function stopChrome(live) {
  if (!live.exited) {
    live.chrome.kill();
    for (let i = 0; i < 50 && !live.exited; i++) await sleep(100);
    if (!live.exited) live.chrome.kill("SIGKILL");
  }
  rmSync(live.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  LIVE.delete(live);
}

/** The keys a check presses by name, as DevTools wants them. @type {Record<string, { key: string, code: string, keyCode: number }>} */
const NAMED = {
  Enter: { key: "Enter", code: "Enter", keyCode: 13 },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Shift: { key: "Shift", code: "ShiftLeft", keyCode: 16 },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
};

/**
 * Starts Chrome on a fresh profile and gives back what a check needs to drive the page.
 * @param {string} chromePath
 * @param {string} base the served repository
 * @param {string} [query] more of the address's query, after ?debug ("&lang=de")
 */
export async function start(chromePath, base, query = "") {
  const url = `${base}?debug${query}`;
  const profile = mkdtempSync(join(tmpdir(), "trs80-browser-"));
  // the GPU, for the 3D view: without it three.js falls back, or fails, in headless Chrome
  const chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--lang=en-US", "--enable-gpu", "--use-angle=metal", "--autoplay-policy=no-user-gesture-required", "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  /** @type {Live} */
  const live = { chrome, profile, exited: false };
  LIVE.add(live);
  chrome.on("exit", () => (live.exited = true));
  let port = 0;
  for (let i = 0; i < 75 && !port && !live.exited; i++) {
    await sleep(200);
    try {
      port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || 0;
    } catch {
      // not written yet
    }
  }
  if (!port) {
    await stopChrome(live);
    throw new Error(`Chrome did not start: ${chromePath}`);
  }
  /** @type {{ type: string, webSocketDebuggerUrl: string } | undefined} */
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      /** @type {{ type: string, webSocketDebuggerUrl: string }[]} */
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === "page");
    } catch {
      await sleep(100);
    }
  }
  if (!target) {
    await stopChrome(live);
    throw new Error("Chrome started, but offered no page to drive");
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.addEventListener("open", ok);
    ws.addEventListener("error", () => fail(new Error("no DevTools connection")));
  });
  let id = 0;
  /** @type {Map<number, { method: string, ok: (m: any) => void, fail: (e: Error) => void }>} */
  const pending = new Map();
  /** @type {string[]} */
  const errors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)?.ok(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push(msg.params.args.map((/** @type {any} */ a) => a.value ?? a.description).join(" "));
    }
  });
  ws.addEventListener("close", () => {
    for (const call of pending.values()) call.fail(new Error(`the browser went away during ${call.method}`));
    pending.clear();
  });
  /** @param {string} method @param {object} [params] @returns {Promise<any>} */
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const n = ++id;
      const timer = setTimeout(() => {
        pending.delete(n);
        fail(new Error(`the browser did not answer ${method}`));
      }, ANSWER_MS);
      pending.set(n, { method, ok: (m) => (clearTimeout(timer), ok(m)), fail: (e) => (clearTimeout(timer), fail(e)) });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");

  /** Evaluates an expression in the page, awaiting a promise. @param {string} expr @returns {Promise<any>} */
  const js = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) {
      errors.push(`eval: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`);
      return undefined;
    }
    return r.result?.result?.value;
  };
  /** Waits until an expression is true in the page, up to ms; whether it became so. @param {string} expr @param {number} [ms] */
  const until = async (expr, ms = 15000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await js(`!!(${expr})`)) return true;
      await sleep(150);
    }
    return false;
  };
  /** The window's size; a phone is touch, at three times the pixels. @param {number} width @param {number} height @param {boolean} [phone] @param {number} [scale] pixels per CSS pixel */
  const viewport = async (width, height, phone = false, scale = phone ? 3 : 1) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: phone });
    await send("Emulation.setTouchEmulationEnabled", { enabled: phone });
    await sleep(400);
  };
  /** Opens the page; first: as a first visit, nothing kept from before. @param {{ keep?: boolean }} [o] */
  const open = async (o = {}) => {
    if (!o.keep) {
      await send("Page.navigate", { url });
      await until("document.readyState === 'complete'");
      await js("localStorage.clear()");
    }
    await send("Page.navigate", { url });
    await until("typeof trs80 === 'object' && typeof app === 'object'", 20000);
    await sleep(500);
  };
  /** An element's middle, on screen. @param {string} selector */
  const centre = (selector) =>
    js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
      const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  /** A real mouse press and release at a point. @param {number} x @param {number} y @param {number} [clickCount] */
  const clickAt = async (x, y, clickCount = 1) => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    for (let n = 1; n <= clickCount; n++) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: n });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: n });
    }
    await sleep(150);
  };
  /** Clicks an element's middle, as the mouse would; false if there is none. @param {string} selector @param {number} [clickCount] */
  const press = async (selector, clickCount = 1) => {
    const c = await centre(selector);
    if (!c) {
      errors.push(`no element ${selector}`);
      return false;
    }
    await clickAt(c.x, c.y, clickCount);
    return true;
  };
  /** Clicks the first element that matches and whose text starts so. @param {string} selector @param {string} text */
  const pressText = async (selector, text) => {
    const c = await js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)}));
      if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    if (!c) {
      errors.push(`no ${selector} "${text}"`);
      return false;
    }
    await clickAt(c.x, c.y);
    return true;
  };
  /** A drag from one point to another, the button held. @param {{ x: number, y: number }} a @param {{ x: number, y: number }} b */
  const drag = async (a, b) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 5; i++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x + ((b.x - a.x) * i) / 5, y: a.y + ((b.y - a.y) * i) / 5, button: "left", buttons: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(150);
  };
  /** A named key (Enter, Escape, Shift, Tab, Backspace), pressed and released. @param {string} name */
  const key = async (name) => {
    const k = NAMED[name];
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode });
    if (name === "Enter") await send("Input.dispatchKeyEvent", { type: "char", key: "Enter", text: "\r" });
    await sleep(60);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode });
    await sleep(90);
  };
  /** Types text on the host's keyboard, a key at a time, slowly enough for the Model I to read each. "\n" is Enter. @param {string} text */
  const typeHost = async (text) => {
    for (const ch of text) {
      if (ch === "\n") {
        await key("Enter");
        continue;
      }
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch });
      await sleep(60);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep(90);
    }
  };
  /** The Model I's screen, its lines that are not blank. @returns {Promise<string[]>} */
  const screen = () => js("trs80.machine.screenText().filter((l) => l.trim())");
  /** Whether a line on the screen matches. @param {string} re a RegExp's source */
  const shows = (re) => js(`trs80.machine.screenText().some((l) => new RegExp(${JSON.stringify(re)}).test(l))`);
  /** The status line's text. @returns {Promise<string>} */
  const status = () => js("document.getElementById('status').textContent");
  /** Waits for the typist to finish, and the machine to show what it typed. @param {number} [ms] */
  const typed = async (ms = 60000) => {
    await until("!trs80.typist.busy", ms);
    await sleep(800);
  };
  /** Opens a top-bar or band menu and chooses the item whose text starts so, scrolled to if the menu scrolls. @param {string} button @param {string} label */
  const choose = async (button, label) => {
    await press(button);
    await sleep(200);
    const sel = await js(`(() => { const b = [...document.querySelectorAll('.menu [role^="menuitem"]')].find((x) => x.textContent.startsWith(${JSON.stringify(label)}));
      if (!b) return null; b.id ||= 'check-item'; b.scrollIntoView({ block: 'nearest' }); return '#' + b.id; })()`);
    if (!sel) {
      errors.push(`no menu item ${label}`);
      await key("Escape");
      return false;
    }
    return press(sel);
  };
  /** @type {{ name: string, ok: boolean }[]} */
  const results = [];
  /** @param {string} name @param {unknown} ok @param {unknown} [info] */
  const verify = (name, ok, info = "") => {
    results.push({ name, ok: !!ok });
    console.log(`  ${ok ? "PASS" : "FAIL"} ${name}${!ok && info !== "" ? `  | ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
  };
  const stop = async () => {
    ws.close();
    await stopChrome(live);
  };
  return { base, send, js, until, viewport, open, centre, clickAt, press, pressText, drag, key, typeHost, screen, shows, status, typed, choose, verify, results, errors, stop, sleep };
}

/** @typedef {Awaited<ReturnType<typeof start>>} Harness */
