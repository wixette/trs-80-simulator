// SPDX-License-Identifier: Apache-2.0
//
// The cassette: the format against Level II's own CSAVE, saving and loading through the
// real ROM, the recorder and its motor relay, system tapes, .wav files and our samples.
// Acceptance area TAP (design/v0.0.1.md, §6).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { casFromTape, decode, encode, Tape, tapeFromCas } from "../js/sim/cassette.js";
import { Clock } from "../js/sim/clock.js";
import { Typist } from "../js/sim/keys.js";
import { CLOCK_HZ, Machine } from "../js/sim/machine.js";
import { Recorder } from "../js/sim/recorder.js";
import { SCREEN_PROGRAM, screenProgramCas } from "../js/sim/system-samples.js";
import { byteRoles, systemTape, tapeInfo } from "../js/sim/system-tape.js";
import { parseWav, pulsesFromSound, wavFromPulses } from "../js/sim/wav.js";
import { NO_ROM, rom } from "./boot.js";

/** A Model I at READY, with a recorder on its DIN cable. */
function ready() {
  const m = new Machine({ rom: rom() });
  const deck = new Recorder();
  m.tape = deck;
  const typist = new Typist(m);
  const clock = new Clock(m, [typist]);
  m.power(true);
  /**
   * Types, and runs until typed (at most 60 s: a ROM busy with the tape reads no keys).
   * @param {string} text @param {number} [after] seconds to run after
   */
  const type = (text, after = 0.3) => {
    typist.type(text);
    for (let s = 0; typist.busy && s < 60; s += 0.01) clock.step(0.01);
    typist.clear();
    clock.step(after);
  };
  /** Runs until the computer stops the motor, or the limit. @param {number} limit seconds */
  const untilMotorOff = (limit) => {
    clock.step(0.5);
    for (let s = 0; s < limit && m.motor; s += 0.5) clock.step(0.5);
  };
  clock.step(1.5);
  type("\n");
  clock.step(1.5);
  return { m, deck, typist, clock, type, untilMotorOff, screen: () => m.screenText().filter(Boolean) };
}

/**
 * A 16-bit stereo .wav of a sound: inverted, quiet, off-centre and noisy, as a poor
 * recording might be.
 * @param {Float32Array} samples
 * @param {number} rate
 */
