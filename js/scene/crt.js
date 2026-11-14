// SPDX-License-Identifier: Apache-2.0
//
// The picture on the 3D tube: the painter's canvas (js/flat/painter.js) as the emissive map
// of the tube's face, whose UVs run 0..1 across it (`display.screen`, v = 0 at the top).
// Redrawn only when the video RAM, the power or a control changed.

import * as THREE from "three";
import { Painter } from "../flat/painter.js";

/** The texture's size: 640 x 512, the picture 544 px across in it (85 %), 4:3. */
const W = 640;
const H = 512;
const MARGIN = { x: (W - 544) / 2 / W, y: (H - 408) / 2 / H };

export class Crt {
  /**
   * @param {THREE.Mesh} face the tube's face
   * @param {import("../flat/painter.js").Colours} colours
   */
  constructor(face, colours) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.painter = new Painter(this.canvas, colours, MARGIN, "#000000");
    this.colours = colours;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.anisotropy = 4;
    this.material = new THREE.MeshPhysicalMaterial({
      color: colours.glassOff,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.25,
      emissive: 0xffffff,
      emissiveMap: this.texture,
      emissiveIntensity: 0,
    });
    face.material = this.material;
    /** Something on the picture changed: redraw it on the next frame. */
    this.dirty = true;
  }

  /** @param {import("../flat/painter.js").Picture} p */
  draw(p) {
    if (!this.dirty) return;
    this.dirty = false;
    this.material.color.set(p.display ? this.colours.glassOn : this.colours.glassOff);
    this.material.emissiveIntensity = p.display ? 1.6 : 0;
    this.painter.paint(p);
    this.texture.needsUpdate = true;
  }
}
