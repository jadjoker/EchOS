/**
 * A low-quality 3D object, generated from what the machine thinks a thing is.
 *
 * The generated web had a hole in it: every page's photograph was an abstract
 * pattern tile. A site that knows a kiln is fired in a yard and sells its
 * shelves separately, illustrated with a picture of some checks, is a site that
 * stops convincing exactly where it should be most convincing.
 *
 * So the figure gets an object instead. Not a photograph — a spinning
 * flat-shaded model, of the kind a 1996 site would have exported from a demo
 * copy of 3D Studio and been very pleased with. Low quality is the brief, the
 * same as the aquarium's fish: chunky pixels, eleven-ish triangles, one light.
 *
 * It cannot draw a kiln. What it can do is draw something of the right
 * CHARACTER — squat and heavy, or tall and spindly, or round and soft — and
 * character is what sells it at thumbnail size. The parameters come from the
 * same reading the rest of the page is built from, so the object on a
 * `mooloona.com` page is round and huge for exactly the reason the prose is.
 */

import type { Rng } from "../core/rng.ts";

type Vec3 = readonly [number, number, number];

export interface Mesh {
  vertices: Vec3[];
  faces: readonly (readonly [number, number, number])[];
}

/**
 * How a thing is shaped, in the only four terms that survive being rendered
 * forty pixels across.
 */
export interface SolidShape {
  /** 0 angular and faceted, 1 round and smooth. Bouba/kiki, as a number. */
  roundness: number;
  /** How far the silhouette spikes out. Tools and machines, not creatures. */
  spikiness: number;
  /** Height against width. Below 1 is squat, above is a tower. */
  aspect: number;
  /** Rings up the body. More is smoother and slower; six is plenty. */
  rings: number;
  /** Points around. Five reads as cut, twelve as turned. */
  segments: number;
}

const LIGHT: Vec3 = [0.35, 0.75, 0.55];

/**
 * Category to character.
 *
 * Deliberately coarse: the point is that an animal and a machine are not the
 * same silhouette, not that a ferret and a stoat differ. Anything not listed
 * falls to the default, which is a slightly irregular lump — the right answer
 * for a thing we cannot classify.
 */
const BY_CATEGORY: Record<string, Partial<SolidShape>> = {
  animal: { roundness: 0.85, spikiness: 0.1, aspect: 0.7, segments: 10 },
  plant: { roundness: 0.6, spikiness: 0.45, aspect: 1.5, segments: 7 },
  machine: { roundness: 0.15, spikiness: 0.35, aspect: 0.9, segments: 6 },
  tool: { roundness: 0.2, spikiness: 0.5, aspect: 1.6, segments: 5 },
  mineral: { roundness: 0.1, spikiness: 0.6, aspect: 0.9, segments: 5 },
  material: { roundness: 0.45, spikiness: 0.2, aspect: 0.6, segments: 8 },
  vehicle: { roundness: 0.3, spikiness: 0.25, aspect: 0.5, segments: 6 },
  place: { roundness: 0.1, spikiness: 0.15, aspect: 0.8, segments: 4 },
  building: { roundness: 0.05, spikiness: 0.1, aspect: 1.3, segments: 4 },
  food: { roundness: 0.9, spikiness: 0.05, aspect: 0.8, segments: 11 },
  garment: { roundness: 0.7, spikiness: 0.15, aspect: 1.1, segments: 9 },
  instrument: { roundness: 0.5, spikiness: 0.3, aspect: 1.7, segments: 8 },
  organisation: { roundness: 0.2, spikiness: 0.1, aspect: 1.2, segments: 6 },
  abstract: { roundness: 0.5, spikiness: 0.55, aspect: 1.0, segments: 7 },
};

/** Bigger things get more facets, because more of them is on screen. */
const BY_SCALE: Record<string, number> = {
  tiny: -2, small: -1, medium: 0, large: 1, huge: 2,
};

