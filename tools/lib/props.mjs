/**
 * The prompt and the quality gate for generated properties.
 *
 * Two failure modes to design against, and they pull in opposite directions:
 *
 *   1. Slop. A model asked "what are the parts of a kettle" happily answers
 *      "components, accessories, replacement parts" — schema-valid and worth
 *      nothing. The banned list and the similarity check exist for this.
 *   2. Wrong register. The default voice of an instruction model is American
 *      product marketing. The shipped data is British, mid-century, amateur
 *      enthusiast, faintly sad. That voice is most of the charm, so it is
 *      carried by few-shot examples taken from the real hand-authored entries
 *      rather than by adjectives in an instruction.
 *
 * Everything here runs at build time. Nothing in this file ships.
 */

const SHAPE = {
  parts: [3, 5],
  setting: [2, 4],
  verb: [3, 5],
  buyer: [2, 4],
  risk: [3, 5],
  material: [2, 3],
  accessory: [2, 3],
};

const SCALES = ["tiny", "small", "medium", "large", "huge"];

/**
 * Words that mean "I did not know anything specific". Mostly these are the
 * BLANK defaults in properties.ts — if the model reaches for those it has
 * added nothing over the fallback that already exists.
 */
const BANNED = new Set(`parts fittings spares items item equipment supplies
  accessories accessory products product various general generic misc
  miscellaneous stuff things thing quality premium deluxe assorted
  components component materials gear essentials`.trim().split(/\s+/));

/**
 * Bare abstractions that pass a schema and say nothing. "disease" is not a risk,
 * "foot rot" is. Only rejected when they stand alone — "a wasting disease" and
 * "storm damage" are fine, which is why this is checked per entry, not per token.
 */
const BARE = new Set(`disease illness sickness damage problems problem issues
  injury failure malfunction breakage decay rot rust wear tear loss theft cost
  costs expense weather age accidents accident neglect misuse abuse
  contamination infection infestation`.trim().split(/\s+/));

/**
 * A living thing's `parts` are what a shop sells for it — feed, bedding, a
 * water bottle — never its anatomy. Small models reliably answer the anatomy
 * question instead, so the body words are rejected outright when alive.
 */
const ANATOMY = new Set(`hand foot feet arm leg head face eye eyes ear ears nose
  mouth tooth teeth tongue lip chin neck shoulder elbow wrist finger thumb knee
  ankle heel heart lung lungs liver kidney bone bones skull rib ribs spine skin
  hair beard nail coat fur feather feathers claw claws hoof hooves horn horns
  tail wing wings beak snout trotter trotters udder mane paw paws whisker
  whiskers fin fins gill gills wattle flank flanks belly muzzle tusk tusks
  bristle bristles hock withers udders teat teats crop gizzard`
  .trim().split(/\s+/));

/**
 * Deliberately absent from ANATOMY: wool, fleece, hide, pelt, scales, comb.
 * Each is a thing a shop genuinely sells, and the head-noun rule below means
 * "a hoof pick" and "wool shears" pass while "hooves" and "the snout" do not.
 */
function headNoun(entry) {
  const words = entry.replace(/^(the|a|an)\s+/, "").split(" ");
  return words[words.length - 1] ?? "";
}

/** The codebase is British throughout. Cheap to enforce, jarring to miss. */
const BRITISH = [
  [/\bcolor/g, "colour"], [/\baluminum/g, "aluminium"], [/\bfiber/g, "fibre"],
  [/\bmeter\b/g, "metre"], [/\bliter/g, "litre"], [/\btire\b/g, "tyre"],
  [/\bneighbor/g, "neighbour"], [/\bharbor/g, "harbour"], [/\bmold/g, "mould"],
  [/\bplow/g, "plough"], [/\bgray\b/g, "grey"], [/\bcurb\b/g, "kerb"],
  [/\bjewelry/g, "jewellery"], [/\bcatalog\b/g, "catalogue"],
  [/\bpractice(d|s)?\b/g, "practise$1"], [/\bdefense/g, "defence"],
  [/\blicense\b/g, "licence"], [/\bcenter/g, "centre"],
  [/\btraveling/g, "travelling"], [/\bcanceled/g, "cancelled"],
  [/\bluster/g, "lustre"], [/\bfibre glass/g, "fibreglass"],
  [/\bodor/g, "odour"], [/\bbehavior/g, "behaviour"], [/\bfavor/g, "favour"],
  [/\blabor/g, "labour"], [/\bhonor/g, "honour"], [/\brumor/g, "rumour"],
  [/\bvapor/g, "vapour"], [/\barmor/g, "armour"], [/\bhumor/g, "humour"],
  [/\bmustache/g, "moustache"], [/\bpajama/g, "pyjama"],
  // Deliberately not here: check/cheque, draft/draught, storied/storeyed. Each
  // is a real word in both spellings with different senses, and "a routine
  // cheque" is a worse error than the Americanism would have been.
  [/\borganiz/g, "organis"], [/\brealiz/g, "realis"], [/\bspecializ/g, "specialis"],
  [/\bgalvaniz/g, "galvanis"], [/\bvulcaniz/g, "vulcanis"],
];

