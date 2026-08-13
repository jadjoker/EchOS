/**
 * What a fish looks like, read off the name it was already given.
 *
 * The shop has always named fish out of two word lists — 21 heads and 16 tails,
 * "Marbled perch", "Whiptail loach" — and the tank has always drawn the same
 * ellipse with a triangle on the back of it whatever the name said. Every fish
 * in the game was one fish in a different colour, and the most specific thing
 * on the card was decoration.
 *
 * Sort the head words by what they claim and they fall into two piles with
 * almost nothing left over. Spotted, Banded, Marbled, Clouded, Painted are
 * MARKINGS. Ribbon, Whiptail, Fantail, Moon, Dwarf, Emperor are SHAPES. The
 * data to draw a legibly different cast has been sitting in the generator the
 * whole time, printed on screen and thrown away.
 *
 * So: the tail word sets the body, because that is the half that carries the
 * fish-ness (a loach is long and low, an angelfish is a disc), and the head
 * word then bends it, marks it, or changes how it takes the light.
 *
 * Two things this deliberately does NOT do. It stores nothing new — the
 * species string is already generated, already saved on every fish you own,
 * so a fish bought three machines ago grows its proper body the moment it is
 * next drawn. And it never fails on an unknown word: the lists are extended at
 * runtime from `fishlore.generated.ts`, so a head or tail this file has never
 * heard of has to come out as an ordinary fish rather than as nothing.
 */

import type { Rng } from "../core/rng.ts";

export type TailKind = "plain" | "fan" | "whip" | "ribbon";
export type Finish = "glass" | "ghost" | "velvet" | "metal" | "thin";

/** One marking, in units of the fish's own size so it scales with the fish. */
export type Mark =
  | { kind: "band"; x: number; tilt: number }
  | { kind: "spot"; x: number; y: number; r: number }
  | { kind: "blob"; x: number; y: number; steps: readonly { cx: number; cy: number; x: number; y: number }[] }
  | { kind: "cloud"; x: number; y: number; r: number }
  | { kind: "splash"; x: number; y: number; rx: number; ry: number; rot: number; hue: number };

export interface FishForm {
  /** Body half-length and depth, as multiples of the fish's size. */
  len: number;
  depth: number;
  /** Fin heights, as multiples of size. */
  dorsal: number;
  anal: number;
  tail: TailKind;
  tailScale: number;
  barbels: boolean;
  feelers: boolean;
  /** A row of spines rather than a single sail. Perch and their relatives. */
  spiny: boolean;
  /** Multiplies the fish's drawn size. Dwarf is small, Emperor is not. */
  scale: number;
  finish: Finish | null;
  /** Precomputed once. Rolling markings per frame would be per fish per 60Hz. */
  marks: readonly Mark[];
  /** Some names are a colour. A Blue guppy that came out red was a bad joke. */
  hue: number | null;
}

interface BodyPlan {
  len: number;
  depth: number;
  dorsal: number;
  anal: number;
  barbels?: boolean;
  feelers?: boolean;
  spiny?: boolean;
  tailScale?: number;
}

/**
 * The tail word sets the body.
 *
 * These are proportions a fishkeeper would recognise, and that is the whole
 * point: the name has to be a promise the picture keeps. Anything not listed
 * gets DEFAULT_BODY, which is an ordinary fish and an honest answer for a word
 * we do not know.
 */
const DEFAULT_BODY: BodyPlan = { len: 1, depth: 0.85, dorsal: 0.75, anal: 0.6 };

const BODY: Record<string, BodyPlan> = {
  barb:      { len: 1.00, depth: 0.88, dorsal: 0.80, anal: 0.60 },
  tetra:     { len: 1.00, depth: 0.78, dorsal: 0.70, anal: 0.60 },
  danio:     { len: 1.35, depth: 0.55, dorsal: 0.50, anal: 0.50 },
  rasbora:   { len: 1.20, depth: 0.68, dorsal: 0.60, anal: 0.55 },
  guppy:     { len: 0.90, depth: 0.70, dorsal: 0.70, anal: 0.60, tailScale: 1.7 },
  molly:     { len: 1.00, depth: 0.85, dorsal: 0.80, anal: 0.70 },
  platy:     { len: 0.95, depth: 0.90, dorsal: 0.70, anal: 0.60 },
  loach:     { len: 1.75, depth: 0.46, dorsal: 0.45, anal: 0.40, barbels: true },
  gourami:   { len: 0.95, depth: 1.15, dorsal: 0.80, anal: 1.15, feelers: true },
  cichlid:   { len: 1.00, depth: 1.00, dorsal: 1.20, anal: 0.80 },
  catfish:   { len: 1.45, depth: 0.60, dorsal: 0.90, anal: 0.40, barbels: true },
  angelfish: { len: 0.82, depth: 1.40, dorsal: 1.60, anal: 1.50 },
  killifish: { len: 1.20, depth: 0.62, dorsal: 0.70, anal: 0.70 },
  minnow:    { len: 1.25, depth: 0.58, dorsal: 0.60, anal: 0.50 },
  carp:      { len: 1.05, depth: 1.05, dorsal: 0.90, anal: 0.60, barbels: true },
  perch:     { len: 1.05, depth: 0.95, dorsal: 1.30, anal: 0.70, spiny: true },
};

type Pattern = "spots" | "bands" | "marble" | "cloud" | "paint";

interface HeadPlan {
  body?: (b: BodyPlan) => BodyPlan;
  tail?: TailKind;
  scale?: number;
  pattern?: Pattern;
  finish?: Finish;
  hue?: number;
}

/**
 * The head word modifies it.
 *
 * Every one of the 21 does something visible. A head that changed nothing
 * would put us back where we started, with a word on the card that the picture
 * ignores, so "does this word earn its place" is the test to apply to any new
 * one.
 */
