// SPDX-License-Identifier: Apache-2.0
//
// The Cassette tool (docs/ui-design.md, U6): the tape in the recorder, what it holds and how
// to load it (D7), its position and length, and Fast tape (D16; the sound's switch is on the top bar); and the
// tape under the head: pulses, bits, bytes, and what each byte is in the recording (a view
// the real machine never had). A strip about five bytes long around the head: each pulse as
// the port made it, the bit cells (a clock pulse, and a data pulse half a cell later for a 1)
// and the bytes they make, most significant bit first, counted from the sync byte.

import { t } from "../../l10n/l10n.js";
import { bitsOf, GAP_T, syncBit } from "../../sim/cassette.js";
import { CLOCK_HZ } from "../../sim/machine.js";
import { byteRoles } from "../../sim/system-tape.js";
import { mmss } from "../../sim/system.js";
import { el, setTip } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */
/** @typedef {import("../../sim/system-tape.js").ByteRole} ByteRole */
/** @typedef {{ start: number, end: number, bits: { at: number, one: boolean }[], sync: number, bytes: number[], roles: ByteRole[] }} Recording */

const W = 960;
const H = 150;
/** Tape shown, T-states: about five bytes. */
const SPAN_T = 5 * 8 * 3570;
/** Where the head sits in the strip: what has passed it is on the left. */
const HEAD_X = 0.62;

/** @param {number} n @param {number} [d] */
const hex = (n, d = 2) => n.toString(16).toUpperCase().padStart(d, "0");

/** A byte's role, worded. @param {ByteRole | undefined} r */
export function roleText(r) {
  if (!r) return "";
  return t(`role.${r.role}`, { block: r.block ?? 0, index: r.index ?? 0, addr: r.addr === undefined ? "" : `${hex(r.addr, 4)}H`, name: r.name ?? "" });
}

/**
 * A switch (Material 3): its track and thumb, then its label.
 * @param {string} label
 * @param {boolean} on
 * @param {(on: boolean) => void} change
 */
function toggle(label, on, change) {
  const b = el("button", { class: "switch", type: "button", role: "switch", "aria-checked": String(on) }, [el("span", { class: "switch-track" }, [el("span", { class: "switch-thumb" })]), el("span", { text: label })]);
  b.addEventListener("click", () => {
    const now = b.getAttribute("aria-checked") !== "true";
    b.setAttribute("aria-checked", String(now));
    change(now);
  });
  return b;
}

