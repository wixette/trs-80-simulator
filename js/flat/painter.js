// SPDX-License-Identifier: Apache-2.0
//
// The picture on the Video Display, drawn from the video RAM into a canvas: one painter for
// the 3D tube's face (js/scene/crt.js) and the 2D view's screen (js/flat/flat.js), so the two
// can never disagree.
//
// 64 x 16 cells of 6 x 12 dots, 384 x 192 dots, on a 4:3 raster, so each dot is half as tall
// again as it is wide [rs-info video]. Each byte is drawn through the character generator as
// the hardware does it (js/sim/charset.js: xtrs's Model I set, D4; 2 x 3 blocks with bit 7
// set). In 32-column mode (port FFH bit 3) only the even columns show, each dot twice as wide.
// The Video Display's own controls set the picture: contrast (C) the phosphor's strength,
// brightness (B) the raster's glow behind it.
//
// Off, the glass is grey-green: the phosphor's coating, lit by the room, as photographs show it.
// On, it is drawn a deep green of the same hue. A lit tube cannot make its glass darker, but
// the eye adapts to the bright phosphor and sees the glass behind the text as much darker; a
// screen cannot show a tube's range of brightness, so the darker glass is drawn instead, for
// the text to be read (About says so). The text is at full strength at C's middle, about 9:1
// on the glass. The change from grey-green to deep green also says the display is on.

import { CELL_H, CELL_W, glyph } from "../sim/charset.js";
import { VIDEO } from "../sim/machine.js";

export const COLS = 64;
export const ROWS = 16;
/** The picture's dots, across and down. */
export const DOTS_W = COLS * CELL_W;
export const DOTS_H = ROWS * CELL_H;
/** The picture's shape on the tube: 4:3. */
export const PICTURE_ASPECT = 4 / 3;

/**
 * @typedef {object} Picture
 * @property {(addr: number) => number} read the video RAM as the CPU reads it (bit 6 rebuilt)
 * @property {boolean} computer the computer is on
 * @property {boolean} display the Video Display is on
 * @property {boolean} mode32
 * @property {number} contrast 0..1
 * @property {number} brightness 0..1
 */

/**
 * @typedef {object} Colours
 * @property {string} phosphor
 * @property {string} glassOff
 * @property {string} glassOn
 */

export class Painter {
  /**
   * @param {HTMLCanvasElement} canvas drawn whole: the glass, and the picture in it
   * @param {Colours} colours
   * @param {{ x: number, y: number }} [margin] the glass round the picture, as fractions of the canvas
   * @param {string} [ground] what to fill under the picture instead of the glass: black for the
   *   3D tube, where the canvas is the light the tube gives and the glass is its material
   */
  constructor(canvas, colours, margin = { x: 0.08, y: 0.08 }, ground) {
    this.canvas = canvas;
    this.colours = colours;
    this.margin = margin;
    this.ground = ground;
    /** @private the lit dots, drawn apart so that the glow adds light to them only */
    this.layer = document.createElement("canvas");
  }

  /** Where the picture is in the canvas, px. */
  get frame() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const x0 = W * this.margin.x;
    const y0 = H * this.margin.y;
    return { x0, y0, w: W - 2 * x0, h: H - 2 * y0 };
  }

  /**
   * The video RAM cell at a point of the canvas (fractions 0..1 across and down), or -1 off
   * the picture. In 32-column mode a wide character is its even cell.
   * @param {number} fx
   * @param {number} fy
   * @param {boolean} mode32
   */
  cellAt(fx, fy, mode32) {
    const { x0, y0, w, h } = this.frame;
    const col = Math.floor(((fx * this.canvas.width - x0) / w) * COLS);
    const row = Math.floor(((fy * this.canvas.height - y0) / h) * ROWS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return row * COLS + (mode32 ? col & ~1 : col);
  }

  /** @param {Picture} p @param {number} [highlight] a cell to outline (the cell inspector), or -1 */
  paint(p, highlight = -1) {
    const c = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext("2d"));
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.globalAlpha = 1;
    c.fillStyle = this.ground ?? (p.display ? this.colours.glassOn : this.colours.glassOff);
    c.fillRect(0, 0, W, H);
    if (!p.display) return;
    const { x0, y0, w, h } = this.frame;
    const dx = w / DOTS_W;
    const dy = h / DOTS_H;
    // B: the raster's glow, the picture lifting from black as it is turned up
    const glow = Math.max(0, p.brightness - 0.5) * 0.4;
    if (glow > 0) {
      c.fillStyle = `rgba(200, 215, 240, ${glow.toFixed(3)})`;
      c.fillRect(x0 - dx * 2, y0 - dy * 2, w + dx * 4, h + dy * 4);
    }
    if (!p.computer) return;
    const layer = this.layer;
    if (layer.width !== W || layer.height !== H) {
      layer.width = W;
      layer.height = H;
    }
    const l = /** @type {CanvasRenderingContext2D} */ (layer.getContext("2d"));
    l.clearRect(0, 0, W, H);
    l.fillStyle = this.colours.phosphor;
    const wide = p.mode32 ? 2 : 1;
    for (let cell = 0; cell < COLS * ROWS; cell++) {
      const col = cell % COLS;
      if (p.mode32 && col % 2) continue;
      const code = p.read(VIDEO + cell);
      if (code === 0x20 || code === 0x80) continue;
      const rows = glyph(code);
      const cx = x0 + col * CELL_W * dx;
      const cy = y0 + Math.floor(cell / COLS) * CELL_H * dy;
      for (let r = 0; r < CELL_H; r++) {
        const bits = rows[r];
        if (!bits) continue;
        // runs of lit dots as one rectangle: fewer calls, no seams between dots
        for (let d = 0; d < CELL_W; d++) {
          if (!(bits & (1 << d))) continue;
          let e = d;
          while (e + 1 < CELL_W && bits & (1 << (e + 1))) e++;
          l.fillRect(cx + d * wide * dx, cy + r * dy, (e - d + 1) * wide * dx, dy * 0.86);
          d = e;
        }
      }
    }
    // C: the phosphor's strength, full at its middle and dimmer below; above, the glow grows
    const strength = Math.min(1, 0.3 + 1.4 * p.contrast);
    const halo = 0.35 * strength + Math.max(0, p.contrast - 0.5) * 0.8;
    if ("filter" in c) {
      c.save();
      c.filter = `blur(${Math.max(1, dx * 0.9).toFixed(1)}px)`;
      c.globalAlpha = halo;
      c.globalCompositeOperation = "lighter";
      c.drawImage(layer, 0, 0);
      c.restore();
    }
    c.globalAlpha = strength;
    c.drawImage(layer, 0, 0);
    c.globalAlpha = 1;
    if (highlight >= 0) {
      // in 32-column mode a character is two cells wide, from the even one
      const col = p.mode32 ? highlight % COLS & ~1 : highlight % COLS;
      const row = Math.floor(highlight / COLS);
      c.strokeStyle = "rgba(255, 185, 92, 0.95)";
      c.lineWidth = Math.max(1.5, dx * 0.5);
      c.strokeRect(x0 + col * CELL_W * dx, y0 + row * CELL_H * dy, CELL_W * dx * (p.mode32 ? 2 : 1), CELL_H * dy);
    }
  }
}
