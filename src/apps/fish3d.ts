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

  let raf = 0;
  let angle = options.deceased ? Math.PI * 0.15 : 0;

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

    // A dead fish drifts belly-up rather than turning on display.
    if (!options.deceased) angle += 0.018;
    const roll = options.deceased ? Math.PI : Math.sin(time / 1600) * 0.12;

    const projected = V.map((v) => {
      const r = rotateZ(rotateY(v, angle), roll);
      // Weak perspective — enough to read as 3D, not enough to look modern.
      const depth = 1 / (2.6 - r[2] * 0.5);
      return {
        x: SIZE / 2 + r[0] * SIZE * 0.42 * depth * 2.6,
        y: SIZE / 2 - r[1] * SIZE * 0.42 * depth * 2.6,
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
