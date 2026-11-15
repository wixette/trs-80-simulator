// SPDX-License-Identifier: Apache-2.0
//
// Records our programs' tapes (design/v0.0.3.md, S2) into tapes/<id>.cas: each typed into a
// Model I of its own and CSAVEd, as an owner made a tape (js/sim/sample-tapes.js), so that
// nothing but the ROM's own output is on it. The page loads these files rather than
// recording in the visitor's browser, which would take seconds for a long program.
// tests/cassette.test.js checks that each file is what a fresh recording gives.
//
//     pnpm tapes            every program
//     pnpm tapes worm       just these

import { mkdirSync, writeFileSync } from "node:fs";
import { casFromTape } from "../js/sim/cassette.js";
import { recordSampleTape } from "../js/sim/sample-tapes.js";
import { SAMPLES } from "../js/sim/samples.js";
import { NO_ROM, rom } from "../tests/boot.js";

if (NO_ROM) {
  console.error(NO_ROM);
  process.exit(2);
}
const wanted = process.argv.slice(2);
mkdirSync(new URL("../tapes/", import.meta.url), { recursive: true });
for (const s of SAMPLES.filter((x) => !wanted.length || wanted.includes(x.id))) {
  const cas = casFromTape(recordSampleTape(rom(), s, s.id));
  writeFileSync(new URL(`../tapes/${s.id}.cas`, import.meta.url), cas);
  console.log(`tapes/${s.id}.cas  ${cas.length} bytes`);
}
