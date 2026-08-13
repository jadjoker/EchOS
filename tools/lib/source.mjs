/**
 * Reads the shipped source as data.
 *
 * The lexicon and the hand-authored overrides are the input to generation, so
 * the tool parses the real files rather than keeping a second copy that drifts.
 * Regex rather than the TS compiler: the shapes are simple and literal, and a
 * parser dependency for build tooling is not worth it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SRC = join(ROOT, "src");

/** word -> category, first tag winning, exactly as lexicon.ts resolves it. */
export function readLexicon() {
  const src = readFileSync(join(SRC, "web", "lexicon.ts"), "utf8");
  const body = src.slice(src.indexOf("const WORDS"), src.indexOf("const LOOKUP"));
  const entries = new Map();
  for (const [, category, list] of body.matchAll(/(\w+):\s*`([^`]*)`/g)) {
    for (const word of list.split(/\s+/).filter(Boolean)) {
      if (!entries.has(word)) entries.set(word, category);
    }
  }
  return entries;
}

/** The category defaults, so generated entries can be checked for adding nothing. */
export function readCategoryDefaults() {
  const src = readFileSync(join(SRC, "web", "properties.ts"), "utf8");
  const body = slice(src, "const BY_CATEGORY", "\n};");
  return parseRecordOfProps(body);
}

/** Hand-authored overrides are canonical and are never regenerated. */
export function readHandOverrides() {
  const src = readFileSync(join(SRC, "web", "properties.ts"), "utf8");
  const body = slice(src, "const OVERRIDES", "\n};");
  return parseRecordOfProps(body);
}

/**
 * The existing lore pools, so generation can be told what already exists and
 * duplicates of the hand-written entries are impossible by construction.
 *
 * Two literal styles in play: backtick word-lists split on whitespace in
 * fishtank.ts, and arrays of quoted strings in fishlore.ts.
 */
export function readPoolSeeds() {
  const tank = readFileSync(join(SRC, "apps", "fishtank.ts"), "utf8");
  const lore = readFileSync(join(SRC, "gen", "fishlore.ts"), "utf8");

  return {
    names: words(tank, "PET_NAMES"),
    speciesHead: words(tank, "SPECIES_HEAD"),
    speciesTail: words(tank, "SPECIES_TAIL"),
    likes: strings(lore, "LIKES"),
    dislikes: strings(lore, "DISLIKES"),
    quotes: strings(lore, "QUOTES"),
    sources: strings(lore, "SOURCES"),
    temperaments: strings(lore, "TEMPERAMENTS"),
  };
}

function words(src, name) {
  const match = src.match(new RegExp(`const ${name}\\s*=\\s*\`([^\`]*)\``));
  return match ? match[1].split(/\s+/).filter(Boolean) : [];
}

function strings(src, name) {
  const match = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`));
  return match ? [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]) : [];
}

function slice(src, from, to) {
  const start = src.indexOf(from);
  if (start < 0) throw new Error(`source.mjs: could not find ${from}`);
  const end = src.indexOf(to, start);
  if (end < 0) throw new Error(`source.mjs: could not find end of ${from}`);
  return src.slice(start, end);
}

/** `key: { field: [...], scale: "x", alive: true },` blocks. */
function parseRecordOfProps(body) {
  const out = {};
  for (const [, key, block] of body.matchAll(/(\w+):\s*\{([\s\S]*?)\n  \}/g)) {
    const props = {};
    for (const [, field, items] of block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
      props[field] = [...items.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    }
    const scale = block.match(/scale:\s*"(\w+)"/);
    if (scale) props.scale = scale[1];
    const alive = block.match(/alive:\s*(true|false)/);
    if (alive) props.alive = alive[1] === "true";
    out[key] = props;
  }
  return out;
}
