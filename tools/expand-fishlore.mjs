/**
 * Build-time expansion of the aquarium's lore pools.
 *
 * The tank draws 4-8 fish from 17 pet names, so about two thirds of tanks
 * contain two fish with the same name — the most visible repetition in the
 * game. Quotes are 15 deep and are the thing a player actually reads.
 *
 * As with expand-props.mjs: nothing here ships, nothing runs at play time, and
 * the output is a static table, so seeds stay exact.
 *
 * TEMPERAMENTS is deliberately not expandable here. fishtank.ts keys its Swim
 * profiles off those exact strings, so a new temperament without a matching
 * movement profile would silently drop that fish to default movement and break
 * the one thing that makes the lore more than flavour text.
 *
 * Usage:
 *   node tools/expand-fishlore.mjs --pool names
 *   node tools/expand-fishlore.mjs --pool quotes --model qwen2.5:7b-instruct-q4_K_M
 *   node tools/expand-fishlore.mjs --all
 *   node tools/expand-fishlore.mjs --write
 *   node tools/expand-fishlore.mjs --review quotes    # read the shortlist
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readPoolSeeds, SRC } from "./lib/source.mjs";
import { POOLS, unsafe } from "./lib/pools.mjs";

const TOOLS = dirname(fileURLToPath(import.meta.url));
const CACHE = join(TOOLS, ".cache");
const OUT = join(SRC, "gen", "fishlore.generated.ts");
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

const args = parseArgs(process.argv.slice(2));
const MODEL = args.model ?? "qwen2.5:7b-instruct-q4_K_M";
const EMBED_MODEL = args.embed ?? "nomic-embed-text";

/**
 * Cosine similarity above which two entries are "the same idea in different
 * words". A model asked for 200 fish quotes will write the same six thoughts
 * thirty times each; string dedupe cannot see that, embeddings can.
 * 0.82 is strict enough to catch paraphrase without merging genuinely
 * different lines that happen to share vocabulary.
 */
const NEAR_DUPLICATE = Number(args.threshold ?? 0.82);

const seeds = readPoolSeeds();

async function main() {
  if (args.write) return writeOutput();
  if (args.review) return review(args.review);
  if (args.clean) return clean();

  const names = args.all ? Object.keys(POOLS) : [args.pool];
  for (const name of names) {
    if (!POOLS[name]) {
      console.error(`unknown pool "${name}" — one of: ${Object.keys(POOLS).join(", ")}`);
      process.exit(1);
    }
    await expand(name);
  }
}

async function expand(name) {
  const pool = POOLS[name];
  const seed = seeds[name] ?? [];
  const state = load(name);

  console.log(`\n=== ${name} ===`);
  console.log(`shipped ${seed.length}, generated ${state.accepted.length}, target ${pool.target}`);
  if (pool.curate) console.log(`(shortlist — for review, not to ship blind)`);

  // Hand-written entries seed the embedding index so nothing generated is a
  // paraphrase of a line that already exists.
  const vectors = [];
  const useEmbeddings = pool.batch <= 30 && name !== "names" && name !== "speciesHead" && name !== "speciesTail";
  if (useEmbeddings) {
    for (const entry of [...seed, ...state.accepted]) vectors.push(await embed(entry));
  }

  const taken = new Set([...seed, ...state.accepted].map(normalise));
  const stats = { added: 0, rejected: new Map() };
  let stalled = 0;

  while (state.accepted.length < pool.target && stalled < 6) {
    const batch = await request(pool, seed, state.accepted);
    let addedThisRound = 0;

    for (const candidate of batch) {
      const entry = tidy(candidate);
      if (!entry) continue;

      const reason = unsafe(entry) ?? pool.validate(entry);
      if (reason) {
        count(stats.rejected, reason);
        continue;
      }
      if (taken.has(normalise(entry))) {
        count(stats.rejected, "duplicate");
        continue;
      }

      if (useEmbeddings) {
        const vector = await embed(entry);
        const nearest = closest(vector, vectors);
        if (nearest > NEAR_DUPLICATE) {
          count(stats.rejected, `near-duplicate (${nearest.toFixed(2)})`);
          continue;
        }
        vectors.push(vector);
      }

      taken.add(normalise(entry));
      state.accepted.push(entry);
      stats.added++;
      addedThisRound++;
      if (state.accepted.length >= pool.target) break;
    }

    save(name, state);
    process.stdout.write(`  ${state.accepted.length}/${pool.target}  (+${addedThisRound} this batch)\n`);
    // A pool that has genuinely run out of ideas stops asking rather than
    // burning the GPU rephrasing what it already said.
    stalled = addedThisRound === 0 ? stalled + 1 : 0;
  }

  if (stalled >= 6) console.log(`  stopped: six batches with nothing new`);
  console.log(`  added ${stats.added}`);
  const top = [...stats.rejected].sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [reason, n] of top) console.log(`    ${String(n).padStart(4)}  ${reason}`);
}

