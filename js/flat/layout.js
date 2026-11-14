// SPDX-License-Identifier: Apache-2.0
//
// The 2D view's geometry (docs/ui-design.md, U10), apart from the DOM so the tests can hold it:
//
// - displayLayout: the Video Display's front as the 2D view draws it. Readability first: the
//   glass is larger than on the machine, the black rim, the margins round it, the right-hand
//   panel and the band under the case are trimmed to make room, at the monitor's own width.
//   The 3D model keeps the measured proportions (model/params/machine.json); this keeps their
//   order and their shapes, not their sizes.
// - fitFlat: how big each drawing is on the stage. The display and the keyboard are drawn at
//   one scale, as they stand on the desk, so the keyboard is no wider than it is beside the
//   monitor; the display takes as much of the stage as that leaves. The recorder is small
//   beside them, and its printing smaller still, so it is drawn larger: as tall as the display,
//   beside it. On an upright phone the keyboard takes the stage's width, as its keys must be
//   tapped.

/** @param {{ v: any } | any} p a parameter: its value */
const v = (p) => (p && typeof p === "object" && "v" in p ? p.v : p);

/** @typedef {{ x0: number, x1: number, z0: number, z1: number, r: number }} Rect a box on the front, mm: x across from the centre, z up from the case's bottom */

/**
 * The display's front, in mm, for the 2D view.
 * @param {any} d model/params/machine.json's video_display
 */
export function displayLayout(d) {
  const W = v(d.width);
  const fc = d.front_controls;
  const tf = d.tube_face;
  const [tx0, tx1] = v(tf.x);
  const [tz0, tz1] = v(tf.z);
  /** the glass's shape, as measured */
  const faceAspect = (tx1 - tx0) / (tz1 - tz0);
  const [nx0, nx1] = v(d.nameplate.x);
  const [nz0, nz1] = v(d.nameplate.z);
  const [vx0, vx1] = v(d.vent_grille.x);
  const [so0, so1] = v(d.screen_opening.x);
  // the trims, mm: what is left round the glass
  const edge = 6; // the silver round the brown front (9 on the machine)
  const lower = 30; // the silver band under the brown front, with the vents and C, B, V (50)
  const base = 8; // the plinth (15)
  const pad = 10; // the brown round the black opening (about 20)
  const rim = 5; // the black round the glass (about 11)
  const panelW = 58; // the right-hand panel (75)
  const panelGap = 8; // between the opening and the panel (11)
  const panelPad = 8; // between the panel and the brown's right edge (14)
  const brown = { x0: -W / 2 + edge, x1: W / 2 - edge, z0: lower, z1: 0, r: 8 };
  const panel = { x0: brown.x1 - panelPad - panelW, x1: brown.x1 - panelPad, z0: 0, z1: 0, r: v(d.right_panel.corner_radius) };
  const opening = { x0: brown.x0 + pad, x1: panel.x0 - panelGap, z0: lower + pad, z1: 0, r: 0 };
  const faceW = opening.x1 - opening.x0 - 2 * rim;
  const faceH = faceW / faceAspect;
  opening.z1 = opening.z0 + faceH + 2 * rim;
  // the glass's corners rounder than the picture's need, but no more: the picture's own corners
  // stay inside the rounded glass (pictureMargin)
  const face = { x0: opening.x0 + rim, x1: opening.x1 - rim, z0: opening.z0 + rim, z1: opening.z1 - rim, r: FACE_RADIUS };
  opening.r = face.r + rim * 0.6;
  brown.z1 = opening.z1 + pad;
  // the silver shell is a tray with no top: its sides and the band under the front, the dark
  // front running up to the case's top edge, as on the machine
  const body = brown.z1;
  const H = body + base;
  // the right-hand panel: the word Power, the button, then the raised platform and its plate
  const cx = (panel.x0 + panel.x1) / 2;
  // the button a little smaller than the machine's, to sit with the trimmed panel; room above
  // it for the word Power, and below it before the platform
  const button = { x: cx, z: opening.z1 - 27, r: v(d.power_button.radius) * BUTTON_SCALE };
  const label = { x: cx, z: button.z + 16, size: v(d.power_label.height) * 1.6, text: d.power_label.text };
  panel.z0 = opening.z0;
  panel.z1 = button.z - 17;
  const plateW = panelW - 8;
  const plateH = (plateW * (nz1 - nz0)) / (nx1 - nx0);
  const plate = { x0: cx - plateW / 2, x1: cx + plateW / 2, z1: panel.z1 - 5, z0: panel.z1 - 5 - plateH, r: 2 };
  // the vents, under the opening as on the machine; C, B and V under the panel
  const vents = { x0: opening.x0 + (vx0 - so0), x1: opening.x1 - (so1 - vx1), z0: 5, z1: lower - 6, pitch: v(d.vent_grille.pitch) };
  const kz = lower / 2 - 2;
  const knobs = [-25.5, 0, 24.9].map((dx) => /** @type {[number, number]} */ ([cx + dx, kz]));
  const letters = { text: /** @type {string[]} */ (v(fc.letters)), z: kz + v(fc.letters.z_above) * 0.8, size: v(fc.letters.height) * 1.6 };
  return { W, H, base: { h: base, inset: v(d.base.inset) }, brown, opening, face, panel, plate, button, label, vents, knobs, letters, bushing: /** @type {[number, number]} */ (v(fc.bushing_radius)), ring: { silver: v(d.power_button.silver_ring)[1] * BUTTON_SCALE, casing: v(d.power_button.casing_ring)[1] * BUTTON_SCALE } };
}

