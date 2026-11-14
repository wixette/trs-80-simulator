// SPDX-License-Identifier: Apache-2.0
//
// The helper strip (docs/ui-design.md, U4): the machine's controls that are hard to reach on
// the machine itself, as large buttons in one strip at the stage's foot, centred, in 2D and
// in 3D: the computer's POWER and RESET (at the back of the keyboard unit), the Video
// Display's POWER, and the CTR-80's six keys. They are not parts of the machine, so they speak
// in the instrument's voice, with the recorder's keys named by their legends (P5). Each is the
// same operation as the control on the machine (P2), and a key that cannot act now is greyed
// and still answers, saying why (P6). A tab on the strip's top edge folds it away, and the
// choice is remembered. After the Altair 8800 simulator's Switch Board Helper
// (https://github.com/wixette/8800-simulator, Apache-2.0, by the same author).

import { t } from "../l10n/l10n.js";
import { el, icon, setTip } from "../ui/components.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("../sim/system.js").DeckKey} DeckKey */
/** @typedef {import("../scene/desk3d.js").Desk3D} Desk3D */

const STORE = "trs80.strip";
/** The recorder's keys, left to right as on the machine, with their legends and icons. */
const DECK = /** @type {{ id: DeckKey, legend: string, icon: import("../ui/components.js").IconName }[]} */ ([
  { id: "record", legend: "RECORD", icon: "fiber_manual_record" },
  { id: "rewind", legend: "REWIND", icon: "fast_rewind" },
  { id: "play", legend: "PLAY", icon: "play_arrow" },
  { id: "fastf", legend: "FAST-F", icon: "fast_forward" },
  { id: "stop", legend: "STOP", icon: "stop" },
  { id: "eject", legend: "EJECT", icon: "eject" },
]);

/** Whether a recorder key is down, as the machine latches them. @param {DeckKey} id @param {string} mode */
export function latched(id, mode) {
  if (id === "stop" || id === "eject") return false; // they spring back
  return (id === "fastf" ? "fast" : id) === mode || (id === "play" && mode === "record");
}

export class HelperStrip {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {() => Desk3D | null} desk the 3D desk, once loaded: its keys move as these are pressed
   */
  constructor(host, system, desk) {
    this.system = system;
    this.desk = desk;
    const s = system;
    /** @param {string} cls @param {import("../ui/components.js").IconName} ic @param {string} label @param {string} tip @param {() => void} run */
    const button = (cls, ic, label, tip, run) => {
      const b = el("button", { class: `btn tonal small has-icon ${cls}`, type: "button" }, [icon(ic), el("span", { class: "strip-label", text: label })]);
      b.setAttribute("data-tip-describes", "");
      setTip(b, tip);
      b.addEventListener("click", run);
      return b;
    };
    this.powerBtn = button("", "power_settings_new", t("stage.computer"), t("stage.computer.tip"), () => s.power(!s.machine.powered));
    this.resetBtn = button("", "restart_alt", t("stage.reset"), t("stage.reset.tip"), () => {
      this.desk()?.pressReset();
      s.reset();
    });
    this.displayBtn = button("", "power_settings_new", t("stage.display"), t("stage.display.tip"), () => s.displayPower(!s.display.on));
    /** @type {Map<DeckKey, HTMLElement>} */
    this.deckBtns = new Map();
    for (const k of DECK) {
      this.deckBtns.set(
        k.id,
        button(`deck-key${k.id === "record" ? " rec" : ""}`, k.icon, k.legend, t(`deck.key.${k.id}`), () => {
          this.desk()?.tapDeckKey(k.id);
          s.deckKey(k.id);
        }),
      );
    }
    this.body = el("div", { class: "strip-body", id: "strip-body", role: "group", "aria-label": t("strip.label") }, [
      el("div", { class: "strip-group" }, [this.powerBtn, this.resetBtn]),
      el("div", { class: "strip-group" }, [this.displayBtn]),
      el("span", { class: "strip-divider", "aria-hidden": "true" }),
      el("div", { class: "strip-group" }, [...this.deckBtns.values()]),
    ]);
    this.tab = el("button", { class: "strip-tab", type: "button", "aria-controls": "strip-body" }, [icon("keyboard_arrow_down")]);
    this.tab.addEventListener("click", () => this.setFolded(!this.folded));
    host.append(this.tab, this.body);
    this.host = host;
    /** @private */
    this.shownKey = "";
    let folded = false;
    try {
      folded = localStorage.getItem(STORE) === "folded";
    } catch {
      // not remembered
    }
    this.folded = folded;
    this.setFolded(folded);
  }

  /** Folds the strip away to its tab, or brings it back. @param {boolean} folded */
  setFolded(folded) {
    this.folded = folded;
    this.host.classList.toggle("folded", folded);
    this.tab.setAttribute("aria-expanded", String(!folded));
    setTip(this.tab, t(folded ? "strip.unfold" : "strip.fold"));
    try {
      localStorage.setItem(STORE, folded ? "folded" : "shown");
    } catch {
      // not remembered
    }
  }

  /** The buttons' states: called each frame, and does the work only on a change. */
  refresh() {
    const s = this.system;
    const d = s.deck;
    const key = `${s.machine.powered}${s.display.on}${!!d.tape}${d.mode}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.powerBtn.classList.toggle("lit", s.machine.powered);
    this.powerBtn.setAttribute("aria-pressed", String(s.machine.powered));
    this.displayBtn.classList.toggle("lit", s.display.on);
    this.displayBtn.setAttribute("aria-pressed", String(s.display.on));
    this.resetBtn.setAttribute("aria-disabled", String(!s.machine.powered));
    for (const [id, b] of this.deckBtns) {
      b.setAttribute("aria-pressed", String(latched(id, d.mode)));
      b.setAttribute("aria-disabled", String(!d.tape));
    }
  }
}
