// SPDX-License-Identifier: Apache-2.0
//
// The 2D view (design/decisions.md, D10; docs/ui-design.md, U1): the machine's own faces,
// flat, drawn from the same parameters as the 3D model (model/params/), each control where it
// is on the machine:
//
// - the Video Display from the front: the picture (a canvas at full resolution in the tube's
//   opening), its POWER button, the name plate, C, B and V;
// - the CTR-80 from above: its six keys, the counter, the RECORD lamp, and the door's window
//   with the cassette, whose reels turn while the tape moves;
// - the keyboard unit from above: the keys (held while pressed, several at once; SHIFT tapped
//   alone latches for the next key), the power LED, and the two controls on its rear, the
//   POWER switch and RESET, at the left of the band behind the keys, with icons.
//
// Layout (css/style.css): the display, with the recorder beside it as on the desk, and the
// keyboard under them. The recorder and the keyboard are drawers, each shown only while it is
// open, at any width, and remembered as the visitor left them (docs/ui-design.md, U10); with
// both closed, the display has the stage. On an upright phone the keypad is cropped (every
// digit is on the main keys), and the recorder, opened, stands beside the display there too,
// both smaller; on a phone on its side, the keyboard opens over the display. Each key's legend
// is sized to fit its cap. Nothing in the drawings can be
// selected or dragged.

import { t } from "../l10n/l10n.js";
import { KEYS } from "../sim/keymap.js";
import { mmss } from "../sim/system.js";
import { el, icon, setTip } from "../ui/components.js";
import { displayLayout, fitFlat, pictureMargin } from "./layout.js";
import { Painter, PICTURE_ASPECT } from "./painter.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../sim/system.js").DeckKey} DeckKey */
/** @typedef {{ node: string, name: string, legend: string, shift_legend: string, keypad: boolean, matrix_row: number, matrix_bit: number, cap: { x: number, y: number, w: number, d: number } }} KeyCap */
/** @typedef {{ x0: number, x1: number, y0: number, y1: number }} Box */

