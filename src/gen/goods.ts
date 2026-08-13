/**
 * The things the shop sells, as objects you can recognise.
 *
 * The generated web's `solid.ts` draws a LATHE: one profile spun around an
 * axis. That is the right primitive for a page's photograph, where the object
 * is a thing we cannot name and only has to have the right character. It is
 * the wrong primitive for a shop, because a lathe cannot make a castle. Spin
 * any profile you like and you get a vase.
 *
 * A shop is different: the player is being asked to buy a specific object and
 * ought to be able to tell a heater from a lamp without reading the label. So
 * these are BUILT, out of boxes, tubes, cones and roofs, in the smallest kit
 * that gets each one recognisable. Still real geometry, still turning, still
 * eleven-ish triangles a part and one light. Chunky, not accurate.
 *
 * Everything is authored rather than rolled. A heater that came out different
 * on every machine would be a heater you cannot learn to recognise, and
 * recognition is the entire point of the exercise.
 */

import type { FaceTint, Mesh } from "./solid.ts";

type Vec3 = readonly [number, number, number];

interface Part {
  vertices: Vec3[];
  faces: [number, number, number][];
  tint: FaceTint;
}

/**
 * Materials, as relationships to the machine's accent rather than colours.
 *
 * Saturation and lightness are what separate glass from ceramic from the black
 * rubber cap on a heater. Hue is mostly left alone so an object reads as one
 * object; where it does move, it moves a long way, because a roof that is
 * fifteen degrees off its walls just looks like a rendering error.
 */
const BODY: FaceTint = { hue: 0, sat: 46, light: 1 };
const DARK: FaceTint = { hue: 0, sat: 16, light: 0.5 };
const METAL: FaceTint = { hue: 0, sat: 8, light: 1.12 };
const GLASS: FaceTint = { hue: 10, sat: 30, light: 1.35 };
const ROOF: FaceTint = { hue: 150, sat: 54, light: 0.92 };
const GLOW: FaceTint = { hue: 40, sat: 70, light: 1.5 };

/**
 * A box. Winding is outward on every face, which matters more than it sounds:
 * lighting is a dot product against the face normal, so a face wound the wrong
 * way is not mirrored, it is black.
 */
function box(c: Vec3, size: Vec3, tint: FaceTint): Part {
  const [cx, cy, cz] = c;
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const vertices: Vec3[] = [
    [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz],
  ];
  const faces: [number, number, number][] = [
    [4, 5, 6], [4, 6, 7], // +z
    [1, 0, 3], [1, 3, 2], // -z
    [1, 2, 6], [1, 6, 5], // +x
    [0, 4, 7], [0, 7, 3], // -x
    [3, 7, 6], [3, 6, 2], // +y
    [0, 1, 5], [0, 5, 4], // -y
  ];
  return { vertices, faces, tint };
}

/** A tube. `axis` because a lamp's bulb lies down and a heater stands up. */
function cylinder(
  c: Vec3, radius: number, length: number, segments: number,
  tint: FaceTint, axis: "x" | "y" = "y",
): Part {
  const vertices: Vec3[] = [];
  const faces: [number, number, number][] = [];
  const half = length / 2;

  // Built along Y, then swapped into place. One winding to get right, not two.
  const put = (r: number, along: number, angle: number): Vec3 => {
    const u = Math.cos(angle) * r;
    const v = Math.sin(angle) * r;
    return axis === "y"
      ? [c[0] + u, c[1] + along, c[2] + v]
      : [c[0] + along, c[1] + u, c[2] + v];
  };

  for (const end of [-half, half]) {
    for (let s = 0; s < segments; s++) {
      vertices.push(put(radius, end, (s / segments) * Math.PI * 2));
    }
  }
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    faces.push([s, segments + s, segments + next], [s, segments + next, next]);
  }

  const lowCap = vertices.push(put(0, -half, 0)) - 1;
  const highCap = vertices.push(put(0, half, 0)) - 1;
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    faces.push([lowCap, s, next]);
    faces.push([highCap, segments + next, segments + s]);
  }
  return { vertices, faces, tint };
}

/** A cone, point up. Turret roofs and nothing else so far. */
function cone(c: Vec3, radius: number, height: number, segments: number, tint: FaceTint): Part {
  const vertices: Vec3[] = [];
  const faces: [number, number, number][] = [];
  const half = height / 2;

  for (let s = 0; s < segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    vertices.push([c[0] + Math.cos(angle) * radius, c[1] - half, c[2] + Math.sin(angle) * radius]);
  }
  const apex = vertices.push([c[0], c[1] + half, c[2]]) - 1;
  const base = vertices.push([c[0], c[1] - half, c[2]]) - 1;
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    faces.push([s, apex, next]);
    faces.push([base, s, next]);
  }
  return { vertices, faces, tint };
}

/** A pitched roof: a prism with the ridge running along x. */
function roof(c: Vec3, size: Vec3, tint: FaceTint): Part {
  const [cx, cy, cz] = c;
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const vertices: Vec3[] = [
    [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz + hz], [cx - hx, cy - hy, cz + hz],
    [cx - hx, cy + hy, cz], [cx + hx, cy + hy, cz],
  ];
  const faces: [number, number, number][] = [
    [3, 2, 5], [3, 5, 4], // front slope
    [1, 0, 4], [1, 4, 5], // back slope
    [1, 5, 2], [0, 3, 4], // gable ends
    [0, 1, 2], [0, 2, 3], // underside
  ];
  return { vertices, faces, tint };
}

