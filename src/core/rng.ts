/**
 * Deterministic seeded randomness.
 *
 * Every generated thing in the machine must come from here. If a seed
 * reproduces a machine exactly, seeds are shareable — and seed sharing is the
 * marketing engine, not a feature.
 *
 * The canonical seed is the *string* ("4471-OSSUARY"). We hash it to a uint32
 * for the PRNG rather than the other way round, so round-tripping through the
 * URL bar is exact by construction and there is no encode/decode pair to drift.
 */

/** Words are chosen to read like something recovered, not something branded. */
const WORDS = [
  "OSSUARY", "LANTERN", "MERIDIAN", "HOLLOW", "TALLOW", "VESSEL", "CINDER",
  "MARROW", "PALLOR", "THRESHOLD", "AUGUR", "BASALT", "CHANTRY", "DRIFT",
  "EMBER", "FALLOW", "GANTRY", "HUSK", "IVORY", "JETSAM", "KEEL", "LODE",
  "MANTLE", "NACRE", "ORACLE", "PLINTH", "QUARRY", "RELIC", "SALVAGE",
  "TITHE", "UMBRA", "VERGE", "WICK", "XENON", "YARROW", "ZENITH", "ANVIL",
  "BRACKISH", "CAIRN", "DERELICT", "ESTUARY", "FURLONG", "GLEAN", "HARROW",
  "INGOT", "JUNCTURE", "KILN", "LIMEN", "MIDDEN", "NOCTURNE", "OBELISK",
  "PUMICE", "QUIETUS", "RIGGING", "SEXTANT", "TANNERY", "UNDERTOW", "VELLUM",
  "WHETSTONE", "XYLEM", "YAWL", "ZEPHYR", "ASHEN", "BALLAST",
] as const;

export type Seed = string;

/** xmur3 — string to a well-mixed uint32. */
function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — small, fast, good enough, and stable across engines. */
function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_SHAPE = /^(\d{4})-([A-Z]{3,12})$/;

/** A fresh seed, from real entropy — the only unseeded randomness we allow. */
export function randomSeed(): Seed {
  const n = 1000 + Math.floor(Math.random() * 9000);
  const word = WORDS[Math.floor(Math.random() * WORDS.length)] ?? "OSSUARY";
  return `${n}-${word}`;
}

/**
 * Accept anything a human might paste. Returns null if it can't be read as a
 * seed — callers decide whether that means "fall back to random" or "complain".
 */
export function normalizeSeed(input: string): Seed | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "-");
  return SEED_SHAPE.test(cleaned) ? cleaned : null;
}

export class Rng {
  readonly seed: Seed;
  private readonly root: number;
  private next01: () => number;

  private constructor(seed: Seed, root: number) {
    this.seed = seed;
    this.root = root;
    this.next01 = mulberry32(root);
  }

  static fromSeed(seed: Seed): Rng {
    return new Rng(seed, hashString(seed));
  }

  /**
   * An independent stream for one subsystem.
   *
   * This matters more than it looks: if every generator pulled from one shared
   * stream, adding a single roll anywhere would shift every later roll and
   * silently break every seed people had shared. Namespaced substreams mean a
   * new generator can be added without invalidating old seeds.
   *
   * Derived from the root, not the current state, so it does not matter when
   * during a boot you ask for it.
   *
   * The root is mixed in by HASHING IT TOGETHER with the namespace, not by
   * XOR-ing. XOR is commutative and self-inverse, which quietly broke the one
   * guarantee this method exists to provide:
   *
   *   derive("a").derive("b")  ===  derive("b").derive("a")
   *   derive("x").derive("x")  ===  the root stream itself
   *
   * Nested derives are already normal here — the browser derives `app:browser`
   * then `page:<domain>`, a site derives `site:<domain>` then `solid:<caption>`
   * — so two unrelated chains could land on one stream and produce the same
   * "random" object twice, or collapse back onto the root and correlate with
   * everything. Composing the string first makes the order of a chain matter,
   * which is what a namespace path is supposed to mean.
   */
  derive(namespace: string): Rng {
    return new Rng(this.seed, hashString(`${this.root}/${namespace}`));
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next01();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next01() * (max - min);
  }

  /** Integer in [min, max], inclusive both ends. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next01() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next01() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty list");
    return items[Math.floor(this.next01() * items.length)] as T;
  }

  /** Weighted pick. Weights need not sum to 1; non-positive weights never win. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error("Rng.weighted: no positive weights");
    let roll = this.next01() * total;
    for (const [value, weight] of entries) {
      roll -= Math.max(0, weight);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next01() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** n distinct items. Returns fewer only if the pool is smaller than n. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, n);
  }
}
