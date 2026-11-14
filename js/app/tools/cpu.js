// SPDX-License-Identifier: Apache-2.0
//
// The CPU & Memory tool (docs/ui-design.md, U6): a view the real machine never had. The
// Z80's registers and flags; the next instructions, disassembled (js/sim/disasm.js); the
// memory map, each region lit by the traffic it had this frame; a memory dump that can follow
// PC, SP or HL. Pause, Step (one instruction), Run to an address, and a slower clock. While
// paused, everything waits: the screen, the tape, the keys. With the computer off the tool
// keeps its layout, greyed, and says why (P6).

import { t } from "../../l10n/l10n.js";
import { disassemble, listing } from "../../sim/disasm.js";
import { REGIONS } from "../../sim/machine.js";
import { el, icon, setTip } from "../../ui/components.js";

/** @typedef {import("../../sim/system.js").System} System */
/** @typedef {import("../../sim/cpu.js").Registers} Registers */

/** @param {number} n @param {number} d */
const hex = (n, d) => n.toString(16).toUpperCase().padStart(d, "0");
/** The speeds offered: the real machine, and slower. */
export const SPEEDS = [1, 0.1, 0.01, 0.001];
const FLAGS = [
  ["S", 7],
  ["Z", 6],
  ["H", 4],
  ["P/V", 2],
  ["N", 1],
  ["C", 0],
];
/** How many instructions to list, and rows of 16 bytes to dump. */
const LIST = 8;
const DUMP_ROWS = 8;