function poorRecording(samples, rate) {
  let seed = 1;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.04;
  const out = new Uint8Array(44 + samples.length * 4);
  const v = new DataView(out.buffer);
  /** @param {number} o @param {string} s */
  const put = (o, s) => {
    for (let k = 0; k < 4; k++) out[o + k] = s.charCodeAt(k);
  };
  put(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 4, true);
  put(8, "WAVE");
  put(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  put(36, "data");
  v.setUint32(40, samples.length * 4, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.round((-0.3 * samples[i] + 0.1 + noise()) * 32767);
    v.setInt16(44 + i * 4, s, true);
    v.setInt16(46 + i * 4, s, true);
  }
  return out;
}

/**
 * The same sound as a WAVE_FORMAT_EXTENSIBLE file of 32-bit floats, mono.
 * @param {Float32Array} samples
 * @param {number} rate
 */
function extensibleFloat(samples, rate) {
  const out = new Uint8Array(68 + samples.length * 4);
  const v = new DataView(out.buffer);
  /** @param {number} o @param {string} s */
  const put = (o, s) => {
    for (let k = 0; k < 4; k++) out[o + k] = s.charCodeAt(k);
  };
  put(0, "RIFF");
  v.setUint32(4, 60 + samples.length * 4, true);
  put(8, "WAVE");
  put(12, "fmt ");
  v.setUint32(16, 40, true);
  v.setUint16(20, 0xfffe, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 32, true);
  v.setUint16(36, 22, true); // cbSize
  v.setUint16(38, 32, true); // valid bits
  v.setUint32(40, 4, true); // channel mask
  v.setUint16(44, 3, true); // the sub-format: IEEE float
  put(60, "data");
  v.setUint32(64, samples.length * 4, true);
  for (let i = 0; i < samples.length; i++) v.setFloat32(68 + i * 4, samples[i], true);
  return out;
}

describe("TAP: the tape format", () => {
  it("TAP-1: encode and decode are inverse, from the leader on", () => {
    const bytes = [0x00, 0x00, 0xa5, 0xd3, 0x41, 0xff, 0x80, 0x01, 0x7e];
    assert.deepEqual(decode(encode(bytes, 1000)), bytes);
  });

  it("TAP-2: recording over a tape replaces what was between two positions", () => {
    const t = new Tape("t", [10, 20, 30, 40, 50]);
    t.overwrite(15, 45, [25]);
    assert.deepEqual(t.pulses, [10, 25, 50]);
  });

  it("TAP-3: a system tape round-trips: name, blocks split at 256 bytes, entry, checksums", () => {
    const data = Array.from({ length: 300 }, (_, i) => i & 0xff);
    const info = tapeInfo(systemTape("game", [{ addr: 0x5000, bytes: data }], 0x5123));
    assert.equal(info.kind, "system");
    if (info.kind !== "system") return;
    assert.equal(info.name, "GAME");
    assert.equal(info.entry, 0x5123);
    assert.deepEqual(info.blocks.map((b) => [b.addr, b.bytes.length]), [
      [0x5000, 256],
      [0x5100, 44],
    ]);
    assert.deepEqual(info.bad, []);
  });

  it("TAP-4: a bad checksum is found; a BASIC tape and noise are told apart", () => {
    const t = systemTape("X", [{ addr: 0x7000, bytes: [1, 2, 3] }], 0x7000);
    t[t.length - 4] ^= 0xff;
    const info = tapeInfo(t);
    assert.ok(info.kind === "system" && info.bad.length === 1);
    assert.deepEqual(tapeInfo([0, 0, 0xa5, 0xd3, 0xd3, 0xd3, 0x41, 0]), { kind: "basic", name: "A" });
    assert.deepEqual(tapeInfo([1, 2, 3]), { kind: "unknown" });
  });

  it("TAP-5: every byte of a recording has a role: leader, sync, header, name, blocks, end", () => {
    const roles = byteRoles(screenProgramCas()).map((r) => r.role);
    assert.equal(roles.length, screenProgramCas().length);
    assert.deepEqual([...new Set(roles)], ["leader", "sync", "systemHeader", "systemName", "blockStart", "blockCount", "blockAddrLo", "blockAddrHi", "blockData", "blockChecksum", "end", "entryLo", "entryHi"]);
    const basic = byteRoles([0, 0xa5, 0xd3, 0xd3, 0xd3, 0x41, 0x99]);
    assert.deepEqual(basic[5], { role: "basicName", name: "A" });
    assert.equal(basic[6].role, "basicProgram");
  });
});

describe("TAP: recordings cut short", () => {
  it("TAP-6: a recording cut anywhere gives one role per byte, and its information reads without throwing", () => {
    const basic = [0, 0, 0xa5, 0xd3, 0xd3, 0xd3, 0x41, 0x1e, 0x43, 0x0a, 0x00, 0xb2, 0x22, 0x48, 0x22, 0x00, 0x00, 0x00];
    for (const whole of [screenProgramCas(), new Uint8Array(basic)]) {
      for (let n = 0; n <= whole.length; n++) {
        const cut = whole.slice(0, n);
        assert.equal(byteRoles(cut).length, n, `${n} bytes`);
        assert.doesNotThrow(() => tapeInfo(cut));
      }
    }
  });
});

describe("TAP: the recorder", () => {
  it("TAP-10: the tape moves only while PLAY is down and the computer closes the relay (port FFH bit 2)", () => {
    const deck = new Recorder();
    deck.insert(new Tape("t"));
    deck.press("play", 0);
    assert.equal(deck.at(CLOCK_HZ), 0, "relay open: no movement");
    deck.setRelay(true, CLOCK_HZ);
    assert.equal(deck.at(2 * CLOCK_HZ), CLOCK_HZ, "relay closed: one second of tape");
    deck.stop(2 * CLOCK_HZ);
    assert.equal(deck.at(3 * CLOCK_HZ), CLOCK_HZ, "stopped");
    const m = new Machine();
    m.tape = deck;
    m.power(true);
    m.output(0xff, 0x04);
    assert.ok(deck.relay, "OUT (FFH) with bit 2 closes the relay");
    m.power(false);
    assert.ok(!deck.relay, "power off opens it");
  });

  it("TAP-11: REWIND and FAST-F wind whatever the relay (D16); EJECT takes the tape out", () => {
    const deck = new Recorder();
    deck.insert(tapeFromCas("t", screenProgramCas()));
    deck.press("fast", 0);
    deck.wind(1, 0);
    assert.ok(deck.at(0) > 0, "wound forward with the relay open");
    deck.press("rewind", 0);
    for (let i = 0; i < 100 && deck.mode === "rewind"; i++) deck.wind(1, 0);
    assert.equal(deck.at(0), 0);
    assert.equal(deck.mode, "stop", "the deck stops at the end of the tape");
    assert.ok(deck.eject(0));
    assert.equal(deck.tape, null);
  });

  it("TAP-14: FAST-F never winds back: from beyond the last pulse (a long play) it stops where it is", () => {
    const deck = new Recorder();
    deck.insert(tapeFromCas("t", screenProgramCas()));
    const end = deck.tape?.end ?? 0;
    deck.press("play", 0);
    deck.setRelay(true, 0);
    deck.setRelay(false, end + 10 * CLOCK_HZ); // a CLOAD that found nothing played on
    const played = deck.at(end + 10 * CLOCK_HZ);
    deck.press("fast", end + 10 * CLOCK_HZ);
    deck.wind(0.01, end + 10 * CLOCK_HZ);
    assert.ok(deck.at(0) >= played, `${deck.at(0)} < ${played}`);
    assert.equal(deck.mode, "stop");
  });

  it("TAP-15: a recording is kept by STOP, EJECT and a new tape put in; recording over a tape keeps what follows", () => {
    // over pulses at 1, 2 and 3 s, a recording from 1.5 s to 2.5 s replaces only the one at 2 s
    const tape = new Tape("t", [CLOCK_HZ, 2 * CLOCK_HZ, 3 * CLOCK_HZ]);
    const deck = new Recorder();
    deck.insert(tape);
    deck.pos = 1.5 * CLOCK_HZ;
    deck.press("record", 0);
    deck.setRelay(true, 0);
    deck.portWrite(1, 0.2 * CLOCK_HZ);
    deck.portWrite(0, 0.3 * CLOCK_HZ);
    deck.press("stop", CLOCK_HZ);
    assert.deepEqual(tape.pulses, [CLOCK_HZ, 1.7 * CLOCK_HZ, 3 * CLOCK_HZ]);
    // EJECT mid-recording commits it to the tape taken out
    const t2 = new Tape("t2");
    deck.insert(t2);
    deck.press("record", 0);
    deck.portWrite(1, 0.1 * CLOCK_HZ);
    deck.eject(0.2 * CLOCK_HZ);
    assert.deepEqual(t2.pulses, [0.1 * CLOCK_HZ]);
    // a new tape put in while recording: the recording stays on the old one
    const t3 = new Tape("t3");
    const t4 = new Tape("t4");
    deck.insert(t3);
    deck.press("record", 0);
    deck.portWrite(1, 100);
    deck.insert(t4, 200);
    deck.press("play", 300);
    assert.deepEqual(t3.pulses, [100]);
    assert.deepEqual(t4.pulses, []);
  });

  it("TAP-13: the counter counts as the tape moves, playing or winding, not only when it stops", () => {
    const deck = new Recorder();
    deck.insert(new Tape("t"));
    deck.press("play", 0);
    deck.setRelay(true, 0);
    // while the tape plays its position is read at the moment asked (at(t)), never settled
    assert.equal(deck.counterAt(0), 0);
    assert.ok(deck.counterAt(10 * CLOCK_HZ) > 0, "ten seconds in, it has counted");
    assert.ok(deck.counterAt(20 * CLOCK_HZ) > deck.counterAt(10 * CLOCK_HZ), "and goes on counting");
    deck.stop(20 * CLOCK_HZ);
    const at = deck.counterAt(20 * CLOCK_HZ);
    assert.equal(deck.counterAt(40 * CLOCK_HZ), at, "stopped, it stands");
    deck.press("rewind", 40 * CLOCK_HZ);
    for (let i = 0; i < 100 && deck.mode === "rewind"; i++) deck.wind(1, 40 * CLOCK_HZ);
    assert.equal(deck.counterAt(40 * CLOCK_HZ), 0, "rewound, it is back at 000");
    assert.ok(deck.counterAt(0) < 1000, "three digits");
  });

  it("TAP-12: PLAY with no tape stays up", () => {
    const deck = new Recorder();
    deck.press("play", 0);
    assert.equal(deck.mode, "stop");
  });
});

describe("TAP: with Level II", { skip: NO_ROM }, () => {
  it("TAP-20: CSAVE writes a leader, A5H, D3H D3H D3H, the name and the program; CLOAD reads it back", () => {
    const b = ready();
    b.deck.insert(new Tape("blank"));
    b.type("10 PRINT 1\n20 PRINT 22\n");
    b.deck.press("record", b.m.t);
    b.type('CSAVE "A"\n');
    b.untilMotorOff(20);
    b.deck.stop(b.m.t);
    const cas = casFromTape(/** @type {Tape} */ (b.deck.tape));
    let i = 0;
    while (cas[i] === 0) i++;
    assert.ok(i >= 200, `a leader of ${i} zero bytes`);
    assert.deepEqual([...cas.subarray(i, i + 5)], [0xa5, 0xd3, 0xd3, 0xd3, 0x41]);
    b.type("NEW\nLIST\n");
    assert.ok(!b.screen().includes("10 PRINT 1"));
    b.deck.press("rewind", b.m.t);
    while (b.deck.mode === "rewind") b.deck.wind(0.5, b.m.t);
    b.deck.press("play", b.m.t);
    b.type('CLOAD "A"\n');
    b.untilMotorOff(20);
    b.type("LIST\n");
    const s = b.screen();
    assert.ok(s.includes("10 PRINT 1") && s.includes("20 PRINT 22"), s.join(" | "));
  });

  it("TAP-21: a .cas file put on a tape loads with CLOAD and runs", () => {
    const a = ready();
    a.deck.insert(new Tape("blank"));
    a.type('10 PRINT "LOADED FROM TAPE"\n');
    a.deck.press("record", a.m.t);
    a.type('CSAVE "B"\n');
    a.untilMotorOff(20);
    const cas = casFromTape(/** @type {Tape} */ (a.deck.tape));
    const b = ready();
    b.deck.insert(tapeFromCas("b.cas", cas));
    b.deck.press("play", b.m.t);
    b.type("CLOAD\n");
    b.untilMotorOff(20);
    b.type("RUN\n");
    assert.ok(b.screen().includes("LOADED FROM TAPE"), b.screen().join(" | "));
  });

  it("TAP-22: SYSTEM loads a 1 KB program in four blocks, byte for byte", () => {
    const b = ready();
    let x = 12345;
    const data = Array.from({ length: 1024 }, () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) >> 16) & 0xff);
    b.deck.insert(tapeFromCas("big.cas", systemTape("BIG", [{ addr: 0x6000, bytes: data }], 0x6000)));
    b.deck.press("play", b.m.t);
    b.type("SYSTEM\n");
    b.type("BIG\n");
    b.untilMotorOff(60);
    const wrong = data.filter((v, i) => b.m.read(0x6000 + i) !== v).length;
    assert.equal(wrong, 0, `${wrong} bytes differ; screen: ${b.screen().join(" | ")}`);
    assert.match(b.screen().at(-1) ?? "", /^\*\?/, "back at the *? prompt");
  });

  it("TAP-23: our machine-code tape loads with SYSTEM, runs with /, and BREAK returns to READY", () => {
    const b = ready();
    b.deck.insert(tapeFromCas("screen.cas", screenProgramCas()));
    b.deck.press("play", b.m.t);
    b.type("SYSTEM\n");
    assert.match(b.screen().at(-1) ?? "", /^\*\?/, b.screen().join(" | "));
    b.type("SCREEN\n");
    b.untilMotorOff(30);
    const loaded = SCREEN_PROGRAM.bytes.every((v, i) => b.m.read(SCREEN_PROGRAM.addr + i) === v);
    assert.ok(loaded, `the program is at 7000H; screen: ${b.screen().join(" | ")}`);
    b.type("/\n");
    b.clock.step(0.5);
    for (let i = 0; i < 1024; i++) assert.equal(b.m.vram[i], i & 0xbf, `cell ${i}`);
    b.m.keyDown(6, 2); // BREAK
    b.clock.step(0.2);
    b.m.keyUp(6, 2);
    b.clock.step(0.5);
    assert.ok(b.screen().some((l) => l.startsWith("READY")), b.screen().join(" | "));
  });
});

