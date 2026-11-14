// SPDX-License-Identifier: Apache-2.0
//
// The page: loads the ROM and the model's parameters, builds the desk (js/sim/system.js),
// the stage in 3D and 2D, the dock and its tools, the top bar and the status line, and runs
// them each frame. docs/ui-design.md says how they are laid out and why.

import { t } from "../l10n/l10n.js";
import { TapeSound } from "../audio/tape-sound.js";
import { Flat } from "../flat/flat.js";
import { Crt } from "../scene/crt.js";
import { Desk3D } from "../scene/desk3d.js";
import { Viewer } from "../scene/viewer.js";
import { CLOCK_HZ } from "../sim/machine.js";
import { checkRom, loadRom } from "../sim/roms.js";
import { System } from "../sim/system.js";
import { applyIcons, applyL10n, el, overlayOpen } from "../ui/components.js";
import { tokens } from "../ui/theme.js";
import { aboutBody } from "./about.js";
import { Dock } from "./dock.js";
import { LessonsTool } from "./lessons.js";
import { readLink, writeLink } from "./link.js";
import { Stage, VIEWS } from "./stage.js";
import { HelperStrip } from "./strip.js";
import { CassetteTool } from "./tools/cassette.js";
import { CpuTool } from "./tools/cpu.js";
import { KeyboardTool } from "./tools/keyboard.js";
import { VramTool } from "./tools/vram.js";
import { TopBar } from "./topbar.js";

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
/** A file of the site's own, with this module's version stamp. @param {string} path */
const asset = (path) => {
  const u = new URL(`../../${path}`, import.meta.url);
  u.search = new URL(import.meta.url).search;
  return u;
};
/** Where the power of the computer and the display is remembered. */
const POWER_STORE = "trs80.power";
/** @param {string} path */
const json = async (path) => (await fetch(asset(path))).json();

applyIcons(document);
applyL10n(document);

const [romResult, machineParams, keyboardParams, boardParams] = await Promise.all([loadRom(), json("model/params/machine.json"), json("model/params/keyboard.json"), json("model/params/board.json")]);
const system = new System({ rom: romResult.rom, takeApart: machineParams.take_apart.order });
const c = tokens();

// ---- the status line (P7) ---------------------------------------------------------------------
// One line's height in the page, whatever it says: a longer message rises over the foot of the
// dock, whose panes gain as much room below their end (--status-rise), so the stage never
// changes size because of a message. A refusal is amber, a fault red.
const statusBar = $("status");
const statusText = $("status-text");
/** Messages that refuse something, and say why (P6). */
const WARN = new Set(["power.apart", "power.noRom", "reset.off", "deck.noTape", "deck.empty", "apart.poweredOn", "type.off", "cpu.off", "cpu.badAddress", "tape.nothingToSave", "tape.noPulses", "status.otherRom"]);
/** Messages about a fault. */
const ERROR = new Set(["stage.no3d", "tape.badFile", "status.noRom", "rom.short"]);
/** @param {string} key */
const levelOf = (key) => (ERROR.has(key) ? "error" : WARN.has(key) ? "warn" : "");
const fitStatus = () => {
  const rise = Math.max(0, statusText.offsetHeight - statusBar.clientHeight);
  document.documentElement.style.setProperty("--status-rise", `${rise}px`);
};
/** @param {string} text @param {"" | "warn" | "error"} [level] */
const say = (text, level = "") => {
  statusText.textContent = text;
  statusBar.dataset.level = level;
  fitStatus();
};
addEventListener("resize", fitStatus);
system.say = (m) => say(t(m.key, m.params ?? {}), levelOf(m.key));

// ---- the stage: 2D always, 3D where WebGL is ---------------------------------------------------
const flat = new Flat($("view2d"), system, {
  machine: machineParams,
  board: boardParams,
  keyboard: keyboardParams,
  colours: /** @type {any} */ (c),
  logos: asset("model/assets/logos/"),
  pickCell: (cell) => {
    vram.pick(cell);
    flat.highlight = cell;
    flat.invalidate();
    dock.show("vram");
  },
});

const webgl = (() => {
  try {
    const cv = document.createElement("canvas");
    return !!(cv.getContext("webgl2") || cv.getContext("webgl"));
  } catch {
    return false;
  }
})();
/** @type {Viewer | null} */
let viewer = null;
/** @type {Desk3D | null} */
let desk = null;
/** @type {Crt | null} */
let crt = null;
if (webgl) {
  viewer = new Viewer($("view3d"));
  viewer.jumpTo(viewer.fit(VIEWS.desk));
}

const stage = new Stage(system, {
  viewer,
  desk: null,
  flat,
  onModeChange: (mode) => {
    try {
      localStorage.setItem("trs80.view", mode);
    } catch {
      // not remembered
    }
    writeLink({ view: mode });
    if (mode === "2d") say(t(system.machine.powered ? "stage.legend" : "status.welcome2d"));
  },
});

