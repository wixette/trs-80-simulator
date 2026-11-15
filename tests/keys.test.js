// SPDX-License-Identifier: Apache-2.0
//
// The visitor's keyboard as the Model I's (docs/ui-design.md, U5), and the typist (D15):
// acceptance area KEY.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HostKeys, READ_MAX_T } from "../js/sim/host-keys.js";
import { KEY_DOWN_T, KEY_UP_T, Typist } from "../js/sim/keys.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { NO_ROM, ready, rom } from "./boot.js";

/** A matrix that only records its switches. */
function matrix() {
  const rows = new Array(8).fill(0);
  return {
    rows,
    t: 0,
    /** @param {number} r @param {number} b */
    keyDown(r, b) {
      rows[r] |= 1 << b;
    },
    /** @param {number} r @param {number} b */
    keyUp(r, b) {
      rows[r] &= ~(1 << b);
    },
  };
}

describe("KEY: the visitor's keyboard", () => {
  it("KEY-10: a key is held as long as it is held, and several at once", () => {
    const m = matrix();
    const h = new HostKeys(m);
    h.down({ key: "ArrowLeft", code: "ArrowLeft" });
    h.down({ key: " ", code: "Space" });
    m.t = 10 * KEY_DOWN_T;
    h.down({ key: "ArrowLeft", code: "ArrowLeft", repeat: true });
    h.tick();
    assert.equal(m.rows[6], (1 << 5) | (1 << 7), "LEFT and SPACE both down");
    h.up({ key: "ArrowLeft", code: "ArrowLeft" });
    assert.equal(m.rows[6], 1 << 7, "LEFT up, SPACE still down");
  });

  it("KEY-11: a quick tap stays down for KEY_DOWN_T of machine time", () => {
    const m = matrix();
    const h = new HostKeys(m);
    h.down({ key: "a", code: "KeyA" });
    m.t = 100;
    h.up({ key: "a", code: "KeyA" });
    h.tick();
    assert.equal(m.rows[0] & 2, 2, "A still down");
    assert.equal(h.next(), KEY_DOWN_T - 100);
    m.t = KEY_DOWN_T;
    h.tick();
    assert.equal(m.rows[0], 0, "A up");
  });

  it("KEY-12: SHIFT is worked out from the character, not copied from the visitor's Shift", () => {
    const m = matrix();
    const h = new HostKeys(m);
    h.down({ key: "Shift", code: "ShiftLeft" });
    assert.equal(m.rows[7] & 1, 1, "Shift alone holds SHIFT");
    h.down({ key: "@", code: "Digit2" }); // a US keyboard's Shift 2
    assert.equal(m.rows[7] & 1, 0, "SHIFT up for @, unshifted on the Model I");
    assert.equal(m.rows[0] & 1, 1, "@ down");
    m.t = KEY_DOWN_T;
    h.up({ key: "@", code: "Digit2" });
    h.down({ key: '"', code: "Quote" });
    assert.equal(m.rows[4] & (1 << 2), 0, "waits KEY_UP_T after @ was let go (D17)");
    m.t += KEY_UP_T;
    h.tick();
    assert.equal(m.rows[4] & (1 << 2), 1 << 2, "2 down");
    assert.equal(m.rows[7] & 1, 1, 'SHIFT down for ", SHIFT 2 on the Model I');
    h.releaseAll();
    assert.deepEqual(m.rows, [0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("KEY-13: Esc is BREAK, Delete and Home are CLEAR, Backspace is ←, Enter is ENTER", () => {
    const h = new HostKeys(matrix());
    assert.deepEqual(h.lookup({ key: "Escape" }), { row: 6, bit: 2, shift: null });
    assert.deepEqual(h.lookup({ key: "Delete" }), { row: 6, bit: 1, shift: null });
    assert.deepEqual(h.lookup({ key: "Home" }), { row: 6, bit: 1, shift: null });
    assert.deepEqual(h.lookup({ key: "Backspace" }), { row: 6, bit: 5, shift: null });
    assert.deepEqual(h.lookup({ key: "Enter" }), { row: 6, bit: 0, shift: null });
  });

  it("KEY-14: a key the Model I lacks is refused", () => {
    const h = new HostKeys(matrix());
    assert.equal(h.down({ key: "[", code: "BracketLeft" }), false);
    assert.equal(h.down({ key: "F1", code: "F1" }), false);
  });

  it("KEY-15: typing on the visitor's keyboard reaches Level II as a person's would", { skip: NO_ROM }, () => {
    const m = new Machine({ rom: rom() });
    const h = new HostKeys(m);
    m.power(true);
    /** @param {number} s */
    const run = (s) => {
      const end = m.t + s * CLOCK_HZ;
      while (m.t < end) {
        h.tick();
        m.run(Math.min(CLOCK_HZ / 1000, h.next()) || 1);
      }
    };
    /** Each key 60 ms down, then 60 ms before the next, Shift around the shifted ones. @param {string} text */
    const type = (text) => {
      for (const c of text) {
        const shifted = c === '"' || c === "+";
        const e = { key: c === "\n" ? "Enter" : c, code: `K${c}` };
        if (shifted) h.down({ key: "Shift", code: "ShiftLeft" });
        h.down(e);
        run(0.06);
        h.up(e);
        if (shifted) h.up({ key: "Shift", code: "ShiftLeft" });
        run(0.06);
      }
    };
    run(1.5);
    type("\n");
    run(1.5);
    type('PRINT "A@"2+2\n');
    run(0.5);
    assert.ok(m.screenText().includes("A@ 4"), m.screenText().filter(Boolean).join(" | "));
  });
});

describe("KEY: fast typing", () => {
  it("KEY-16: keys tapped faster than the debounce wait their turn, and all reach Level II (D17)", { skip: NO_ROM }, () => {
    const m = new Machine({ rom: rom() });
    const h = new HostKeys(m);
    m.power(true);
    /** @param {number} s */
    const run = (s) => {
      const end = m.t + s * CLOCK_HZ;
      while (m.t < end) {
        h.tick();
        m.run(Math.min(CLOCK_HZ / 1000, h.next()) || 1);
      }
    };
    run(1.5);
    h.down({ key: "Enter", code: "Enter" });
    h.up({ key: "Enter", code: "Enter" });
    run(1.5);
    // every key down and up within the same millisecond, as a script or a very fast typist
    for (const c of "PRINT 6*7+22") {
      const e = { key: c === " " ? " " : c.toLowerCase(), code: `K${c}` };
      const code = { "*": "Digit8", "+": "Equal" }[c] ?? e.code;
      const shifted = c === "*" || c === "+";
      if (shifted) h.down({ key: "Shift", code: "ShiftLeft" });
      h.down({ ...e, code });
      h.up({ ...e, code });
      if (shifted) h.up({ key: "Shift", code: "ShiftLeft" });
      run(0.001);
    }
    h.down({ key: "Enter", code: "Enter" });
    h.up({ key: "Enter", code: "Enter" });
    run(3);
    assert.ok(m.screenText().includes(" 64"), m.screenText().filter(Boolean).join(" | "));
  });

  it("KEY-18: a key let go before the program read its row stays down until it does, for up to READ_MAX_T; and holds up no other key", () => {
    const m = { ...matrix(), rowScanT: new Array(8).fill(-1) };
    const h = new HostKeys(m);
    h.down({ key: "ArrowUp", code: "ArrowUp" });
    m.t = 2 * KEY_DOWN_T;
    h.up({ key: "ArrowUp", code: "ArrowUp" });
    h.tick();
    assert.equal(m.rows[6] & 8, 8, "UP still down: the game has not read row 6 since");
    h.down({ key: "ArrowDown", code: "ArrowDown" });
    assert.equal(m.rows[6] & 16, 16, "DOWN goes down at once: a key waiting to be read holds up none");
    m.t += 1000;
    m.rowScanT[6] = m.t;
    h.tick();
    assert.equal(m.rows[6] & 8, 0, "read once, UP is let go");
    h.down({ key: "a", code: "KeyA" });
    m.t += KEY_DOWN_T;
    h.up({ key: "a", code: "KeyA" });
    h.tick();
    assert.equal(m.rows[0] & 2, 2, "A waits for row 0 to be read");
    m.t += READ_MAX_T;
    h.tick();
    assert.equal(m.rows[0] & 2, 0, "and is let go after READ_MAX_T if it never is");
  });

  it("KEY-19: quick taps between a BASIC game's reads all reach it, once each", { skip: NO_ROM }, () => {
    const b = ready();
    const h = new HostKeys(b.m);
    b.clock.add(h);
    // a game that reads the arrows' row once in about half a second, and counts UP
    b.type("10 IF PEEK(14400) AND 8 THEN N=N+1\n20 FOR D=1 TO 150:NEXT D:GOTO 10\nRUN\n", 0.5);
    for (let i = 0; i < 5; i++) {
      h.down({ key: "ArrowUp", code: "ArrowUp" });
      b.run(0.03);
      h.up({ key: "ArrowUp", code: "ArrowUp" });
      b.run(0.9 + i * 0.13);
    }
    b.m.keyDown(6, 2); // BREAK
    b.run(0.2);
    b.m.keyUp(6, 2);
    b.type("PRINT N\n");
    assert.ok(b.screen().includes(" 5"), b.screen().join(" | "));
  });

  it("KEY-17: keys held together are down together (a game's arrow and SPACE)", () => {
    const m = matrix();
    const h = new HostKeys(m);
    h.down({ key: "ArrowRight", code: "ArrowRight" });
    m.t = 2 * KEY_DOWN_T;
    h.down({ key: " ", code: "Space" });
    assert.equal(m.rows[6], (1 << 6) | (1 << 7));
  });
});

describe("KEY: the typist", () => {
  it("KEY-20: lower case is typed as capitals; a character the Model I lacks is named", () => {
    const t = new Typist({ ...matrix(), scanT: 0, anyScanT: 0, rowScanT: new Array(8).fill(0) });
    assert.deepEqual(t.untypable("print [x]"), ["[", "]"]);
    assert.equal(t.type("ab"), 2);
  });

  it("KEY-21: clear() drops what is queued and opens every switch it closed", () => {
    const m = { ...matrix(), scanT: 0, anyScanT: 0, rowScanT: new Array(8).fill(0) };
    const t = new Typist(m);
    t.type('"');
    t.tick();
    assert.ok(m.rows[7] & 1);
    t.clear();
    assert.deepEqual(m.rows, [0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(t.busy, false);
  });
});