export function shapeFor(category: string, scale: string, rng: Rng): SolidShape {
  const base = BY_CATEGORY[category] ?? { roundness: 0.5, spikiness: 0.3, aspect: 1, segments: 7 };
  const facets = BY_SCALE[scale] ?? 0;

  // Rolled inside the category rather than freely: two kilns should differ from
  // each other while both still reading as kilns. Same principle as the
  // aesthetic movements.
  return {
    roundness: clamp01((base.roundness ?? 0.5) + rng.range(-0.12, 0.12)),
    spikiness: clamp01((base.spikiness ?? 0.3) + rng.range(-0.12, 0.12)),
    aspect: Math.max(0.35, (base.aspect ?? 1) * rng.range(0.82, 1.22)),
    rings: 4 + Math.round(rng.range(0, 2)) + Math.max(0, facets),
    segments: Math.max(4, (base.segments ?? 7) + facets + rng.int(-1, 1)),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * A lathe, then. Rings of vertices stacked up an axis, radius following a
 * profile curve, with the whole thing free to be pushed out of round.
 *
 * A lathe is the right primitive because it is what the era's modellers
 * actually produced — a spun profile is the single easiest thing to make in
 * 1996 software, so an object that looks lathed looks period-correct rather
 * than looking like a mistake.
 */
export function makeSolid(rng: Rng, shape: SolidShape): Mesh {
  const { rings, segments } = shape;
  const vertices: Vec3[] = [];
  const faces: [number, number, number][] = [];

  // A per-segment radial bias, held constant up the body, is what keeps the
  // object from being a perfect solid of revolution. Rolled once, not per ring,
  // so the silhouette has flats and edges that run its whole height.
  const bias = Array.from({ length: segments }, () =>
    1 + (1 - shape.roundness) * rng.range(-0.28, 0.28));

  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1);
    const y = (t - 0.5) * 2 * shape.aspect;

    // Round profiles bulge in the middle, angular ones taper straight. Mixing
    // between the two is what "roundness" actually controls in silhouette.
    const bulge = Math.sin(t * Math.PI);
    const taper = 1 - Math.abs(t - 0.5) * 0.8;
    const radius = (bulge * shape.roundness + taper * (1 - shape.roundness))
      * rng.range(0.86, 1.14);

    for (let seg = 0; seg < segments; seg++) {
      const angle = (seg / segments) * Math.PI * 2;
      // Spikes on alternate points, and only where the body is widest — a
      // spike on the cap reads as a spire, which is a different object.
      const spike = seg % 2 === 0 ? 1 + shape.spikiness * bulge : 1;
      const r = radius * (bias[seg] ?? 1) * spike;
      vertices.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
    }
  }

  for (let ring = 0; ring < rings - 1; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const next = (seg + 1) % segments;
      const a = ring * segments + seg;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + seg;
      const d = (ring + 1) * segments + next;
      faces.push([a, c, d], [a, d, b]);
    }
  }

  // Caps, as fans to a pole at each end. Without them the object is a tube and
  // reads as a hole rather than a thing.
  const bottom = vertices.push([0, -shape.aspect * 1.15, 0]) - 1;
  const top = vertices.push([0, shape.aspect * 1.15, 0]) - 1;
  for (let seg = 0; seg < segments; seg++) {
    const next = (seg + 1) % segments;
    faces.push([bottom, next, seg]);
    const base = (rings - 1) * segments;
    faces.push([top, base + seg, base + next]);
  }

  return { vertices, faces };
}

function rotateY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

function rotateX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
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

/**
 * How much to magnify this particular mesh so it fills the frame without
 * leaving it.
 *
 * A fixed magnification only works if every object is the same size, and these
 * are not: aspect alone runs from 0.35 to about 2, and spikes push the widest
 * ones out further again. Measured across a turn rather than solved for,
 * because the silhouette changes as it rotates and the tall ones clip at the
 * top of the swing rather than at rest.
 */
function fitScale(mesh: Mesh, tilt: number): number {
  let extent = 0;
  for (let step = 0; step < 16; step++) {
    const a = (step / 16) * Math.PI * 2;
    for (const v of mesh.vertices) {
      const r = rotateX(rotateY(v, a), tilt);
      const depth = 1 / (3.4 - r[2] * 0.5);
      extent = Math.max(extent, Math.abs(r[0]) * depth, Math.abs(r[1]) * depth);
    }
  }
  // 0.46 of the half-frame: full-bleed, minus a pixel of air so the silhouette
  // never touches the border and read as cropped.
  return extent > 0 ? 0.46 / extent : 1;
}

export interface SolidOptions {
  mesh: Mesh;
  /** Base hue, 0–359. */
  hue: number;
  /** Radians per frame. */
  spin: number;
  /** Fixed lean, so it is not viewed dead-on from the equator. */
  tilt: number;
}

/**
 * Mounts a canvas that renders the mesh, and owns its own animation loop.
 * Call stop() when the page navigates away or it spins on in a detached node.
 */
export function mountSolid(host: HTMLElement, options: SolidOptions): { stop(): void } {
  const canvas = document.createElement("canvas");
  canvas.className = "site-solid";
  host.append(canvas);

  // The model is drawn at this and scaled up with smoothing off. Everything
  // that makes it read as period comes from this number being small.
  const SIZE = 64;
  const buffer = document.createElement("canvas");
  buffer.width = SIZE;
  buffer.height = SIZE;

  let raf = 0;
  let angle = 0;

  // Measured once. The mesh never changes shape, only orientation.
  const magnify = fitScale(options.mesh, options.tilt);

  /**
   * Pages are built detached and appended after, and are thrown away on every
   * navigation without anyone being told. So the loop watches its own canvas
   * and stops once it has been in the document and then left it — otherwise
   * every address you visit leaves a model spinning in a node nobody holds.
   */
  let wasConnected = false;

  function frame(): void {
    if (canvas.isConnected) wasConnected = true;
    else if (wasConnected) return;

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
    angle += options.spin;

    const projected = options.mesh.vertices.map((v) => {
      const r = rotateX(rotateY(v, angle), options.tilt);
      const depth = 1 / (3.4 - r[2] * 0.5);
      return {
        x: SIZE / 2 + r[0] * SIZE * depth * magnify,
        y: SIZE / 2 - r[1] * SIZE * depth * magnify,
        z: r[2],
        world: r,
      };
    });

    const faces = options.mesh.faces.map((face) => {
      const a = projected[face[0]]!;
      const b = projected[face[1]]!;
      const c = projected[face[2]]!;
      const n = normal(a.world, b.world, c.world);
      const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      return { a, b, c, depth: (a.z + b.z + c.z) / 3, lit };
    });

    // Painter's algorithm, as with the fish. A depth buffer for a hundred
    // triangles would be more correct and would look no different.
    faces.sort((p, q) => p.depth - q.depth);

    for (const f of faces) {
      bc.fillStyle = `hsl(${options.hue} 48% ${24 + f.lit * 54}%)`;
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