export class CpuTool {
  /** @param {HTMLElement} host @param {System} system */
  constructor(host, system) {
    this.system = system;
    /** What the dump follows: "pc", "sp", "hl", or an address. @type {"pc" | "sp" | "hl" | number} */
    this.follow = "pc";
    /** @private the registers at the last step, to mark what changed @type {Registers | null} */
    this.before = null;
    /** @private eased traffic per region */
    this.lit = /** @type {Map<string, number>} */ (new Map(REGIONS.map((r) => [r.id, 0])));
    /** @private seconds since the last full redraw, and what it showed */
    this.since = 1;
    this.shown = "";
    const s = system;

    // the controls
    this.pauseBtn = el("button", { class: "btn tonal small has-icon", type: "button" });
    this.pauseBtn.addEventListener("click", () => this.togglePause());
    this.stepBtn = el("button", { class: "btn tonal small has-icon", type: "button" }, [icon("skip_next"), el("span", { text: t("cpu.step") })]);
    setTip(this.stepBtn, t("cpu.step.tip"));
    this.stepBtn.setAttribute("data-tip-describes", "");
    this.stepBtn.addEventListener("click", () => this.step());
    this.toField = /** @type {HTMLInputElement} */ (el("input", { class: "field mono", type: "text", inputmode: "text", maxlength: "5", size: "6", placeholder: "1A19", "aria-label": t("cpu.runTo.field"), spellcheck: "false", autocomplete: "off" }));
    this.toBtn = el("button", { class: "btn tonal small has-icon", type: "button" }, [icon("fast_forward"), el("span", { text: t("cpu.runTo") })]);
    setTip(this.toBtn, t("cpu.runTo.tip"));
    this.toBtn.setAttribute("data-tip-describes", "");
    this.toBtn.addEventListener("click", () => this.runTo());
    this.toField.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") this.runTo();
    });
    this.speed = el("div", { class: "segmented", role: "radiogroup", "aria-label": t("cpu.speed") });
    for (const sp of SPEEDS) {
      const b = el("button", { type: "button", role: "radio", "aria-checked": String(sp === 1), text: sp === 1 ? t("cpu.speed.real") : `1/${Math.round(1 / sp)}` });
      setTip(b, t(sp === 1 ? "cpu.speed.real.tip" : "cpu.speed.slow.tip", { n: Math.round(1 / sp) }));
      b.addEventListener("click", () => {
        s.clock.speed = sp;
        for (const x of this.speed.children) x.setAttribute("aria-checked", String(x === b));
        s.say({ key: sp === 1 ? "cpu.speedReal" : "cpu.speedSlow", params: { n: Math.round(1 / sp) } });
      });
      this.speed.append(b);
    }
    const controls = el("div", { class: "tool-actions cpu-controls" }, [this.pauseBtn, this.stepBtn, el("span", { class: "group" }, [this.toField, this.toBtn]), this.speed]);

    // the registers and flags
    this.regs = el("div", { class: "regs mono", "aria-label": t("cpu.registers") });
    this.flags = el("div", { class: "flags", "aria-label": t("cpu.flags") });
    // the next instructions
    this.code = el("ol", { class: "code mono", "aria-label": t("cpu.next") });
    // the memory map
    this.map = el("div", { class: "memmap", role: "img", "aria-label": t("cpu.map") });
    for (const r of REGIONS) {
      const size = r.end - r.start + 1;
      const seg = el("div", { class: `region ${r.id}`, style: `flex: ${Math.max(0.035, size / 0x10000)} 1 0`, "data-region": r.id }, [el("span", { text: t(`region.${r.id}`) })]);
      setTip(seg, t("cpu.region", { name: t(`region.${r.id}`), start: hex(r.start, 4), end: hex(r.end, 4), chips: r.chips.length ? r.chips.map((c) => c.toUpperCase()).join(", ") : t("cpu.noChips") }));
      seg.addEventListener("click", () => {
        this.follow = r.start;
        this.followSel.value = "addr";
        this.addrField.value = hex(r.start, 4);
      });
      this.map.append(seg);
    }
    // the dump
    this.followSel = /** @type {HTMLSelectElement} */ (el("select", { class: "field", "aria-label": t("cpu.follow") }, ["pc", "sp", "hl", "addr"].map((v) => el("option", { value: v, text: t(`cpu.follow.${v}`) }))));
    this.addrField = /** @type {HTMLInputElement} */ (el("input", { class: "field mono", type: "text", maxlength: "5", size: "6", "aria-label": t("cpu.address"), spellcheck: "false", autocomplete: "off" }));
    this.followSel.addEventListener("change", () => {
      const v = this.followSel.value;
      this.follow = v === "addr" ? parseHex(this.addrField.value) ?? 0x4000 : /** @type {"pc" | "sp" | "hl"} */ (v);
      if (v === "addr" && !this.addrField.value) this.addrField.value = "4000";
    });
    this.addrField.addEventListener("keydown", (e) => e.stopPropagation());
    this.addrField.addEventListener("change", () => {
      const a = parseHex(this.addrField.value);
      if (a === null) return;
      this.follow = a;
      this.followSel.value = "addr";
    });
    this.dump = el("div", { class: "dump mono", role: "table", "aria-label": t("cpu.dump") });
    this.state = el("p", { class: "cpu-state", "aria-live": "polite" });
    host.append(
      el("div", { class: "tool cpu-tool" }, [
        el("div", { class: "cpu-top" }, [controls, this.state]),
        el("div", { class: "cpu-grid" }, [
          el("section", { class: "cpu-box" }, [el("h3", { text: t("cpu.registers") }), this.regs, this.flags]),
          el("section", { class: "cpu-box" }, [el("h3", { text: t("cpu.next") }), this.code]),
          el("section", { class: "cpu-box wide" }, [
            el("div", { class: "box-head" }, [el("h3", { text: t("cpu.memory") }), el("span", { class: "spacer" }), this.followSel, this.addrField]),
            this.map,
            this.dump,
          ]),
        ]),
      ]),
    );
    s.clock.onStop = (pc) => {
      s.clock.stops.clear();
      s.say({ key: "cpu.reached", params: { addr: hex(pc, 4) } });
    };
  }

  /** @private */
  togglePause() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    if (s.clock.paused) {
      s.clock.resume();
      s.say({ key: "cpu.running" });
    } else {
      s.clock.pause();
      this.before = s.machine.registers();
      s.say({ key: "cpu.paused", params: { addr: hex(s.machine.pc, 4) } });
    }
  }

  /** One instruction. */
  step() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    if (!s.clock.paused) {
      s.clock.pause();
      this.before = s.machine.registers();
      s.say({ key: "cpu.paused", params: { addr: hex(s.machine.pc, 4) } });
      return;
    }
    const ins = disassemble((a) => s.machine.peek(a), s.machine.pc);
    this.before = s.machine.registers();
    const n = s.clock.stepOnce();
    s.say({ key: "cpu.stepped", params: { text: ins.text, addr: hex(ins.addr, 4), t: n } });
  }

  /** @private Runs until PC reaches the address in the field. */
  runTo() {
    const s = this.system;
    if (!s.machine.powered) return void s.say({ key: "cpu.off" });
    const a = parseHex(this.toField.value);
    if (a === null) return void s.say({ key: "cpu.badAddress" });
    s.clock.stops.clear();
    s.clock.stops.add(a);
    s.clock.resume();
    s.say({ key: "cpu.runningTo", params: { addr: hex(a, 4) } });
  }

  /** Called each frame while shown. @param {number} dt */
  tick(dt) {
    const s = this.system;
    const m = s.machine;
    const on = m.powered;
    const paused = s.clock.paused;
    this.pauseBtn.replaceChildren(icon(paused ? "play_arrow" : "pause"), el("span", { text: t(paused ? "cpu.run" : "cpu.pause") }));
    setTip(this.pauseBtn, t(paused ? "cpu.run.tip" : "cpu.pause.tip"));
    this.pauseBtn.setAttribute("data-tip-describes", "");
    for (const b of [this.pauseBtn, this.stepBtn, this.toBtn]) b.setAttribute("aria-disabled", String(!on));
    this.state.textContent = !on ? t("cpu.off") : paused ? t("cpu.state.paused", { addr: hex(m.pc, 4) }) : s.clock.stops.size ? t("cpu.state.runningTo", { addr: hex([...s.clock.stops][0], 4) }) : t("cpu.state.running");
    this.renderMap(dt);
    // the registers, code and dump: ten times a second while it runs; paused, when they change
    this.since += dt;
    const key = `${on}|${paused}|${m.t}|${String(this.follow)}`;
    if (key === this.shown || (!paused && on && this.since < 0.1)) return;
    this.shown = key;
    this.since = 0;
    const r = on ? m.registers() : null;
    this.renderRegs(r);
    this.renderCode(r);
    this.renderDump(r);
  }

  /** @private @param {Registers | null} r */
  renderRegs(r) {
    const b = this.before;
    /** @param {string} name @param {number | undefined} v @param {number} d @param {number | undefined} was */
    const cell = (name, v, d, was) => el("span", { class: `reg${r && b && was !== undefined && v !== was ? " changed" : ""}` }, [el("small", { text: name }), el("b", { text: v === undefined || !r ? "–".repeat(d) : hex(v, d) })]);
    const pair = (/** @type {number} */ hi, /** @type {number} */ lo) => (hi << 8) | lo;
    const rows = [
      [["AF", r && pair(r.a, r.f), b && pair(b.a, b.f)], ["BC", r && pair(r.b, r.c), b && pair(b.b, b.c)], ["DE", r && pair(r.d, r.e), b && pair(b.d, b.e)], ["HL", r && pair(r.h, r.l), b && pair(b.h, b.l)]],
      [["AF'", r && pair(r.a_, r.f_), b && pair(b.a_, b.f_)], ["BC'", r && pair(r.b_, r.c_), b && pair(b.b_, b.c_)], ["DE'", r && pair(r.d_, r.e_), b && pair(b.d_, b.e_)], ["HL'", r && pair(r.h_, r.l_), b && pair(b.h_, b.l_)]],
      [["IX", r?.ix, b?.ix], ["IY", r?.iy, b?.iy], ["SP", r?.sp, b?.sp], ["PC", r?.pc, b?.pc]],
    ];
    this.regs.replaceChildren(
      ...rows.map((row) => el("div", { class: "reg-row" }, row.map(([n, v, w]) => cell(/** @type {string} */ (n), /** @type {number | undefined} */ (v ?? undefined), 4, /** @type {number | undefined} */ (w ?? undefined))))),
      el("div", { class: "reg-row" }, [cell("I", r?.i, 2, b?.i), cell("R", r?.r, 2, undefined), el("span", { class: "reg" }, [el("small", { text: "IM" }), el("b", { text: r ? String(r.im) : "–" })]), el("span", { class: "reg" }, [el("small", { text: "IFF" }), el("b", { text: r ? (r.iff1 ? "1" : "0") : "–" })])]),
    );
    this.flags.replaceChildren(
      ...FLAGS.map(([n, bit]) => {
        const set = r ? (r.f >> /** @type {number} */ (bit)) & 1 : 0;
        const e = el("span", { class: `flag${set ? " on" : ""}`, text: String(n) });
        setTip(e, t(`flag.${n === "P/V" ? "PV" : n}`));
        return e;
      }),
    );
  }

  /** @private @param {Registers | null} r */
  renderCode(r) {
    if (!r) {
      this.code.replaceChildren(...Array.from({ length: LIST }, () => el("li", { class: "dim", text: "–" })));
      return;
    }
    const m = this.system.machine;
    const list = listing((a) => m.peek(a), r.pc, LIST);
    this.code.replaceChildren(
      ...list.map((ins, i) =>
        el("li", { class: `${i === 0 ? "at-pc" : ""}${ins.undocumented ? " undoc" : ""}` }, [
          el("span", { class: "c-addr", text: hex(ins.addr, 4) }),
          el("span", { class: "c-bytes", text: ins.bytes.map((x) => hex(x, 2)).join(" ") }),
          el("span", { class: "c-text", text: ins.text }),
        ]),
      ),
    );
  }

  /** @private @param {number} dt */
  renderMap(dt) {
    const tr = this.system.traffic;
    /** @type {Record<string, number>} */
    const by = { romA: tr.romA, romB: tr.romB, keyboard: tr.keyboard, video: tr.videoRead + tr.videoWrite, ram: tr.ramRead + tr.ramWrite };
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    for (const seg of this.map.children) {
      const id = /** @type {HTMLElement} */ (seg).dataset.region ?? "";
      const target = total ? Math.sqrt((by[id] ?? 0) / total) : 0;
      const now = (this.lit.get(id) ?? 0) + (target - (this.lit.get(id) ?? 0)) * Math.min(1, dt * 8);
      this.lit.set(id, now);
      /** @type {HTMLElement} */ (seg).style.setProperty("--lit", now.toFixed(3));
    }
  }

  /** @private @param {Registers | null} r */
  renderDump(r) {
    const m = this.system.machine;
    const at = !r ? 0x4000 : this.follow === "pc" ? r.pc : this.follow === "sp" ? r.sp : this.follow === "hl" ? (r.h << 8) | r.l : this.follow;
    const start = (at & 0xfff0) - (this.follow === "sp" || typeof this.follow === "number" ? 0 : 0x10) & 0xffff;
    const pcLen = r ? disassemble((a) => m.peek(a), r.pc).length : 0;
    /** @type {HTMLElement[]} */
    const rows = [];
    for (let i = 0; i < DUMP_ROWS; i++) {
      const base = (start + i * 16) & 0xffff;
      /** @type {HTMLElement[]} */
      const bytes = [];
      let ascii = "";
      for (let k = 0; k < 16; k++) {
        const a = (base + k) & 0xffff;
        const v = r ? m.peek(a) : 0;
        const atPc = r && ((a - r.pc) & 0xffff) < pcLen;
        const atSp = r && (a === r.sp || a === ((r.sp + 1) & 0xffff));
        bytes.push(el("span", { class: `${atPc ? "at-pc" : ""}${atSp ? " at-sp" : ""}`, text: r ? hex(v, 2) : "··" }));
        ascii += r && v >= 0x20 && v < 0x7f ? String.fromCharCode(v) : "·";
      }
      rows.push(el("div", { class: "dump-row", role: "row" }, [el("span", { class: "d-addr", text: hex(base, 4) }), el("span", { class: "d-bytes" }, bytes), el("span", { class: "d-ascii", text: ascii })]));
    }
    this.dump.replaceChildren(...rows);
  }
}

/** A hex address typed by the visitor (an H at the end is allowed), or null. @param {string} s */
export function parseHex(s) {
  const m = s.trim().toUpperCase().match(/^([0-9A-F]{1,4})H?$/);
  return m ? parseInt(m[1], 16) : null;
}
