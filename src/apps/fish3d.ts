/**
 * A rotating fish, in eleven triangles.
 *
 * Hand-rolled 3D in a 2D canvas: no dependency, and "low quality" is literally
 * the brief. The model renders to a small offscreen buffer and is upscaled with
 * smoothing switched off, so it arrives as chunky pixels — which is what a
 * spinning model on a 1996 machine actually looked like. A clean WebGL fish
 * would be wrong for this window even though it would be easier.
 *
 * Flat-shaded, painter's algorithm, one directional light. That is the whole
 * renderer.
 */

import { honk } from "../core/sound.ts";
import type { FishForm } from "../gen/fishform.ts";

type Vec3 = readonly [number, number, number];

/** Nose points along +X. Y is up, Z is across. */
const V: Vec3[] = [
  [1.25, 0, 0],      // 0 nose
  [0.2, 0.38, 0],    // 1 top
  [0.2, 0, 0.28],    // 2 near
  [0.2, -0.34, 0],   // 3 bottom
  [0.2, 0, -0.28],   // 4 far
  [-0.85, 0, 0],     // 5 tail base
  [-1.45, 0.52, 0],  // 6 tail upper
  [-1.45, -0.46, 0], // 7 tail lower
  [0.05, 0.36, 0],   // 8 dorsal root front
  [-0.45, 0.34, 0],  // 9 dorsal root back
  [-0.3, 0.92, 0],   // 10 dorsal tip
];

/** Triangles, wound so the normal points outward. */
const F: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], // snout
  [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4], // flanks to tail base
  [5, 6, 7],                                   // tail fin
  [8, 10, 9],                                  // dorsal
  [9, 10, 8],                                  // dorsal, other side
];

const LIGHT: Vec3 = [0.35, 0.75, 0.55];

function rotateY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

