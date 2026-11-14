// SPDX-License-Identifier: Apache-2.0
//
// The dock under the stage (docs/ui-design.md, P3, U6): the lessons and four tools, one at a
// time. It is resized by its top edge (drag, or the arrow keys on the handle), folds to its
// tab bar, and remembers its tab and height. What the machine does never switches its tab.
// After the AGT-30 simulator's dock (https://github.com/wixette/agt30-simulator, Apache-2.0).

import { t } from "../l10n/l10n.js";
import { icon, setTip, tabs } from "../ui/components.js";

/** @typedef {"lessons" | "vram" | "keyboard" | "cassette" | "cpu" | "refs"} ToolId */
/** In the bar's order: the instruments, in the order lessons 3 to 6 use them; then the reading, the lessons (the default) and References, as the Altair 8800 simulator's dock. */
export const TOOLS = /** @type {ToolId[]} */ (["vram", "keyboard", "cassette", "cpu", "lessons", "refs"]);

/** The dock's least open height, px; at the start it takes this share of the window. */
const DOCK_MIN = 140;
/** A window this short, px, or shorter (a phone on its side): the dock opens folded at first,
 * and its least height gives way to the stage's. */
const SHORT = 520;
/** The dock's least open height in this window, px. */
const dockMin = () => Math.min(DOCK_MIN, Math.round(window.innerHeight * 0.25));
const DOCK_START = 0.4;
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
    /**
     * The height the visitor chose, by the handle, px, or null: until they do, the dock takes
     * DOCK_START of the window. A window too small for it squeezes the dock, but never changes
     * what was chosen, so the dock comes back as the window does (and after a reload).
     * @type {number | null}
     */
    this.wanted = typeof saved.height === "number" ? saved.height : null;
    /** The height shown, px. */
    this.height = 0;
    this.folded = saved.folded ?? window.innerHeight <= SHORT;
    /** @type {ToolId} */
    this.current = saved.tab && TOOLS.includes(saved.tab) ? saved.tab : "lessons";
    /** Called when a tab is shown. @type {(id: ToolId) => void} */
    this.onShow = () => {};
    /** @private while the remembered tab is shown at the start */
    this.starting = false;
    /** Called when the dock changes size or folds. */
    this.onResize = () => {};
    this.select = tabs(/** @type {HTMLElement} */ (document.getElementById("dock-tabs")), (tabId) => {
      this.current = /** @type {ToolId} */ (tabId.replace(/^tab-/, ""));
      document.getElementById(tabId)?.querySelector(".dot")?.setAttribute("hidden", "");
      // a tab chosen opens the dock; the one shown at the start leaves it as it was
      if (this.folded && !this.starting) {
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
      if (e.button) return;
      e.preventDefault();
      this.handle.setPointerCapture(e.pointerId);
      this.handle.classList.add("dragging");
      // the dock's foot stays where it is: its height is from there to the pointer
      const bottom = this.el.getBoundingClientRect().bottom;
      /** @param {PointerEvent} m */
      const move = (m) => {
        this.folded = false;
        this.choose(bottom - m.clientY);
      };
      const up = () => {
        this.handle.classList.remove("dragging");
        this.handle.removeEventListener("pointermove", move);
        this.handle.removeEventListener("pointerup", up);
        this.handle.removeEventListener("pointercancel", up);
      };
      this.handle.addEventListener("pointermove", move);
      this.handle.addEventListener("pointerup", up);
      this.handle.addEventListener("pointercancel", up);
    });
    this.handle.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowUp" ? KEY_STEP : e.key === "ArrowDown" ? -KEY_STEP : 0;
      if (!d) return;
      e.preventDefault();
      this.folded = false;
      this.choose(this.height + d);
    });
    window.addEventListener("resize", () => this.apply());
  }

  /** Shows the remembered tab; call once the tools are built. */
  start() {
    this.starting = true;
    this.select(`tab-${this.current}`);
    this.starting = false;
    this.apply();
  }

  /** The tallest the dock may be in this window: whatever leaves the stage its least, px. */
  maxHeight() {
    const h = (/** @type {string} */ id) => document.getElementById(id)?.offsetHeight ?? 0;
    return Math.max(dockMin(), document.body.clientHeight - h("topbar") - h("status") - h("dock-handle") - this.stageMin());
  }

  /** @private */
  apply() {
    const max = this.maxHeight();
    this.height = Math.max(dockMin(), Math.min(max, this.wanted ?? Math.round(window.innerHeight * DOCK_START)));
    this.el.classList.toggle("folded", this.folded);
    this.el.style.height = this.folded ? "" : `${this.height}px`;
    this.fold.replaceChildren(icon(this.folded ? "keyboard_arrow_up" : "keyboard_arrow_down"));
    setTip(this.fold, t(this.folded ? "dock.unfold" : "dock.fold"));
    this.save();
    this.onResize();
    window.dispatchEvent(new Event("dockresize"));
  }

  /** @private The visitor's height, by the handle: what the window allows of it is what they see, and so what they chose. @param {number} h */
  choose(h) {
    this.wanted = h;
    this.apply();
    this.wanted = this.height;
    this.save();
  }

  /** @private */
  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tab: this.current, height: this.wanted === null ? undefined : Math.round(this.wanted), folded: this.folded }));
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
