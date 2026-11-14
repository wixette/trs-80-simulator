// SPDX-License-Identifier: Apache-2.0
//
// Brings every third-party file the page runs into the repository, so that nothing is
// fetched at run time. Run `pnpm vendor` after changing a version or a pin below;
// tests/vendor.test.js fails while vendor/, roms/ or a generated file is out of date or
// altered.
//
// - From npm (node_modules, the versions in package.json): three.js, the Roboto Flex
//   font, and the Material Symbols the page uses, written as one module of SVG paths.
// - Not on npm, so pinned by commit and SHA-256: the Z80 core (D3), xtrs's character
//   set (D4) and the Level II ROM (D2). Each file is fetched from its repository at the
//   pinned commit, or copied from a local folder holding the same files (--from <dir>),
//   and refused either way unless it has the SHA-256 recorded here.
// - Generated from those: vendor/z80js/z80.module.js (the core with one export line
//   appended) and its types, js/sim/charset-data.js (xtrs's "CG 1"), and
//   roms/level2-v12.bin (ROM A and the used half of ROM B, joined).
//
// The decisions cited (D2, D3, D4) are in design/decisions.md.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Files the page needs, by npm package. three.js's addons import each other by relative path. */
export const VENDORED = /** @type {Record<string, string[]>} */ ({
  three: [
    "LICENSE",
    "build/three.module.js",
    "build/three.core.js",
    "examples/jsm/controls/OrbitControls.js",
    "examples/jsm/loaders/GLTFLoader.js",
    "examples/jsm/utils/BufferGeometryUtils.js",
    "examples/jsm/utils/SkeletonUtils.js", // GLTFLoader imports it
  ],
  // Roboto Flex, weight axis only, Latin subsets (English only).
  "@fontsource-variable/roboto-flex": ["LICENSE", ...["latin", "latin-ext"].map((s) => `files/roboto-flex-${s}-wght-normal.woff2`)],
  "@material-symbols/svg-400": ["LICENSE"],
});

/** Where each package goes under vendor/ (a short name for the scoped ones). */
const DIR = /** @type {Record<string, string>} */ ({
  "@fontsource-variable/roboto-flex": "roboto-flex",
  "@material-symbols/svg-400": "material-symbols",
});

/** Material Symbols the page uses (Rounded, weight 400). */
export const ICONS = [
  "check",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "construction",
  "download",
  "eject",
  "error",
  "fast_forward",
  "fast_rewind",
  "fiber_manual_record",
  "grid_on",
  "home",
  "info",
  "keyboard",
  "keyboard_arrow_down",
  "keyboard_arrow_up",
  "memory",
  "menu_book",
  "pause",
  "play_arrow",
  "power_settings_new",
  "restart_alt",
  "school",
  "skip_next",
  "stop",
  "upload_file",
  "view_in_ar",
  "visibility",
  "voicemail",
  "volume_off",
  "volume_up",
  "web_asset",
  "zoom_in",
  "zoom_out",
];

/**
 * Files pinned by commit, each with its SHA-256.
 * @type {{ dir: string, repo: string, commit: string, files: Record<string, { from: string, sha256: string }> }[]}
 */
export const FETCHED = [
  {
    dir: "vendor/z80js", // D3
    repo: "DrGoldfire/Z80.js",
    commit: "2207d7c6a8b42246ea12efbf9dba8b2adf010437",
    files: {
      "Z80.js": { from: "Z80.js", sha256: "78609811c202d717c94d2f2aaf6f540d2d5c4d0485f723dedc42bf384625637b" },
      "LICENSE.md": { from: "LICENSE.md", sha256: "d74738f928b828b0a1683d3ef2590c45088660031c2aaa007b60a10ab7293cf1" },
    },
  },
  {
    dir: "vendor/xtrs", // D4
    repo: "TimothyPMann/xtrs",
    commit: "3a2180c063811a715faa28d39a94739c33e0abd0",
    files: {
      "trs_chars.c": { from: "trs_chars.c", sha256: "1b8bbb9d63a8d598e58f64e831fc11a08f61a82e5c2eb0f631e5cc7be1464166" },
      LICENSE: { from: "LICENSE", sha256: "614367e2793a12214343dcd4fc95fc75e32fe943f103bb0c9c946070f94e4c93" },
    },
  },
  {
    dir: "roms/src", // D2; not under the repository's licence (roms/NOTICE)
    repo: "RetroStack/TRS-80-Model-I-System-ROMs",
    commit: "3f31faebde2214214acb74f87f06b836df3914d2",
    files: {
      "rom_a_L2_v12.bin": { from: "1-Option_2x64/rom_a_L2_v12.bin", sha256: "3d07912ff154dbf0174c25691fd1e4502ff6c15292202c8193a6ae89636b7fc5" },
      "rom_b_L2_v12.bin": { from: "1-Option_2x64/rom_b_L2_v12.bin", sha256: "a59d730f3ef732119f354bb571314e4530b9f707dba231a28fa89aacb57c3295" },
    },
  },
];

