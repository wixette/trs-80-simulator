// SPDX-License-Identifier: Apache-2.0
//
// The desk in 3D, bound to the desk's state (js/sim/system.js): the model's nodes
// (model/README.md, the node contract) move and light as the machine does, and clicks on
// them work the machine through the same calls as every other view (docs/ui-design.md, P2).
//
// - Keys go down while pressed, by hand or by the program's typist; a click holds a key, and
//   SHIFT clicked latches for the next key (U5).
// - POWER, RESET and the Video Display's POWER button work where they are; C and B turn by a
//   drag sideways or the wheel.
// - The recorder's keys latch as the deck's do; its door lifts to take a cassette in or out;
//   the reels turn while the tape moves.
// - Taking it apart: a click on a unit with the computer off (U3); the units move as the
//   system says they are (System.motion), the main board lifting, coming forward and turning
//   over.
// - See inside: the case as glass; the chips lit by their share of the memory traffic (U2), a
//   view the real machine never had.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** @typedef {import("../sim/system.js").System} System */
/** @typedef {import("./viewer.js").Viewer} Viewer */
/** @typedef {import("../sim/system.js").DeckKey} DeckKey */

/** A node by its name in the model (GLTFLoader drops the dots from names). @param {string} name */
const nodeName = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

/** The units that come out, by the System's name, and the nodes that move with each. */
const MOVERS = /** @type {Record<string, string[]>} */ ({
  cables: ["cable.video", "cable.tape", "cable.power"],
  "case.top": ["case.top"],
  keyboard: ["keyboard"],
  "board.main": ["board.main"],
});
/** The case, turned to glass by See inside. */
const GHOSTED = ["case.top", "case.bottom", "case.feet", "case.din_panel"];
/** The deck's keys, by the System's names. @type {DeckKey[]} */
const DECK_KEYS = ["record", "rewind", "play", "fastf", "stop", "eject"];
/** The main board turns over about this point, m (the model's frame). */
const BOARD_PIVOT = new THREE.Vector3(0, 0.02, -0.0075);
const DOOR_OPEN_RAD = THREE.MathUtils.degToRad(-38);
/** How long the door takes to open, stay open, and close, as a cassette goes in or out, s. */
const DOOR_S = [0.25, 0.5, 0.3];

/**
 * @typedef {object} Hover what the pointer is over, for the stage's label
 * @property {string} node the model's node name of the part, e.g. "part.z40", "key.a"
 * @property {string} label its build label (label_en), a fallback for the page's message
 * @property {"press" | "toggle" | "turn" | "takeOut" | "putBack" | "none"} action what a click does
 */

/**
 * @typedef {object} DeskEvents
 * @property {(h: Hover | null, x: number, y: number) => void} [hover]
 * @property {(node: string) => void} [info] a click on a part that does nothing: its name, to say
 * @property {() => void} [screenDoubleClick]
 */

export class Desk3D {
  /**
   * Loads the model and binds it.
   * @param {Viewer} viewer
   * @param {System} system
   * @param {URL} model the .glb
   * @param {{ glow: Record<"cpu" | "rom" | "ram" | "video", string> }} colours
   * @param {(f: number) => void} [progress] 0..1 while it loads
   */
  static async load(viewer, system, model, colours, progress) {
    const gltf = await new GLTFLoader().loadAsync(model.href, (e) => e.total && progress?.(e.loaded / e.total));
    return new Desk3D(viewer, system, gltf.scene, colours);
  }

  /**
   * @param {Viewer} viewer
   * @param {System} system
   * @param {THREE.Object3D} root
   * @param {{ glow: Record<"cpu" | "rom" | "ram" | "video", string> }} colours
   */
  constructor(viewer, system, root, colours) {
    this.viewer = viewer;
    this.system = system;
    this.root = root;
    /** @type {DeskEvents} */
    this.on = {};
    root.traverse((o) => {
      const m = /** @type {THREE.Mesh} */ (o);
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (mat.name === "door_window") {
          mat.transparent = true;
          mat.opacity = 0.28;
          mat.depthWrite = false;
        }
      }
    });
    viewer.scene.add(root);
    /** The tube's face, for the CRT's texture. */
    this.screen = /** @type {THREE.Mesh} */ (this.node("display.screen"));