function rotateZ([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
}

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

export interface Fish3dOptions {
  /** Base hue, 0–359. */
  hue: number;
  /** Grey and still, for the one nobody removed. */
  deceased: boolean;
  /**
   * The body its species asks for. Optional, and when it is missing the model
   * is the plain fish above, which is what every fish looked like before
   * gen/fishform.ts existed.
   */
  form?: FishForm | undefined;
}

/**
 * The eleven triangles, stretched to the proportions the tank is drawing.
 *
 * Without this the shelf and the water disagreed: a Whiptail loach swam past
 * as a long thin thing trailing a tail, and the same fish on its profile card
 * was the same generic model as everything else. Buying a fish and watching it
 * change shape on the way in is a seam, and a seam in the one object the game
 * asks you to care about.
 *
 * Only the SILHOUETTE carries over. Markings do not: at 84 pixels with flat
 * shading there is nowhere to put them, and a spotted fish whose spots
 * appeared in one window and not the other would be a worse mismatch than the
 * one being fixed. The overall Dwarf-to-Emperor scaling does not carry either,
 * because the model is fitted to its canvas and every fish gets the same frame.
 */
function shapeVertices(form: FishForm | undefined): Vec3[] {
  if (!form) return V;

  // Against the plain fish, which sits at roughly these proportions.
  const xk = form.len;
  const yk = form.depth / 0.9;
  const dorsalK = form.dorsal / 0.8;

  return V.map(([x, y, z], index) => {
    // 6 and 7 are the tail tips, 10 is the point of the dorsal fin.
    const isTailTip = index === 6 || index === 7;
    const isDorsalTip = index === 10;
    const stretch = isTailTip ? form.tailScale : 1;
    return [
      x * xk * (isTailTip ? Math.max(1, form.tailScale * 0.85) : 1),
      y * yk * stretch * (isDorsalTip ? dorsalK : 1),
      z * yk,
    ];
  });
}

/**
 * Returns a handle that owns its own animation loop. Call stop() when the
 * window closes or the fish keeps spinning in a detached canvas forever.
 */
export function mountFish3d(
  host: HTMLElement,
  options: Fish3dOptions,
): { stop(): void } {
  const canvas = document.createElement("canvas");
  canvas.className = "fish3d";
  host.append(canvas);

  // Deliberately tiny. Everything below draws at this resolution and the
  // browser scales it up with nearest-neighbour.
  const SIZE = 84;
  const buffer = document.createElement("canvas");
  buffer.width = SIZE;
  buffer.height = SIZE;

  /** Radians per frame when nobody is touching it. A dead fish does not turn. */
  const AUTO_SPIN = options.deceased ? 0 : 0.018;
  /** How long after letting go before it eases back to turning on its own. */
  const SETTLE_AFTER = 900;
  /** Screen pixels to radians. Roughly a full turn across the canvas. */
  const DRAG_SCALE = 0.02;

  // Measured once. The proportions never change while it is mounted.
  const verts = shapeVertices(options.form);

  let raf = 0;
  let angle = options.deceased ? Math.PI * 0.15 : 0;
  let spin = AUTO_SPIN;

  /** Vertical drag tips the fish; it rights itself once you stop. */
  let tilt = 0;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let releasedAt = -Infinity;

  canvas.addEventListener("pointerdown", (event) => {
    // Poking a fish should do something. Pitched from its hue so each one has
    // its own note, and a dead one gets a lower, duller version of the same
    // sound rather than silence, which is funnier and also tells you it heard.
    honk(options.hue, { dull: options.deceased });
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    spin = 0;
    // Capture keeps the drag alive when the pointer leaves the little canvas,
    // which it will. Not worth failing the drag over if it is refused.
    try { canvas.setPointerCapture(event.pointerId); } catch { /* drag still works */ }
    // Otherwise a drag on the model selects the profile text behind it.
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    angle += dx * DRAG_SCALE;
    // Clamped: past a quarter turn the flat-shaded model reads as broken
    // rather than tipped, because it has no thickness to speak of.
    tilt = Math.max(-0.7, Math.min(0.7, tilt + dy * DRAG_SCALE * 0.5));
    // Carried out of the drag as momentum, so a flick keeps going.
    spin = dx * DRAG_SCALE;
  });

  function endDrag(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    releasedAt = performance.now();
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch { /* nothing to release */ }
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  /**
   * Deterministic idle noise — layered sines rather than Math.random, because
   * everything else in this machine reproduces from its seed and a renderer
   * that quietly did not would be a hole in that. Reads as a fish holding
   * station, not as a turntable.
   */
  function wobble(t: number): number {
    return Math.sin(t * 0.0011) * 0.6 + Math.sin(t * 0.0027 + 1.3) * 0.3
      + Math.sin(t * 0.0061 + 2.7) * 0.1;
  }

  /**
   * Offsets the noise per fish, so two profiles open at once do not drift in
   * lockstep. Taken from the hue because it is already unique per fish and
   * costs no roll, which keeps the seed untouched.
   */
  const phase = options.hue * 37;

  function frame(time: number): void {
    const bc = buffer.getContext("2d");
    const oc = canvas.getContext("2d");
    if (!bc || !oc) return;

    const rect = host.getBoundingClientRect();
    const side = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
    if (canvas.width !== side || canvas.height !== side) {
      canvas.width = side;
      canvas.height = side;
    }

    bc.clearRect(0, 0, SIZE, SIZE);

    if (!dragging) {
      // A flick coasts, then the fish remembers what it was doing. Easing
      // toward AUTO_SPIN rather than snapping is the whole difference between
      // "it went back to spinning" and "the animation restarted".
      const settled = time - releasedAt > SETTLE_AFTER;
      spin += (AUTO_SPIN - spin) * (settled ? 0.04 : 0.006);
      angle += spin;
      tilt *= 0.94;
    }

    // A dead fish drifts belly-up rather than turning on display.
    const idleRoll = options.deceased ? Math.PI : Math.sin(time / 1600) * 0.12;
    // Noise is damped while held: a fish you have hold of is steadier than one
    // left to its own devices.
    const jitter = dragging ? 0.25 : 1;
    const roll = idleRoll + tilt + wobble(time + phase + 5000) * 0.09 * jitter;
    const shown = angle + wobble(time + phase) * 0.07 * jitter;

    /**
     * Holding station, as a change of PLACE rather than of angle.
     *
     * The first attempt at this noise only perturbed rotation, on a fish that
     * is already turning a degree a frame, so it was mathematically present
     * and visually absent. Drift is what reads as a live thing keeping itself
     * in one spot, and it stays legible whether the fish is spinning or dead.
     *
     * Weighted to the vertical: the fish is already as wide as the frame at
     * some angles, so sideways drift only buys more cropping, while there is
     * clear air above and below. A fish holding station bobs more than it
     * slides anyway.
     */
    const driftX = wobble(time * 0.7 + phase + 300) * SIZE * 0.012 * jitter;
    const driftY = wobble(time * 1.1 + phase) * SIZE * 0.055 * jitter;

    const projected = verts.map((v) => {
      const r = rotateZ(rotateY(v, shown), roll);
      // Weak perspective — enough to read as 3D, not enough to look modern.
      const depth = 1 / (2.6 - r[2] * 0.5);
      return {
        x: SIZE / 2 + driftX + r[0] * SIZE * 0.42 * depth * 2.6,
        y: SIZE / 2 + driftY - r[1] * SIZE * 0.42 * depth * 2.6,
        z: r[2],
        world: r,
      };
    });

    const faces = F.map((face) => {
      const [ia, ib, ic] = face;
      const a = projected[ia]!;
      const b = projected[ib]!;
      const c = projected[ic]!;
      const n = normal(a.world, b.world, c.world);
      const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      return { a, b, c, depth: (a.z + b.z + c.z) / 3, lit };
    });

    // Painter's algorithm. Eleven faces does not justify a depth buffer.
    faces.sort((p, q) => p.depth - q.depth);

    for (const f of faces) {
      const shade = 26 + f.lit * 52;
      bc.fillStyle = options.deceased
        ? `hsl(0 0% ${shade}%)`
        : `hsl(${options.hue} 62% ${shade}%)`;
      bc.beginPath();
      bc.moveTo(f.a.x, f.a.y);
      bc.lineTo(f.b.x, f.b.y);
      bc.lineTo(f.c.x, f.c.y);
      bc.closePath();
      bc.fill();
    }

    oc.imageSmoothingEnabled = false;
    oc.clearRect(0, 0, side, side);
    oc.drawImage(buffer, 0, 0, side, side);

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return { stop: () => cancelAnimationFrame(raf) };
}
