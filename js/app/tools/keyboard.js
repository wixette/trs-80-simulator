// SPDX-License-Identifier: Apache-2.0
//
// The Keyboard tool (docs/ui-design.md, U6): the 8 x 8 matrix as the computer sees it at
// 3800H-3BFFH [rs-info keyboard]. A key held down lights its switch; a row lights while the
// program reads it, with the address it read, the byte it got back, and how many times a
// second. BASIC scans every row; a game reads only its own.

import { t } from "../../l10n/l10n.js";
import { keyAt, rowAddress } from "../../sim/keymap.js";
import { el } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

/** @param {number} n @param {number} d */
const hex = (n, d) => n.toString(16).toUpperCase().padStart(d, "0");
/** A row stays lit this long after a read, ms. */
const LIT_MS = 120;

export class KeyboardTool {
  /** @param {HTMLElement} host @param {System} system */
  constructor(host, system) {
    this.system = system;
    /** @private reads in the last second, by row, in machine time @type {number[][]} */
    this.reads = Array.from({ length: 8 }, () => []);
    /** @private the last byte each row read gave, and when (wall time) */
    this.last = Array.from({ length: 8 }, () => ({ value: 0, at: -1e9, sel: 0 }));
    /** @private the latest read of all */
    this.latest = { sel: 0, value: 0 };
    /** @private @type {HTMLElement[][]} */
    this.cellEls = [];
    /** @private @type {{ row: HTMLElement, addr: HTMLElement, byte: HTMLElement, rate: HTMLElement }[]} */
    this.rowEls = [];
    const table = el("div", { class: "matrix", role: "table", "aria-label": t("kbd.matrix") });
    const head = el("div", { class: "matrix-row matrix-head", role: "row" }, [el("span", { class: "mx-addr", role: "columnheader", text: t("kbd.address") })]);
    for (let b = 0; b < 8; b++) head.append(el("span", { class: "mx-bit", role: "columnheader", text: `D${b}` }));
    head.append(el("span", { class: "mx-byte", role: "columnheader", text: t("kbd.byte") }), el("span", { class: "mx-rate", role: "columnheader", text: t("kbd.rate") }));
    table.append(head);
    for (let r = 0; r < 8; r++) {
      const addr = el("span", { class: "mx-addr mono", role: "rowheader", text: `${hex(rowAddress(r), 4)}H` });
      const row = el("div", { class: "matrix-row", role: "row" }, [addr]);
      /** @type {HTMLElement[]} */
      const cells = [];
      for (let b = 0; b < 8; b++) {
        const k = keyAt(r, b);
        const c = el("span", { class: k ? "mx-key" : "mx-key none", role: "cell", text: k ? short(k.name) : "" });
        row.append(c);
        cells.push(c);
      }
      const byte = el("span", { class: "mx-byte mono", role: "cell", text: "–" });
      const rate = el("span", { class: "mx-rate mono", role: "cell", text: "" });
      row.append(byte, rate);
      table.append(row);
      this.cellEls.push(cells);
      this.rowEls.push({ row, addr, byte, rate });
    }
    this.note = el("p", { class: "tool-note", "aria-live": "off" });
    host.append(el("div", { class: "tool kbd-tool" }, [el("div", { class: "tool-main" }, [table]), el("div", { class: "tool-side" }, [this.note, el("p", { class: "dim", text: t("kbd.about") }), el("p", { class: "dim", text: t("stage.legend") })])]));
  }

  /** The program read the keyboard (the page passes on the machine's scan event). @param {number} sel the rows selected @param {number} value */
  scanned(sel, value) {
    const t0 = this.system.machine.t;
    const now = performance.now();
    for (let r = 0; r < 8; r++) {
      if (!(sel & (1 << r))) continue;
      const list = this.reads[r];
      // the machine's time starts again at 0 when it is switched on: older reads are another run's
      if (list.length && list[list.length - 1] > t0) list.length = 0;
      list.push(t0);
      if (list.length > 4000) list.splice(0, list.length - 4000);
      this.last[r] = { value, at: now, sel };
    }
    this.latest = { sel, value };
  }

  /** Called each frame while shown. */
  tick() {
    const m = this.system.machine;
    const now = performance.now();
    const second = m.t - 1_774_080;
    for (let r = 0; r < 8; r++) {
      for (let b = 0; b < 8; b++) this.cellEls[r][b].classList.toggle("down", (m.rows[r] & (1 << b)) !== 0);
      const list = this.reads[r];
      if (list.length && list[list.length - 1] > m.t) list.length = 0;
      while (list.length && list[0] < second) list.shift();
      const e = this.rowEls[r];
      e.row.classList.toggle("read", now - this.last[r].at < LIT_MS && m.powered);
      e.byte.textContent = this.last[r].at > -1e9 ? `${hex(this.last[r].value, 2)}H` : "–";
      e.rate.textContent = m.powered && list.length ? t("kbd.perSecond", { n: list.length }) : "";
    }
    const { sel, value } = this.latest;
    this.note.textContent = !m.powered ? t("kbd.off") : sel ? t("kbd.latest", { addr: hex(0x3800 | sel, 4), value: hex(value, 2) }) : t("kbd.none");
  }
}

/** A key's name, short enough for a cell. @param {string} name */
function short(name) {
  return { ENTER: "ENTER", CLEAR: "CLEAR", BREAK: "BREAK", UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→", SPACE: "SPACE", SHIFT: "SHIFT" }[name] ?? name;
}