async function request(pool, seed, accepted) {
  // Show a rotating window of what exists. All of it would crowd the context
  // and bias every batch toward whatever sits at the top of the list.
  const shown = sample([...seed, ...accepted], 18);
  const messages = [
    { role: "system", content: pool.system },
    {
      role: "user",
      content: `Write ${pool.batch} more: ${pool.describe}.

These already exist. Do not repeat them, and do not write variations on them — go somewhere they did not:
${shown.map((entry) => `- ${entry}`).join("\n")}

Return JSON: {"entries": ["...", "..."]}`,
    },
  ];

  const body = await post("/api/chat", {
    model: MODEL,
    messages,
    stream: false,
    format: {
      type: "object",
      properties: { entries: { type: "array", items: { type: "string" } } },
      required: ["entries"],
    },
    // Higher than the properties pass: this is idea generation, and a low
    // temperature makes every batch a rewrite of the last one.
    options: { temperature: 0.95, top_p: 0.95, num_predict: 900 },
  });

  try {
    return JSON.parse(body.message.content).entries ?? [];
  } catch {
    return [];
  }
}

async function embed(text) {
  const body = await post("/api/embed", { model: EMBED_MODEL, input: text });
  return body.embeddings?.[0] ?? [];
}

function closest(vector, vectors) {
  let best = 0;
  for (const other of vectors) best = Math.max(best, cosine(vector, other));
  return best;
}

function cosine(a, b) {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function post(path, payload) {
  const response = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${path}`);
  return response.json();
}

/** Straight quotes throughout — the model mixes U+2019 into the same batch. */
function tidy(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s*/, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, " - ")
    .replace(/\s+/g, " ");
}

const normalise = (text) => text.toLowerCase().replace(/[^a-z ]/g, "").trim();

function sample(items, n) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const cacheFile = (name) => join(CACHE, `fishlore-${name}.json`);

function load(name) {
  const file = cacheFile(name);
  if (!existsSync(file)) return { accepted: [] };
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { accepted: [] };
  }
}

function save(name, state) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cacheFile(name), JSON.stringify(state, null, 2));
}

/**
 * Re-run the gates over everything already cached.
 *
 * The gates get tightened as the failures show up — a rule added after a pool
 * was generated should apply to it retroactively, and regenerating from scratch
 * to get that would waste an hour of GPU for no reason.
 */
function clean() {
  for (const [name, pool] of Object.entries(POOLS)) {
    const state = load(name);
    if (state.accepted.length === 0) continue;

    const kept = [];
    const dropped = [];
    for (const raw of state.accepted) {
      // Re-tidy as well as re-validate: typography rules get added here too.
      const entry = tidy(raw);
      const reason = unsafe(entry) ?? pool.validate(entry);
      if (reason) dropped.push([entry, reason]);
      else kept.push(entry);
    }

    if (dropped.length === 0) {
      console.log(`${name}: ${kept.length} kept, nothing dropped`);
      continue;
    }
    save(name, { ...state, accepted: kept });
    console.log(`\n${name}: ${kept.length} kept, ${dropped.length} dropped`);
    for (const [entry, reason] of dropped) console.log(`  - ${entry.padEnd(24)} ${reason}`);
  }
}

/** Print a pool for reading. Quotes need human eyes before they ship. */
function review(name) {
  const state = load(name);
  if (state.accepted.length === 0) {
    console.error(`nothing generated for "${name}" yet`);
    process.exit(1);
  }
  state.accepted.forEach((entry, i) => console.log(`${String(i + 1).padStart(4)}  ${entry}`));
  console.log(`\n${state.accepted.length} entries in ${cacheFile(name)}`);
  console.log(`Delete the bad ones from that file, then: node tools/expand-fishlore.mjs --write`);
}

function writeOutput() {
  const sections = [];
  let total = 0;

  // Every pool is emitted even when empty, so the imports in fishlore.ts and
  // fishtank.ts stay valid whichever pools have been generated so far.
  for (const [name, pool] of Object.entries(POOLS)) {
    const entries = load(name).accepted;
    total += entries.length;
    const items = entries.map((entry) => `  ${JSON.stringify(entry)},`).join("\n");
    sections.push(
      entries.length === 0
        ? `export const ${pool.export}: readonly string[] = [];`
        : `export const ${pool.export}: readonly string[] = [\n${items}\n];`,
    );
  }

  const file = `/**
 * GENERATED — do not edit by hand.
 *
 * Written by tools/expand-fishlore.mjs. Build-time output only: by the time the
 * game runs these are ordinary static arrays, so seeds stay exact and nothing
 * here touches core/rng.ts.
 *
 * These extend the hand-written pools rather than replacing them — the
 * originals stay first in fishlore.ts and fishtank.ts, and remain the reference
 * for the voice. To remove a bad entry, delete it from the matching file in
 * tools/.cache and regenerate, or promote a correction into the hand-written
 * list where it will not be overwritten.
 *
 * ${total} entries, model ${MODEL}, generated ${new Date().toISOString().slice(0, 10)}.
 */

${sections.join("\n\n")}
`;

  writeFileSync(OUT, file);
  console.log(`wrote ${total} entries to ${OUT}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (name === "write" || name === "all" || name === "clean") out[name] = true;
    else out[name] = argv[++i];
  }
  return out;
}

await main();