/** @param {Buffer | string} data */
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

/**
 * @param {string} pkg
 * @param {string} file
 */
export const sourcePath = (pkg, file) => join(ROOT, "node_modules", pkg, file);
/**
 * @param {string} pkg
 * @param {string} file
 */
export const vendorPath = (pkg, file) => join(ROOT, "vendor", DIR[pkg] ?? pkg, file);

/** The generated icon module, from the Material Symbols SVGs in node_modules. */
export const ICONS_MODULE = join(ROOT, "vendor", "material-symbols", "icons.js");

/** @returns {string} */
export function iconsModule() {
  const lines = ICONS.map((name) => {
    const svg = readFileSync(sourcePath("@material-symbols/svg-400", `rounded/${name}.svg`), "utf8");
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    if (!svg.includes('viewBox="0 -960 960 960"') || paths.length !== 1) throw new Error(`${name}: expected one path in a 0 -960 960 960 view box`);
    return `  ${JSON.stringify(name)}: ${JSON.stringify(paths[0])},`;
  });
  return `// Generated by tools/vendor.mjs (pnpm vendor) from @material-symbols/svg-400, Rounded, weight 400.
// Material Symbols are Google's, under the Apache License 2.0 (vendor/material-symbols/LICENSE).
// Do not edit: change the list in tools/vendor.mjs and run pnpm vendor.

/** One SVG path per icon, in a "0 -960 960 960" view box. */
export const ICONS = /** @type {const} */ ({
${lines.join("\n")}
});
`;
}

/** The line appended to Z80.js, which defines its function but exports nothing. */
export const Z80_EXPORT = "\nexport { Z80 };\n";

/**
 * The vendored Z80 core as an ES module: the upstream file unchanged, then one export line.
 * @param {string} upstream
 */
export const z80Module = (upstream) => upstream + Z80_EXPORT;

/**
 * Types for the vendored core, so that the type check reads these and never the upstream
 * file, which is not ours to annotate. js/sim/cpu.js is its only importer.
 */
export const Z80_TYPES = `// Generated by tools/vendor.mjs: the types of vendor/z80js/z80.module.js (design/decisions.md, D3).
export interface Z80Core {
  mem_read(address: number): number;
  mem_write(address: number, value: number): void;
  io_read(port: number): number;
  io_write(port: number, value: number): void;
}
export interface Z80State {
  b: number; a: number; c: number; d: number; e: number; h: number; l: number;
  a_prime: number; b_prime: number; c_prime: number; d_prime: number;
  e_prime: number; h_prime: number; l_prime: number;
  ix: number; iy: number; i: number; r: number; sp: number; pc: number;
  flags: { S: number; Z: number; Y: number; H: number; X: number; P: number; N: number; C: number };
  flags_prime: { S: number; Z: number; Y: number; H: number; X: number; P: number; N: number; C: number };
  imode: number; iff1: number; iff2: number; halted: boolean;
  do_delayed_di: boolean; do_delayed_ei: boolean; cycle_counter: number;
}
export interface Z80Instance {
  reset(): void;
  run_instruction(): number;
  interrupt(non_maskable: boolean, data: number): void;
  getState(): Z80State;
  setState(state: Z80State): void;
}
export declare function Z80(this: Z80Instance | void, core: Z80Core): Z80Instance;
`;

/**
 * xtrs's "CG 1" (the standard Model I character generator: no lower-case kit, with the
 * arrows) as a JavaScript module: 128 glyphs of 12 rows, each row's low 5 bits the dots,
 * bit 0 the leftmost; with xtrs's licence at its head, which its terms require.
 * @param {string} chars the text of trs_chars.c
 * @param {string} license the text of xtrs's LICENSE
 */
