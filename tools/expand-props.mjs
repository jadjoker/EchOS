/**
 * Build-time expansion of per-word properties.
 *
 * properties.ts ships 22 category defaults and 8 hand-authored overrides against
 * a lexicon of 1036 words, so 99% of domains resolve to their category and every
 * animal on the generated web shares one set of risks. This fills that in.
 *
 * Nothing here ships and nothing here runs at play time. The output is a static
 * data file, so seeds stay exact and `core/rng.ts` remains the only source of
 * randomness in the game.
 *
 * Usage:
 *   node tools/expand-props.mjs --limit 20              # sample run
 *   node tools/expand-props.mjs --only kiln,ferret      # specific words
 *   node tools/expand-props.mjs --model qwen2.5:7b      # everything
 *   node tools/expand-props.mjs --write                 # emit the .ts file
 *
 * Results are checkpointed to tools/.cache/props.jsonl, so a run that dies at
 * word 900 does not start again from zero, and --write can be run separately.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readLexicon, readCategoryDefaults, readHandOverrides, SRC } from "./lib/source.mjs";
import { SCHEMA, buildMessages, validate } from "./lib/props.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const CACHE = join(TOOLS, ".cache");
const CHECKPOINT = join(CACHE, "props.jsonl");
const OUT = join(SRC, "web", "properties.generated.ts");
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

const args = parseArgs(process.argv.slice(2));
const MODEL = args.model ?? "qwen2.5:3b";
const CONCURRENCY = Number(args.concurrency ?? 2);
const RETRIES = Number(args.retries ?? 2);

const lexicon = readLexicon();
const categoryDefaults = readCategoryDefaults();
const handAuthored = readHandOverrides();

/** Hand-authored entries are canonical: never regenerate, never overwrite. */
const candidates = [...lexicon]
  .filter(([word]) => !(word in handAuthored))
  .filter(([word]) => (args.only ? args.only.includes(word) : true));

const done = loadCheckpoint();
const todo = candidates.filter(([word]) => !done.has(word));
const batch = args.limit ? todo.slice(0, Number(args.limit)) : todo;

/**
 * Accepted entries grouped by category, so each new word can be checked against
 * the neighbours it is most likely to collapse into. Seeded from the checkpoint
 * so a resumed run keeps comparing against everything already written.
 */
const byCategory = new Map();
for (const entry of done.values()) {
  if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
  byCategory.get(entry.category).push(entry);
}

/** Compare against recent neighbours only — every animal against all 150 is both
 *  slow and too strict, since some overlap between animals is simply correct. */
const siblingsFor = (category) => (byCategory.get(category) ?? []).slice(-25);

/** category -> risk phrase -> how many words have claimed it. */
const riskCounts = new Map();
for (const entry of done.values()) countRisks(entry.category, entry.props);

function countRisks(category, props) {
  if (!riskCounts.has(category)) riskCounts.set(category, new Map());
  const counts = riskCounts.get(category);
  for (const risk of props.risk) counts.set(risk, (counts.get(risk) ?? 0) + 1);
}

function remember(word, category, props) {
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push({ word, category, props });
  countRisks(category, props);
}

async function run() {
  console.log(`model      ${MODEL}`);
  console.log(`lexicon    ${lexicon.size} words, ${Object.keys(handAuthored).length} hand-authored`);
  console.log(`cached     ${done.size}`);
  console.log(`this run   ${batch.length}\n`);
  if (batch.length === 0) return;

  mkdirSync(CACHE, { recursive: true });
  const started = Date.now();
  const stats = { ok: 0, failed: 0, reasons: new Map() };
  let index = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < batch.length) {
      const mine = index++;
      const [word, category] = batch[mine];
      const result = await generate(word, category);

      if (result.ok) {
        stats.ok++;
        remember(word, category, result.props);
        appendFileSync(CHECKPOINT, JSON.stringify({ word, category, props: result.props }) + "\n");
      } else {
        stats.failed++;
        stats.reasons.set(result.reason, (stats.reasons.get(result.reason) ?? 0) + 1);
      }
      report(mine + 1, batch.length, word, result, started);
    }
  });

  await Promise.all(workers);
  summarise(stats, started);
}

/**
 * One word, with repair rather than plain rerolling.
 *
 * A model that answers the anatomy question for `parts` answers it again on a
 * blind retry, three times, slowly. Feeding the rejection reason back turns the
 * retry into a correction and converts most failures into accepts.
 */
async function generate(word, category) {
  const examples = pickExamples(word, category);
  const messages = buildMessages(word, category, examples);
  const context = {
    category,
    riskCounts: riskCounts.get(category) ?? new Map(),
    echoes: phrasesIn(examples),
  };
  let last = { ok: false, reason: "no attempt" };

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    let raw;
    try {
      raw = await chat(messages, hash(word) + attempt);
    } catch (error) {
      last = { ok: false, reason: `request failed: ${error.message}` };
      continue;
    }
    last = validate(raw, word, categoryDefaults[category] ?? {}, siblingsFor(category), context);
    if (last.ok) return last;

    messages.push({ role: "assistant", content: JSON.stringify(raw) });
    messages.push({ role: "user", content: `Rejected: ${last.reason}. Fix that field and return the whole object again.` });
  }
  return last;
}