const HEAD: Record<string, HeadPlan> = {
  Ribbon:   { tail: "ribbon", body: (b) => ({ ...b, len: b.len * 1.75, depth: b.depth * 0.55 }) },
  Whiptail: { tail: "whip", body: (b) => ({ ...b, tailScale: (b.tailScale ?? 1) * 2.1 }) },
  Fantail:  { tail: "fan", body: (b) => ({ ...b, tailScale: (b.tailScale ?? 1) * 1.75 }) },
  Moon:     { body: (b) => ({ ...b, len: b.len * 0.74, depth: b.depth * 1.7, dorsal: b.dorsal * 1.35, anal: b.anal * 1.35 }) },
  Dwarf:    { scale: 0.62, body: (b) => ({ ...b, len: b.len * 0.85, depth: b.depth * 1.12 }) },
  Lesser:   { scale: 0.78 },
  Emperor:  { scale: 1.34, body: (b) => ({ ...b, depth: b.depth * 1.15, dorsal: b.dorsal * 1.55 }) },
  Royal:    { scale: 1.18, body: (b) => ({ ...b, dorsal: b.dorsal * 1.45, anal: b.anal * 1.45, tailScale: (b.tailScale ?? 1) * 1.35 }) },
  Paper:    { finish: "thin", body: (b) => ({ ...b, depth: b.depth * 1.25, len: b.len * 0.92 }) },
  Common:   {},
  Glass:    { finish: "glass" },
  Ghost:    { finish: "ghost" },
  Velvet:   { finish: "velvet" },
  Golden:   { finish: "metal", hue: 45 },
  Copper:   { finish: "metal", hue: 22 },
  Blue:     { hue: 208 },
  Spotted:  { pattern: "spots" },
  Banded:   { pattern: "bands" },
  Marbled:  { pattern: "marble" },
  Clouded:  { pattern: "cloud" },
  Painted:  { pattern: "paint" },
};

/**
 * Markings, rolled once and kept.
 *
 * Positions are in body units: x runs to ±len, y to ±depth/2, so the same
 * marks fit whatever size the fish is drawn at. They are generated slightly
 * outside the body on purpose and clipped to it when drawn, which is what
 * makes a band run off the edge of a flank instead of stopping short of it.
 */
function markingsFor(pattern: Pattern | undefined, body: BodyPlan, rng: Rng, hue: number): Mark[] {
  if (!pattern) return [];
  const marks: Mark[] = [];
  const halfDepth = body.depth * 0.5;

  switch (pattern) {
    case "bands": {
      const count = rng.int(4, 7);
      for (let i = 0; i < count; i++) {
        marks.push({
          kind: "band",
          x: -body.len + (i + 0.5) * (body.len * 2 / count),
          tilt: rng.range(-0.18, 0.18),
        });
      }
      return marks;
    }
    case "spots": {
      const count = rng.int(9, 16);
      for (let i = 0; i < count; i++) {
        marks.push({
          kind: "spot",
          x: rng.range(-1, 1) * body.len,
          y: rng.range(-1, 1) * halfDepth,
          r: rng.range(0.05, 0.12),
        });
      }
      return marks;
    }
    case "marble": {
      const count = rng.int(5, 8);
      for (let i = 0; i < count; i++) {
        const x = rng.range(-1, 1) * body.len;
        const y = rng.range(-1, 1) * halfDepth;
        const steps = Array.from({ length: 5 }, (_, k) => {
          const angle = (k / 5) * Math.PI * 2;
          const r = rng.range(0.12, 0.34);
          return {
            cx: Math.cos(angle) * r * 1.5,
            cy: Math.sin(angle) * r * 1.5,
            x: Math.cos(angle + 1.2) * r,
            y: Math.sin(angle + 1.2) * r,
          };
        });
        marks.push({ kind: "blob", x, y, steps });
      }
      return marks;
    }
    case "cloud": {
      for (let i = 0; i < 4; i++) {
        marks.push({
          kind: "cloud",
          x: rng.range(-1, 1) * body.len,
          y: rng.range(-1, 1) * halfDepth,
          r: rng.range(0.4, 0.9),
        });
      }
      return marks;
    }
    case "paint": {
      const count = rng.int(3, 5);
      for (let i = 0; i < count; i++) {
        marks.push({
          kind: "splash",
          x: rng.range(-1, 1) * body.len,
          y: rng.range(-1, 1) * halfDepth,
          rx: rng.range(0.16, 0.40),
          ry: rng.range(0.10, 0.30),
          rot: rng.range(0, 3),
          // Far enough round to read as a second colour rather than a shadow.
          hue: (hue + rng.int(60, 300)) % 360,
        });
      }
      return marks;
    }
  }
}

/**
 * "Marbled perch" becomes a body.
 *
 * `hue` is passed in because the paint splashes are picked relative to the
 * fish's own colour; everything else depends only on the name.
 */
export function formFor(species: string, hue: number, rng: Rng): FishForm {
  const [head = "", tail = ""] = species.split(/\s+/);
  const plan = HEAD[head] ?? {};
  const base = BODY[tail.toLowerCase()] ?? DEFAULT_BODY;
  const body = plan.body ? plan.body(base) : base;

  return {
    len: body.len,
    depth: body.depth,
    dorsal: body.dorsal,
    anal: body.anal,
    tail: plan.tail ?? "plain",
    tailScale: body.tailScale ?? 1,
    barbels: body.barbels === true,
    feelers: body.feelers === true,
    spiny: body.spiny === true,
    scale: plan.scale ?? 1,
    finish: plan.finish ?? null,
    marks: markingsFor(plan.pattern, body, rng, plan.hue ?? hue),
    hue: plan.hue ?? null,
  };
}
