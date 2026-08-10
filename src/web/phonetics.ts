/**
 * Reading an invented word by its sound.
 *
 * "What happens if a user types a made-up word" is the question the whole
 * browser lives or dies on, and "it falls back to something generic" is the
 * wrong answer. A machine that treats glorbus and flumph and kraxdor
 * identically has admitted it isn't really generating anything.
 *
 * So we listen to the shape of it. Sound carries meaning independent of
 * definition — the bouba/kiki effect is one of the most reliably reproduced
 * results in psycholinguistics: rounded vowels and liquids (l, m, n, o, u) read
 * as large, soft and round; sharp vowels with plosives and sibilants (k, t, p,
 * i, e) read as small, hard and angular. That is enough to give an invented
 * word a character, and character is all the page generator needs.
 *
 * Deterministic on purpose. The same invented word must always read as the same
 * kind of thing, or the web stops being a place.
 */

import type { Category } from "./lexicon.ts";
import { propsFor, type Props, type Scale } from "./properties.ts";

const PLOSIVES = new Set("pbtdkgqc");
const SIBILANTS = new Set("szx");
const FRICATIVES = new Set("fvh");
const LIQUIDS = new Set("lr");
const NASALS = new Set("mn");
const VOWELS = new Set("aeiouy");
const OPEN_VOWELS = new Set("aou");

/** Endings that carry meaning strongly enough to override the sound profile. */
const ENDINGS: readonly (readonly [RegExp, Category, string])[] = [
  [/(?:tron|tech|tek|tec|byte|comp|matic|otron|tronic)$/, "machine", "a machine or apparatus"],
  [/(?:ium|ius|eum)$/, "mineral", "an element or a mineral"],
  [/(?:ol|ine|ate|ide|ase|yl)$/, "material", "a compound or a substance"],
  [/(?:ite|oid|yte)$/, "mineral", "a mineral or a specimen"],
  [/(?:ling|kin|let|chick|pup)$/, "animal", "a small living creature"],
  [/(?:us|um|ia|ae)$/, "organisation", "an institution or a genus"],
  [/(?:ery|ory|arium|orium|atorium)$/, "place", "a building or an establishment"],
  [/(?:ism|ology|osophy)$/, "abstract", "a doctrine or a discipline"],
  [/(?:wort|weed|bane|leaf|root)$/, "plant", "a plant, probably medicinal"],
  [/(?:shire|ford|ton|mere|combe|dale)$/, "place", "a settlement"],
];

export interface Reading {
  category: Category;
  props: Props;
  scale: Scale;
  alive: boolean;
  /** Shown in the browser's status bar. Makes the machine's guess legible. */
  gloss: string;
}

interface Profile {
  length: number;
  hardness: number;
  softness: number;
  openness: number;
  vowelRatio: number;
  /**
   * Openness weighted by how much of the word is actually vowel.
   *
   * Raw openness is a trap: "plonk" has one vowel, that vowel is open, so
   * openness reads 1.0 and the word scores as round and enormous. Multiplying
   * by vowel density gives "how round does this sound overall", which is the
   * thing bouba/kiki is really about.
   */
  roundness: number;
  /** m and n specifically. The most animal-sounding letters we have. */
  nasality: number;
}

function profile(word: string): Profile {
  const letters = [...word.toLowerCase()].filter((c) => /[a-z]/.test(c));
  const n = Math.max(1, letters.length);

  let plosive = 0, sibilant = 0, fricative = 0, liquid = 0, nasal = 0, vowel = 0, open = 0;
  for (const c of letters) {
    if (PLOSIVES.has(c)) plosive++;
    if (SIBILANTS.has(c)) sibilant++;
    if (FRICATIVES.has(c)) fricative++;
    if (LIQUIDS.has(c)) liquid++;
    if (NASALS.has(c)) nasal++;
    if (VOWELS.has(c)) {
      vowel++;
      if (OPEN_VOWELS.has(c)) open++;
    }
  }

  const openness = vowel > 0 ? open / vowel : 0;
  const vowelRatio = vowel / n;

  return {
    length: letters.length,
    // Fricatives are abrasive but not percussive, so they count for half.
    hardness: (plosive + sibilant + fricative * 0.5) / n,
    softness: (liquid + nasal) / n,
    openness,
    vowelRatio,
    roundness: openness * vowelRatio,
    nasality: nasal / n,
  };
}

/** Small and sharp, or big and round? The core bouba/kiki axis. */
function scaleFrom(p: Profile): Scale {
  const bigness =
    (p.length - 7) * 0.18 + p.roundness * 1.6 + p.softness * 1.0 - p.hardness * 1.4;
  if (bigness < -0.5) return "tiny";
  if (bigness < -0.12) return "small";
  if (bigness < 0.4) return "medium";
  if (bigness < 0.85) return "large";
  return "huge";
}

export function readInvented(word: string): Reading {
  const clean = word.toLowerCase();
  const p = profile(clean);
  const scale = scaleFrom(p);

  for (const [pattern, category, gloss] of ENDINGS) {
    if (pattern.test(clean)) {
      return finish(clean, category, scale, gloss);
    }
  }

  // No informative ending — decide on the sound profile alone. Scored rather
  // than branched so the thresholds can be tuned without restructuring.
  // Every score that used raw `openness` now uses `roundness`, and the hard
  // categories subtract softness rather than merely not adding it — otherwise
  // one open vowel was enough to make anything edible.
  const scores: [Category, number, string][] = [
    // Nasals get their own term for creatures: m and n are the single most
    // animal-sounding letters in English and softness alone under-weights them.
    ["animal", p.softness * 2.0 + p.nasality * 1.4 + p.vowelRatio * 1.5 - p.hardness * 0.7, "a living creature"],
    ["tool", p.hardness * 1.7 - p.softness * 0.5 + (p.length <= 6 ? 0.7 : 0), "a hand tool or implement"],
    ["machine", p.hardness * 1.4 + (p.length >= 8 ? 0.9 : 0), "a machine or apparatus"],
    ["mineral", p.hardness * 1.3 + (p.vowelRatio < 0.35 ? 0.5 : 0), "a mineral or a hard substance"],
    ["food", p.roundness * 2.2 + p.softness * 0.9 - p.hardness * 1.2 + (p.length <= 7 ? 0.3 : 0), "something edible"],
    ["place", p.softness * 1.1 + (p.length >= 9 ? 1.1 : 0) + p.roundness * 0.8, "a place"],
    ["abstract", p.vowelRatio * 1.6 + (p.length >= 9 ? 0.8 : 0) - p.hardness * 0.3, "a concept, or a rumour"],
    ["plant", p.softness * 1.2 + p.roundness * 1.0 + p.vowelRatio * 0.6, "a plant"],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [category = "abstract", , gloss = "something"] = scores[0] ?? [];
  return finish(clean, category, scale, gloss);
}

function finish(word: string, category: Category, scale: Scale, gloss: string): Reading {
  const base = propsFor(word, category);
  const props: Props = { ...base, scale };
  const sizeWord: Record<Scale, string> = {
    tiny: "very small", small: "small", medium: "middling",
    large: "large", huge: "enormous",
  };
  return {
    category,
    props,
    scale,
    alive: base.alive,
    gloss: `${sizeWord[scale]} — ${gloss}`,
  };
}
