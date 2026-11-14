// SPDX-License-Identifier: Apache-2.0
//
// The dock under the stage (docs/ui-design.md, P3, U6): the lessons and four tools, one at a
// time. It is resized by its top edge (drag, or the arrow keys on the handle), folds to its
// tab bar, and remembers its tab and height. What the machine does never switches its tab.
// After the AGT-30 simulator's dock (https://github.com/wixette/agt30-simulator, Apache-2.0).

import { t } from "../l10n/l10n.js";
import { icon, setTip, tabs } from "../ui/components.js";

/** @typedef {"lessons" | "vram" | "keyboard" | "cassette" | "cpu"} ToolId */
export const TOOLS = /** @type {ToolId[]} */ (["lessons", "vram", "keyboard", "cassette", "cpu"]);

/** The dock's least open height, and its height at the start, px. */
const DOCK_MIN = 140;
const DOCK_START = 280;
/** One arrow key's step on the handle, px. */
const KEY_STEP = 24;
const STORE = "trs80.dock";

/** @returns {{ tab?: ToolId, height?: number, folded?: boolean }} */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}

export class Dock {
  /** @param {() => number} stageMin the least height the stage keeps, px, now */
  constructor(stageMin) {
    this.el = /** @type {HTMLElement} */ (document.getElementById("dock"));
    this.handle = /** @type {HTMLElement} */ (document.getElementById("dock-handle"));
    this.fold = /** @type {HTMLButtonElement} */ (document.getElementById("dock-fold"));
    this.stageMin = stageMin;
    const saved = load();
    this.height = saved.height ?? DOCK_START;
    this.folded = saved.folded ?? false;
    /** @type {ToolId} */
    this.current = saved.tab && TOOLS.includes(saved.tab) ? saved.tab : "lessons";
    /** Called when a tab is shown. @type {(id: ToolId) => void} */
    this.onShow = () => {};
    this.select = tabs(/** @type {HTMLElement} */ (document.getElementById("dock-tabs")), (tabId) => {
      this.current = /** @type {ToolId} */ (tabId.replace(/^tab-/, ""));
      document.getElementById(tabId)?.querySelector(".dot")?.setAttribute("hidden", "");
      if (this.folded) {
        this.folded = false;
        this.apply();
      }
      this.save();
      this.onShow(this.current);
    });
    this.fold.addEventListener("click", () => {
      this.folded = !this.folded;
      this.apply();
    });
    this.handle.addEventListener("pointerdown", (e) => {
      this.handle.setPointerCapture(e.pointerId);
      const y0 = e.clientY;
      const h0 = this.folded ? DOCK_MIN : this.el.getBoundingClientRect().height;
      this.folded = false;
      /** @param {PointerEvent} m */
      const move = (m) => {
        this.height = h0 + (y0 - m.clientY);
        this.apply();
      };
      const up = () => {
        this.handle.removeEventListener("pointermove", move);
        this.handle.removeEventListener("pointerup", up);
      };
      this.handle.addEventListener("pointermove", move);
      this.handle.addEventListener("pointerup", up);
    });
    this.handle.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
      if (!d) return;
      e.preventDefault();
      this.folded = false;
      this.height += d;
      this.apply();
    });
    window.addEventListener("resize", () => this.apply());
  }

  /** Shows the remembered tab; call once the tools are built. */
  start() {
    this.select(`tab-${this.current}`);
    this.apply();
  }

  /** @private */
  apply() {
    const bars = 52 + 30; // the top bar and the status line (css/theme.css, --bar-h, --status-h)
    const max = Math.max(DOCK_MIN, window.innerHeight - bars - this.stageMin());
    this.height = Math.max(DOCK_MIN, Math.min(max, this.height));
    this.el.classList.toggle("folded", this.folded);
    this.el.style.height = this.folded ? "" : `${this.height}px`;
    this.fold.replaceChildren(icon(this.folded ? "keyboard_arrow_up" : "keyboard_arrow_down"));
    setTip(this.fold, t(this.folded ? "dock.unfold" : "dock.fold"));
    this.save();
    window.dispatchEvent(new Event("dockresize"));
  }

  /** @private */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tab: this.current, height: Math.round(this.height), folded: this.folded }));
    } catch {
      // private browsing: the dock is not remembered
    }
  }

  /** Opens a tab. @param {ToolId} id */
  show(id) {
    this.select(`tab-${id}`);
  }

  /** Whether a tool is in view. @param {ToolId} id */
  shows(id) {
    return this.current === id && !this.folded;
  }

  /** A dot on a tab out of sight: something new there. @param {ToolId} id */
  mark(id) {
    if (this.shows(id)) return;
    document.getElementById(`tab-${id}`)?.querySelector(".dot")?.removeAttribute("hidden");
  }
}