    // keys: the 65 caps, each with its row and bit
    /** @type {{ obj: THREE.Object3D, base: THREE.Vector3, axis: THREE.Vector3, travel: number, row: number, bit: number, name: string, down: number }[]} */
    this.keys = [];
    root.traverse((o) => {
      if (o.userData.matrix_row === undefined) return;
      const ax = /** @type {number[]} */ (o.userData.axis ?? [0, -1, 0]);
      this.keys.push({
        obj: o, base: o.position.clone(), axis: new THREE.Vector3(...ax).normalize(), travel: (o.userData.travel ?? 3.5) / 1000,
        row: o.userData.matrix_row, bit: o.userData.matrix_bit, name: o.userData.key_name, down: 0,
      });
    });
    /** SHIFT clicked: down until the next key is let go. */
    this.shiftLatched = false;

    this.led = this.ownMaterial(this.node("led.power"));
    /** @private @type {{ obj: THREE.Object3D, base: THREE.Vector3, axis: THREE.Vector3, travel: number }[]} */
    this.pushers = ["button.power", "display.power_button"].map((n) => {
      const obj = this.node(n);
      // the model's extras are in glTF's frame: Y up, +Z towards the front
      const ax = /** @type {number[]} */ (obj.userData.axis ?? [0, 0, 1]);
      return { obj, base: obj.position.clone(), axis: new THREE.Vector3(...ax).normalize(), travel: (obj.userData.travel ?? 2) / 1000 };
    });
    this.resetButton = this.node("button.reset");
    this.resetBase = this.resetButton.position.clone();
    /** @private */
    this.resetUntil = 0;
    this.knobs = {
      contrast: this.node("display.control.contrast"),
      brightness: this.node("display.control.brightness"),
    };
    /** @private @type {Map<DeckKey, { obj: THREE.Object3D, rest: number, travel: number }>} */
    this.deckKeys = new Map(DECK_KEYS.map((id) => {
      const obj = this.node(`recorder.key.${id}`);
      return [id, { obj, rest: obj.position.y, travel: (obj.userData.travel ?? 3) / 1000 }];
    }));
    /** @private a key tapped: down for a moment, then up (STOP, EJECT spring back) */
    this.tapped = { id: "", until: 0 };
    this.door = this.node("recorder.door");
    this.doorRest = this.door.quaternion.clone();
    this.doorAxis = new THREE.Vector3(...(this.door.userData.axis ?? [1, 0, 0])).normalize();
    this.cassette = this.node("recorder.cassette");
    this.cassette.visible = !!system.deck.tape;
    /** @private the cassette last shown in the door */
    this.tapeShown = system.deck.tape;
    /** @private @type {{ start: number, show: boolean } | null} */
    this.doorMove = null;
    this.reels = ["recorder.reel.left", "recorder.reel.right"].map((n) => {
      const o = this.node(n);
      return { o, rest: o.quaternion.clone(), axis: new THREE.Vector3(...(o.userData.axis ?? [0, 1, 0])).normalize(), angle: 0 };
    });

