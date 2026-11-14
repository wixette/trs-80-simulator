// SPDX-License-Identifier: Apache-2.0
//
// Where the camera goes to show a view (docs/ui-design.md, U2): the subject fills a share of
// whichever side of the stage runs out first, centred, seen from the view's direction. Only
// the camera's distance and its sideways place change; its direction is the view's. Measured
// on the corners of each part's box as the camera sees them, not on a bounding sphere, which
// would leave the machine small. Plain numbers, no three.js, so the tests run it in Node.
// After the Altair 8800 simulator's js/view3d/framing.js (https://github.com/wixette/8800-simulator,
// Apache-2.0, by the same author).

/** @typedef {[number, number, number]} Vec */
/** @typedef {{ min: Vec, max: Vec }} Box */
/** The parts of the canvas the subject keeps clear of, CSS px from each edge. @typedef {{ top: number, right: number, bottom: number, left: number }} Insets */

/** @param {Vec} a @param {Vec} b @returns {Vec} */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {Vec} a @param {Vec} b @returns {Vec} */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** @param {Vec} a @param {number} s @returns {Vec} */
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** @param {Vec} a @param {Vec} b */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** @param {Vec} a @param {Vec} b @returns {Vec} */
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {Vec} a @returns {Vec} */
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l ? scale(a, 1 / l) : a;
};

/** The 8 corners of each box. @param {Box[]} boxes @returns {Vec[]} */
export function corners(boxes) {
  /** @type {Vec[]} */
  const out = [];
  for (const { min, max } of boxes) {
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  }
  return out;
}

/** The camera's axes for a direction, as three.js's lookAt() makes them with the world's up. @param {Vec} dir from the subject towards the camera */
export function axes(dir) {
  const z = unit(dir);
  let x = cross([0, 1, 0], z);
  if (dot(x, x) < 1e-12) x = [1, 0, 0]; // straight up or down: keep the world's x
  x = unit(x);
  return { x, y: cross(z, x), z };
}

/**
 * Where to put the camera so that the points, seen from a direction, fill a share of the free
 * area's limiting side, centred in it.
 * @param {Vec[]} points the subject: its parts' corners
 * @param {Vec} dir from the subject towards the camera
 * @param {number} fov the camera's vertical field of view, degrees
 * @param {number} width the canvas, CSS px
 * @param {number} height
 * @param {Insets} insets
 * @param {number} [fill] the share of the limiting side the subject fills
 * @returns {{ pos: Vec, target: Vec }}
 */
export function frame(points, dir, fov, width, height, insets, fill = 0.9) {
  const { x, y, z } = axes(dir);
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = (tanV * width) / Math.max(1, height);
  const halfX = (fill * Math.max(1, width - insets.left - insets.right)) / width;
  const halfY = (fill * Math.max(1, height - insets.top - insets.bottom)) / height;
  const centreX = (insets.left - insets.right) / width;
  const centreY = (insets.bottom - insets.top) / height;
  /** @type {Vec} */
  const lo = [Infinity, Infinity, Infinity];
  /** @type {Vec} */
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i]);
      hi[i] = Math.max(hi[i], p[i]);
    }
  }
  let target = scale(add(lo, hi), 0.5);
  const radius = Math.max(1e-6, ...points.map((p) => Math.hypot(...sub(p, target))));
  let distance = radius / Math.min(tanV * halfY, tanH * halfX);
  for (let i = 0; i < 60; i++) {
    const camera = add(target, scale(z, distance));
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const v = sub(p, camera);
      const depth = Math.max(1e-6, -dot(v, z));
      const u = dot(v, x) / (depth * tanH);
      const w = dot(v, y) / (depth * tanV);
      minX = Math.min(minX, u);
      maxX = Math.max(maxX, u);
      minY = Math.min(minY, w);
      maxY = Math.max(maxY, w);
    }
    // centre the silhouette on the free area, moving the camera and its target together...
    const offX = (minX + maxX) / 2 - centreX;
    const offY = (minY + maxY) / 2 - centreY;
    target = add(target, add(scale(x, offX * distance * tanH), scale(y, offY * distance * tanV)));
    // ...and size it to the limiting side: it goes as 1 / distance
    const s = Math.max((maxX - minX) / (2 * halfX), (maxY - minY) / (2 * halfY));
    if (Math.abs(s - 1) < 1e-5 && Math.abs(offX) < 1e-5 && Math.abs(offY) < 1e-5) break;
    distance *= s;
  }
  return { pos: add(target, scale(z, distance)), target };
}

/**
 * Where points land on the canvas, seen from a camera: for the tests, to measure a framing.
 * @param {Vec[]} points @param {{ pos: Vec, target: Vec }} camera @param {number} fov @param {number} width @param {number} height
 */
export function silhouette(points, camera, fov, width, height) {
  const { x, y, z } = axes(sub(camera.pos, camera.target));
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = (tanV * width) / Math.max(1, height);
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    const v = sub(p, camera.pos);
    const depth = -dot(v, z);
    const px = ((dot(v, x) / (depth * tanH) + 1) / 2) * width;
    const py = ((1 - dot(v, y) / (depth * tanV)) / 2) * height;
    left = Math.min(left, px);
    right = Math.max(right, px);
    top = Math.min(top, py);
    bottom = Math.max(bottom, py);
  }
  return { left, right, top, bottom };
}
