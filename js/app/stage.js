// SPDX-License-Identifier: Apache-2.0
//
// The stage (docs/ui-design.md, U1-U4): the machine in 3D or in 2D, and its band.
//
// - `[2D | 3D]` at the band's right. Going to 2D, the camera flies to the screen and the flat
//   views cross-fade in; going back, they fade out and the camera flies back to where it was.
//   The 3D scene stops rendering under 2D. Going to 2D puts the machine back together (U3).
// - In 3D the band also holds ⌂, zoom, the Views and Show menus; Put it all back stands on the
//   stage while anything is out. The helpers for the controls that are hard to reach are in
//   their own strip at the stage's foot, in both views (js/app/strip.js, U4).
// - A part's label shows after the pointer rests on it, beside the pointer.

import { t } from "../l10n/l10n.js";
import { corners, frame } from "../scene/framing.js";
import { FOV } from "../scene/viewer.js";
import { el, icon, setTip, showMenu } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../scene/viewer.js").Viewer} Viewer */
/** @typedef {import("../scene/desk3d.js").Desk3D} Desk3D */
/** @typedef {import("../flat/flat.js").Flat} Flat */
/** @typedef {"desk" | "angle" | "keyboard" | "screen" | "recorder" | "rear" | "inside"} ViewName */
/** @typedef {"everything" | "inside"} ShowName */

/**
 * The camera's views, in metres: each looks from pos towards target. Once the model is in, a
 * view keeps only its direction, and frames its parts (SUBJECTS) on the stage as it is now
 * (js/scene/framing.js); the poses themselves are for before then.
 */
export const VIEWS = /** @type {Record<ViewName, import("../scene/viewer.js").Pose>} */ ({
  // the way in: from the front, a little above the desk, the screen face on enough to read and
  // the keyboard under it to type at, the recorder beside them
  desk: { pos: [0.08, 0.5, 1.05], target: [0.08, 0.12, -0.05] },
  // the whole system three-quarter on, from the left
  angle: { pos: [-0.55, 0.62, 0.95], target: [0.05, 0.1, -0.12] },
  keyboard: { pos: [-0.05, 0.42, 0.4], target: [0.0, 0.04, -0.01] },
  screen: { pos: [-0.04, 0.22, 0.32], target: [-0.04, 0.17, -0.21] },
  recorder: { pos: [0.62, 0.38, 0.3], target: [0.36, 0.02, -0.1] },
  rear: { pos: [0.62, 0.2, -0.32], target: [0.05, 0.03, -0.09] },
  inside: { pos: [0.2, -0.42, 0.3], target: [0.05, 0.015, -0.015] },
});
const VIEW_ORDER = /** @type {ViewName[]} */ (["desk", "angle", "keyboard", "screen", "recorder", "rear", "inside"]);
/** What each view frames: the model's nodes (model/README.md), and the share of the stage they fill. */
const SUBJECTS = /** @type {Record<ViewName, { nodes: string[], fill: number }>} */ ({
  desk: { nodes: ["unit.keyboard", "unit.display", "unit.recorder"], fill: 0.94 },
  angle: { nodes: ["unit.keyboard", "unit.display", "unit.recorder", "unit.psu"], fill: 0.92 },
  keyboard: { nodes: ["unit.keyboard"], fill: 0.9 },
  screen: { nodes: ["display.screen"], fill: 0.96 },
  recorder: { nodes: ["unit.recorder"], fill: 0.85 },
  rear: { nodes: ["unit.keyboard"], fill: 0.9 },
  inside: { nodes: ["board.main"], fill: 0.92 },
});
/** What a framed view keeps clear of the stage's edges, px. */
const GAP = 8;
/** How long a label waits under a resting pointer, ms. */
const LABEL_MS = 400;