// ---- the dock and its tools (P3, U6) ---------------------------------------------------------------
const dock = new Dock(() => (matchMedia("(max-width: 700px)").matches ? Math.round(window.innerHeight * 0.4) : 300));
dock.onResize = fitStatus;
const sound = new TapeSound();
const lessons = new LessonsTool($("pane-lessons"), system, (s) => showMe(s));
const vram = new VramTool($("pane-vram"), system, (cell) => {
  flat.highlight = cell;
  flat.invalidate();
});
const keyboard = new KeyboardTool($("pane-keyboard"), system);
const cassette = new CassetteTool($("pane-cassette"), system, sound);
const cpu = new CpuTool($("pane-cpu"), system);
/** The tool Show me put beside the lesson, if any. @type {{ tick: (dt: number) => void } | null} */
let companion = null;
/** The Keyboard tool beside the lesson, which hears the program's reads too. @type {KeyboardTool | null} */
let companionKeys = null;
system.machine.on.scan = (sel, value) => {
  keyboard.scanned(sel, value);
  companionKeys?.scanned(sel, value);
};
dock.start();

/**
 * Show me (U7): points at what a lesson's step is about. It never works the machine.
 * @param {import("../lessons/lessons.js").Show} s
 */
function showMe(s) {
  if (s.mode) stage.setMode(s.mode);
  if (s.view) stage.goTo(s.view);
  if (s.show) stage.setShow(s.show);
  if (s.tool) {
    const host = el("div", { class: "companion-tool" });
    if (s.tool === "vram") {
      const v = new VramTool(host, system, (cell) => {
        flat.highlight = cell;
        flat.invalidate();
      });
      if (s.cell !== undefined) {
        v.pick(s.cell);
        flat.highlight = s.cell;
        flat.invalidate();
      }
      companion = v;
    } else if (s.tool === "keyboard") {
      companionKeys = new KeyboardTool(host, system);
      companion = companionKeys;
    } else if (s.tool === "cassette") companion = new CassetteTool(host, system, sound);
    else {
      const cp = new CpuTool(host, system);
      if (s.address !== undefined) {
        cp.follow = s.address;
        cp.followSel.value = "addr";
        cp.addrField.value = s.address.toString(16).toUpperCase();
        cp.toField.value = s.address.toString(16).toUpperCase();
      }
      companion = cp;
    }
    lessons.setCompanion(host);
  }
}

// ---- the 3D desk, loaded in the background ---------------------------------------------------
if (viewer) {
  stage.progress(0);
  Desk3D.load(viewer, system, asset("model/trs80-model-i.glb"), { glow: { cpu: c.glowCpu, rom: c.glowRom, ram: c.glowRam, video: c.glowVideo } }, (f) => stage.progress(f))
    .then((d) => {
      desk = d;
      stage.desk = d;
      stage.bindDesk(d);
      crt = new Crt(d.screen, { phosphor: c.phosphor, glassOff: c.glassOff, glassOn: c.glassOn });
      stage.progress(null);
    })
    .catch((err) => {
      stage.progress(null);
      say(`${t("stage.no3d")} (${err instanceof Error ? err.message : err})`, "error");
    });
}

// ---- the helper strip (U4) ----------------------------------------------------------------------
const strip = new HelperStrip($("helper-strip"), system, () => desk);

// ---- the top bar ---------------------------------------------------------------------------------
new TopBar(system, { rom: () => romResult.rom, about: () => aboutBody(asset("package.json")) });

// ---- the machine's events -------------------------------------------------------------------------
system.machine.on.video = (addr) => {
  if (crt) crt.dirty = true;
  flat.invalidate();
  vram.written(addr);
};
system.machine.on.mode32 = () => {
  if (crt) crt.dirty = true;
  flat.invalidate();
};
system.onChange.push(() => {
  if (crt) crt.dirty = true;
  flat.invalidate();
  vram.invalidate();
});
/** The pulses of this frame, for the tape's sound: machine times. @type {number[]} */
const pulses = [];
system.deck.onPulse = (tt) => pulses.push(tt);

// ---- the visitor's keyboard (U5) ------------------------------------------------------------------
/** Whether a key event belongs to the page rather than the machine. @param {KeyboardEvent} e */
function forThePage(e) {
  if (overlayOpen()) return true;
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const a = /** @type {HTMLElement | null} */ (document.activeElement);
  if (!a || a === document.body) return false;
  if (a.matches("input, textarea, select, [contenteditable]")) return true;
  // a focused control keeps the keys it acts on
  if (a.matches("button, [role=tab], [role=radio], summary, a, #dock-handle") && ["Enter", " ", "Tab"].includes(e.key)) return true;
  if (a.matches(".vram-cell") && e.key.startsWith("Arrow")) return true;
  // the 3D view, focused by Tab: its arrows, + and - move the camera, Home goes home
  if (viewer && a === viewer.canvas && a.matches(":focus-visible") && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "Home"].includes(e.key)) return true;
  return e.key === "Tab" || e.key === "F5" || e.key.startsWith("F");
}
addEventListener("keydown", (e) => {
  sound.unlock();
  if (forThePage(e)) {
    if (viewer && document.activeElement === viewer.canvas && e.key === "Home") stage.home();
    return;
  }
  if (system.hostKeys.down(e)) e.preventDefault();
});
addEventListener("keyup", (e) => system.hostKeys.up(e));
addEventListener("blur", () => system.hostKeys.releaseAll());
if (viewer) {
  // the camera's own keys only when the canvas was reached by Tab, not by a click
  viewer.canvas.addEventListener(
    "keydown",
    (e) => {
      if (!viewer?.canvas.matches(":focus-visible")) e.stopImmediatePropagation();
      if (!viewer?.canvas.matches(":focus-visible") && !forThePage(e) && system.hostKeys.down(e)) e.preventDefault();
    },
    { capture: true },
  );
}
// a control pressed with the pointer lets go of the focus, so that the next keys are the machine's
document.addEventListener("click", (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest?.("button, [role=tab]");
  if (b && e.detail > 0 && !b.closest("dialog, .menu")) /** @type {HTMLElement} */ (b).blur();
});
addEventListener("pointerdown", () => sound.unlock(), { capture: true });

