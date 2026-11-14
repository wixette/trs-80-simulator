// SPDX-License-Identifier: Apache-2.0
//
// The Video RAM tool (docs/ui-design.md, U6): the 1,024 bytes at 3C00H as a 64 x 16 grid,
// live, each cell flashing as it is written; and the cell inspector. Pick a cell (here, or
// on the screen in 2D) for its address, its byte as the video RAM gives it back with bit 6
// marked as rebuilt, and either the character's 6 x 12 dots from the character generator,
// row by row, or the 2 x 3 blocks by bit with their SET coordinates.

import { t } from "../../l10n/l10n.js";
import { blockOf, CELL_H, CELL_W, glyph } from "../../sim/charset.js";
import { VIDEO, VIDEO_SIZE } from "../../sim/machine.js";
import { el } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */

/** @param {number} n @param {number} d */
const hex = (n, d) => n.toString(16).toUpperCase().padStart(d, "0");
/** @param {number} n */
const bin = (n) => n.toString(2).padStart(8, "0");

export class VramTool {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   * @param {(cell: number) => void} [onPick] a cell was picked here (the 2D view outlines it)
   */
  constructor(host, system, onPick) {
    this.system = system;
    this.onPick = onPick;
    /** The picked cell, or -1. */
    this.cell = -1;
    /** @private when each cell was last written, for the flash, ms */
    this.flash = new Float64Array(VIDEO_SIZE);
    /** @private @type {Set<number>} */
    this.dirty = new Set();
    /** @private */
    this.all = true;
    /** @private the power the inspector was drawn for */
    this.wasOn = false;
    this.grid = el("div", { class: "vram-grid", role: "grid", "aria-label": t("vram.grid") });
    /** @private @type {HTMLElement[]} */
    this.cells = [];
    const head = el("div", { class: "vram-row vram-head", role: "row" }, [el("span", { class: "vram-addr" })]);
    for (let c = 0; c < 64; c += 8) head.append(el("span", { class: "vram-colhead", text: `+${c}` }));
    this.grid.append(head);
    for (let r = 0; r < 16; r++) {
      const row = el("div", { class: "vram-row", role: "row" }, [el("span", { class: "vram-addr", text: `${hex(VIDEO + r * 64, 4)}` })]);
      for (let c = 0; c < 64; c++) {
        const i = r * 64 + c;
        const b = el("button", { class: "vram-cell", type: "button", role: "gridcell", tabindex: i === 0 ? "0" : "-1" });
        b.addEventListener("click", () => this.pick(i, true));
        b.addEventListener("keydown", (e) => this.key(e, i));
        row.append(b);
        this.cells.push(b);
      }
      this.grid.append(row);
    }
    this.inspector = el("div", { class: "vram-inspector", "aria-live": "polite" });
    host.append(el("div", { class: "tool vram-tool" }, [el("div", { class: "tool-main" }, [this.grid]), this.inspector]));
    this.renderInspector();
  }

  /** A byte was written to the video RAM. @param {number} addr */
  written(addr) {
    const i = addr - VIDEO;
    this.flash[i] = performance.now();
    this.dirty.add(i);
  }

  /** Everything changed (power). */
  invalidate() {
    this.all = true;
  }

  /** Picks a cell. @param {number} i @param {boolean} [fromHere] */
  pick(i, fromHere = false) {
    const old = this.cells[this.cell];
    if (old) {
      old.classList.remove("picked");
      old.tabIndex = -1;
    }
    this.cell = i;
    const now = this.cells[i];
    if (now) {
      now.classList.add("picked");
      now.tabIndex = 0;
    }
    this.renderInspector();
    if (fromHere) this.onPick?.(i);
  }

  /** @private arrows move the pick @param {KeyboardEvent} e @param {number} i */
  key(e, i) {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -64, ArrowDown: 64 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const j = Math.max(0, Math.min(VIDEO_SIZE - 1, i + d));
    this.pick(j, true);
    this.cells[j].focus();
  }