async function chat(messages, seed) {
  const response = await fetch(`${HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      format: SCHEMA,
      // Some temperature: at 0 the model repeats one phrasing across a whole
      // category, which is the sameness this is meant to cure. Seeded per word
      // so a rerun reproduces the same corpus.
      options: { temperature: 0.5, top_p: 0.9, seed, num_predict: 400 },
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return JSON.parse(body.message.content);
}

/**
 * Four few-shot examples, one of them from the same category where possible.
 * Deterministic per word so reruns are stable, rotated so the corpus does not
 * inherit the phrasing of whichever example happened to come first.
 */
function pickExamples(word, category) {
  const all = Object.entries(handAuthored).map(([w, props]) => [w, lexicon.get(w) ?? "abstract", props]);
  const sameCategory = all.filter(([, c]) => c === category);
  const rest = all.filter(([, c]) => c !== category);
  const offset = hash(word) % Math.max(1, rest.length);
  const rotated = [...rest.slice(offset), ...rest.slice(0, offset)];
  return [...sameCategory.slice(0, 1), ...rotated].slice(0, 4);
}

/**
 * Every phrase in the few-shot context, mapped to the category it came from,
 * so verbatim recall can be judged rather than simply banned.
 */
function phrasesIn(examples) {
  const out = new Map();
  for (const [, exampleCategory, props] of examples) {
    for (const value of Object.values(props)) {
      if (Array.isArray(value)) for (const entry of value) out.set(entry, exampleCategory);
    }
  }
  return out;
}

function report(n, total, word, result, started) {
  const elapsed = (Date.now() - started) / 1000;
  const rate = n / elapsed;
  const eta = Math.round((total - n) / rate);
  const mark = result.ok ? "ok  " : "FAIL";
  const detail = result.ok ? summary(result.props) : result.reason;
  const position = `${String(n).padStart(4)}/${total}`;
  console.log(`${position} ${mark} ${word.padEnd(14)} ${detail}   [eta ${fmt(eta)}]`);
}

function summary(props) {
  return `${props.risk.slice(0, 2).join(", ")} | ${props.parts.slice(0, 2).join(", ")}`;
}

function summarise(stats, started) {
  const elapsed = (Date.now() - started) / 1000;
  console.log(`\naccepted ${stats.ok}  rejected ${stats.failed}  in ${fmt(elapsed)}`);
  if (stats.reasons.size) {
    console.log("\nrejection reasons:");
    const sorted = [...stats.reasons].sort((a, b) => b[1] - a[1]).slice(0, 12);
    for (const [reason, count] of sorted) console.log(`  ${String(count).padStart(4)}  ${reason}`);
  }
  console.log(`\ncheckpoint: ${CHECKPOINT}`);
  console.log(`then: node tools/expand-props.mjs --write`);
}

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return "?";
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m}m${String(Math.round(seconds % 60)).padStart(2, "0")}s` : `${Math.round(seconds)}s`;
}

function loadCheckpoint() {
  const map = new Map();
  if (!existsSync(CHECKPOINT)) return map;
  for (const line of readFileSync(CHECKPOINT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      map.set(entry.word, entry);
    } catch {
      // A half-written final line after a kill. Skip it.
    }
  }
  return map;
}

/** Emit the shipped data file from the checkpoint. */
function writeOutput() {
  const entries = [...done.values()].sort((a, b) => a.word.localeCompare(b.word));
  if (entries.length === 0) {
    console.error("nothing in the checkpoint yet — run a generation pass first");
    process.exit(1);
  }

  const body = entries.map((entry) => {
    const fields = ["parts", "setting", "verb", "buyer", "risk", "material", "accessory"]
      .map((field) => `    ${field}: [${entry.props[field].map(quote).join(", ")}],`)
      .join("\n");
    return `  ${key(entry.word)}: {\n${fields}\n    scale: "${entry.props.scale}", alive: ${entry.props.alive},\n  },`;
  }).join("\n");

  const file = `/**
 * GENERATED — do not edit by hand.
 *
 * Written by tools/expand-props.mjs from the lexicon. Build-time output only:
 * by the time the game runs this is an ordinary static table, so seeds stay
 * exact and nothing here touches core/rng.ts.
 *
 * Hand-authored entries in properties.ts always win over anything in here. To
 * correct a word, add it to OVERRIDES there rather than editing this file —
 * the next regeneration would discard the edit.
 *
 * ${entries.length} words, model ${MODEL}, generated ${new Date().toISOString().slice(0, 10)}.
 */

import type { Props } from "./properties.ts";

export const GENERATED: Record<string, Partial<Props>> = {
${body}
};

export const GENERATED_COUNT = Object.keys(GENERATED).length;
`;

  writeFileSync(OUT, file);
  console.log(`wrote ${entries.length} entries to ${OUT}`);
}

const IDENTIFIER = /^[a-z][a-z0-9]*$/;

// Function declarations, not const arrows: writeOutput() runs at module top
// level and would hit the temporal dead zone otherwise.
function key(word) {
  return IDENTIFIER.test(word) ? word : JSON.stringify(word);
}

function quote(text) {
  return JSON.stringify(text);
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (name === "write") out.write = true;
    else if (name === "only") out.only = argv[++i].split(",");
    else out[name] = argv[++i];
  }
  return out;
}

// Last, so every const above it is initialised — top-level await plus module
// scope means an earlier dispatch hits the temporal dead zone.
if (args.write) writeOutput();
else await run();
