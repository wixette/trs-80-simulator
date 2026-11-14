// SPDX-License-Identifier: Apache-2.0
//
// Reads a .glb's JSON chunk in Node, for the model's tests: its nodes, their names, extras
// and parents. No three.js.

import { readFileSync } from "node:fs";

/**
 * @typedef {{ name?: string, children?: number[], extras?: Record<string, unknown>, mesh?: number, translation?: number[] }} GltfNode
 * @typedef {{ nodes: GltfNode[], meshes: { primitives: { indices?: number }[] }[], accessors: { count: number }[] }} Gltf
 */

/** @param {string | URL} file @returns {Gltf} */
export function readGlb(file) {
  const b = readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("not a .glb");
  const len = b.readUInt32LE(12);
  if (b.readUInt32LE(16) !== 0x4e4f534a) throw new Error("the first chunk is not JSON");
  return JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
}

/** Every node's name, with its parent's index. @param {Gltf} g */
export function nodesByName(g) {
  /** @type {Map<string, { node: GltfNode, index: number, parent: number }>} */
  const out = new Map();
  /** @type {number[]} */
  const parent = new Array(g.nodes.length).fill(-1);
  g.nodes.forEach((n, i) => n.children?.forEach((c) => (parent[c] = i)));
  g.nodes.forEach((n, i) => {
    if (n.name) out.set(n.name, { node: n, index: i, parent: parent[i] });
  });
  return out;
}

/** Triangles in the whole model. @param {Gltf} g */
export function triangles(g) {
  let n = 0;
  for (const m of g.meshes) for (const p of m.primitives) if (p.indices !== undefined) n += g.accessors[p.indices].count / 3;
  return n;
}