/** The glass's corner radius in the 2D drawing, mm. */
const FACE_RADIUS = 30;
/** The display's POWER button and its rings, against the machine's. */
const BUTTON_SCALE = 0.8;
/** The glass round the picture, across, as a share of the glass's width. */
export const PICTURE_MARGIN_X = 0.06;

/**
 * The picture's margins in the glass, as shares of the glass's width and height: across as
 * given, down whatever keeps the picture 4:3.
 * @param {DisplayLayout} L
 * @param {number} aspect the picture's width over its height
 */
export function pictureMargin(L, aspect) {
  const w = L.face.x1 - L.face.x0;
  const h = L.face.z1 - L.face.z0;
  const picH = (w * (1 - 2 * PICTURE_MARGIN_X)) / aspect;
  return { x: PICTURE_MARGIN_X, y: Math.max(0.02, (1 - picH / h) / 2) };
}

/** @typedef {ReturnType<typeof displayLayout>} DisplayLayout */

/** On an upright phone, the least share of the height the display keeps beside a full-width keyboard. */
const DISPLAY_SHARE = 0.45;

/**
 * How wide each drawing is on the stage, px.
 * @param {object} o
 * @param {number} o.width the room, px
 * @param {number} o.height
 * @param {number} o.gap between the rows, and between the display and the recorder, px
 * @param {{ w: number, h: number }} o.display its size in mm
 * @param {{ w: number, h: number } | null} o.recorder its size in mm, or null while its drawer is closed
 * @param {{ w: number, h: number } | null} o.keyboard its size in mm, or null while its drawer is closed (or open over the display)
 * @param {boolean} [o.fullKeyboard] the keyboard takes the whole width (an upright phone)
 * @returns {{ display: number, recorder: number, keyboard: number }}
 */
export function fitFlat(o) {
  const { width, height, gap, display: d, recorder: r, keyboard: k } = o;
  /** the recorder's width per px of the display's: as tall as the display */
  const recShare = r ? (d.h / d.w) * (r.w / r.h) : 0;
  // across: the display, and the recorder beside it
  const across = (width - (r ? gap : 0)) / (1 + recShare);
  // down: the top row (the display, the recorder as tall), then the keyboard
  const topH = d.h / d.w; // px of height per px of the display's width
  let down;
  let keyboard = 0;
  if (k && o.fullKeyboard) {
    // the stage's width, while that leaves the display at least its share of the height
    keyboard = Math.min(width, ((height - gap) * (1 - DISPLAY_SHARE) * k.w) / k.h);
    down = (height - gap - (keyboard * k.h) / k.w) / topH;
  } else if (k) {
    down = (height - gap) / (topH + k.h / d.w);
  } else down = height / topH;
  // never more than fits: a short stage draws everything smaller rather than overflowing
  const display = Math.max(1, Math.min(across, down));
  if (k && !o.fullKeyboard) keyboard = Math.min(width, (display * k.w) / d.w);
  return { display, recorder: display * recShare, keyboard };
}
