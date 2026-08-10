/**
 * Influence: what one program does to another when you connect them.
 *
 * The naive version of this feature is a table of pairs — aquarium plus browser
 * equals fish on websites, weather plus aquarium equals a cold tank. That dies
 * immediately: five programs is twenty ordered pairs, fifteen is two hundred
 * and ten, and none of it composes when you plug three things into one input.
 *
 * So nothing is authored per pair. A program EMITS a bundle of traits and
 * ABSORBS the traits it has a receptor for. The effect is emitter × receptor,
 * each authored once. Adding a program adds one emitter and one receptor and
 * gets every combination with everything else for free.
 *
 * Influences MERGE. Three programs feeding the browser stack up rather than
 * fighting, which is the whole reason many-to-one connections are allowed.
 */

/** Something that can be drawn wandering around inside another program. */
export interface Agent {
  kind: "fish" | "drop" | "spark" | "glyph" | "leaf" | "mote";
  label: string;
  /** 0–359 */
  hue: number;
  /** 0–1, relative to the host's idea of big. */
  size: number;
  /** 0–1 */
  speed: number;
}

export interface Influence {
  /** Program titles, for the "what is happening" status line. */
  sources: string[];
  /** Coarse flavour: "aquatic", "meteorological", "commercial", "textual". */
  tags: string[];
  /** Things that swim, drift or crawl through the receiving program. */
  agents: Agent[];
  /** Vocabulary to inject into whatever text the receiver generates. */
  words: string[];
  /** Hues to bleed into the receiver's palette. */
  palette: number[];
  /** A time series, roughly -1..1, for anything that moves. */
  rhythm: number[];
  /** Named quantities: temperature, wetness, agitation, crowding. */
  scalars: Record<string, number>;
}

/** Caps, so a feedback loop can't grow an influence without bound. */
const LIMITS = { agents: 24, words: 40, palette: 12, rhythm: 128, sources: 8 };

export function emptyInfluence(): Influence {
  return { sources: [], tags: [], agents: [], words: [], palette: [], rhythm: [], scalars: {} };
}

export function isEmpty(influence: Influence): boolean {
  return (
    influence.agents.length === 0 &&
    influence.words.length === 0 &&
    influence.palette.length === 0 &&
    influence.rhythm.length === 0 &&
    Object.keys(influence.scalars).length === 0
  );
}

function unique<T>(items: T[], limit: number): T[] {
  return [...new Set(items)].slice(0, limit);
}

/**
 * Combine several influences into one.
 *
 * Lists concatenate and cap; scalars average, because two cold things should
 * not read as twice as cold. Rhythms are summed element-wise and normalised so
 * plugging in a second oscillator changes the shape rather than the volume.
 */
export function mergeInfluences(parts: readonly Influence[]): Influence {
  const live = parts.filter((p) => !isEmpty(p));
  if (live.length === 0) return emptyInfluence();
  if (live.length === 1) return live[0] as Influence;

  const out = emptyInfluence();

  for (const part of live) {
    out.sources.push(...part.sources);
    out.tags.push(...part.tags);
    out.agents.push(...part.agents);
    out.words.push(...part.words);
    out.palette.push(...part.palette);
  }

  out.sources = unique(out.sources, LIMITS.sources);
  out.tags = unique(out.tags, 8);
  out.agents = out.agents.slice(0, LIMITS.agents);
  out.words = unique(out.words, LIMITS.words);
  out.palette = out.palette.slice(0, LIMITS.palette);

  const rhythms = live.map((p) => p.rhythm).filter((r) => r.length > 0);
  if (rhythms.length > 0) {
    const length = Math.min(LIMITS.rhythm, Math.max(...rhythms.map((r) => r.length)));
    out.rhythm = Array.from({ length }, (_, i) => {
      let sum = 0;
      for (const r of rhythms) sum += r[i % r.length] ?? 0;
      return sum / rhythms.length;
    });
  }

  const counts: Record<string, number> = {};
  for (const part of live) {
    for (const [key, value] of Object.entries(part.scalars)) {
      out.scalars[key] = (out.scalars[key] ?? 0) + value;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(out.scalars)) {
    out.scalars[key] = (out.scalars[key] ?? 0) / (counts[key] ?? 1);
  }

  return out;
}

/** One-line description of what an influence is doing, for the status bar. */
export function describeInfluence(influence: Influence): string {
  if (isEmpty(influence)) return "";
  const bits: string[] = [];
  if (influence.agents.length) bits.push(`${influence.agents.length} visitors`);
  if (influence.words.length) bits.push(`${influence.words.length} words`);
  if (influence.palette.length) bits.push("colour");
  if (influence.rhythm.length) bits.push("motion");
  for (const [key, value] of Object.entries(influence.scalars)) {
    bits.push(`${key} ${value.toFixed(1)}`);
  }
  return `${influence.sources.join(" + ")} → ${bits.join(", ")}`;
}
