// SPDX-License-Identifier: Apache-2.0
//
// Taking the machine apart (docs/ui-design.md, U3; design/decisions.md, D11): for each
// removable unit, how far along its way out it is (0 seated, 1 out), and what must be out
// before it (model/params/machine.json, take_apart). No three.js here: the 3D view moves
// the parts, this says where they are and what may move.
//
// As in the Altair 8800 simulator, the visitor is never asked to work the order out: a
// click on a unit takes out whatever is in its way first, in order, and putting one back
// first puts back whatever sits on it.

/** @typedef {{ unit: string, requires: string[] }} Step */

export class Assembly {
  /** @param {readonly Step[]} order the units, each after everything it requires */
  constructor(order) {
    /** @readonly */
    this.order = order;
    /** @type {Map<string, number>} */
    this.out = new Map(order.map((s) => [s.unit, 0]));
  }

  /** The units, in the order they come out. */
  get units() {
    return this.order.map((s) => s.unit);
  }

  /** @param {string} unit */
  isOut(unit) {
    return (this.out.get(unit) ?? 0) >= 1;
  }

  /** @param {string} unit */
  isIn(unit) {
    return (this.out.get(unit) ?? 0) <= 0;
  }

  /**
   * What must come out to take `unit` out, itself last, in order; [] if it is out.
   * @param {string} unit
   * @returns {string[]}
   */
  planOut(unit) {
    const step = this.order.find((s) => s.unit === unit);
    if (!step) throw new Error(`no such unit: ${unit}`);
    /** @type {Set<string>} */
    const need = new Set();
    /** @param {string} u */
    const visit = (u) => {
      if (need.has(u) || this.isOut(u)) return;
      for (const r of this.order.find((s) => s.unit === u)?.requires ?? []) visit(r);
      need.add(u);
    };
    visit(unit);
    return this.units.filter((u) => need.has(u));
  }

  /**
   * What must go back to put `unit` back, itself last, in order; [] if it is in.
   * @param {string} unit
   * @returns {string[]}
   */
  planIn(unit) {
    if (!this.out.has(unit)) throw new Error(`no such unit: ${unit}`);
    /** @type {Set<string>} */
    const need = new Set();
    /** @param {string} u */
    const visit = (u) => {
      if (need.has(u) || this.isIn(u)) return;
      for (const s of this.order) if (s.requires.includes(u)) visit(s.unit);
      need.add(u);
    };
    visit(unit);
    return this.units.filter((u) => need.has(u)).reverse();
  }

  /** Everything back, in the order it goes back. */
  planAllIn() {
    return this.units.filter((u) => !this.isIn(u)).reverse();
  }

  /** @param {string} unit @param {number} f 0..1 */
  set(unit, f) {
    if (!this.out.has(unit)) throw new Error(`no such unit: ${unit}`);
    this.out.set(unit, Math.max(0, Math.min(1, f)));
  }

  /** Anything out, or on its way: the computer must stay off. */
  anyOut() {
    return [...this.out.values()].some((v) => v > 0);
  }

  /** The units out, or on their way. */
  outUnits() {
    return this.units.filter((u) => !this.isIn(u));
  }
}