describe("TAP: a long CSAVE", { skip: NO_ROM }, () => {
  it("TAP-16: a 12 KB program saved with CSAVE goes onto the tape whole, and the deck stops", () => {
    const b = ready();
    // a program of REM lines, 12 KB, put in memory as BASIC keeps it (42E9H on)
    let a = 0x42e9;
    let line = 10;
    while (a < 0x42e9 + 12 * 1024) {
      const next = a + 4 + 201 + 1;
      for (const [k, v] of [[0, next & 255], [1, next >> 8], [2, line & 255], [3, line >> 8], [4, 0x93]]) b.m.write(a + k, v);
      for (let k = 0; k < 200; k++) b.m.write(a + 5 + k, 0x58);
      b.m.write(a + 205, 0);
      a = next;
      line += 10;
    }
    b.m.write(a, 0);
    b.m.write(a + 1, 0);
    a += 2;
    for (const p of [0x40f9, 0x40fb, 0x40fd]) {
      b.m.write(p, a & 255);
      b.m.write(p + 1, a >> 8);
    }
    const tape = new Tape("long");
    b.deck.insert(tape);
    b.deck.press("record", b.m.t);
    b.type('CSAVE "L"\n');
    b.untilMotorOff(300);
    assert.ok(!b.m.motor && !b.deck.recording, "the motor stopped and the recording ended");
    assert.ok(tape.pulses.length > 124000, `${tape.pulses.length} pulses`);
    const bytes = tape.blocks()[0];
    assert.deepEqual([...bytes.slice(bytes.indexOf(0xa5), bytes.indexOf(0xa5) + 5)], [0xa5, 0xd3, 0xd3, 0xd3, 0x4c]);
    assert.ok(bytes.length > 12 * 1024);
  });
});