/**
 * `verb` wants the bare infinitive — "survey", "photograph", "ring" — because
 * site.ts drops it straight into "we survey and photograph". A past participle
 * there reads as broken English on the page.
 *
 * Both endings have real bare verbs hiding in them, so each needs an allowlist
 * rather than a blanket rule: "feed" and "breed" end in -ed, "ring" and "bring"
 * end in -ing, and the animal category default legitimately uses "ring".
 */
const BARE_ED = new Set(`feed breed read lead spread shed bed seed weed speed
  bleed need embed exceed proceed succeed`.trim().split(/\s+/));

const BARE_ING = new Set(`ring bring sing sling string cling spring swing wing
  fling sting`.trim().split(/\s+/));

function isInflected(verb) {
  const head = verb.split(" ")[0] ?? "";
  if (head.endsWith("ed") && !BARE_ED.has(head)) return true;
  if (head.endsWith("ing") && !BARE_ING.has(head)) return true;
  return false;
}

export const SCHEMA = {
  type: "object",
  properties: {
    parts: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    setting: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    verb: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    buyer: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    risk: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    material: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    accessory: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    scale: { type: "string", enum: SCALES },
    alive: { type: "boolean" },
  },
  required: ["parts", "setting", "verb", "buyer", "risk", "material", "accessory", "scale", "alive"],
};

export const SYSTEM = `You write reference data for a game that generates fictional amateur websites from the late 1990s. Given a noun, you record what someone who genuinely knows the subject would know about it.

VOICE. This is the whole job:
- British English. aluminium, neighbour, kerb, tyre, colour.
- The register of club newsletters, small ads, allotments, church halls, trade counters and society AGMs. Not marketing. Not whimsy. Not American e-commerce.
- Specific beats general, always. "a stuck fermentation" not "fermentation problems". "the neighbour's cat" not "predators". "vinegar syndrome" not "film decay".
- Deadpan and faintly resigned. These are people whose hobby has disappointed them before.
- Lowercase unless a proper noun. No full stops. No exclamation marks.
- Short. One to four words is typical, five is the maximum.

FIELDS:
- parts: what a SHOP SELLS for it. spares, consumables, replacements.
    Ask "what would be on the shelf behind the counter", never "what is it made of".
    For a living thing this is its keeping and feeding — feed, bedding, a water
    bottle, a grooming kit. NEVER its anatomy. A shop does not sell a dog's ears.
- setting: where it is actually found. concrete physical places.
- verb: what an enthusiast does with or to it. bare verb, no "to".
- buyer: who cares about it. trades, clubs, societies, kinds of household.
- risk: what goes wrong. the single most important field. be specific, be slightly sad.
    "foot rot" not "disease". "a buckled wheel" not "damage". "the neighbour's
    cat" not "predators". Never a bare abstract noun on its own.
- material: what it is made of, or stored in
- accessory: things sold alongside it
- scale: physical size of one of them
- alive: whether it is a living thing

Two words that are near neighbours must not get the same answer. A goat is not a
cow. If the honest answer feels generic, go narrower and more particular instead.

Never use these words: parts, fittings, spares, items, equipment, supplies, accessories, products, various, general, miscellaneous, quality, premium, assorted, components.

Answer only with the JSON object.`;

/** Few-shot drawn from the real hand-authored entries — the voice, by example. */
export function buildMessages(word, category, examples) {
  const messages = [{ role: "system", content: SYSTEM }];
  for (const [exampleWord, exampleCategory, props] of examples) {
    messages.push({ role: "user", content: ask(exampleWord, exampleCategory) });
    messages.push({ role: "assistant", content: JSON.stringify(props) });
  }
  messages.push({ role: "user", content: ask(word, category) });
  return messages;
}

function ask(word, category) {
  return `noun: ${word}\ncategory: ${category}`;
}

function tidy(text) {
  let out = String(text).trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  for (const [pattern, replacement] of BRITISH) out = out.replace(pattern, replacement);
  // Sentence-initial capitals only; a proper noun mid-phrase is left alone.
  if (/^[A-Z][a-z]/.test(out)) out = out[0].toLowerCase() + out.slice(1);
  return out;
}

/**
 * Returns { ok: true, props } or { ok: false, reason } — the reason is kept so
 * a run can report *why* a model is failing rather than just how often.
 */
/**
 * How many words in one category may share a single risk phrase.
 *
 * The README calls risk the most characterful property, and it is the one a
 * player actually reads, so it carries the strictest diversity rule. Some
 * overlap between animals is simply true — five of them with "foot rot" is not
 * a fact about livestock, it is the model reaching for the nearest answer.
 * parts and material are left alone: "feed" and "bedding" recurring is correct.
 */