export function charsetModule(chars, license) {
  const start = chars.indexOf("/* CG 1 - for Model I */");
  const end = chars.indexOf("/* CG 2 - for Model I */");
  if (start < 0 || end < 0) throw new Error("trs_chars.c: CG 1 not found");
  const rows = [...chars.slice(start, end).matchAll(/\{([^{}]*)\}/g)].map((m) => m[1].split(",").map((x) => parseInt(x.trim(), 16)));
  if (rows.length !== 128 || rows.some((r) => r.length !== 12 || r.some((x) => !(x >= 0 && x < 256)))) {
    throw new Error(`trs_chars.c: CG 1 should be 128 glyphs of 12 rows, found ${rows.length}`);
  }
  const head = [
    "// Generated by tools/vendor.mjs from xtrs's trs_chars.c, \"CG 1 - for Model I\"; do not edit.",
    "// design/decisions.md, D4. The data is xtrs's, under the licence below, kept with it as",
    "// its terms require:",
    "//",
    ...license.trimEnd().split("\n").map((l) => (l ? `// ${l}` : "//")),
    "",
    "/**",
    " * The Model I's character generator (MCM6670), codes 00h-7Fh: 12 rows per glyph, the",
    " * dots in each row's low 5 bits, bit 0 leftmost. Codes 80h-FFh are not in the chip.",
    " * @type {readonly (readonly number[])[]}",
    " */",
    "export const CG1 = [",
    ...rows.map((r, i) => `  [${r.map((x) => `0x${x.toString(16).padStart(2, "0")}`).join(", ")}], // ${i.toString(16).padStart(2, "0")}h`),
    "];",
    "",
  ];
  return head.join("\n");
}

/**
 * Level II as the Model I sees it: ROM A (8 KB at 0000h) and the used half of ROM B
 * (4 KB at 2000h), 12,288 bytes.
 * @param {Buffer} romA
 * @param {Buffer} romB
 */
export function level2Rom(romA, romB) {
  if (romA.length !== 8192 || romB.length !== 8192) throw new Error("ROM A and ROM B should be 8 KB each");
  if (romB.subarray(4096).some((b) => b !== 0)) throw new Error("ROM B's upper half should be blank");
  return Buffer.concat([romA, romB.subarray(0, 4096)]);
}

/** The generated files, from the pinned ones (what tests/vendor.test.js checks). */
export const DERIVED = /** @type {Record<string, () => string | Buffer>} */ ({
  "vendor/z80js/z80.module.js": () => z80Module(readFileSync(join(ROOT, "vendor/z80js/Z80.js"), "utf8")),
  "vendor/z80js/z80.module.d.ts": () => Z80_TYPES,
  "js/sim/charset-data.js": () => charsetModule(readFileSync(join(ROOT, "vendor/xtrs/trs_chars.c"), "utf8"), readFileSync(join(ROOT, "vendor/xtrs/LICENSE"), "utf8")),
  "roms/level2-v12.bin": () => level2Rom(readFileSync(join(ROOT, "roms/src/rom_a_L2_v12.bin")), readFileSync(join(ROOT, "roms/src/rom_b_L2_v12.bin"))),
});

/**
 * One pinned file: from a local folder (searched by its name, then its path upstream), or
 * from its repository at the pinned commit.
 * @param {(typeof FETCHED)[number]} src
 * @param {string} name
 * @param {string | undefined} from a local folder, or undefined to fetch
 * @returns {Promise<Buffer>}
 */
async function pinned(src, name, from) {
  const upstream = src.files[name].from;
  if (from) {
    for (const p of [join(from, name), join(from, upstream), join(from, basename(src.dir), name)]) {
      if (existsSync(p)) return readFileSync(p);
    }
    throw new Error(`${name} not found under ${from}`);
  }
  const url = `https://raw.githubusercontent.com/${src.repo}/${src.commit}/${upstream}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [pkg, files] of Object.entries(VENDORED)) {
    rmSync(join(ROOT, "vendor", DIR[pkg] ?? pkg), { recursive: true, force: true });
    for (const file of files) {
      mkdirSync(dirname(vendorPath(pkg, file)), { recursive: true });
      copyFileSync(sourcePath(pkg, file), vendorPath(pkg, file));
    }
    process.stdout.write(`vendor/${DIR[pkg] ?? pkg}: ${files.length} files\n`);
  }
  writeFileSync(ICONS_MODULE, iconsModule());
  process.stdout.write(`vendor/material-symbols/icons.js: ${ICONS.length} icons\n`);

  const at = process.argv.indexOf("--from");
  const from = at > 0 ? process.argv[at + 1] : undefined;
  for (const src of FETCHED) {
    mkdirSync(join(ROOT, src.dir), { recursive: true });
    for (const [name, { sha256: want }] of Object.entries(src.files)) {
      const data = await pinned(src, name, from);
      const got = sha256(data);
      if (got !== want) throw new Error(`${src.dir}/${name}: SHA-256 ${got}, expected ${want}`);
      writeFileSync(join(ROOT, src.dir, name), data);
    }
    process.stdout.write(`${src.dir}: ${Object.keys(src.files).length} files, ${src.repo}@${src.commit.slice(0, 7)}, hashes checked\n`);
  }
  for (const [file, make] of Object.entries(DERIVED)) {
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    writeFileSync(join(ROOT, file), make());
    process.stdout.write(`${file}: generated\n`);
  }
}