export class CassetteTool {
  /**
   * @param {HTMLElement} host
   * @param {System} system
   */
  constructor(host, system) {
    this.system = system;
    this.name = el("strong", { class: "tape-name" });
    this.what = el("p", { class: "tape-what" });
    this.where = el("p", { class: "tape-where mono" });
    // the same switch as the Tapes menu's: either sets it, both show it
    const fast = toggle(t("tape.fast"), system.fastTape, (on) => system.setFastTape(on));
    this.fast = fast;
    setTip(fast, t("tape.fast.tip"));
    fast.setAttribute("data-tip-describes", "");
    this.canvas = /** @type {HTMLCanvasElement} */ (el("canvas", { width: String(W), height: String(H), class: "tape-strip", "aria-label": t("tape.strip") }));
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext("2d"));
    this.now = el("p", { class: "tape-now", "aria-live": "off" });
    host.append(
      el("div", { class: "tool tape-tool" }, [
        el("div", { class: "tool-side" }, [this.name, this.what, this.where, el("div", { class: "tool-actions" }, [fast])]),
        el("div", { class: "tool-main" }, [el("h3", { text: t("tape.under") }), this.canvas, this.now]),
      ]),
    );
    /** @private the tape analysed, and how many pulses it had then @type {{ tape: object | null, n: number }} */
    this.key = { tape: null, n: -1 };
    /** @private @type {Recording[]} */
    this.recs = [];
    /** @private */
    this.drawnAt = NaN;
    const css = getComputedStyle(document.documentElement);
    /** @private */
    this.col = {
      ink: css.getPropertyValue("--md-on-surface").trim() || "#e6e6e6",
      dim: css.getPropertyValue("--md-outline").trim() || "#8c8c8c",
      hot: css.getPropertyValue("--story").trim() || "#8db9f2",
      head: css.getPropertyValue("--md-primary").trim() || "#ff9900",
      line: css.getPropertyValue("--md-outline-variant").trim() || "#444444",
    };
  }

  /** @private splits the tape into recordings and decodes each, once per tape and length */
  analyse() {
    const tape = this.system.deck.tape;
    const n = tape ? tape.pulses.length : 0;
    if (this.key.tape === tape && this.key.n === n) return;
    this.key = { tape, n };
    this.recs = [];
    this.drawnAt = NaN;
    if (!tape) return;
    const p = tape.pulses;
    let s = 0;
    for (let i = 1; i <= p.length; i++) {
      if (i < p.length && p[i] - p[i - 1] <= GAP_T) continue;
      const pulses = p.slice(s, i);
      const bits = bitsOf(pulses);
      const sync = syncBit(bits);
      /** @type {number[]} */
      const bytes = [];
      for (let b = sync; b + 8 <= bits.length; b += 8) {
        let v = 0;
        for (let k = 0; k < 8; k++) v = (v << 1) | (bits[b + k].one ? 1 : 0);
        bytes.push(v);
      }
      this.recs.push({ start: pulses[0], end: pulses[pulses.length - 1], bits, sync, bytes, roles: byteRoles(bytes) });
      s = i;
    }
  }

  /** Called each frame while shown. */
  tick() {
    const s = this.system;
    const d = s.deck;
    const tape = d.tape;
    this.fast.setAttribute("aria-checked", String(s.fastTape));
    this.name.textContent = tape ? tape.name : t("tape.none");
    const info = s.tapeInfo();
    this.what.textContent = !tape ? t("tape.none.how") : !info ? t("tape.blank.how") : info.kind === "basic" ? t("tape.basic.how", { letter: info.name }) : info.kind === "system" ? t("tape.system.how", { program: info.name, blocks: info.blocks.length, entry: `${hex(info.entry, 4)}H`, bad: info.bad.length ? t("tape.badBlocks", { n: info.bad.length }) : "" }) : t("tape.unknown.how");
    const mode = d.mode === "record" ? "RECORD + PLAY" : d.mode === "fast" ? "FAST-F" : d.mode.toUpperCase();
    this.where.textContent = tape ? t("tape.where", { pos: mmss(d.at(s.machine.t)), length: mmss(d.length), counter: String(d.counterAt(s.machine.t)).padStart(3, "0"), mode, motor: t(d.relay ? "tape.motorOn" : "tape.motorOff") }) : "";
    this.draw();
  }

  /** @private */
  draw() {
    this.analyse();
    const s = this.system;
    const tape = s.deck.tape;
    const pos = s.deck.at(s.machine.t);
    if (pos === this.drawnAt) return;
    this.drawnAt = pos;
    const c = this.ctx;
    const { ink, dim, hot, head, line } = this.col;
    c.clearRect(0, 0, W, H);
    const x0 = pos - SPAN_T * HEAD_X;
    const X = (/** @type {number} */ tt) => ((tt - x0) / SPAN_T) * W;
    const base = 46;
    c.strokeStyle = line;
    c.beginPath();
    c.moveTo(0, base);
    c.lineTo(W, base);
    c.stroke();
    c.font = "12px ui-monospace, Menlo, monospace";
    c.textBaseline = "top";
    if (tape) {
      // the pulses: up then down, as the port's levels make them
      const p = tape.pulses;
      for (let i = tape.indexAt(x0 - 1000); i < p.length && p[i] < x0 + SPAN_T; i++) {
        const x = X(p[i]);
        c.strokeStyle = p[i] <= pos ? hot : dim;
        c.beginPath();
        c.moveTo(x, base);
        c.lineTo(x + 2, base - 28);
        c.lineTo(x + 4, base + 22);
        c.lineTo(x + 6, base);
        c.stroke();
      }
    }
    const rec = this.recs.find((r) => pos >= r.start - SPAN_T && pos <= r.end + SPAN_T);
    let here = "";
    if (rec) {
      const { bits, sync, bytes, roles } = rec;
      for (let b = 0; b < bits.length; b++) {
        const bit = bits[b];
        if (bit.at < x0 - 4000) continue;
        if (bit.at > x0 + SPAN_T) break;
        const x = X(bit.at);
        c.fillStyle = bit.at <= pos ? ink : dim;
        c.fillText(bit.one ? "1" : "0", x + 10, base + 30);
        const k = b - sync;
        if (k >= 0 && k % 8 === 0 && k / 8 < bytes.length) {
          const i = k / 8;
          c.strokeStyle = line;
          c.beginPath();
          c.moveTo(x - 2, base + 28);
          c.lineTo(x - 2, base + 72);
          c.stroke();
          c.fillStyle = bit.at <= pos ? ink : dim;
          c.fillText(`${hex(bytes[i])}H`, x + 6, base + 48);
          c.fillStyle = dim;
          const ch = bytes[i] >= 0x20 && bytes[i] < 0x7f ? ` “${String.fromCharCode(bytes[i])}”` : "";
          c.fillText(`#${i + 1}${ch}`, x + 6, base + 64);
        }
      }
      // the byte the head is in
      let lo = 0;
      let hi = bits.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (bits[mid].at <= pos) lo = mid + 1;
        else hi = mid;
      }
      const k = lo - 1 - sync;
      if (lo > 0 && k >= 0 && Math.floor(k / 8) < bytes.length) {
        const i = Math.floor(k / 8);
        here = t("tape.byteHere", { n: i + 1, of: bytes.length, hex: `${hex(bytes[i])}H`, bin: bytes[i].toString(2).padStart(8, "0"), bit: 7 - (k % 8), role: roleText(roles[i]) });
      } else if (lo > 0) here = t("role.leader");
    }
    c.strokeStyle = head;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(X(pos), 16);
    c.lineTo(X(pos), H - 4);
    c.stroke();
    c.lineWidth = 1;
    c.fillStyle = head;
    c.fillText(t("tape.head"), X(pos) + 4, 2);
    c.fillStyle = dim;
    c.fillText(`${(pos / CLOCK_HZ).toFixed(3)} s`, 4, 2);
    this.now.textContent = !tape ? t("tape.none") : here || t("tape.nothingHere");
  }
}