export class Stage {
  /**
   * @param {System} system
   * @param {{ viewer: Viewer | null, desk: Desk3D | null, flat: Flat, onModeChange: (mode: "2d" | "3d") => void }} parts
   */
  constructor(system, parts) {
    this.system = system;
    this.viewer = parts.viewer;
    this.desk = parts.desk;
    this.flat = parts.flat;
    this.onModeChange = parts.onModeChange;
    /** @type {"2d" | "3d"} */
    this.mode = "3d";
    /** @type {ViewName} */
    this.view = "desk";
    /** @type {ShowName} */
    this.show = "everything";
    /** @private the camera before a flight to 2D, to come back to */
    this.before = /** @type {import("../scene/viewer.js").Pose | null} */ (null);
    /** @private a move between 2D and 3D under way */
    this.moving = false;
    this.el = /** @type {HTMLElement} */ (document.getElementById("stage"));
    /** The stage under its band: the views, and what stands over them. */
    this.area = /** @type {HTMLElement} */ (document.getElementById("stage-view"));
    /** The view the camera was put on and has kept since, refitted as the stage changes size; null once the visitor moves it. @type {ViewName | null} */
    this.fitted = "desk";
    /** @private what was fitted when the camera flew to 2D, to come back to */
    this.fittedBefore = /** @type {ViewName | null} */ (null);
    this.view3d = /** @type {HTMLElement} */ (document.getElementById("view3d"));
    this.view2d = /** @type {HTMLElement} */ (document.getElementById("view2d"));
    const band = /** @type {HTMLElement} */ (document.getElementById("band"));
    // the 3D tools
    const home = el("button", { class: "btn icon-only home-btn", type: "button" }, [icon("home")]);
    setTip(home, t("stage.home"));
    home.addEventListener("click", () => this.home());
    const zoomOut = el("button", { class: "btn icon-only", type: "button" }, [icon("zoom_out")]);
    setTip(zoomOut, t("stage.zoomOut"));
    zoomOut.addEventListener("click", () => {
      this.fitted = null; // the camera is the visitor's now
      this.viewer?.zoom(1 / 0.8);
    });
    const zoomIn = el("button", { class: "btn icon-only", type: "button" }, [icon("zoom_in")]);
    setTip(zoomIn, t("stage.zoomIn"));
    zoomIn.addEventListener("click", () => {
      this.fitted = null;
      this.viewer?.zoom(0.8);
    });
    this.viewsBtn = el("button", { class: "btn small menu-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" });
    setTip(this.viewsBtn, t("stage.views.tip"));
    this.viewsBtn.setAttribute("data-tip-describes", "");
    this.viewsBtn.addEventListener("click", () =>
      showMenu(
        this.viewsBtn,
        VIEW_ORDER.map((v) => ({ label: t(`view.${v}`), checked: this.view === v, run: () => this.goTo(v) })),
      ),
    );
    this.showBtn = el("button", { class: "btn small menu-btn show-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false" });
    setTip(this.showBtn, t("stage.show.tip"));
    this.showBtn.setAttribute("data-tip-describes", "");
    this.showBtn.addEventListener("click", () =>
      showMenu(this.showBtn, [
        { label: t("show.everything"), checked: this.show === "everything", run: () => this.setShow("everything") },
        { label: t("show.inside"), checked: this.show === "inside", run: () => this.setShow("inside") },
      ]),
    );
    this.tools3d = el("div", { class: "band-group tools3d" }, [home, el("span", { class: "joined" }, [zoomOut, zoomIn]), this.viewsBtn, this.showBtn]);
    // the toggle (U1)
    this.toggle = el("div", { class: "segmented mode", role: "radiogroup", "aria-label": t("stage.mode") });
    for (const m of /** @type {const} */ (["2d", "3d"])) {
      const b = el("button", { type: "button", role: "radio", "data-mode": m }, [icon(m === "2d" ? "web_asset" : "view_in_ar"), el("span", { text: m.toUpperCase() })]);
      setTip(b, t(`stage.${m}.tip`));
      b.setAttribute("data-tip-describes", "");
      b.addEventListener("click", () => this.setMode(m));
      this.toggle.append(b);
    }
    // the 2D view's own: its two drawers, the recorder and the keyboard, each a toggle that is
    // filled while its drawer is open
    this.drawers = el("div", { class: "band-group drawers" });
    for (const which of /** @type {const} */ (["rec", "kbd"])) {
      const b = el("button", { class: `btn small tonal has-icon drawer-${which}`, type: "button", "aria-pressed": String(this.flat.drawerOpen(which)) }, [icon(which === "rec" ? "voicemail" : "keyboard"), el("span", { text: t(which === "rec" ? "stage.drawer.recorder" : "stage.drawer.keyboard") })]);
      setTip(b, t(which === "rec" ? "stage.drawer.recorder.tip" : "stage.drawer.keyboard.tip"));
      b.setAttribute("data-tip-describes", "");
      b.dataset.drawer = which;
      b.addEventListener("click", () => {
        this.flat.toggleDrawer(which);
        this.refresh();
      });
      this.drawers.append(b);
    }
    band.append(el("span", { class: "spacer" }), this.drawers, this.tools3d, this.toggle);
    // Put it all back (U3)
    this.putBack = el("button", { class: "btn filled has-icon put-back", type: "button", hidden: true }, [icon("construction"), el("span", { text: t("stage.putBack") })]);
    this.putBack.addEventListener("click", () => this.system.putAllBack());
    this.area.append(this.putBack);
    this.loading = el("div", { class: "loading", hidden: true }, [el("div", { class: "loading-bar" }, [el("span")]), el("p", { text: t("stage.loading") })]);
    this.area.append(this.loading);
    this.label = el("div", { class: "part-label", role: "tooltip", hidden: true });
    this.area.append(this.label);
    if (this.viewer) {
      const v = this.viewer;
      v.onUserMove.push(() => (this.fitted = null));
      v.onResize.push(() => {
        if (this.fitted && this.mode === "3d" && !this.moving && !v.isFlying()) v.jumpTo(this.framed(this.fitted));
      });
    }
    /** @private whether See inside came with the Inside view, not by the visitor's choice */
    this.insideChosenByView = false;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this.labelTimer = undefined;
    /** @private what the band showed last */
    this.shownKey = "";
    if (this.desk) this.bindDesk(this.desk);
    system.onChange.push(() => this.refresh());
    this.refresh();
  }