    // the units that come out, and their paths (the model's extras: mm, in glTF's frame)
    /** @private @type {Map<THREE.Object3D, { base: THREE.Vector3, path: THREE.Vector3[], flip: boolean }>} */
    this.paths = new Map();
    /** @type {Map<THREE.Object3D, string>} the top node of each unit, to its name */
    this.unitOf = new Map();
    for (const [unit, names] of Object.entries(MOVERS)) {
      for (const n of names) {
        const o = this.node(n);
        const flat = /** @type {number[]} */ (o.userData.path ?? [0, 0, 0]);
        /** @type {THREE.Vector3[]} */
        const pts = [];
        for (let i = 0; i < flat.length; i += 3) pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).multiplyScalar(0.001));
        this.paths.set(o, { base: o.position.clone(), path: pts, flip: !!o.userData.flip });
        this.unitOf.set(o, unit);
      }
    }
    this.ribbon = this.node("cable.ribbon");

    // the chips, lit (a view the real machine never had)
    const glow = (/** @type {string[]} */ names, /** @type {string} */ c) => names.flatMap((n) => this.ownMaterials(this.node(n), c));
    this.cpuMats = glow(["part.z40"], colours.glow.cpu);
    this.romAMats = glow(["part.z33"], colours.glow.rom);
    this.romBMats = glow(["part.z34"], colours.glow.rom);
    this.ramMats = glow(["z13", "z14", "z15", "z16", "z17", "z18", "z19", "z20"].map((z) => `part.${z}`), colours.glow.ram);
    this.videoMats = glow(["z45", "z46", "z47", "z48", "z61", "z62", "z63"].map((z) => `part.${z}`), colours.glow.video);
    /** @private eased glow levels */
    this.levels = { romA: 0, romB: 0, ram: 0, video: 0 };

    /** See inside: the case as glass. */
    this.seeInside = false;
    /** @private @type {Map<THREE.Mesh, THREE.Material | THREE.Material[]>} */
    this.solid = new Map();

    this.bindPointer();
    viewer.onFrame.push((dt) => this.tick(dt));
  }

  /** A node by its name in the model. @param {string} name */
  node(name) {
    const o = this.root.getObjectByName(nodeName(name));
    if (!o) throw new Error(`the model has no ${name}`);
    return o;
  }

  /**
   * A part's box in the world, where it is now, for framing a view (js/scene/framing.js).
   * @param {string} name
   * @returns {{ min: [number, number, number], max: [number, number, number] }}
   */
  box(name) {
    this.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(this.node(name));
    return { min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] };
  }

  /** @private A mesh's material, cloned so that it can light on its own. @param {THREE.Object3D} o */
  ownMaterial(o) {
    const m = /** @type {THREE.Mesh} */ (o);
    const mat = /** @type {THREE.MeshStandardMaterial} */ (/** @type {THREE.MeshStandardMaterial} */ (m.material).clone());
    m.material = mat;
    return mat;
  }

  /**
   * @private Every material under a node, cloned, with an emissive colour at 0.
   * @param {THREE.Object3D} node
   * @param {string} colour
   * @returns {THREE.MeshStandardMaterial[]}
   */
  ownMaterials(node, colour) {
    /** @type {THREE.MeshStandardMaterial[]} */
    const out = [];
    node.traverse((o) => {
      const m = /** @type {THREE.Mesh} */ (o);
      if (!m.isMesh) return;
      const list = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = /** @type {THREE.MeshStandardMaterial} */ (x.clone());
        c.emissive = new THREE.Color(colour);
        c.emissiveIntensity = 0;
        out.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? list : list[0];
    });
    return out;
  }

  // ---- each frame ---------------------------------------------------------------------------

  /** @private @param {number} dt */
  tick(dt) {
    const s = this.system;
    const m = s.machine;
    // keys: down while their switch is closed
    for (const k of this.keys) {
      const target = m.rows[k.row] & (1 << k.bit) ? 1 : 0;
      k.down += (target - k.down) * Math.min(1, dt * 30);
      k.obj.position.copy(k.base).addScaledVector(k.axis, k.travel * k.down);
    }
    this.led.emissive.set(m.powered ? 0xff2a10 : 0x000000);
    this.led.emissiveIntensity = m.powered ? 2.5 : 0;
    const [pc, pd] = this.pushers;
    pc.obj.position.copy(pc.base).addScaledVector(pc.axis, m.powered ? pc.travel * 0.75 : 0);
    pd.obj.position.copy(pd.base).addScaledVector(pd.axis, s.display.on ? pd.travel * 0.75 : 0);
    this.resetButton.position.z = this.resetBase.z + (performance.now() < this.resetUntil ? 0.001 : 0);
    for (const which of /** @type {const} */ (["contrast", "brightness"])) this.knobs[which].rotation.z = (s.display[which] - 0.5) * Math.PI * 1.5;
    this.tickDeck(dt);
    this.tickApart();
    this.tickGlow(dt);
  }

  /** @private @param {number} dt */
  tickDeck(dt) {
    const d = this.system.deck;
    const mode = d.mode;
    const down = new Set(mode === "record" ? ["record", "play"] : mode === "play" ? ["play"] : mode === "rewind" ? ["rewind"] : mode === "fast" ? ["fastf"] : []);
    if (performance.now() < this.tapped.until) down.add(this.tapped.id);
    for (const [id, k] of this.deckKeys) {
      const target = k.rest - (down.has(id) ? k.travel : 0);
      k.obj.position.y += (target - k.obj.position.y) * Math.min(1, dt * 25);
    }
    // a cassette in or out: the door lifts, the cassette changes, the door closes
    if (d.tape !== this.tapeShown && !this.doorMove) {
      this.doorMove = { start: performance.now(), show: !!d.tape };
      this.tapeShown = d.tape;
    }
    let open = 0;
    if (this.doorMove) {
      const e = (performance.now() - this.doorMove.start) / 1000;
      const [a, b, c] = DOOR_S;
      open = e < a ? e / a : e < a + b ? 1 : Math.max(0, 1 - (e - a - b) / c);
      if (e > a + b / 2) this.cassette.visible = this.doorMove.show;
      if (e > a + b + c) this.doorMove = null;
    }
    this.door.quaternion.copy(this.doorRest).multiply(new THREE.Quaternion().setFromAxisAngle(this.doorAxis, DOOR_OPEN_RAD * (open * (2 - open))));
    // the reels: about 1.5 turns a second playing, the take-up a little slower; fast winding
    const fast = this.system.fastTape ? 2 : 1;
    const speed = d.running ? 1.5 * fast : mode === "rewind" ? -9 * fast : mode === "fast" ? 9 * fast : 0;
    for (const [i, r] of this.reels.entries()) {
      r.angle -= speed * (i ? 1.1 : 0.9) * 2 * Math.PI * dt;
      r.o.quaternion.copy(r.rest).multiply(new THREE.Quaternion().setFromAxisAngle(r.axis, r.angle));
    }
  }

  /** @private the units where the system says they are */
  tickApart() {
    for (const [o, p] of this.paths) {
      const unit = /** @type {string} */ (this.unitOf.get(o));
      const f = this.system.motion.get(unit)?.f ?? 0;
      const e = f * f * (3 - 2 * f);
      const lift = p.flip ? Math.min(1, e / 0.6) : e;
      const pos = p.base.clone().add(along(p.path, lift));
      if (p.flip) {
        const a = Math.max(0, (e - 0.6) / 0.4) * Math.PI;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
        o.quaternion.copy(q);
        pos.add(BOARD_PIVOT.clone().sub(BOARD_PIVOT.clone().applyQuaternion(q)));
      }
      o.position.copy(pos);
    }
    const mo = this.system.motion;
    this.ribbon.visible = (mo.get("keyboard")?.f ?? 0) < 0.02 && (mo.get("board.main")?.f ?? 0) < 0.02;
  }

  /** @private The chips by their share of the memory traffic: ROM A while BASIC runs, the RAM while a program does. @param {number} dt */
  tickGlow(dt) {
    const m = this.system.machine;
    const tr = this.system.traffic;
    const total = tr.romA + tr.romB + tr.ramRead + tr.ramWrite;
    const ease = Math.min(1, dt * 8);
    /** @param {"romA" | "romB" | "ram"} k @param {number} n */
    const level = (k, n) => {
      const share = m.powered && total ? n / total : 0;
      const target = share > 0 ? 0.25 + 0.65 * Math.sqrt(share) : 0;
      this.levels[k] += (target - this.levels[k]) * ease;
    };
    level("romA", tr.romA);
    level("romB", tr.romB);
    level("ram", tr.ramRead + tr.ramWrite);
    this.levels.video = tr.videoWrite ? 1 : Math.max(0, this.levels.video - dt * 3);
    for (const x of this.cpuMats) x.emissiveIntensity = m.powered ? 0.6 : 0;
    for (const x of this.romAMats) x.emissiveIntensity = this.levels.romA;
    for (const x of this.romBMats) x.emissiveIntensity = this.levels.romB;
    for (const x of this.ramMats) x.emissiveIntensity = this.levels.ram;
    for (const x of this.videoMats) x.emissiveIntensity = this.levels.video * 0.9;
  }

  /** The RESET button's press, shown. */
  pressReset() {
    this.resetUntil = performance.now() + 160;
  }

  /** A recorder key's press, shown even when it does not latch. @param {DeckKey} id */
  tapDeckKey(id) {
    this.tapped = { id, until: performance.now() + 180 };
  }

  /** See inside: the case as glass (true), or solid. @param {boolean} on */
  setSeeInside(on) {
    if (on === this.seeInside) return;
    this.seeInside = on;
    for (const n of GHOSTED) {
      this.node(n).traverse((x) => {
        const m = /** @type {THREE.Mesh} */ (x);
        if (!m.isMesh) return;
        if (on) {
          this.solid.set(m, m.material);
          const ghost = (/** @type {THREE.Material} */ mat) => {
            const g = mat.clone();
            g.transparent = true;
            g.opacity = 0.14;
            g.depthWrite = false;
            return g;
          };
          m.material = Array.isArray(m.material) ? m.material.map(ghost) : ghost(m.material);
          m.castShadow = false;
        } else if (this.solid.has(m)) {
          m.material = /** @type {THREE.Material} */ (this.solid.get(m));
          m.castShadow = true;
        }
      });
    }
    if (!on) this.solid.clear();
  }

  // ---- the pointer --------------------------------------------------------------------------

  /** @private The first visible, solid part under a point. @param {{ clientX: number, clientY: number }} e */
  pick(e) {
    const r = this.viewer.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.viewer.camera);
    return (
      ray.intersectObject(this.root, true).find((h) => {
        if (!h.object.visible) return false;
        const mat = /** @type {THREE.Mesh} */ (h.object).material;
        const first = Array.isArray(mat) ? mat[0] : mat;
        // clicks pass through glass: See inside's case, the door's window
        return !(first && first.transparent && first.opacity < 0.5);
      }) ?? null
    );
  }

  /** @private The nearest ancestor (or itself) that passes a test. @param {THREE.Object3D | null} o @param {(o: THREE.Object3D) => boolean} test */
  up(o, test) {
    while (o && !test(o)) o = o.parent;
    return o;
  }

  /** @private What a part is, and what a click on it does. @param {THREE.Object3D | null} o @returns {Hover | null} */
  describe(o) {
    const named = this.up(o, (x) => !!x.userData.label_en);
    if (!named) return null;
    const node = this.modelName(named);
    const label = String(named.userData.label_en);
    const s = this.system;
    /** @type {Hover["action"]} */
    let action = "none";
    if (named.userData.matrix_row !== undefined || node.startsWith("recorder.key.") || node === "button.reset") action = "press";
    else if (node === "button.power" || node === "display.power_button") action = "toggle";
    else if (node.startsWith("display.control.")) action = "turn";
    else {
      const unit = this.unitAt(o);
      if (unit && !s.machine.powered) action = s.motion.get(unit)?.target ? "putBack" : "takeOut";
    }
    return { node, label, action };
  }

  /** @private The model's name of a three.js node (the one GLTFLoader cleaned). @param {THREE.Object3D} o */
  modelName(o) {
    return /** @type {string} */ (o.userData.name ?? o.name);
  }

  /** @private The unit a part belongs to, if it comes out. @param {THREE.Object3D | null} o */
  unitAt(o) {
    const top = this.up(o, (x) => this.unitOf.has(x));
    return top ? /** @type {string} */ (this.unitOf.get(top)) : null;
  }

  /** @private */
  bindPointer() {
    const canvas = this.viewer.canvas;
    const s = this.system;
    /** @type {{ row: number, bit: number } | null} */
    let held = null;
    /** @type {{ which: "contrast" | "brightness", x: number, v: number } | null} */
    let turning = null;
    let downAt = { x: 0, y: 0, button: 0 };
    canvas.addEventListener("pointerdown", (e) => {
      downAt = { x: e.clientX, y: e.clientY, button: e.button };
      if (e.button !== 0) return;
      const o = this.pick(e)?.object ?? null;
      const keyObj = this.up(o, (x) => x.userData.matrix_row !== undefined);
      const knob = this.up(o, (x) => x === this.knobs.contrast) ? "contrast" : this.up(o, (x) => x === this.knobs.brightness) ? "brightness" : null;
      if (keyObj) {
        const row = keyObj.userData.matrix_row;
        const bit = keyObj.userData.matrix_bit;
        this.viewer.controls.enabled = false;
        if (row === 7) {
          this.shiftLatched = !this.shiftLatched;
          if (this.shiftLatched) s.typist.hold(7, 0);
          else s.typist.release(7, 0);
          return;
        }
        held = { row, bit };
        s.typist.hold(row, bit);
        this.on.info?.(this.modelName(keyObj));
      } else if (knob) {
        this.viewer.controls.enabled = false;
        turning = { which: knob, x: e.clientX, v: s.display[knob] };
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (turning) {
        s.setControl(turning.which, turning.v + (e.clientX - turning.x) / 200);
        return;
      }
      if (e.pointerType !== "mouse" || e.buttons) {
        this.on.hover?.(null, 0, 0);
        return;
      }
      const h = this.describe(this.pick(e)?.object ?? null);
      canvas.style.cursor = h && h.action !== "none" ? "pointer" : "";
      this.on.hover?.(h, e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerleave", () => this.on.hover?.(null, 0, 0));
    canvas.addEventListener(
      "wheel",
      (e) => {
        const o = this.pick(e)?.object ?? null;
        const knob = this.up(o, (x) => x === this.knobs.contrast) ? "contrast" : this.up(o, (x) => x === this.knobs.brightness) ? "brightness" : null;
        if (!knob) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        s.setControl(knob, s.display[knob] - Math.sign(e.deltaY) * 0.05);
      },
      { capture: true, passive: false },
    );
    const release = () => {
      this.viewer.controls.enabled = true;
      if (turning) {
        turning = null;
        return true;
      }
      if (held) {
        s.typist.release(held.row, held.bit);
        held = null;
        if (this.shiftLatched) {
          this.shiftLatched = false;
          s.typist.release(7, 0);
        }
        return true;
      }
      return false;
    };
    canvas.addEventListener("pointerup", (e) => {
      if (release()) return;
      if (downAt.button !== 0 || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      this.click(this.pick(e)?.object ?? null);
    });
    canvas.addEventListener("pointercancel", () => release());
    canvas.addEventListener("dblclick", (e) => {
      const o = this.pick(e)?.object ?? null;
      // C or B: back to the middle
      const knob = this.up(o, (x) => x === this.knobs.contrast) ? "contrast" : this.up(o, (x) => x === this.knobs.brightness) ? "brightness" : null;
      if (knob) return void s.resetControl(knob);
      if (o === this.screen) this.on.screenDoubleClick?.();
    });
  }

  /** @private A click (not a drag) on a part. @param {THREE.Object3D | null} o */
  click(o) {
    const s = this.system;
    if (!o || o === this.screen) return; // the tube: a double-click opens 2D (U1)
    const is = (/** @type {string} */ n) => !!this.up(o, (x) => this.modelName(x) === n);
    if (is("button.power")) return void s.power(!s.machine.powered);
    if (is("display.power_button")) return void s.displayPower(!s.display.on);
    if (is("button.reset")) {
      this.pressReset();
      return void s.reset();
    }
    for (const id of DECK_KEYS) {
      if (is(`recorder.key.${id}`)) {
        this.tapDeckKey(id);
        return void s.deckKey(id);
      }
    }
    const unit = this.unitAt(o);
    if (unit && !s.machine.powered) return void s.toggleUnit(unit);
    const named = this.up(o, (x) => !!x.userData.label_en);
    if (named) this.on.info?.(this.modelName(named));
  }
}

/** A point along a polyline, f 0..1. @param {THREE.Vector3[]} pts @param {number} f */
function along(pts, f) {
  if (pts.length < 2) return new THREE.Vector3();
  const seg = pts.length - 1;
  const t = f * seg;
  const i = Math.min(seg - 1, Math.floor(t));
  return pts[i].clone().lerp(pts[i + 1], t - i);
}