describe("TAP: .wav files", () => {
  it("TAP-30: a tape written as .wav reads back to the same bytes", () => {
    const cas = screenProgramCas();
    const wav = wavFromPulses(tapeFromCas("s", cas).pulses);
    assert.deepEqual(new Tape("w", pulsesFromSound(parseWav(wav))).blocks()[0], [...cas]);
  });

  it("TAP-31: reads a poor recording: inverted, quiet, off-centre, noisy, 16-bit stereo at 44.1 kHz", () => {
    const cas = screenProgramCas();
    const clean = parseWav(wavFromPulses(tapeFromCas("s", cas).pulses, 44100));
    const poor = parseWav(poorRecording(clean.samples, 44100));
    assert.equal(poor.rate, 44100);
    const bytes = new Tape("w", pulsesFromSound(poor)).blocks()[0];
    assert.deepEqual(bytes.slice(bytes.indexOf(0xa5)), [...cas].slice(cas.indexOf(0xa5)));
  });

  it("TAP-32: reads WAVE_FORMAT_EXTENSIBLE by its sub-format: 32-bit float", () => {
    const cas = screenProgramCas();
    const clean = parseWav(wavFromPulses(tapeFromCas("s", cas).pulses, 22050));
    const sound = parseWav(extensibleFloat(clean.samples, 22050));
    assert.equal(sound.rate, 22050);
    assert.deepEqual(new Tape("w", pulsesFromSound(sound)).blocks()[0], [...cas]);
  });

  it("TAP-33: refuses what is not a .wav", () => {
    assert.throws(() => parseWav(new Uint8Array(100)), /not a \.wav/);
  });

  it("TAP-34: a .wav tape loads with SYSTEM and runs", { skip: NO_ROM }, () => {
    const b = ready();
    const wav = poorRecording(parseWav(wavFromPulses(tapeFromCas("s", screenProgramCas()).pulses, 44100)).samples, 44100);
    b.deck.insert(new Tape("screen.wav", pulsesFromSound(parseWav(wav))));
    b.deck.press("play", b.m.t);
    b.type("SYSTEM\n");
    b.type(`${SCREEN_PROGRAM.name}\n`);
    b.untilMotorOff(30);
    b.type("/\n");
    b.clock.step(0.5);
    assert.ok([...b.m.vram].every((v, i) => v === (i & 0xbf)), b.screen().slice(-2).join(" | "));
  });

  // A real recording, if a visitor's own is placed in tests/.cache/ with its .cas (never committed, D7).
  const REAL_WAV = fileURLToPath(new URL(".cache/real.wav", import.meta.url));
  const REAL_CAS = fileURLToPath(new URL(".cache/real.cas", import.meta.url));
  it("TAP-35: a real recording decodes to its .cas, from the sync byte", { skip: !existsSync(REAL_WAV) && "no tests/.cache/real.wav (a local file only)" }, () => {
    const pulses = pulsesFromSound(parseWav(new Uint8Array(readFileSync(REAL_WAV))));
    const cas = [...readFileSync(REAL_CAS)];
    const bytes = new Tape("r", pulses).blocks()[0];
    const a = bytes.indexOf(0xa5);
    const b = cas.indexOf(0xa5);
    let same = 0;
    while (b + same < cas.length && bytes[a + same] === cas[b + same]) same++;
    assert.ok(same >= cas.length - b - 3, `${same} of ${cas.length - b} bytes from the sync byte`);
  });
});