  /** The 3D desk, once it has loaded. @param {Desk3D} d */
  bindDesk(d) {
    this.desk = d;
    d.on.hover = (h, x, y) => this.hover(h, x, y);
    d.on.info = (node) => this.system.say({ key: "part.said", params: { name: `${partName(node, "")}${partRole(node) ? `: ${partRole(node)}` : ""}` } });
    d.on.screenDoubleClick = () => this.setMode("2d");
    if (this.show === "inside") d.setSeeInside(true);
    if (this.fitted && this.mode === "3d" && this.viewer) this.viewer.jumpTo(this.framed(this.fitted));
  }

  /**
   * Where the camera goes for a view: its parts framed on the stage as it is now, seen from
   * the view's direction; before the model is in, the view's own pose.
   * @param {ViewName} v
   * @returns {import("../scene/viewer.js").Pose}
   */
  framed(v) {
    const viewer = /** @type {Viewer} */ (this.viewer);
    const pose = VIEWS[v];
    if (!this.desk) return viewer.fit(pose);
    const { width, height } = viewer.size();
    const dir = /** @type {[number, number, number]} */ (pose.pos.map((p, i) => p - pose.target[i]));
    const boxes = SUBJECTS[v].nodes.map((n) => /** @type {Desk3D} */ (this.desk).box(n));
    return frame(corners(boxes), dir, FOV, width, height, { top: GAP, right: GAP, bottom: GAP, left: GAP }, SUBJECTS[v].fill);
  }