/** The keycaps' legends, where the drawing shortens them. */
const SHORT = /** @type {Record<string, string>} */ ({ UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", LSHIFT: "SHIFT", RSHIFT: "SHIFT", SPACE: "" });
/** @type {DeckKey[]} */
const DECK = ["record", "rewind", "play", "fastf", "stop", "eject"];
const DECK_LEGEND = { record: "RECORD", rewind: "REWIND", play: "PLAY", fastf: "FAST-F", stop: "STOP", eject: "EJECT" };
/** Where the keyboard drawer's state is remembered. */
const STORE = { kbd: "trs80.kbd", rec: "trs80.rec" };
/** Canvas pixels per dot: 384 x 192 dots on a 4:3 picture. */
const DOT_W = 3;

/** @param {{ v: any }} p a parameter: its value */
const v = (p) => p.v;
/** @param {number} n one decimal, for SVG */
const f = (n) => Math.round(n * 10) / 10;

/** Places an element over a drawing, a box in the drawing's units, as percentages. @param {HTMLElement} e @param {Box} box @param {Box} frame */
function placeIn(e, box, frame) {
  e.style.left = `${((box.x0 - frame.x0) / (frame.x1 - frame.x0)) * 100}%`;
  e.style.top = `${((box.y0 - frame.y0) / (frame.y1 - frame.y0)) * 100}%`;
  e.style.width = `${((box.x1 - box.x0) / (frame.x1 - frame.x0)) * 100}%`;
  e.style.height = `${((box.y1 - box.y0) / (frame.y1 - frame.y0)) * 100}%`;
}

/**
 * @typedef {object} FlatOptions
 * @property {any} machine model/params/machine.json
 * @property {{ parts: { ref: string, x: number }[] }} board model/params/board.json (S1 and S2 are used)
 * @property {{ keys: KeyCap[] }} keyboard model/params/keyboard.json
 * @property {Record<string, string>} colours the theme's tokens (js/ui/theme.js)
 * @property {URL} logos the folder of the name plates' logos
 * @property {(cell: number) => void} [pickCell] a click on the picture: the cell under it
 */

export class Flat {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {FlatOptions} o
   */
  constructor(host, system, o) {
    this.system = system;
    this.o = o;
    this.c = o.colours;
    // the two drawers, each as the visitor left it (U10). At first the recorder is closed, its keys
    // being on the helper strip, and so is the keyboard, so that the screen has the stage (the
    // machine starts switched on); but where the visitor has no keyboard of their own (a touch
    // screen held upright), the keyboard is open, as there is no other way to type.
    /** @param {"kbd" | "rec"} which @param {boolean} first */
    const drawer = (which, first) => {
      let v = null;
      try {
        v = localStorage.getItem(STORE[which]);
      } catch {
        // not remembered
      }
      return v === "open" || v === "closed" ? v : first ? "open" : "closed";
    };
    const kbd = drawer("kbd", matchMedia("(pointer: coarse) and (orientation: portrait)").matches);
    const rec = drawer("rec", false);
    this.el = el("div", { class: "flat", "data-rec": rec, "data-kbd": kbd }, [
      el("div", { class: "flat-top" }, [el("div", { class: "flat-box flat-display" }), el("div", { class: "flat-box flat-recorder" })]),
      el("div", { class: "flat-kbd" }, [el("div", { class: "flat-box flat-keyboard", role: "group", "aria-label": t("flat.keyboard") })]),
    ]);
    host.appendChild(this.el);
    for (const ev of ["selectstart", "dragstart", "contextmenu"]) this.el.addEventListener(ev, (e) => e.preventDefault());
    /** @private */
    this.q = (/** @type {string} */ s) => /** @type {HTMLElement} */ (this.el.querySelector(s));
    /** The cell the inspector has picked, outlined on the picture, or -1. */
    this.highlight = -1;
    /** @private */
    this.dirty = true;
    /** @private */
    this.reelAngle = 0;
    /** @private each key, and how wide its legend is, in characters @type {{ el: HTMLElement, row: number, bit: number, keypad: boolean, cap: KeyCap["cap"], chars: number }[]} */
    this.keyEls = [];
    /** @private @type {{ el: HTMLButtonElement, kind: "power" | "reset" }[]} */
    this.rear = [];
    /** @private */
    this.shiftLatched = false;
    this.canvas = /** @type {HTMLCanvasElement} */ (el("canvas"));
    /** @private the display's POWER button, placed by buildDisplay */
    this.dpower = el("button");
    this.painter = new Painter(this.canvas, { phosphor: this.c.phosphor, glassOff: this.c.glassOff, glassOn: this.c.glassOn });
    /** The drawings' sizes, mm, set as each is built. */
    this.displayMm = { w: 1, h: 1 };
    this.recorderMm = { w: 1, h: 1 };
    this.keyboardMm = { w: 1, h: 1 };
    this.buildDisplay();
    this.buildRecorder();
    this.buildKeyboard();
    /** @private an upright phone: the keypad cropped */
    this.compact = matchMedia("(orientation: portrait) and (max-width: 700px)");
    this.compact.addEventListener("change", () => {
      this.layoutKeyboard();
      this.fit();
    });
    /** @private a phone on its side: the keyboard, opened, rises over the display (css/style.css) */
    this.overlayKbd = matchMedia("(max-height: 520px) and (orientation: landscape)");
    this.overlayKbd.addEventListener("change", () => this.fit());
    this.layoutKeyboard();
    new ResizeObserver(() => this.fit()).observe(this.el);
  }

  /** Whether a drawer is open: the keyboard, or the recorder. @param {"rec" | "kbd"} which */
  drawerOpen(which) {
    return this.el.dataset[which] === "open";
  }

  /** Opens or closes a drawer, and remembers it. @param {"rec" | "kbd"} which @param {boolean} [open] */
  toggleDrawer(which, open) {
    const now = open ?? !this.drawerOpen(which);
    this.el.dataset[which] = now ? "open" : "closed";
    try {
      localStorage.setItem(STORE[which], now ? "open" : "closed");
    } catch {
      // not remembered
    }
    this.fit();
    return now;
  }

  /**
   * Sizes the drawings for the stage: the display, the recorder and the keyboard at one scale,
   * the display as large as that leaves room for (layout.js, fitFlat).
   */
  fit() {
    const cs = getComputedStyle(this.el);
    const width = this.el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const height = this.el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (width <= 0 || height <= 0) return; // not shown: fitted when it is
    const gap = parseFloat(cs.rowGap) || 12;
    const over = this.overlayKbd.matches;
    const out = fitFlat({
      width,
      height,
      gap,
      display: this.displayMm,
      recorder: this.drawerOpen("rec") ? this.recorderMm : null,
      keyboard: this.drawerOpen("kbd") && !over ? this.keyboardMm : null,
      fullKeyboard: this.compact.matches,
    });
    this.q(".flat-top").style.gap = `${gap}px`;
    this.q(".flat-display").style.width = `${Math.floor(out.display)}px`;
    this.q(".flat-recorder").style.width = `${Math.floor(out.recorder)}px`;
    // opened over the display, the keyboard takes the width CSS gives it
    this.q(".flat-keyboard").style.width = over ? "" : `${Math.floor(out.keyboard)}px`;
  }

  /** The picture changed. */
  invalidate() {
    this.dirty = true;
  }

  // ---- the Video Display, from the front ----------------------------------------------------

  /** @private */
  buildDisplay() {
    const d = this.o.machine.video_display;
    const c = this.c;
    // the front as the 2D view draws it: the glass larger, what is round it trimmed (layout.js)
    const L = displayLayout(d);
    this.displayMm = { w: L.W, h: L.H };
    const { W, H } = L;
    const base = L.base.h;
    // the drawing's frame: x across (mm, centre 0), y down from the top (mm); the front's
    // features are placed by their height above the body's bottom, on the base
    const fr = { x0: -W / 2, x1: W / 2, y0: 0, y1: H };
    const Y = (/** @type {number} */ z) => H - base - z;
    /** @param {{ x0: number, x1: number, z0: number, z1: number }} b @param {number} r @param {string} fill */
    const rect = (b, r, fill) => `<rect x="${f(b.x0)}" y="${f(Y(b.z1))}" width="${f(b.x1 - b.x0)}" height="${f(b.z1 - b.z0)}" rx="${f(r)}" fill="${fill}"/>`;
    let slots = "";
    for (let x = L.vents.x0; x < L.vents.x1; x += L.vents.pitch) slots += `<rect x="${f(x)}" y="${f(Y(L.vents.z1))}" width="2.6" height="${f(L.vents.z1 - L.vents.z0)}" rx="1.3" fill="#141312"/>`;
    // the name plate: brushed aluminium; a black panel with the Radio Shack logo in silver; the
    // TRS-80 logo in black; a black panel with VIDEO DISPLAY in silver, in Michroma
    const np = L.plate;
    const ps = (np.x1 - np.x0) / (v(d.nameplate.x)[1] - v(d.nameplate.x)[0]); // the plate's scale
    const hgt = np.z1 - np.z0;
    const top = [np.z1 - 2.5 * ps - hgt * 0.33, np.z1 - 2.5 * ps];
    const bot = [np.z0 + 2.5 * ps, np.z0 + 2.5 * ps + hgt * 0.4];
    const pw = np.x1 - np.x0 - 6 * ps;
    const cxn = (np.x0 + np.x1) / 2;
    // VIDEO DISPLAY in Michroma, as on the 3D plate: at its own width, made smaller (never
    // stretched) should a line not fit 72 % of the panel, which leaves the margin the 3D plate has (fitLettering)
    const lettering = (/** @type {string} */ s, /** @type {number} */ z) =>
      `<text class="flat-lettering" data-max="${f(pw * 0.72)}" x="${f(cxn)}" y="${f(Y(z) + 2.4 * ps)}" font-size="${f(6.6 * ps)}" fill="${c.inkSilver}" text-anchor="middle" font-family="Michroma, 'Roboto Flex', sans-serif">${s}</text>`;
    const label = (/** @type {string} */ s, /** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ size, /** @type {string} */ fill) =>
      `<text x="${f(x)}" y="${f(Y(z) + size * 0.37)}" font-size="${f(size)}" fill="${fill}" text-anchor="middle" font-family="var(--font)" font-weight="600">${s}</text>`;
    const { x: bx, z: bz } = L.button;
    // the silver tray, seen straight from the front: its sides end square at the top, as the 3D
    // model's do; round at the bottom
    const sr = 10;
    const shellPath = `<path d="M${f(-W / 2)} 0H${f(W / 2)}V${f(H - base - sr)}Q${f(W / 2)} ${f(H - base)} ${f(W / 2 - sr)} ${f(H - base)}H${f(-W / 2 + sr)}Q${f(-W / 2)} ${f(H - base)} ${f(-W / 2)} ${f(H - base - sr)}Z" fill="${c.caseSilver}"/>`;
    // the dark front: square at the top, where it meets the case's top edge; round at the bottom
    const br = L.brown;
    const frontPath = `<path d="M${f(br.x0)} ${f(Y(br.z1))}H${f(br.x1)}V${f(Y(br.z0) - br.r)}Q${f(br.x1)} ${f(Y(br.z0))} ${f(br.x1 - br.r)} ${f(Y(br.z0))}H${f(br.x0 + br.r)}Q${f(br.x0)} ${f(Y(br.z0))} ${f(br.x0)} ${f(Y(br.z0) - br.r)}Z" fill="${c.monitorBrown}"/>`;
    const [bushIn, bushOut] = L.bushing;
    const box = this.q(".flat-display");
    box.style.setProperty("--ar", String(W / H));
    box.innerHTML = `
      <svg viewBox="${fr.x0} 0 ${W} ${H}" aria-hidden="true">
        <defs><linearGradient id="flat-alu" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d9d9d6"/><stop offset="0.5" stop-color="#bdbdb9"/><stop offset="1" stop-color="#d0d0cc"/></linearGradient></defs>
        <rect x="${f(-W / 2 + L.base.inset)}" y="${f(H - base)}" width="${f(W - 2 * L.base.inset)}" height="${f(base)}" fill="${c.caseSilverDark}"/>
        ${shellPath}
        ${frontPath}
        ${slots}
        ${rect(L.opening, L.opening.r, c.tubeBlack)}
        ${rect(L.panel, L.panel.r, c.panelBrown)}
        ${label(L.label.text, L.label.x, L.label.z, L.label.size, c.inkSilver)}
        <circle cx="${f(bx)}" cy="${f(Y(bz))}" r="${L.ring.casing}" fill="${c.panelBrown}"/>
        <circle cx="${f(bx)}" cy="${f(Y(bz))}" r="${L.ring.silver}" fill="${c.chrome}"/>
        ${rect(np, np.r, "url(#flat-alu)")}
        ${rect({ x0: np.x0 + 3 * ps, x1: np.x1 - 3 * ps, z0: top[0], z1: top[1] }, 1.5, "#111")}
        ${rect({ x0: np.x0 + 3 * ps, x1: np.x1 - 3 * ps, z0: bot[0], z1: bot[1] }, 1.5, "#111")}
        <g class="flat-logo" data-logo="Radio_Shack_1974_logo" data-fill="${c.inkSilver}" data-x="${f(cxn - (pw - 5 * ps) / 2)}" data-y="${f(Y(top[1]) + (top[1] - top[0]) * 0.225)}" data-w="${f(pw - 5 * ps)}" data-h="${f((top[1] - top[0]) * 0.55)}"></g>
        <g class="flat-logo" data-logo="TRS-80_logo" data-fill="#111" data-x="${f(cxn - pw * 0.31)}" data-y="${f(Y(top[0]) + (top[0] - bot[1]) * 0.275)}" data-w="${f(pw * 0.62)}" data-h="${f((top[0] - bot[1]) * 0.45)}"></g>
        ${lettering("VIDEO", (bot[0] + bot[1]) / 2 + 4 * ps)}
        ${lettering("DISPLAY", (bot[0] + bot[1]) / 2 - 4 * ps)}
        ${L.knobs
          .map(([kx, kz], i) =>
            (i < 2
              ? `<circle cx="${f(kx)}" cy="${f(Y(kz))}" r="${bushOut}" fill="${c.chrome}"/><circle cx="${f(kx)}" cy="${f(Y(kz))}" r="${bushIn}" fill="#141414"/><rect class="flat-slot" data-knob="${i}" x="${f(kx - 1.6)}" y="${f(Y(kz) - 0.4)}" width="3.2" height="0.8" fill="#5a5a5a" transform="rotate(0 ${f(kx)} ${f(Y(kz))})"/>`
              : `<circle cx="${f(kx)}" cy="${f(Y(kz))}" r="${bushOut}" fill="#0a0a0a"/>`) + label(L.letters.text[i], kx, L.letters.z, L.letters.size, "#1b1b1b"),
          )
          .join("")}
      </svg>`;
    // the picture: a canvas at full resolution in the glass
    const tf = L.face;
    const faceW = tf.x1 - tf.x0;
    const faceH = tf.z1 - tf.z0;
    // the picture stays 4:3 inside the glass, and its corners inside the glass's (layout.js)
    const margin = pictureMargin(L, PICTURE_ASPECT);
    this.canvas.width = Math.round((DOT_W * 384) / (1 - 2 * margin.x));
    this.canvas.height = Math.round(this.canvas.width * (faceH / faceW));
    this.painter.margin = margin;
    this.canvas.className = "flat-screen";
    this.canvas.setAttribute("aria-label", t("flat.screen"));
    placeIn(this.canvas, { x0: tf.x0, x1: tf.x1, y0: Y(tf.z1), y1: Y(tf.z0) }, fr);
    this.canvas.style.borderRadius = `${(tf.r / faceW) * 100}% / ${(tf.r / faceH) * 100}%`;
    this.canvas.addEventListener("click", (e) => {
      const r = this.canvas.getBoundingClientRect();
      const cell = this.painter.cellAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, this.system.machine.mode32);
      if (cell >= 0) this.o.pickCell?.(cell);
    });
    box.appendChild(this.canvas);
    // the display's POWER button, and C and B: turned by a drag sideways or the wheel
    const r = L.button.r;
    const pb = el("button", { class: "flat-dpower", type: "button", "aria-pressed": "false" });
    setTip(pb, t("flat.displayPower"));
    placeIn(pb, { x0: bx - r * 1.4, x1: bx + r * 1.4, y0: Y(bz) - r * 1.4, y1: Y(bz) + r * 1.4 }, fr);
    pb.addEventListener("click", () => this.system.displayPower(!this.system.display.on));
    box.appendChild(pb);
    this.dpower = pb;
    const rb = bushOut * 1.5;
    for (const [i, which] of /** @type {const} */ (["contrast", "brightness"]).entries()) {
      const [kx, kz] = L.knobs[i];
      const k = el("button", { class: "flat-knob", type: "button" });
      setTip(k, t(`flat.${which}`));
      placeIn(k, { x0: kx - rb, x1: kx + rb, y0: Y(kz) - rb, y1: Y(kz) + rb }, fr);
      k.addEventListener("pointerdown", (e) => {
        k.setPointerCapture(e.pointerId);
        const x0 = e.clientX;
        const v0 = this.system.display[which];
        const move = (/** @type {PointerEvent} */ m) => this.system.setControl(which, v0 + (m.clientX - x0) / 150);
        const end = () => {
          k.removeEventListener("pointermove", move);
          k.removeEventListener("pointerup", end);
        };
        k.addEventListener("pointermove", move);
        k.addEventListener("pointerup", end);
      });
      k.addEventListener("wheel", (e) => {
        e.preventDefault();
        this.system.setControl(which, this.system.display[which] - Math.sign(e.deltaY) * 0.05);
      }, { passive: false });
      // a double-click, or Home, puts it back to the middle
      k.addEventListener("dblclick", () => this.system.resetControl(which));
      k.addEventListener("keydown", (e) => {
        if (e.key === "Home") {
          e.preventDefault();
          e.stopPropagation();
          return void this.system.resetControl(which);
        }
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.05 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.05 : 0;
        if (!step) return;
        e.preventDefault();
        e.stopPropagation();
        this.system.setControl(which, this.system.display[which] + step);
      });
      box.appendChild(k);
    }
    void this.loadLogos(box);
    void this.fitLettering(box);
  }

  /** @private The plate's lettering, no wider than its room, once Michroma is in. @param {HTMLElement} box */
  async fitLettering(box) {
    try {
      await document.fonts.load("10px Michroma");
    } catch {
      // the fallback font is measured instead
    }
    // measured where it is drawn; under a hidden view, once it is shown
    const fit = () => {
      for (const n of box.querySelectorAll(".flat-lettering")) {
        const te = /** @type {SVGTextElement} */ (/** @type {unknown} */ (n));
        const len = te.getComputedTextLength();
        if (!len) return false;
        const max = Number(te.dataset.max);
        if (len > max) te.setAttribute("font-size", String(f((Number(te.getAttribute("font-size")) * max) / len)));
      }
      return true;
    };
    if (!fit()) {
      const ro = new ResizeObserver(() => fit() && ro.disconnect());
      ro.observe(box);
    }
  }

  /** @private The two name-plate logos, as the 3D plate has them. @param {HTMLElement} box */
  async loadLogos(box) {
    for (const g of box.querySelectorAll(".flat-logo")) {
      const ge = /** @type {SVGGElement} */ (/** @type {unknown} */ (g));
      try {
        const url = new URL(`${ge.dataset.logo}.svg`, this.o.logos);
        const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), "image/svg+xml");
        const src = doc.documentElement;
        for (const x of src.querySelectorAll("style, title, metadata, script")) x.remove();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        for (const k of ["x", "y"]) svg.setAttribute(k, ge.dataset[k] ?? "0");
        svg.setAttribute("width", ge.dataset.w ?? "0");
        svg.setAttribute("height", ge.dataset.h ?? "0");
        svg.setAttribute("viewBox", src.getAttribute("viewBox") ?? "");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("fill", ge.dataset.fill ?? "#111");
        svg.style.setProperty("--logo", ge.dataset.fill ?? "#111");
        svg.innerHTML = src.innerHTML;
        ge.appendChild(svg);
      } catch {
        // no logo: the plate stays plain
      }
    }
  }

  // ---- the recorder, from above ----------------------------------------------------------------

  /** @private */
  buildRecorder() {
    const r = this.o.machine.recorder;
    const [W, D] = v(r.size);
    this.recorderMm = { w: W, h: D };
    const b = r.bands;
    // from above, the front at the bottom: drawing y = -Y (machine +Y is the back)
    const fr = { x0: -W / 2, x1: W / 2, y0: -D / 2, y1: D / 2 };
    const band = (/** @type {number[]} */ ys) => ({ y: -ys[1], h: ys[1] - ys[0] });
    const door = band(v(b.door));
    const lp = band(v(b.label_panel));
    const gr = band(v(b.grille));
    const [cx0, cx1] = v(r.counter.x);
    const [cy0, cy1] = v(r.counter.y);
    const [lx, ly] = v(r.led);
    const [mx0, mx1] = v(r.mic_grille.x);
    const [my0, my1] = v(r.mic_grille.y);
    const dy0 = v(b.door)[0];
    const dy1 = v(b.door)[1];
    const wy0 = dy0 + 7;
    const wy1 = dy1 - 4;
    const hy = (wy0 + wy1) / 2 + 3;
    let holes = "";
    const p = v(r.grille_holes.pitch);
    for (let x = -W / 2 + 8; x < W / 2 - 6; x += p) {
      for (let y = gr.y + 5; y < gr.y + gr.h - 4; y += p) {
        if (x > cx0 - 3 && x < cx1 + 7 && -y > cy0 - 3 && -y < cy1 + 3) continue;
        holes += `<rect x="${f(x)}" y="${f(y)}" width="1.8" height="1.8" fill="#0b0b0b"/>`;
      }
    }
    const reel = (/** @type {string} */ id, /** @type {number} */ x) =>
      `<g class="flat-reel" data-reel="${id}" data-x="${x}" data-y="${f(-hy)}" transform="translate(${x} ${f(-hy)})"><circle r="4.2" fill="#e6e6e0"/><circle r="2.4" fill="#111"/>${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="1.4" y="-0.45" width="1.4" height="0.9" fill="#e6e6e0" transform="rotate(${a})"/>`).join("")}</g>`;
    const box = this.q(".flat-recorder");
    box.style.setProperty("--ar", String(W / D));
    box.innerHTML = `
      <svg viewBox="${-W / 2} ${-D / 2} ${W} ${D}" aria-hidden="true">
        <rect x="${-W / 2}" y="${-D / 2}" width="${W}" height="${D}" rx="4" fill="${this.c.recorderBlack}"/>
        <rect x="${-W / 2 + 5}" y="${f(gr.y)}" width="${W - 10}" height="${f(gr.h)}" rx="2" fill="#262626"/>
        ${holes}
        <rect x="${cx0}" y="${-cy1}" width="${cx1 - cx0}" height="${cy1 - cy0}" rx="1" fill="#0e0e0e" stroke="#555" stroke-width="0.5"/>
        <text class="flat-counter" x="${f((cx0 + cx1) / 2)}" y="${f(-(cy0 + cy1) / 2 + 2.6)}" font-size="7" fill="#e8e8e2" text-anchor="middle" font-family="var(--mono)">000</text>
        <rect x="${-W / 2 + 5}" y="${f(-dy1 - 3.5)}" width="${W - 10}" height="3" fill="#a7a7a2"/>
        <rect x="${-W / 2 + 5}" y="${f(-dy0)}" width="${W - 10}" height="3" fill="#a7a7a2"/>
        <rect x="${-W / 2 + 6}" y="${f(door.y)}" width="${W - 12}" height="${f(door.h)}" rx="1.5" fill="#101010"/>
        <rect x="${-W / 2 + 12}" y="${f(-wy1)}" width="${W - 24}" height="${f(wy1 - wy0)}" rx="1.5" fill="#1d2222"/>
        <g class="flat-cassette">
          <rect x="-50.2" y="${f(-(wy0 + wy1) / 2 - 31.9)}" width="100.4" height="63.8" rx="2" fill="#0c0c0d"/>
          <rect x="-45" y="${f(-(wy0 + wy1) / 2 - 27.9)}" width="90" height="46" fill="#cfc7ae"/>
          <rect x="-30" y="${f(-hy - 6.5)}" width="60" height="13" fill="#2a160b"/>
          ${reel("l", -21.25)}${reel("r", 21.25)}
        </g>
        <text x="0" y="${f(-dy0 - 3.4)}" font-size="2.6" fill="#bdbdb8" text-anchor="middle" font-family="var(--font)">AUTOMATIC STOP</text>
        <rect x="${mx0}" y="${-my1}" width="${mx1 - mx0}" height="${my1 - my0}" rx="1" fill="#a7a7a2"/>
        <text x="-6" y="${f(lp.y + 9)}" font-size="4.2" fill="#c9c9c4" font-style="italic" font-weight="700" font-family="var(--font)">REALISTIC</text>
        <text x="22" y="${f(lp.y + 9)}" font-size="2.8" fill="#c9c9c4" font-family="var(--font)">CTR-80</text>
        <circle class="flat-recled" cx="${lx}" cy="${-ly}" r="1.4" fill="${this.c.ledOff}"/>
      </svg>`;
    // the six keys, larger than the deck's own (D10: clearest first): the whole width, and
    // deeper, over the strip that carries their names on the machine
    const [ky0] = v(b.keys);
    const KY1 = v(b.label_panel)[0] - 1;
    const pitch = (W - 6) / 6;
    for (const [i, id] of DECK.entries()) {
      const btn = el("button", { class: `flat-deckkey${id === "record" ? " rec" : ""}`, type: "button", "data-deck": id, text: DECK_LEGEND[id] });
      setTip(btn, t(`deck.key.${id}`));
      btn.setAttribute("data-tip-describes", "");
      const x = -W / 2 + 3 + i * pitch;
      placeIn(btn, { x0: x + 0.5, x1: x + pitch - 0.5, y0: -KY1, y1: -ky0 + 1 }, fr);
      btn.addEventListener("click", () => this.system.deckKey(id));
      box.appendChild(btn);
    }
  }

  // ---- the keyboard unit, from above ---------------------------------------------------------

  /** @private */
  buildKeyboard() {
    const box = this.q(".flat-keyboard");
    box.innerHTML = `<svg aria-hidden="true"></svg>`;
    // POWER and RESET are on the unit's rear (D10): the top view puts them together at the
    // left of the band behind the keys, POWER then RESET, each with an icon
    for (const kind of /** @type {const} */ (["power", "reset"])) {
      const b = el("button", { class: "flat-rear", type: "button" }, [icon(kind === "power" ? "power_settings_new" : "restart_alt"), el("span", { text: kind === "power" ? "POWER" : "RESET" })]);
      setTip(b, t(kind === "power" ? "flat.power" : "flat.reset"));
      b.setAttribute("data-tip-describes", "");
      b.addEventListener("click", () => (kind === "power" ? this.system.power(!this.system.machine.powered) : this.system.reset()));
      box.appendChild(b);
      this.rear.push({ el: b, kind });
    }
    const s = this.system;
    for (const k of this.o.keyboard.keys) {
      const isShift = k.matrix_row === 7;
      const legend = SHORT[k.name] ?? k.legend;
      const b = el("button", { class: `flat-key${k.keypad ? " pad" : ""}${k.name === "ENTER" ? " enter" : ""}${["CLEAR", "BREAK"].includes(k.name) ? " func" : ""}`, type: "button", tabindex: "-1" }, [
        k.shift_legend ? el("small", { text: k.shift_legend }) : null,
        el("span", { text: legend }),
      ]);
      const name = KEYS.find((m) => m.row === k.matrix_row && m.bit === k.matrix_bit)?.name ?? k.name;
      b.setAttribute("aria-label", t(k.keypad ? "flat.keyPad" : "flat.key", { name: name === "SPACE" ? t("flat.space") : name }));
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          // a pointer the browser no longer tracks: the key still goes down
        }
        if (isShift) {
          this.shiftLatched = !this.shiftLatched;
          if (this.shiftLatched) s.typist.hold(7, 0);
          else s.typist.release(7, 0);
          return;
        }
        s.typist.hold(k.matrix_row, k.matrix_bit);
      });
      const up = () => {
        if (isShift) return;
        s.typist.release(k.matrix_row, k.matrix_bit);
        if (this.shiftLatched) {
          this.shiftLatched = false;
          s.typist.release(7, 0);
        }
      };
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      box.appendChild(b);
      // the shifted legend is drawn at 0.72 of the size (css/style.css)
      const chars = Math.max([...legend].length, [...(k.shift_legend ?? "")].length * 0.72);
      this.keyEls.push({ el: b, row: k.matrix_row, bit: k.matrix_bit, keypad: k.keypad, cap: k.cap, chars });
    }
  }

  /**
   * @private The keyboard drawn tight: the keys, a slim black bezel, a silver rim, and the band
   * behind them for POWER and RESET. On an upright phone, cropped at the keypad.
   */
  layoutKeyboard() {
    const compact = this.compact.matches;
    const caps = this.keyEls.filter((k) => !(compact && k.keypad)).map((k) => k.cap);
    const kx0 = Math.min(...caps.map((c) => c.x - c.w / 2));
    const kx1 = Math.max(...caps.map((c) => c.x + c.w / 2));
    const ky0 = Math.min(...caps.map((c) => c.y - c.d / 2));
    const ky1 = Math.max(...caps.map((c) => c.y + c.d / 2));
    const BEZEL = 4;
    const RIM = 5;
    const BAND = 15;
    // machine Y (back +) to drawing y (down +)
    const bz = { x0: kx0 - BEZEL, x1: kx1 + BEZEL, y0: -(ky1 + BEZEL), y1: -(ky0 - BEZEL) };
    const fr = { x0: bz.x0 - RIM, x1: bz.x1 + RIM, y0: bz.y0 - BAND, y1: bz.y1 + RIM };
    const [ledx, ledy] = v(this.o.machine.power_led.position);
    const box = this.q(".flat-keyboard");
    box.style.setProperty("--ar", String((fr.x1 - fr.x0) / (fr.y1 - fr.y0)));
    this.keyboardMm = { w: fr.x1 - fr.x0, h: fr.y1 - fr.y0 };
    const svg = /** @type {SVGSVGElement} */ (box.querySelector("svg"));
    svg.setAttribute("viewBox", `${f(fr.x0)} ${f(fr.y0)} ${f(fr.x1 - fr.x0)} ${f(fr.y1 - fr.y0)}`);
    const led = ledx < kx1 ? `<circle class="flat-led" cx="${ledx}" cy="${-ledy}" r="2.4" fill="${this.c.ledOff}"/>` : "";
    svg.innerHTML = `
      <rect x="${f(fr.x0)}" y="${f(fr.y0)}" width="${f(fr.x1 - fr.x0)}" height="${f(fr.y1 - fr.y0)}" rx="6" fill="${this.c.caseSilver}"/>
      <rect x="${f(bz.x0)}" y="${f(bz.y0)}" width="${f(bz.x1 - bz.x0)}" height="${f(bz.y1 - bz.y0)}" rx="2" fill="${this.c.bezelBlack}"/>
      ${led}`;
    for (const k of this.keyEls) {
      const c = k.cap;
      k.el.hidden = compact && k.keypad;
      placeIn(k.el, { x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: -(c.y + c.d / 2), y1: -(c.y - c.d / 2) }, fr);
      // the largest type its legend fits its cap at, in the drawing's own units (cqw): a bold
      // capital is about 0.68 em wide, and the legend keeps a tenth of the cap clear each side
      const capCqw = (c.w / (fr.x1 - fr.x0)) * 100;
      if (k.chars) k.el.style.setProperty("--fit", `${((capCqw * 0.8) / (k.chars * 0.68)).toFixed(3)}cqw`);
    }
    for (const [i, r] of this.rear.entries()) {
      const x0 = bz.x0 + i * 40;
      placeIn(r.el, { x0, x1: x0 + 37, y0: fr.y0 + 2, y1: bz.y0 - 2 }, fr);
    }
  }

  /** Called each frame while 2D shows: keys, lamps, the deck, the reels, and the picture. @param {number} dt */
  tick(dt) {
    const s = this.system;
    const m = s.machine;
    const d = s.deck;
    for (const k of this.keyEls) k.el.classList.toggle("down", (m.rows[k.row] & (1 << k.bit)) !== 0);
    this.q(".flat-counter").textContent = String(d.counterAt(m.t)).padStart(3, "0");
    this.q(".flat-cassette").style.display = d.tape ? "" : "none";
    this.q(".flat-recled").setAttribute("fill", d.mode === "record" && d.running ? this.c.ledOn : this.c.ledOff);
    this.el.querySelector(".flat-led")?.setAttribute("fill", m.powered ? this.c.ledOn : this.c.ledOff);
    for (const r of this.rear) if (r.kind === "power") r.el.classList.toggle("on", m.powered);
    for (const b of this.el.querySelectorAll(".flat-deckkey")) {
      const id = /** @type {HTMLElement} */ (b).dataset.deck;
      // RECORD, PLAY, REWIND and FAST-F latch down; STOP and EJECT spring back
      b.classList.toggle("latched", (id !== "stop" && id !== "eject" && (id === "fastf" ? "fast" : id) === d.mode) || (id === "play" && d.mode === "record"));
    }
    const speed = d.running ? 1.5 : d.mode === "rewind" ? -9 : d.mode === "fast" ? 9 : 0;
    if (speed && d.tape) {
      this.reelAngle = (this.reelAngle - speed * 360 * dt) % 360;
      for (const g of this.el.querySelectorAll(".flat-reel")) {
        const ge = /** @type {SVGGElement} */ (/** @type {unknown} */ (g));
        ge.setAttribute("transform", `translate(${ge.dataset.x} ${ge.dataset.y}) rotate(${f(this.reelAngle)})`);
      }
    }
    this.dpower.setAttribute("aria-pressed", String(s.display.on));
    for (const sl of this.el.querySelectorAll(".flat-slot")) {
      const knob = Number(/** @type {SVGElement} */ (/** @type {unknown} */ (sl)).dataset.knob);
      const val = knob === 0 ? s.display.contrast : s.display.brightness;
      const tr = sl.getAttribute("transform")?.replace(/rotate\([^ ]+/, `rotate(${f((val - 0.5) * 270)}`) ?? "";
      sl.setAttribute("transform", tr);
    }
    if (this.dirty) {
      this.dirty = false;
      this.painter.paint({ read: (a) => m.peek(a), computer: m.powered, display: s.display.on, mode32: m.mode32, contrast: s.display.contrast, brightness: s.display.brightness }, this.highlight);
    }
  }

  /** What the drawing says about the tape, for the band. */
  tapeLine() {
    const d = this.system.deck;
    return d.tape ? `${d.tape.name} · ${mmss(d.at(this.system.machine.t))} / ${mmss(d.length)}` : "";
  }
}