/**
 * An egg. A lathe after all, because an egg is genuinely a solid of
 * revolution — the one thing on the shelf the web's own primitive would have
 * got right.
 */
function egg(c: Vec3, radius: number, height: number, segments: number, tint: FaceTint): Part {
  const vertices: Vec3[] = [];
  const faces: [number, number, number][] = [];
  const rings = 7;

  for (let ring = 0; ring < rings; ring++) {
    const t = (ring + 0.5) / rings;
    // Fatter below the middle, narrower above it. That asymmetry is the whole
    // difference between an egg and a ball.
    const r = Math.sin(t * Math.PI) * radius * (1 - 0.28 * (t - 0.5));
    const y = c[1] + (t - 0.5) * height;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      vertices.push([c[0] + Math.cos(angle) * r, y, c[2] + Math.sin(angle) * r]);
    }
  }
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let s = 0; s < segments; s++) {
      const next = (s + 1) % segments;
      const a = ring * segments + s;
      const b = ring * segments + next;
      const cc = (ring + 1) * segments + s;
      const d = (ring + 1) * segments + next;
      faces.push([a, cc, d], [a, d, b]);
    }
  }
  const bottom = vertices.push([c[0], c[1] - height / 2, c[2]]) - 1;
  const top = vertices.push([c[0], c[1] + height / 2, c[2]]) - 1;
  const last = (rings - 1) * segments;
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    faces.push([bottom, s, next]);
    faces.push([top, last + next, last + s]);
  }
  return { vertices, faces, tint };
}

/** Parts into one mesh, carrying each part's colour onto its faces. */
function assemble(parts: Part[]): Mesh {
  const vertices: Vec3[] = [];
  const faces: [number, number, number][] = [];
  const tints: FaceTint[] = [];

  for (const part of parts) {
    const offset = vertices.length;
    vertices.push(...part.vertices);
    for (const face of part.faces) {
      faces.push([face[0] + offset, face[1] + offset, face[2] + offset]);
      tints.push(part.tint);
    }
  }
  return { vertices, faces, tints };
}

/**
 * One builder per thing the shop sells.
 *
 * Read each as a sentence about a silhouette. The heater is a tube with a cap
 * on it. The castle is a block with two towers and pointed roofs. The
 * conservatory is a shed with a pitched glass roof, which is exactly what
 * distinguishes it from the annexe's plain crate.
 */
export const GOODS: Record<string, () => Mesh> = {
  egg: () => assemble([egg([0, 0, 0], 0.62, 1.6, 12, BODY)]),

  // A drum with a lid a little wider than the body, which is the whole read on
  // a tin: the overhang is what says the top comes off.
  flake: () => assemble([
    cylinder([0, -0.08, 0], 0.6, 0.78, 14, BODY),
    cylinder([0, 0.38, 0], 0.66, 0.16, 14, DARK),
  ]),

  // Glass tube, black cap, and the dial you set it with.
  heater: () => assemble([
    cylinder([0, -0.18, 0], 0.15, 1.5, 10, GLASS),
    cylinder([0, 0.72, 0], 0.21, 0.34, 10, DARK),
    cylinder([0, 0.93, 0], 0.12, 0.1, 8, METAL),
  ]),

  // A hood over a horizontal tube. The tube lies down, which is what makes it
  // a strip light rather than a candle.
  lamp: () => assemble([
    box([0, 0.26, 0], [1.5, 0.34, 0.86], BODY),
    box([0, 0.44, 0], [1.6, 0.1, 0.94], DARK),
    cylinder([0, -0.06, 0], 0.13, 1.24, 10, GLOW, "x"),
  ]),

  // A keep and two towers with pointed roofs. Nothing else is needed: two
  // cones above a block is a castle at any resolution.
  castle: () => assemble([
    box([0, -0.42, 0], [1.1, 0.62, 0.78], BODY),
    cylinder([-0.36, 0.04, 0.1], 0.19, 0.94, 8, BODY),
    cone([-0.36, 0.66, 0.1], 0.25, 0.36, 8, ROOF),
    cylinder([0.34, 0.16, -0.08], 0.17, 1.16, 8, BODY),
    cone([0.34, 0.88, -0.08], 0.23, 0.34, 8, ROOF),
  ]),

  // A glass box with a rim and the bracket it bolts on by.
  annexe: () => assemble([
    box([0, -0.06, 0], [1.36, 0.86, 0.86], GLASS),
    box([0, 0.4, 0], [1.44, 0.12, 0.94], DARK),
    box([0, -0.52, 0], [1.44, 0.1, 0.94], DARK),
    box([-0.78, -0.06, 0], [0.22, 0.34, 0.34], METAL),
  ]),

  // The annexe with a pitched roof on it, which is the difference between a
  // tank and a glasshouse.
  conservatory: () => assemble([
    box([0, -0.42, 0], [1.16, 0.78, 0.86], GLASS),
    box([0, -0.02, 0], [1.24, 0.1, 0.92], DARK),
    roof([0, 0.28, 0], [1.24, 0.52, 0.92], ROOF),
  ]),
};
