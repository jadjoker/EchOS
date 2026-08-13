#!/usr/bin/env node
/**
 * Where the generated web says things that do not fit its subject.
 *
 * Variety and sense are different problems. A page can be structurally unique
 * and still tell you about the models and fitting instructions of a loaf of
 * bread, because some sentences quietly assume their subject is a manufactured
 * object and nothing stops them landing on food, an animal or an idea.
 *
 * This cannot judge prose. What it can do is take phrases that only make sense
 * for certain kinds of thing, generate pages across every category, and report
 * where they landed somewhere they should not have. That turns a vague "the
 * content did not match" into a list with counts.
 *
 * Usage:
 *   node tools/page-sense.mjs
 *   node tools/page-sense.mjs --per 40      # pages per category
 *   node tools/page-sense.mjs --show        # print offending sentences
 */

import { Rng } from "../src/core/rng.ts";
import { parseDomain } from "../src/web/domain.ts";
import { buildPage } from "../src/web/site.ts";
import { wordsIn } from "../src/web/lexicon.ts";

const args = process.argv.slice(2);
const PER = (() => {
  const i = args.indexOf("--per");
  return i === -1 ? 24 : Number(args[i + 1]);
})();
const SHOW = args.includes("--show");

/**
 * Each rule is a phrase and the categories it is allowed to appear for.
 * Anything else is a mismatch worth looking at.
 *
 * These are judgements, not facts, and the first draft of them was too strict:
 * it flagged wild yeast on a brewing page, spares for a board game, and
 * reconditioned furniture, all of which are ordinary English. Every `fits`
 * entry below was widened only after reading the sentence it was rejecting.
 * Resist widening one to make a number go down: a rule that never fires is
 * worth nothing, and the point of this file is to catch the next regression.
 */
const RULES = [
  // A coat comes in models. So does a lathe. Bread does not.
  { name: "models", phrase: /\bmodels?\b/i, fits: ["machine", "vehicle", "tool", "instrument", "game", "furniture", "garment"] },
  // Instruments genuinely ship with fitting instructions, for reeds and strings.
  { name: "fitting instructions", phrase: /\bfitting instructions\b/i, fits: ["machine", "vehicle", "tool", "furniture", "garment", "instrument"] },
  // Second hand furniture is a trade. Second hand cheese is not.
  { name: "reconditioned", phrase: /\breconditioned\b/i, fits: ["machine", "vehicle", "tool", "instrument", "furniture"] },
  // Board games lose pieces, and shops sell the pieces.
  { name: "spares", phrase: /\bspares?\b/i, fits: ["machine", "vehicle", "tool", "instrument", "game", "furniture"] },
  { name: "wiring", phrase: /\bwiring\b/i, fits: ["machine", "vehicle"] },
  { name: "serial number", phrase: /\bserial number\b/i, fits: ["machine", "vehicle", "tool", "instrument"] },
  { name: "breeding", phrase: /\bbreeding\b/i, fits: ["animal", "plant"] },
  // "Wild yeast" is what a brewer calls it.
  { name: "wild", phrase: /\bwild\b/i, fits: ["animal", "plant", "place", "weather", "drink", "food"] },
  { name: "feeding", phrase: /\bfeed(ing)?\b/i, fits: ["animal", "plant", "food"] },
  { name: "worn", phrase: /\bworn\b/i, fits: ["garment", "machine", "tool", "vehicle", "furniture"] },
];

const CATEGORIES = [
  "animal", "plant", "mineral", "food", "drink", "tool", "vehicle", "garment",
  "material", "furniture", "machine", "game", "instrument", "place", "role",
  "abstract", "activity", "field", "organisation", "media", "weather", "body",
];

const hits = new Map();
const samples = [];
let pages = 0;

for (const category of CATEGORIES) {
  const words = wordsIn(category);
  if (!words.length) continue;

  for (let i = 0; i < PER; i++) {
    const word = words[i % words.length];
    const rng = Rng.fromSeed(`${1000 + (i % 9000)}-HUSK`).derive(`sense:${category}:${i}`);
    const subject = parseDomain(`${word}.com`);
    const page = buildPage(rng, subject);
    pages++;

    // The subject's own category, not the list this word came from. A word can
    // classify differently once parsed, and blaming the wrong category sends
    // you hunting for a bug that is not there.
    const actual = subject.category;

    const text = page.blocks
      .map((b) => ("text" in b ? b.text : "items" in b && Array.isArray(b.items)
        ? b.items.map((x) => (typeof x === "string" ? x : x.name ?? "")).join(" ")
        : ""))
      .join("  ");

    for (const rule of RULES) {
      if (!rule.phrase.test(text)) continue;
      if (rule.fits.includes(actual)) continue;
      const key = `"${rule.name}" on ${actual}`;
      hits.set(key, (hits.get(key) ?? 0) + 1);
      if (SHOW && samples.length < 25) {
        const sentence = text.split(/(?<=\.)\s+/).find((s) => rule.phrase.test(s));
        if (sentence) samples.push(`[${actual}/${word}] ${sentence.trim()}`);
      }
    }
  }
}

const ranked = [...hits.entries()].sort((a, b) => b[1] - a[1]);
const total = ranked.reduce((sum, [, n]) => sum + n, 0);

console.log(`\n  ${pages} pages across ${CATEGORIES.length} categories`);
console.log(`  ${total} mismatches, ${ranked.length} distinct kinds\n`);
for (const [key, n] of ranked.slice(0, 20)) {
  console.log(`  ${String(n).padStart(4)}x  ${key}`);
}
if (SHOW) {
  console.log(`\n  examples`);
  for (const s of samples) console.log(`    ${s}`);
}
console.log("");