// ---- the ROM: missing, or the visitor's own (D2) ----------------------------------------------------
if (romResult.status !== "ok") {
  say(t(romResult.status === "missing" ? "status.noRom" : "status.otherRom"), romResult.status === "missing" ? "error" : "warn");
  if (romResult.status === "missing") {
    const pick = /** @type {HTMLInputElement} */ (el("input", { type: "file", hidden: true }));
    document.body.append(pick);
    const b = el("button", { class: "btn filled small rom-pick", type: "button", text: t("rom.choose") });
    b.addEventListener("click", () => pick.click());
    pick.addEventListener("change", async () => {
      const f = pick.files?.[0];
      if (!f) return;
      const r = await checkRom(new Uint8Array(await f.arrayBuffer()));
      if (!r.rom) return say(t("rom.short", { name: f.name }), "error");
      system.setRom(r.rom);
      romResult.rom = r.rom;
      b.remove();
      say(t(r.status === "ok" ? "rom.ok" : "status.otherRom"), r.status === "ok" ? "" : "warn");
    });
    $("status").append(b);
  }
} else {
  // the machine starts as the visitor left it: at first, switched on, waiting at MEMORY SIZE?
  // (docs/ui-design.md, U5), so that a first visit opens on a live machine
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(POWER_STORE) ?? "null");
  } catch {
    // not remembered
  }
  const on = { computer: saved?.computer ?? true, display: saved?.display ?? true };
  const sayNothing = system.say;
  system.say = () => {};
  if (on.display) system.displayPower(true);
  if (on.computer) system.power(true);
  system.say = sayNothing;
  say(t(on.computer && on.display ? "status.welcomeOn" : "status.welcome"));
}
// the power, as the visitor leaves it
let powerShown = "";
system.onChange.push(() => {
  const now = JSON.stringify({ computer: system.machine.powered, display: system.display.on });
  if (now === powerShown) return;
  powerShown = now;
  try {
    localStorage.setItem(POWER_STORE, now);
  } catch {
    // not remembered
  }
});

// ---- the view to start in (U1): the link's, else the remembered one, else 3D --------------------------
const link = readLink(location.hash);
let start = link.view;
if (!start) {
  try {
    start = /** @type {"2d" | "3d" | undefined} */ (localStorage.getItem("trs80.view") ?? undefined);
  } catch {
    start = undefined;
  }
}
if (!viewer) start = "2d";
if (start === "2d") stage.setMode("2d", { instant: true });
if (start !== "2d" && matchMedia("(max-width: 700px)").matches) say(t("status.phone2d"));

// ---- each frame ------------------------------------------------------------------------------------
system.clock.start();
let lastT = performance.now();
let frameT0 = system.machine.t;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  system.frame(dt);
  // the tape's sound, at the real speed only
  const ran = system.machine.t - frameT0;
  if (system.clock.boost === 1 && system.clock.speed === 1 && pulses.length && ran > 0) sound.frame(pulses.map((p) => (p - frameT0) / CLOCK_HZ), ran / CLOCK_HZ);
  pulses.length = 0;
  frameT0 = system.machine.t;
  const pic = { read: (/** @type {number} */ a) => system.machine.peek(a), computer: system.machine.powered, display: system.display.on, mode32: system.machine.mode32, contrast: system.display.contrast, brightness: system.display.brightness };
  if (crt && stage.mode === "3d") crt.draw(pic);
  if (stage.mode === "2d") flat.tick(dt);
  if (dock.shows("vram")) vram.tick();
  if (dock.shows("keyboard")) keyboard.tick();
  if (dock.shows("cassette")) cassette.tick();
  if (dock.shows("cpu")) cpu.tick(dt);
  if (dock.shows("lessons")) {
    lessons.tick();
    if (companion && !lessons.companion.hidden) companion.tick(dt);
  }
  stage.refresh();
  strip.refresh();
}
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has("debug")) Object.assign(window, { trs80: system, app: { stage, dock, flat, viewer, lessons, desk: () => desk } });
if (new URLSearchParams(location.search).has("selftest")) import("./selftest.js").then((m) => m.selftest(system));