const RISK_QUOTA = 2;

export function validate(raw, word, categoryDefault, siblings = [], context = {}) {
  const { riskCounts = new Map(), echoes = new Map() } = context;
  if (!raw || typeof raw !== "object") return fail("not an object");
  if (typeof raw.alive !== "boolean") return fail("alive not a boolean");

  const props = {};
  for (const [field, [min, max]] of Object.entries(SHAPE)) {
    const value = raw[field];
    if (!Array.isArray(value)) return fail(`${field} not an array`);

    const cleaned = [...new Set(value.map(tidy).filter(Boolean))];
    if (cleaned.length < min) return fail(`${field} has ${cleaned.length}, needs ${min}`);

    for (const entry of cleaned) {
      const words = entry.split(" ");
      if (words.length > 5) return fail(`${field} entry too long: "${entry}"`);
      if (entry.length > 34) return fail(`${field} entry too long: "${entry}"`);
      // A banned word alone is filler; inside a phrase ("brake parts") it is
      // still filler, so check every token rather than the whole string.
      for (const token of words) {
        if (BANNED.has(token.replace(/[^a-z]/g, ""))) {
          return fail(`${field} uses filler "${token}"`);
        }
      }
      // "a trampoline for trampolines" — restating the subject is a non-answer.
      if (entry === word || entry === `${word}s`) return fail(`${field} restates "${word}"`);

      // A bare abstraction standing alone. Modified is fine: "storm damage" and
      // "a wasting disease" both survive, "damage" and "disease" do not.
      if (words.length === 1 && BARE.has(entry)) return fail(`${field} is bare "${entry}"`);

      // A shop does not sell a dog's ears — but it does sell a hoof pick, so
      // this tests the head noun rather than every token in the phrase.
      if (raw.alive && (field === "parts" || field === "accessory")) {
        if (ANATOMY.has(headNoun(entry))) return fail(`${field} is anatomy: "${entry}"`);
      }
    }
    props[field] = cleaned.slice(0, max);
  }

  for (const verb of props.verb) {
    if (isInflected(verb)) return fail(`verb not bare: "${verb}"`);
  }

  // Specificity floor. The risk field carries most of the character, and a set
  // of one-word risks is the signature of a model that guessed by category.
  const specific = props.risk.filter((entry) => entry.includes(" ")).length;
  if (specific < 2) return fail("risk is too general");

  // Verbatim recall of a few-shot example — but only across categories.
  //
  // "a buckled wheel" is a good phrase for a bicycle and nonsense for a pony,
  // and the model reaches for it because it is sitting in the context window.
  // Within a category the same phrase is usually just correct: a badger really
  // does leave tracks, a barge really does live on the towpath. Rejecting those
  // threw away right answers, so the rule is cross-category only.
  // Only the fields where a lifted phrase is actually *wrong*. Two unrelated
  // things sharing "the workshop" or "brass" is how the world is; two sharing
  // "a buckled wheel" is the context window talking.
  const category = context.category;
  for (const field of ["parts", "risk", "accessory"]) {
    for (const entry of props[field]) {
      const from = echoes.get(entry);
      if (from !== undefined && from !== category) {
        return fail(`echoes the ${from} example: "${entry}"`);
      }
    }
  }

  // Phrase collapse within a category.
  for (const entry of props.risk) {
    if ((riskCounts.get(entry) ?? 0) >= RISK_QUOTA) {
      return fail(`"${entry}" already used ${RISK_QUOTA}x in category`);
    }
  }

  if (!SCALES.includes(raw.scale)) return fail(`bad scale "${raw.scale}"`);
  props.scale = raw.scale;
  props.alive = raw.alive;

  // The point of an override is to beat the category default. If it mostly
  // agrees with the default it is costing bytes and buying nothing.
  const overlap = similarity(props, categoryDefault);
  if (overlap > 0.5) return fail(`${Math.round(overlap * 100)}% same as category default`);

  // The failure the whole exercise exists to prevent: cow and goat both
  // answering "disease, starvation". Beating the default is not enough if every
  // word in the category converges on the same *other* answer.
  for (const sibling of siblings) {
    if (similarity(props, sibling.props) > 0.45) {
      return fail(`too close to "${sibling.word}"`);
    }
  }

  return { ok: true, props };
}

function fail(reason) {
  return { ok: false, reason };
}

/** Jaccard over every string in the two property sets. */
function similarity(a, b) {
  const flat = (props) =>
    new Set(Object.keys(SHAPE).flatMap((field) => props[field] ?? []));
  const left = flat(a);
  const right = flat(b);
  if (right.size === 0) return 0;
  let shared = 0;
  for (const entry of left) if (right.has(entry)) shared++;
  return shared / Math.min(left.size, right.size);
}
