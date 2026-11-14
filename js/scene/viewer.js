// SPDX-License-Identifier: Apache-2.0
//
// The 3D stage's viewer (docs/ui-design.md, U2): renderer, camera, orbit controls, a studio
// environment for the metals, and a key light with soft shadows. No floor: the canvas is clear, over
// the stage's dark blue glow (css/style.css, #view3d), so nothing is brighter than the machine. After the Altair
// 8800 simulator's viewer, simplified.
//
// - Drag to orbit, right-drag or two fingers to pan, wheel or pinch to zoom; damped and
//   limited, so the machine can't be lost.
// - With the canvas focused (by Tab), the arrows orbit, Shift and the arrows pan, + and -
//   zoom, Home goes home.
// - Camera flights are eased, and a cut under prefers-reduced-motion.
// - It renders only while active: under the 2D view the scene stops (U1).

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** A studio environment: a warm grey dome with softboxes, for the silver case to reflect. */
function studioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.SphereGeometry(10, 32, 16);
  const pos = dome.getAttribute("position");
  /** @type {number[]} */
  const colours = [];
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 10;
    const v = h >= 0 ? 0.3 + 0.3 * h : 0.3 - 0.18 * h * h;
    colours.push(v * 1.02, v, v * 0.96);
  }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  env.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  /** @type {[number, number, number, [number, number, number]][]} */
  const boxes = [
    [5, 3, 8, [-3, 6, 3]],
    [1.2, 5, 5, [6, 2.5, 1]],
    [8, 2.5, 3, [0, 1.5, 7]],
    [8, 1, 2.5, [0, 3, -6]],
  ];
  for (const [w, h, intensity, p] of boxes) {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    m.color.setScalar(intensity);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    b.position.set(...p);
    b.lookAt(0, 0, 0);
    env.add(b);
  }
  return env;
}

/** @typedef {[number, number, number]} Vec */
/** @typedef {{ pos: Vec, target: Vec }} Pose */

/** How far the camera may come to what it looks at, and go from it, m. */
const MIN_DISTANCE = 0.08;
const MAX_DISTANCE = 3;
/** A flight's length, s. */
const FLIGHT_S = 0.7;
/** The camera's vertical field of view, degrees. */
export const FOV = 35;

export class Viewer {
  /**
   * @param {HTMLElement} host
   */
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(studioEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 20);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.minDistance = MIN_DISTANCE;
    this.controls.maxDistance = MAX_DISTANCE;
    // the whole sphere, so the undersides can be seen (See inside looks up from below)
    this.controls.maxPolarAngle = Math.PI;
    this.controls.keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" };
    this.controls.listenToKeyEvents(this.canvas);
    this.scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x202326, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-0.8, 1.6, 1.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -0.9;
    key.shadow.camera.right = 0.9;
    key.shadow.camera.top = 0.9;
    key.shadow.camera.bottom = -0.9;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    this.scene.add(key);
    /** Called every frame, with seconds since the last. @type {((dt: number) => void)[]} */
    this.onFrame = [];
    /** Called after the canvas changes size. @type {(() => void)[]} */
    this.onResize = [];
    /** Called when the visitor starts to move the camera themselves. @type {(() => void)[]} */
    this.onUserMove = [];
    this.controls.addEventListener("start", () => {
      for (const f of this.onUserMove) f();
    });
    /** Whether the scene is drawn: false under the 2D view. */
    this.active = true;
    /** @private @type {((dt: number) => boolean) | null} the flight under way */
    this.flight = null;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.canvas.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=") this.zoom(0.85);
      else if (e.key === "-" || e.key === "_") this.zoom(1 / 0.85);
      else return;
      e.preventDefault();
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const f of this.onResize ?? []) f();
  }

  /** The canvas's size, CSS px. */
  size() {
    return { width: this.host.clientWidth || 1, height: this.host.clientHeight || 1 };
  }

  /** Whether a flight is under way. */
  isFlying() {
    return this.flight !== null;
  }

  /** @private */
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    for (const f of this.onFrame) f(dt);
    if (this.flight && this.flight(dt)) this.flight = null;
    if (!this.active) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * A fixed pose, stood back on a narrow stage so that what it frames still fits across: for
   * a view before the model has loaded, which has no parts to frame yet.
   * @param {Pose} pose framed for a stage about 16:9
   * @returns {Pose}
   */
  fit(pose) {
    const aspect = this.camera.aspect;
    const p = new THREE.Vector3(...pose.pos);
    const t = new THREE.Vector3(...pose.target);
    const back = aspect < 1.6 ? Math.pow(1.6 / aspect, 0.85) : 1;
    const q = t.clone().add(p.sub(t).multiplyScalar(back));
    return { pos: [q.x, q.y, q.z], target: [t.x, t.y, t.z] };
  }

  /** Puts the camera at a pose at once. @param {Pose} pose */
  jumpTo(pose) {
    this.flight = null;
    this.camera.position.set(...pose.pos);
    this.controls.target.set(...pose.target);
  }

  /**
   * Flies the camera to a pose, as it is given, then calls `then`.
   * @param {Pose} pose
   * @param {() => void} [then]
   * @param {number} [seconds]
   */
  flyTo(pose, then, seconds = FLIGHT_S) {
    const p1 = new THREE.Vector3(...pose.pos);
    const t1 = new THREE.Vector3(...pose.target);
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    if (this.reducedMotion.matches) {
      this.camera.position.copy(p1);
      this.controls.target.copy(t1);
      this.flight = null;
      then?.();
      return;
    }
    let t = 0;
    this.flight = (dt) => {
      t = Math.min(1, t + dt / seconds);
      const e = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(p0, p1, e);
      this.controls.target.lerpVectors(t0, t1, e);
      if (t < 1) return false;
      then?.();
      return true;
    };
  }

  /** Where the camera is now. @returns {Pose} */
  pose() {
    const p = this.camera.position;
    const t = this.controls.target;
    return { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  /** Moves the camera nearer (f < 1) or further. @param {number} f */
  zoom(f) {
    const t = this.controls.target;
    const d = this.camera.position.clone().sub(t);
    const len = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d.length() * f));
    this.camera.position.copy(t.clone().add(d.setLength(len)));
  }
}
