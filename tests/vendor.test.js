// SPDX-License-Identifier: Apache-2.0
//
// The page runs only what is in the repository (tools/vendor.mjs). These tests keep it
// honest, offline: vendor/ equals node_modules for the npm packages; every pinned file
// still has its SHA-256; every generated file is exactly what tools/vendor.mjs makes.
// tests/stamp.test.js checks the import map.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DERIVED, FETCHED, ICONS_MODULE, iconsModule, sha256, sourcePath, VENDORED, vendorPath, Z80_EXPORT } from "../tools/vendor.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("vendor/ matches the versions in package.json", () => {
  for (const [pkg, files] of Object.entries(VENDORED)) {
    for (const file of files) {
      it(`${pkg}/${file}`, () => {
        assert.ok(existsSync(vendorPath(pkg, file)), `${vendorPath(pkg, file)} is missing: run pnpm vendor`);
        assert.ok(readFileSync(vendorPath(pkg, file)).equals(readFileSync(sourcePath(pkg, file))), `${vendorPath(pkg, file)} differs from node_modules: run pnpm vendor`);
      });
    }
  }

  it("vendor/material-symbols/icons.js holds the icons listed in tools/vendor.mjs", () => {
    assert.equal(readFileSync(ICONS_MODULE, "utf8"), iconsModule(), "run pnpm vendor");
  });
});

describe("pinned files keep their SHA-256", () => {
  for (const src of FETCHED) {
    for (const [name, { sha256: want }] of Object.entries(src.files)) {
      it(`${src.dir}/${name} (${src.repo}@${src.commit.slice(0, 7)})`, () => {
        const file = join(ROOT, src.dir, name);
        assert.ok(existsSync(file), `${file} is missing: run pnpm vendor`);
        assert.equal(sha256(readFileSync(file)), want);
      });
    }
  }
});

describe("generated files are what tools/vendor.mjs makes", () => {
  for (const [file, make] of Object.entries(DERIVED)) {
    it(file, () => {
      const made = make();
      const have = readFileSync(join(ROOT, file));
      assert.ok(have.equals(Buffer.isBuffer(made) ? made : Buffer.from(made)), `${file} differs: run pnpm vendor`);
    });
  }

  it("the Z80 module is the upstream file unchanged, plus one export line (D3)", () => {
    const upstream = readFileSync(join(ROOT, "vendor/z80js/Z80.js"), "utf8");
    const module = readFileSync(join(ROOT, "vendor/z80js/z80.module.js"), "utf8");
    assert.ok(module.startsWith(upstream));
    assert.equal(module.slice(upstream.length), Z80_EXPORT);
  });

  it("Level II v1.2 is the 12 KB image roms/NOTICE names, by its SHA-256 (D2)", () => {
    const rom = readFileSync(join(ROOT, "roms/level2-v12.bin"));
    assert.equal(rom.length, 12288);
    const notice = readFileSync(join(ROOT, "roms/NOTICE"), "utf8");
    const named = notice.match(/level2-v12\.bin[\s\S]*?SHA-256\s+([0-9a-f]{64})/);
    assert.ok(named, "roms/NOTICE names level2-v12.bin's SHA-256");
    assert.equal(sha256(rom), named[1]);
  });
});