  /** Called each frame while shown. */
  tick() {
    const m = this.system.machine;
    const now = performance.now();
    const update = this.all ? Array.from({ length: VIDEO_SIZE }, (_, i) => i) : [...this.dirty];
    this.all = false;
    this.dirty.clear();
    for (const i of update) {
      const b = m.peek(VIDEO + i);
      const c = this.cells[i];
      c.textContent = m.powered ? hex(b, 2) : "··";
      c.classList.toggle("gfx", m.powered && b >= 0x80);
      if (now - this.flash[i] < 400) c.classList.add("hot");
    }
    // the flash fades
    for (const c of this.grid.querySelectorAll(".vram-cell.hot")) {
      const i = this.cells.indexOf(/** @type {HTMLElement} */ (c));
      if (now - this.flash[i] > 400) c.classList.remove("hot");
    }
    if (update.includes(this.cell) || m.powered !== this.wasOn) {
      this.wasOn = m.powered;
      this.renderInspector();
    }
  }

  /** @private */
  renderInspector() {
    const box = this.inspector;
    const m = this.system.machine;
    if (this.cell < 0 || !m.powered) {
      box.replaceChildren(el("p", { class: "empty", text: t(m.powered ? "vram.pick" : "vram.off") }));
      return;
    }
    const i = this.cell;
    const addr = VIDEO + i;
    const b = m.peek(addr);
    const row = Math.floor(i / 64);
    const col = i % 64;
    const bits = el("div", { class: "bits", "aria-label": t("vram.bits", { bits: bin(b) }) });
    for (let k = 7; k >= 0; k--) {
      const on = (b >> k) & 1;
      const cls = `bit${on ? " on" : ""}${k === 6 ? " rebuilt" : ""}`;
      bits.append(el("span", { class: cls, title: k === 6 ? t("vram.bit6") : t("vram.bitN", { n: k }) }, [el("small", { text: String(k) }), el("b", { text: String(on) })]));
    }
    const head = el("div", { class: "insp-head" }, [
      el("strong", { class: "mono", text: `${hex(addr, 4)}H` }),
      el("span", { text: t("vram.where", { addr: addr, row, col }) }),
    ]);
    const value = el("p", { class: "insp-value" }, [el("span", { class: "mono", text: `${hex(b, 2)}H = ${b}` }), " ", el("span", { class: "dim", text: t("vram.readBack") })]);
    /** @type {HTMLElement} */
    let detail;
    if (b < 0x80) {
      const g = glyph(b);
      const dots = el("div", { class: "dots", style: `--w: ${CELL_W}` });
      for (let r = 0; r < CELL_H; r++) {
        for (let d = 0; d < CELL_W; d++) dots.append(el("span", { class: g[r] & (1 << d) ? "dot on" : "dot" }));
      }
      const rows = el("div", { class: "dot-rows mono" });
      for (let r = 0; r < CELL_H; r++) rows.append(el("span", { text: `${hex(g[r], 2)}` }));
      detail = el("div", { class: "insp-detail" }, [
        el("p", { text: t("vram.char", { code: hex(b, 2), char: b >= 0x20 ? String.fromCharCode(b) : "" }) }),
        el("div", { class: "glyph" }, [dots, rows]),
        el("p", { class: "dim", text: t("vram.charNote") }),
      ]);
    } else {
      const blocks = el("div", { class: "blocks" });
      for (let band = 0; band < 3; band++) {
        for (let c2 = 0; c2 < 2; c2++) {
          const bit = band * 2 + c2;
          const on = (b >> bit) & 1;
          const { col: bc, band: bb } = blockOf(bit);
          blocks.append(el("span", { class: on ? "block on" : "block", title: t("vram.setAt", { x: col * 2 + bc, y: row * 3 + bb }) }, [el("small", { text: t("vram.bitShort", { n: bit }) })]));
        }
      }
      detail = el("div", { class: "insp-detail" }, [
        el("p", { text: t("vram.gfx") }),
        el("div", { class: "glyph" }, [blocks]),
        el("p", { class: "dim", text: t("vram.gfxNote", { x0: col * 2, x1: col * 2 + 1, y0: row * 3, y1: row * 3 + 2 }) }),
      ]);
    }
    box.replaceChildren(head, value, bits, detail);
  }
}
