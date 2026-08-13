#!/usr/bin/env node
/**
 * How many pages before two feel the same.
 *
 * The generated web passes trillions of pages by permutation count and that
 * number means nothing. What a player notices is repetition of STRUCTURE and
 * of PHRASING, and neither is improved by adding more nouns. This measures the
 * two things that actually degrade:
 *
 *   shape    the archetype plus its ordered run of block kinds. Two pages with
 *            the same shape read as the same page wearing different words.
 *   opener   the first few words of each paragraph. One template with holes in
 *            it shows up here as the same opener over and over, however
 *            different the nouns dropped into it are.
 *   template the same opener with every proper noun and number blanked. This
 *            exists because the plain opener LIES about the worst offenders:
 *            "Ashcombe Ltd is a leading provider of..." and "Thornfield Ltd is
 *            a leading provider of..." are one sentence written once, and the
 *            opener metric scored them as two, purely because the variable part
 *            happened to come first. Every archetype whose paragraph starts
 *            with the site's own name was invisible until this was added.
 *
 * All are reported as "pages until the first repeat", because that is the
 * number a person experiences: nobody counts distinct skeletons, they notice
 * the twelfth page sounding like the third.
 *
 * Usage:
 *   node tools/page-variety.mjs            # 400 pages from random domains
 *   node tools/page-variety.mjs --n 1000
 *   node tools/page-variety.mjs --show 12  # print some openers
 */

import { Rng } from "../src/core/rng.ts";
import { parseDomain } from "../src/web/domain.ts";
import { buildPage } from "../src/web/site.ts";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

const COUNT = flag("n", 400);
const SHOW = flag("show", 0);

/** Domains a person would actually try: real words, compounds, invented. */
const STEMS = `otter kiln ferret trampoline knitting marrow anvil lantern
  glorbus skritt mooloona flumph kraxdor plonk wibble tarn brindle hoggle
  cistern marmalade locust mallet pride reading duck order brewing builder
  sailing gantry vellum quarry tannery midden nocturne obelisk pumice rigging
  sextant undertow whetstone xylem yawl zephyr ballast cairn derelict estuary`
  .trim().split(/\s+/);
const TAILS = ["com", "net", "org", "co.uk", "info"];
const AFFIX = ["", "", "", "world", "shop", "club", "central", "ology", "corp", "page"];

function domainFor(rng) {
  const stem = rng.pick(STEMS);
  return `${stem}${rng.pick(AFFIX)}.${rng.pick(TAILS)}`;
}

/** First five words, lowercased, punctuation stripped. */
function opener(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
}

/**
 * The same, with everything that varies per page blanked to "@".
 *
 * Two rules, and between them they catch what a reader's ear catches. A word
 * carrying a digit is a year, a price or a count. A capitalised word that is
 * not starting a sentence is a person, a town or the site itself — the only
 * capitals this generator's prose produces mid-sentence are proper nouns.
 *
 * The subject's own stem goes too, wherever it lands and whatever it was
 * inflected into, because "every kiln is checked" and "every marrow is checked"
 * are one sentence and should score as one.
 */
function template(text, subject) {
  const stem = subject.stem.toLowerCase();
  const root = stem.replace(/(us|os|ix|ex|um|a)$/, "") || stem;
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];

  for (let i = 0; i < words.length && out.length < 5; i++) {
    const word = words[i];
    const bare = word.replace(/[^A-Za-z0-9]/g, "");
    if (!bare) continue;

    // A full stop on the PREVIOUS word is what makes this one sentence-initial,
    // where a capital says nothing about whether it is a name.
    const opensSentence = i === 0 || /[.!?]["')\]]?$/.test(words[i - 1]);
    const lower = bare.toLowerCase();

    if (/\d/.test(bare)) out.push("@");
    else if (!opensSentence && /^[A-Z]/.test(bare)) out.push("@");
    else if (root.length >= 3 && lower.startsWith(root)) out.push("@");
    else out.push(lower);
  }
  return out.join(" ");
}

const shapes = new Map();
const openers = new Map();
const templates = new Map();
const archetypes = new Map();
let firstShapeRepeat = null;
let firstOpenerRepeat = null;
let firstTemplateRepeat = null;
let withFigure = 0;
const examples = [];

for (let i = 0; i < COUNT; i++) {
  const rng = Rng.fromSeed(`${1000 + (i % 9000)}-KEEL`).derive(`page:${i}`);
  const subject = parseDomain(domainFor(rng));
  const page = buildPage(rng.derive("build"), subject);

  // A page with no figure is a page with nothing to look at, and two of the
  // archetypes used to have no figure section at all, so their pages could
  // never have one however the dice fell.
  if (page.blocks.some((b) => b.kind === "figure")) withFigure++;

  const shape = `${page.archetype}:${page.blocks.map((b) => b.kind).join(",")}`;
  if (shapes.has(shape) && firstShapeRepeat === null) firstShapeRepeat = i + 1;
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
  archetypes.set(page.archetype, (archetypes.get(page.archetype) ?? 0) + 1);

  for (const block of page.blocks) {
    const text = block.kind === "para" ? block.text
      : block.kind === "heading" ? block.text
        : null;
    if (!text) continue;
    const key = opener(text);
    if (key.split(" ").length < 3) continue;
    if (openers.has(key) && firstOpenerRepeat === null) firstOpenerRepeat = i + 1;
    openers.set(key, (openers.get(key) ?? 0) + 1);

    // Headings are excluded from the template count on purpose. "Price List"
    // recurring across shops is what a real web looked like; a paragraph
    // recurring is the thing being measured.
    if (block.kind === "para") {
      const shell = template(text, subject);
      if (shell.split(" ").length >= 3) {
        if (templates.has(shell) && firstTemplateRepeat === null) firstTemplateRepeat = i + 1;
        templates.set(shell, (templates.get(shell) ?? 0) + 1);
      }
    }

    if (examples.length < SHOW) examples.push(text);
  }
}

const totalOpeners = [...openers.values()].reduce((a, b) => a + b, 0);
const totalTemplates = [...templates.values()].reduce((a, b) => a + b, 0);
const worst = [...openers.entries()].filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1]).slice(0, 8);
const worstTemplates = [...templates.entries()].filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1]).slice(0, 8);

console.log(`\n  ${COUNT} pages\n`);
console.log(`  archetypes in use        ${archetypes.size}`);
console.log(`  distinct shapes          ${shapes.size}`);
console.log(`  pages until shape repeat ${firstShapeRepeat ?? "none"}`);
console.log(`  distinct openers         ${openers.size} of ${totalOpeners} lines`);
console.log(`  pages until line repeat  ${firstOpenerRepeat ?? "none"}`);
console.log(`  distinct templates       ${templates.size} of ${totalTemplates} paragraphs`);
console.log(`  pages until template rpt ${firstTemplateRepeat ?? "none"}`);
console.log(`  pages with a picture     ${withFigure} (${Math.round((withFigure / COUNT) * 100)}%)`);
console.log(`\n  most reused openings`);
for (const [key, n] of worst) console.log(`    ${String(n).padStart(4)}x  ${key}...`);
console.log(`\n  most reused paragraph templates`);
for (const [key, n] of worstTemplates) console.log(`    ${String(n).padStart(4)}x  ${key}...`);

console.log(`\n  archetype spread`);
for (const [name, n] of [...archetypes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(4)}  ${name}`);
}

if (SHOW) {
  console.log(`\n  sample lines`);
  for (const line of examples) console.log(`    ${line}`);
}
console.log("");
