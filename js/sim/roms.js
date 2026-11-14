// SPDX-License-Identifier: Apache-2.0
//
// Loads Level II BASIC (design/decisions.md, D2): the copy in roms/, checked against the
// hash in roms/NOTICE, or a file the visitor chooses, read locally and never uploaded.

/** roms/level2-v12.bin's SHA-256, as roms/NOTICE gives it. */
export const LEVEL2_SHA256 = "3cd3824d2ac2743750d2179951ed812794302b885ccb4f98aa2579b352c4b00e";
export const LEVEL2_SIZE = 12288;

/** @param {Uint8Array} bytes @returns {Promise<string>} */
export async function sha256(bytes) {
  const d = await crypto.subtle.digest("SHA-256", /** @type {BufferSource} */ (bytes));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * @typedef {object} RomResult
 * @property {Uint8Array | null} rom
 * @property {"ok" | "missing" | "other"} status ok: our copy; other: a different 12 KB image; missing: none
 */

/**
 * Checks bytes as a Level II image.
 * @param {Uint8Array} bytes
 * @returns {Promise<RomResult>}
 */
export async function checkRom(bytes) {
  if (bytes.length < LEVEL2_SIZE) return { rom: null, status: "missing" };
  const rom = bytes.subarray(0, LEVEL2_SIZE);
  return { rom, status: (await sha256(rom)) === LEVEL2_SHA256 ? "ok" : "other" };
}

/**
 * Fetches the ROM from roms/, relative to this module, with this module's version stamp.
 * @returns {Promise<RomResult>}
 */
export async function loadRom() {
  const url = new URL("../../roms/level2-v12.bin", import.meta.url);
  url.search = new URL(import.meta.url).search;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return await checkRom(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return { rom: null, status: "missing" };
  }
}