  /** The state shown on the band's buttons: called each frame, and does the work only on a change. */
  refresh() {
    const s = this.system;
    const rec = this.flat.drawerOpen("rec");
    const kbd = this.flat.drawerOpen("kbd");
    const key = `${s.whole}${this.mode}${this.view}${this.show}${rec}${kbd}`;
    if (key === this.shownKey) return;
    // the drawers' toggles say what the drawing shows, however a drawer was opened
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (this.drawers.querySelectorAll("[data-drawer]"))) b.setAttribute("aria-pressed", String(b.dataset.drawer === "rec" ? rec : kbd));
    this.shownKey = key;
    this.putBack.hidden = this.mode !== "3d" || s.whole;
    this.viewsBtn.replaceChildren(el("span", { text: t(`view.${this.view}`) }), icon("keyboard_arrow_down"));
    this.showBtn.replaceChildren(icon("visibility"), el("span", { text: t(`show.${this.show}`) }), icon("keyboard_arrow_down"));
    this.showBtn.classList.toggle("active", this.show !== "everything");
    for (const b of this.toggle.children) b.setAttribute("aria-checked", String(/** @type {HTMLElement} */ (b).dataset.mode === this.mode));
    this.el.dataset.mode = this.mode;
  }

  /** Shows the load's progress, 0..1, or hides it (null). @param {number | null} f */
  progress(f) {
    this.loading.hidden = f === null;
    if (f !== null) /** @type {HTMLElement} */ (this.loading.querySelector("span")).style.width = `${Math.round(f * 100)}%`;
  }

  /** ⌂: the desk, everything shown, every part back. */
  home() {
    this.setShow("everything");
    if (!this.system.whole) this.system.putAllBack();
    this.goTo("desk");
  }

  /** A view: the camera flies there. @param {ViewName} v */
  goTo(v) {
    if (!this.viewer) return;
    if (this.mode === "2d") this.setMode("3d");
    this.view = v;
    if (v === "inside" && this.show === "everything") this.setShow("inside", true);
    else if (v !== "inside" && this.insideChosenByView) this.setShow("everything");
    this.fitted = v;
    this.viewer.flyTo(this.framed(v));
    this.refresh();
  }

  /**
   * A Show. Choosing the Inside view brings See inside with it, and leaving it takes it away
   * again unless the visitor chose it (as the 8800 simulator's Inside does).
   * @param {ShowName} s
   * @param {boolean} [byView]
   */
  setShow(s, byView = false) {
    this.show = s;
    this.insideChosenByView = byView && s === "inside";
    this.desk?.setSeeInside(s === "inside");
    if (s === "inside") this.system.say({ key: this.system.machine.powered ? "show.inside.on" : "show.inside.off" });
    this.refresh();
  }

  /**
   * 2D or 3D (U1).
   * @param {"2d" | "3d"} mode
   * @param {{ instant?: boolean }} [o]
   */
  setMode(mode, o = {}) {
    if (mode === this.mode || this.moving) return;
    const viewer = this.viewer;
    if (mode === "2d") {
      if (this.system.putBackNow()) this.system.say({ key: "apart.putBackFor2d" });
      this.mode = "2d";
      this.refresh();
      this.onModeChange("2d");
      const show = () => {
        this.view2d.hidden = false;
        this.flat.invalidate();
        requestAnimationFrame(() => this.view2d.classList.add("shown"));
        if (viewer) viewer.active = false;
        this.moving = false;
      };
      if (viewer && !o.instant) {
        this.moving = true;
        this.before = viewer.pose();
        this.fittedBefore = this.fitted;
        viewer.flyTo(this.framed("screen"), show);
      } else show();
      return;
    }
    if (!viewer) {
      this.system.say({ key: "stage.no3d" });
      return;
    }
    this.mode = "3d";
    viewer.active = true;
    this.view2d.classList.remove("shown");
    this.moving = true;
    setTimeout(() => {
      this.view2d.hidden = true;
      // a view the page chose is framed again, as the stage may have changed size meanwhile
      this.fitted = this.fittedBefore ?? (this.before ? null : this.view);
      viewer.flyTo(this.fitted ? this.framed(this.fitted) : /** @type {import("../scene/viewer.js").Pose} */ (this.before), () => (this.moving = false));
    }, o.instant ? 0 : 220);
    this.refresh();
    this.onModeChange("3d");
  }

  /** The label of a part under the resting pointer. @param {import("../scene/desk3d.js").Hover | null} h @param {number} x @param {number} y */
  hover(h, x, y) {
    clearTimeout(this.labelTimer);
    if (!h) {
      this.label.hidden = true;
      return;
    }
    this.labelTimer = setTimeout(() => {
      const r = this.area.getBoundingClientRect();
      const s = this.system;
      const why = h.action === "takeOut" ? t("label.takeOut") : h.action === "putBack" ? t("label.putBack") : h.action === "none" && isUnitPart(h.node) && s.machine.powered ? t("label.offFirst") : "";
      this.label.replaceChildren(el("strong", { text: partName(h.node, h.label) }), el("span", { text: partRole(h.node) }), ...(why ? [el("em", { text: why })] : []));
      this.label.hidden = false;
      const lx = Math.min(r.width - this.label.offsetWidth - 8, x - r.left + 14);
      const ly = y - r.top + 18 + this.label.offsetHeight > r.height ? y - r.top - this.label.offsetHeight - 10 : y - r.top + 18;
      this.label.style.left = `${Math.max(8, lx)}px`;
      this.label.style.top = `${Math.max(8, ly)}px`;
    }, LABEL_MS);
  }
}

/** Parts that come out when taken apart. @param {string} node */
const isUnitPart = (node) => /^(case\.|keyboard$|board\.main|cable\.(video|tape|power)|part\.)/.test(node);

/** A part's name for the visitor: a message where the page has one, else the model's own. @param {string} node @param {string} fallback */
export function partName(node, fallback) {
  const key = partKey(node);
  const n = t(`${key}.name`, keyParams(node));
  return n === `${key}.name` ? fallback.split(":")[0] : n;
}

/** What a part does, in a line. @param {string} node */
export function partRole(node) {
  const key = partKey(node);
  const r = t(`${key}.role`, keyParams(node));
  return r === `${key}.role` ? "" : r;
}

/** The message key for a part: keys share one, as do the RAM chips. @param {string} node */
function partKey(node) {
  if (/^key\.pad\./.test(node)) return "part.keypad";
  if (/^key\./.test(node)) return "part.key";
  if (/^recorder\.key\./.test(node)) return "part.recorderKey";
  if (/^part\.z(1[3-9]|20)$/.test(node)) return "part.ram";
  if (/^part\.z(4[5-8]|6[1-3])$/.test(node)) return "part.vram";
  return `part.${node.replace(/^part\./, "")}`;
}

/** @param {string} node */
function keyParams(node) {
  const m = /^(?:key\.(?:pad\.)?|recorder\.key\.|part\.)(.+)$/.exec(node);
  return { name: (m ? m[1] : node).toUpperCase() };
}
