/**
 * Site generation: a Subject becomes a Page.
 *
 * Archetypes are the grammar, same principle as the aesthetic movements — a
 * shop and a fan page are built from the same block vocabulary but arrange it
 * differently and fill it with different language. Free-rolling blocks would
 * give every domain the same shapeless soup.
 *
 * The Page is data, not DOM, so it can be tested and so the renderer stays
 * replaceable.
 */

import type { Rng } from "../core/rng.ts";
import type { TileKind } from "../theme/texture.ts";
import { handle, oldDate, personName, townName } from "../gen/places.ts";
import { shapeFor, type SolidShape } from "../gen/solid.ts";
import { wordsIn, type Category } from "./lexicon.ts";
import type { Subject } from "./domain.ts";

export type Archetype =
  | "shop" | "fan" | "personal" | "corporate" | "enthusiast"
  | "institute" | "directory" | "cult" | "construction" | "news";

export interface Product {
  name: string;
  price: string;
  note: string;
}

export interface GuestEntry {
  who: string;
  when: string;
  text: string;
}

export interface LinkItem {
  label: string;
  href: string;
}

export type Block =
  | { kind: "banner"; title: string; tagline: string }
  | { kind: "marquee"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "products"; items: Product[] }
  | { kind: "guestbook"; entries: GuestEntry[] }
  | { kind: "links"; title: string; items: LinkItem[] }
  | { kind: "counter"; hits: number; since: string }
  | { kind: "construction"; note: string }
  | { kind: "badges"; items: string[] }
  | { kind: "rule" }
  | { kind: "figure"; tile: TileKind; caption: string }
  | { kind: "contact"; lines: string[] }
  | { kind: "updated"; date: string };

export interface Page {
  domain: string;
  title: string;
  archetype: Archetype;
  blocks: Block[];
  /**
   * What the site's photographs are of. One shape per page, not per figure:
   * every picture on a site about kilns is a picture of the same kiln, and a
   * page whose three photographs showed three unrelated objects would read as
   * a stock library rather than as somebody's own site.
   */
  solid: SolidShape;
}

/**
 * Vocabulary bleeding in from a connected program.
 *
 * The web does not know or care what it is connected to — it is handed words
 * and works them into whatever kind of site it was already building. That is
 * why hooking the aquarium up makes a hardware shop start stocking fish rather
 * than turning the page into an aquarium.
 */
export interface Infusion {
  words: string[];
  sources: string[];
}

const ADJECTIVES = `finest quality genuine authentic original classic
  premium deluxe superior handmade custom rare unusual affordable discount
  wholesale reliable trusted traditional modern improved
  guaranteed`.trim().split(/\s+/);

/**
 * Words that only apply to something built in a factory.
 *
 * "Reconditioned" is a fine word for a lathe and a strange one for a cheese.
 * Kept apart rather than dropped, because on the things they suit they are
 * exactly right.
 */
const ADJECTIVES_MADE = `reconditioned refurbished ex-demonstration
  factory-sealed`.trim().split(/\s+/);

/**
 * Whether the subject is the kind of thing that has models, spares and fitting
 * instructions.
 *
 * A shop selling bread and a shop selling lathes are the same archetype and
 * should not be the same sentences: an audit across 22 categories found one
 * page in eight talking about the models of a loaf or the fitting instructions
 * of a goose. This is the distinction that fixes most of them at once.
 */
function isManufactured(category: Category): boolean {
  return ["machine", "vehicle", "tool", "instrument", "furniture", "garment", "game"]
    .includes(category);
}

/**
 * Narrower than manufactured, and the difference is not pedantry.
 *
 * A coat has models and fitting instructions; it is not reconditioned. A lathe
 * is all three. Collapsing the two ideas into one flag is what put
 * "Reconditioned" in front of garments after the first pass fixed it in front
 * of bread.
 */
function isReconditionable(category: Category): boolean {
  return ["machine", "vehicle", "tool", "instrument", "furniture"].includes(category);
}

/**
 * Things that arrive needing to be fitted, assembled or set up.
 *
 * The third and last of these distinctions. A board game is manufactured, has
 * spares and comes in editions, and still nobody has ever read the fitting
 * instructions before playing one.
 */
function isFitted(category: Category): boolean {
  return ["machine", "vehicle", "tool", "instrument", "furniture", "garment"]
    .includes(category);
}

const SHOP_NOISE = [
  "NOW SHIPPING NATIONWIDE",
  "ORDERS OVER $50 POST FREE",
  "ASK ABOUT OUR TRADE PRICES",
  "NEW STOCK ARRIVING WEEKLY",
  "WE DO NOT ACCEPT CHEQUES",
  "PHONE ORDERS WELCOME 9-5",
];

const BADGES = [
  "Best viewed at 800x600", "Netscape Now!", "Made with a text editor",
  "This site is Y2K ready", "No frames!", "Lynx friendly",
  "Member of the WebRing", "Powered by coffee", "Under 30k per page",
  "Sign my guestbook!", "Hosted by a friend", "100% hand coded",
];

/**
 * Who signs a guestbook depends on what they are signing.
 *
 * One shared pool meant a family bakery's visitor book read "found you from
 * the webring. bookmarked." That is the right voice for a fan page and nobody
 * has ever written it under a price list. The words were not wrong, they were
 * on the wrong kind of site, which is the harder half of making a generated
 * page hold together.
 */
const GUEST_LINES_ANY = [
  "great site!! keep up the good work",
  "the pictures take forever to load on my machine",
  "is this site still updated?",
  "hi from australia!!",
  "you spelled it wrong in the third paragraph",
  "does anyone else have trouble with the second one",
];

const GUEST_LINES_ENTHUSIAST = [
  "found you from the webring. bookmarked.",
  "my uncle had one of these. brought back memories",
  "cool page. check out mine too",
  "i disagree with everything on this page",
  "been looking for this info for MONTHS. thank you",
  "please email me i have a question about the blue one",
  "does your club still meet on thursdays",
];

const GUEST_LINES_TRADE = [
  "ordered on the 3rd, arrived thursday. no complaints",
  "do you deliver to the islands?",
  "second one I have bought from you. same as the first",
  "phoned twice, no answer. are you still trading",
  "price has gone up again but so has everything",
  "asked for the older pattern and they found me one",
  "packaging was excellent, no damage at all",
];

const CULT_LINES = [
  "They will tell you it is coincidence. It is not coincidence.",
  "I have kept records since 1994. The records do not lie.",
  "Nobody at the council would return my calls.",
  "Read this page twice. The second time you will see it.",
  "I am not the first to notice. I may be the last to say so.",
  "The pattern repeats every eleven months. Check for yourself.",
];

function price(rng: Rng): string {
  const pounds = rng.weighted([[rng.int(2, 19), 5], [rng.int(20, 99), 3], [rng.int(100, 899), 1]]);
  return `$${pounds}.${rng.pick(["99", "95", "50", "00", "49"])}`;
}

/** "Glorbus" sells Glorbs. Strip a Latinate tail off an invented brand. */
function itemWord(subject: Subject): string {
  if (!subject.invented) return subject.stem;
  return subject.stem.replace(/(us|os|ix|ex|um|a)$/, "") || subject.stem;
}

/** A shop sells trampolines, not trampoline. Worth the eight lines. */
function plural(word: string): string {
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/**
 * The property tables hold two grammatical shapes and always have.
 *
 * Some entries are bare nouns ("ingredients", "spoilage") and some carry their
 * own article ("a starter", "the damp", "the show"), because that is how the
 * things are actually said. Templates were written as though everything were
 * bare, which produced "it is usually the a starter" on any page that rolled
 * the wrong entry.
 *
 * Rewriting the data to one shape would be the wrong fix: "a starter" and
 * "starter" mean different things, and a lot of the entries read as nonsense
 * stripped. So the sentences bend around the data instead.
 */
function hasArticle(phrase: string): boolean {
  return /^(?:a|an|the)\s/i.test(phrase);
}

/** "the rind" stays; "ingredients" becomes "the ingredients". */
function withThe(phrase: string): string {
  return hasArticle(phrase) ? phrase : `the ${phrase}`;
}

const NOTES = ["in stock", "2-3 weeks", "last one", "back by request",
  "trade only", "while stocks last", "discontinued", "new for this season",
  "ask for a quote", "seconds available"];

/**
 * A catalogue mixes the thing itself with its parts and its accessories.
 *
 * This is where properties earn their keep: a shop that lists "Replacement
 * safety netting" and "Frame pads" alongside "Deluxe Trampoline" appears to
 * know what a trampoline *is*. Variants alone never get there, however many
 * adjectives you stack on them.
 */
function productList(rng: Rng, subject: Subject, count: number): Product[] {
  const item = itemWord(subject);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  /**
   * "Reconditioned Bread" and "Weatherproof Lentil" were both real, and both
   * came from here: one variant list applied to everything a shop can sell.
   * The last three only make sense on something built, so they are only
   * offered to something built.
   */
  const variants = ["Standard", "Deluxe", "Junior", "Professional", "Compact",
    "Heavy Duty", "Twin Pack", "Starter", "Economy", "Trade",
    // Second hand trade language: only for things that get taken apart and
    // put back together. A coat is manufactured and is still never
    // "reconditioned".
    ...(isReconditionable(subject.category)
      ? ["Reconditioned", "Ex-Demonstration"]
      : []),
    // Weatherproofing is about living outdoors, which is a different question
    // again from how a thing was made.
    ...(["machine", "vehicle", "tool", "furniture", "garment"].includes(subject.category)
      ? ["Weatherproof"]
      : [])];

  const entries: Product[] = [];
  const wanted = Math.max(3, count);

  for (const variant of rng.sample(variants, Math.max(1, Math.round(wanted * 0.45)))) {
    entries.push({ name: `${variant} ${cap(item)}`, price: price(rng), note: rng.pick(NOTES) });
  }
  for (const part of rng.sample(subject.props.parts, Math.max(1, Math.round(wanted * 0.35)))) {
    entries.push({ name: cap(part), price: price(rng), note: rng.pick(NOTES) });
  }
  for (const extra of rng.sample(subject.props.accessory, Math.max(1, wanted - entries.length))) {
    entries.push({ name: cap(extra), price: price(rng), note: rng.pick(NOTES) });
  }

  return rng.shuffle(entries).slice(0, wanted);
}

/** Links point at other generated domains, so the web is actually navigable. */
function relatedLinks(rng: Rng, subject: Subject, count: number): LinkItem[] {
  const pool = wordsIn(subject.category === "invented" ? "abstract" : subject.category);
  const picks = rng.sample(pool.length > 2 ? pool : wordsIn("abstract"), count);
  const tails = ["", "", "", "world", "shop", "club", "central", "ring", "net"];
  return picks.map((word) => {
    const tail = rng.pick(tails);
    const tld = rng.weighted([["com", 6], ["org", 3], ["net", 2]]);
    return { label: `${word}${tail}`, href: `${word}${tail}.${tld}` };
  });
}

function guestbook(rng: Rng, count: number, archetype: Archetype): GuestEntry[] {
  const trade = archetype === "shop" || archetype === "corporate";
  const pool = [
    ...GUEST_LINES_ANY,
    ...(trade ? GUEST_LINES_TRADE : GUEST_LINES_ENTHUSIAST),
  ];
  return rng.sample(pool, Math.min(count, pool.length)).map((text) => ({
    who: handle(rng),
    when: oldDate(rng),
    text,
  }));
}

const TILES: TileKind[] = ["stars", "checks", "plaid", "bricks", "waves", "confetti", "dither", "grid"];

function figure(rng: Rng, caption: string): Block {
  return { kind: "figure", tile: rng.pick(TILES), caption };
}

function counter(rng: Rng): Block {
  return {
    kind: "counter",
    hits: rng.weighted([[rng.int(12, 400), 5], [rng.int(400, 9000), 3], [rng.int(9000, 90000), 1]]),
    since: oldDate(rng),
  };
}

export function chooseArchetype(rng: Rng, subject: Subject): Archetype {
  // A hint from the domain itself is the strongest signal we have — somebody
  // who typed "birdmart" asked for a shop.
  switch (subject.hint) {
    case "shop": case "product": return "shop";
    case "fan": return "fan";
    case "place": return rng.weighted([["news", 3], ["directory", 1]]);
    case "org": return "corporate";
    case "field": return "institute";
    case "web": return "directory";
    default: break;
  }

  if (subject.tld === "edu") return "institute";
  if (subject.tld === "gov") return rng.weighted([["corporate", 2], ["institute", 1]]);

  const byCategory: Partial<Record<Category, readonly (readonly [Archetype, number])[]>> = {
    animal: [["enthusiast", 5], ["fan", 2], ["shop", 1]],
    plant: [["enthusiast", 5], ["shop", 2]],
    mineral: [["enthusiast", 4], ["shop", 2]],
    food: [["shop", 5], ["personal", 2]],
    drink: [["shop", 4], ["enthusiast", 2]],
    tool: [["shop", 6], ["corporate", 1]],
    vehicle: [["shop", 4], ["enthusiast", 3]],
    garment: [["shop", 6]],
    material: [["corporate", 4], ["shop", 3]],
    furniture: [["shop", 5]],
    machine: [["corporate", 3], ["enthusiast", 3], ["shop", 2]],
    game: [["shop", 3], ["fan", 3], ["enthusiast", 2]],
    instrument: [["shop", 4], ["fan", 2]],
    place: [["news", 4], ["personal", 2]],
    role: [["personal", 4], ["corporate", 2]],
    abstract: [["cult", 4], ["personal", 2], ["directory", 1]],
    activity: [["enthusiast", 5], ["personal", 2]],
    field: [["institute", 5], ["directory", 1]],
    organisation: [["corporate", 6]],
    media: [["fan", 6]],
    weather: [["enthusiast", 3], ["cult", 2], ["news", 1]],
    body: [["institute", 3], ["cult", 2]],
    invented: [["shop", 4], ["corporate", 3], ["cult", 2], ["personal", 2], ["fan", 1]],
  };

  const table = byCategory[subject.category] ?? [["personal", 1] as const];

  // Every so often, nothing but a half-finished page — the most authentic thing
  // the era produced. But never for an invented word: someone who typed
  // "glorbus.com" is asking what a Glorbus *is*, and answering "nothing yet" is
  // the one reply that wastes the question.
  const mayBeUnfinished = !subject.invented && rng.chance(0.05);
  return mayBeUnfinished ? "construction" : rng.weighted(table);
}

/** Where borrowed words land, per archetype. Never replaces the site's own
 * content — it arrives as an extra section, the way a real page accretes. */
function infusionBlocks(rng: Rng, archetype: Archetype, words: string[], sources: string[]): Block[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const picked = rng.sample(words, Math.min(words.length, rng.int(3, 6)));
  const via = sources.join(" and ");

  switch (archetype) {
    case "shop":
      return [
        { kind: "heading", text: "Also In Stock" },
        {
          kind: "products",
          items: picked.map((word) => ({
            name: cap(word),
            price: price(rng),
            note: rng.pick(["new line", "enquire", "just arrived", "one only"]),
          })),
        },
      ];
    case "directory":
      return [
        { kind: "rule" },
        {
          kind: "links",
          title: "Incoming",
          items: picked.map((word) => ({
            label: word,
            href: `${word.replace(/[^a-z0-9]/gi, "")}.com`,
          })),
        },
      ];
    case "cult":
      return [
        { kind: "heading", text: "Further Evidence" },
        { kind: "list", items: picked.map((w) => `${cap(w)}. Again. I did not go looking for it.`) },
        { kind: "para", text: `It began appearing after ${via}. Make of that what you will.` },
      ];
    case "news":
      return [
        { kind: "heading", text: "Also Reported" },
        { kind: "list", items: picked.map((w) => `${cap(w)} seen near the ${rng.pick(["bridge", "allotments", "car park", "canal"])}`) },
      ];
    case "enthusiast":
      return [
        { kind: "heading", text: "Recent Sightings" },
        { kind: "list", items: picked.map((w) => `${cap(w)} — reported by ${personName(rng)}, unconfirmed`) },
      ];
    case "institute":
      return [
        { kind: "heading", text: "Recent Accessions" },
        { kind: "list", items: picked.map((w) => `${cap(w)}, acquired ${oldDate(rng)}. Uncatalogued.`) },
      ];
    case "corporate":
      return [
        { kind: "heading", text: "Recent Acquisitions" },
        { kind: "list", items: picked.map((w) => `${cap(w)} Holdings — terms undisclosed`) },
      ];
    case "fan":
    case "personal":
      return [
        { kind: "heading", text: "Things People Have Sent Me" },
        { kind: "list", items: picked.map((w) => `${cap(w)} (thank you!)`) },
      ];
    case "construction":
      return [{ kind: "para", text: `Sections planned: ${picked.join(", ")}.` }];
  }
}

/**
 * A page is assembled from SECTIONS, not from a fixed list of blocks.
 *
 * The previous version pushed a hardcoded sequence per archetype, which meant
 * every shop that has ever been generated had the identical eleven blocks in
 * the identical order — measured at 3,000 pages producing exactly 10 distinct
 * skeletons. The vocabulary varied; the grammar did not, and it is the grammar
 * you notice by page twelve.
 *
 * A section is a self-contained run of blocks (a heading and the thing it
 * introduces), so the middle of a page can be reordered without a heading
 * drifting away from its list.
 */
interface Section {
  /** Probability of appearing. Omitted means always. */
  chance?: number;
  /** Lazy so a skipped section costs nothing and consumes no randomness. */
  blocks(): Block[];
}

interface Recipe {
  /** Fixed opening — the banner and its noise. Never reordered. */
  head: Section[];
  /** The reorderable middle, where the variety lives. */
  body: Section[];
  /** Fixed close. Counters and badges belong at the bottom of an era page. */
  tail: Section[];
  /**
   * Fewest body sections worth showing. Defaults to 2 — a page that rolled
   * nearly everything away reads as broken rather than sparse. `construction`
   * overrides it to 1, because there the emptiness is the point.
   */
  minBody?: number;
}

const sec = (blocks: () => Block[]): Section => ({ blocks });
const maybe = (chance: number, blocks: () => Block[]): Section => ({ chance, blocks });

function assemble(rng: Rng, recipe: Recipe): Block[] {
  const keep = (sections: Section[]) =>
    sections.filter((s) => s.chance === undefined || rng.chance(s.chance));

  let body = keep(recipe.body);
  const floor = Math.min(recipe.minBody ?? 2, recipe.body.length);
  if (body.length < floor) {
    // Top up from what was skipped, most-likely-to-appear first, so a thin roll
    // recovers with the sections the archetype most wanted anyway.
    const skipped = recipe.body
      .filter((s) => !body.includes(s))
      .sort((a, b) => (b.chance ?? 1) - (a.chance ?? 1));
    body = [...body, ...skipped.slice(0, floor - body.length)];
  }

  // Inclusion is decided before ordering, and blocks() runs last — so the
  // result stays deterministic for a given seed while the skeleton varies.
  return [
    ...keep(recipe.head),
    ...rng.shuffle(body),
    ...keep(recipe.tail),
  ].flatMap((s) => s.blocks());
}

export function buildPage(rng: Rng, subject: Subject, infusion?: Infusion): Page {
  const archetype = chooseArchetype(rng, subject);
  const name = subject.display;
  const item = itemWord(subject);
  const owner = personName(rng);

  /** Whether this thing has models, spares and fitting instructions. */
  const made = isManufactured(subject.category);
  const adj = () => rng.pick(
    isReconditionable(subject.category) ? [...ADJECTIVES, ...ADJECTIVES_MADE] : ADJECTIVES,
  );

  // Shorthands for the thing's properties. Every use of one of these is a
  // sentence that could not have been written about anything else.
  const p = subject.props;
  const where = () => rng.pick(p.setting);
  const who = () => rng.pick(p.buyer);
  const wrong = () => rng.pick(p.risk);
  const doing = () => rng.pick(p.verb);
  const part = () => rng.pick(p.parts);

  const recipe: Recipe = (() => {
    switch (archetype) {
    case "shop": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: `${name}${rng.pick([" & Co.", " Supplies", " Direct", ""])}`, tagline: `Suppliers of ${adj()} ${plural(item)} since ${rng.int(1962, 1994)}` }]),
          maybe(0.7, () => [{ kind: "marquee", text: rng.pick(SHOP_NOISE) }]),
        ],
        body: [
          sec(() => [
            { kind: "heading", text: rng.pick(["Our Range", "Price List", "Stock", "What We Sell"]) },
            { kind: "products", items: productList(rng, subject, rng.int(3, 6)) },
          ]),
          maybe(0.85, () => [
            {
              kind: "heading",
              text: rng.pick([
                "About Us", "The Business", "Who We Are",
                "The Company", "Our Background", "In Brief",
                `${name} Ltd`, "Company Profile",
              ]),
            },
            {
              kind: "para",
              text: (() => {
                const buyer = who();
                // "We supply households across the county" reads; "We supply
                // the show across the county" does not. A buyer that names one
                // definite thing needs a sentence built for one thing.
                const trade = hasArticle(buyer)
                  ? `We sell to ${buyer}`
                  : `We supply ${buyer} across the county`;
                /**
                 * Eight businesses, not one business with the name swapped.
                 *
                 * The first of these was the whole section for a long time, and
                 * it was invisible in the variety numbers because it opens on
                 * the site's own name: measured across 400 pages it was one
                 * paragraph appearing 81 times, scored as 81 different lines.
                 * What varies here is what the shop is LIKE, since a two-man
                 * operation and a converted market stall would not describe
                 * themselves with the same sentence however different their
                 * stock.
                 */
                return rng.pick([
                  `${name} is a family business operating from ${townName(rng)}. ${trade}, and every ${item} is checked before it leaves the premises.`,
                  `We have traded from the same address in ${townName(rng)} since ${rng.int(1954, 1988)}. There are ${rng.int(2, 5)} of us. We do the ordering, the packing and the answering of the telephone between us, so please be patient at busy times.`,
                  `${name} started as ${rng.pick(["a market stall", "a sideline", "one shed and a van", "a mail order list"])} and has grown about as much as we want it to. We know where every ${item} on this page came from, which is more than the catalogues can say.`,
                  `The shop is small. The stockroom is not. If you cannot see what you want, write or ring, because a great deal of what we hold has never made it onto these pages.`,
                  `Most of our work goes to ${buyer}, though we are glad to deal with anyone who knows what they are asking for. Nobody here is paid commission and nobody will talk you into the dearer one.`,
                  `Everything is kept in ${where()} and picked by hand on the day it is ordered. It is slower than it might be. It is also why we have had so few sent back.`,
                  `We have sold ${plural(item)} long enough to know what comes back and why. Nine times in ten it is ${wrong()}, and nine times in ten it could have been avoided by asking us first.`,
                  `${name} is run by ${owner}, who took it over from ${personName(rng)} in ${rng.int(1979, 1996)} and has changed very little since. The prices have gone up. That is about the size of it.`,
                ]);
              })(),
            },
          ]),
          maybe(0.7, () => [{
            kind: "para", text: rng.pick([
              // Works whatever is being sold: a complaint about a fault and a
              // phone number is the same sentence for a lathe or a loaf.
              `Most enquiries we get are about ${wrong()}. Ring us before you order — it is usually ${withThe(part())}.`,
              `A note on returns: we cannot accept ${plural(item)} showing ${wrong()}. ${isFitted(subject.category)
                ? `Please read the fitting instructions before you ${doing()} anything.`
                : `Check what you have been sent before you ${doing()} anything.`}`,
              made
                ? `We keep ${withThe(part())} for models going back to ${rng.int(1961, 1988)}. If you cannot see what you need, ask.`
                : `We have had ${withThe(part())} on the shelf since ${rng.int(1961, 1988)} and see no reason to stop. If you cannot see what you need, ask.`,
              // Four more, kept to the same rule as the section above: each is
              // about a different part of running a shop, so the reader who
              // sees two of them in an evening has read two things.
              `Postage is charged at cost and we round it down. Orders go out ${rng.pick(["the same afternoon", "on Tuesdays and Fridays", "within two days"])}, ${rng.pick(["first class", "by carrier", "by whatever is cheapest for the weight"])}.`,
              `If you are new to this, do not start with the dearest one. Start with something you will not mind ${rng.pick(["marking", "getting wrong", "learning on"])}, and keep it away from ${where()} until you have the hang of it.`,
              `We are asked constantly whether we will ${rng.pick(["split a set", "sell just the one", "do a part exchange"])}. The answer is usually yes. It is quicker to ask than to wonder.`,
              `Prices on this page were correct in ${rng.pick(["the spring", "the autumn", "January"])} and we have not had the heart to change them since. If something has gone up we will tell you before we take the order, not after.`,
            ]),
          }]),
          maybe(0.55, () => [{ kind: "links", title: "Trade Associates", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
          // Raised from 0.35: a catalogue page with nothing to look at was the
          // commonest way a generated shop came out flat.
          maybe(0.55, () => [figure(rng, rng.pick([
            `The workshop, ${rng.int(1978, 1996)}`,
            "Our premises",
            `${adj()} ${item}, as supplied`,
            `${item.charAt(0).toUpperCase()}${item.slice(1)} in ${where()}`,
            `From the ${rng.int(1979, 1997)} catalogue`,
          ]))]),
          maybe(0.3, () => [
            {
              kind: "heading",
              text: rng.pick([
                "What Customers Say", "Testimonials", "From Our Customers",
                "What People Tell Us", "Feedback", "Letters We Have Had",
              ]),
            },
            { kind: "guestbook", entries: guestbook(rng, rng.int(2, 3), archetype) },
          ]),
          maybe(0.25, () => [{ kind: "rule" }]),
        ],
        tail: [
          maybe(0.85, () => [{ kind: "contact", lines: [`Telephone ${rng.int(1, 9)}${rng.int(100, 999)} ${rng.int(1000, 9999)}`, `${rng.int(1, 200)} ${rng.pick(["High Street", "Mill Road", "Station Approach", "The Parade"])}, ${townName(rng)}`, `Open ${rng.pick(["Mon-Fri 9-5", "Tue-Sat 8:30-5:30", "weekdays only"])}`] }]),
          maybe(0.8, () => [counter(rng)]),
          maybe(0.3, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "fan": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: `The ${name} Page`, tagline: rng.pick([`Everything about ${item}!!`, `Unofficial. Unaffiliated. Unstoppable.`, `A tribute to ${item}`]) }]),
          maybe(0.75, () => [{ kind: "marquee", text: `*** WELCOME TO THE ${name.toUpperCase()} PAGE *** SIGN THE GUESTBOOK ***` }]),
        ],
        body: [
          maybe(0.8, () => [figure(rng, `${name} (my own photo, please do not take)`)]),
          maybe(0.9, () => [
            {
              kind: "heading",
              text: rng.pick([
                `Why ${name}?`, "About This Page", "Why I Made This",
                `${name}: An Introduction`, "Some Background", "Before You Start",
                "A Note From Me", "Read This First",
              ]),
            },
            /**
             * Twelve openings that are different SENTENCES, not one sentence
             * with a different noun in it.
             *
             * The old version was a single fixed line with a variable clause,
             * and it opened a third of every page on the generated web. Adding
             * vocabulary would not have touched that: what repeats is the
             * shape, and the shape is what you recognise on the twelfth page.
             *
             * Six was the first fix and was not enough. Fan is the archetype a
             * typed domain lands on most often, so its openings are seen more
             * than any other archetype's, and six of them still came round
             * every twenty-odd pages. The second six are the same idea carried
             * further: a hobbyist who is proud, one who is tired, one who is
             * defending himself against an argument the reader never saw.
             */
            {
              kind: "para", text: rng.pick([
                `I started this page in ${rng.int(1996, 2001)} because there was nothing else out there. ${rng.pick(["I am not an expert.", "I have been collecting for eleven years.", "My family think I am mad."])} If you have anything to add, email me.`,
                `There is no other page like this one. I have looked. What is here I have checked myself, except where it says otherwise, and I would rather be told I am wrong than leave it standing.`,
                `This began as notes for my own use and got away from me. It is not tidy. I have left the older sections up because somebody wrote asking for them.`,
                `Nobody asked for this page. I keep it because ${rng.pick(["the club folded in " + rng.int(1994, 1999), "the old site went down and nothing replaced it", "somebody has to"])}, and because I have the room.`,
                `A word before you go further: I am not affiliated with anyone, I sell nothing, and I have never been paid a penny for any of it. That is worth saying now.`,
                `${rng.int(11, 40)} years of ${item} and I am still finding things I did not know. That is either the appeal or the problem, depending on who you ask.`,
                `My interest in ${item} started with ${rng.pick(["a birthday present", "my grandfather", "one I found in a skip", "a programme on the television"])} and never went away. People ask how long I have been at it and I have stopped counting, which is probably an answer.`,
                `Everything on this page has been checked against ${rng.pick(["the books I own", "two other collectors", "my own records", "what I have in front of me"])}. Where I could not check it, I have said so. I would rather have gaps than guesses.`,
                `I am told there are better sites than this one now. There may well be. This one is staying up because ${rng.pick(["people still write to me about it", "the links elsewhere still point here", "I like it"])}.`,
                `If you have arrived here looking for somewhere to buy ${plural(item)}, this is not that. I sell nothing. What I have is ${rng.int(11, 400)} pages of notes and the willingness to answer an email.`,
                `Fair warning: I have opinions about ${item} and this page is full of them. Where something is my view rather than a fact, I have tried to say which. Where I have not, assume it is my view.`,
                `The whole of this was ${rng.pick(["written in one weekend", "typed up from a notebook", "put together after the club folded", "rescued off an old machine"])} and it shows in places. I fix things as I notice them. Tell me what I have missed and I will fix that too.`,
              ]),
            },
          ]),
          maybe(0.85, () => [
            {
              kind: "heading",
              text: rng.pick([
                "Facts", "Did You Know?", "Things People Get Wrong",
                "Worth Knowing", "Common Mistakes", "A Few Points",
                "The Basics", "Frequently Misunderstood",
              ]),
            },
            { kind: "list", items: rng.sample([
              `There are more than ${rng.int(11, 900)} known kinds.`,
              `The largest recorded was ${rng.int(2, 40)}kg.`,
              `They were banned in ${townName(rng)} until ${rng.int(1971, 1989)}.`,
              `Most people pronounce it wrongly.`,
              `The record has stood since ${rng.int(1954, 1988)}.`,
              `No two are exactly alike.`,
              `You should never ${doing()} one near ${where()}.`,
              `Nine out of ten problems come down to the ${part()}.`,
              `${who().charAt(0).toUpperCase()}${who().slice(1)} have known about ${wrong()} for years. Nobody listens.`,
            ], rng.int(3, 5)) },
          ]),
          maybe(0.7, () => [{ kind: "links", title: rng.pick(["Other Good Sites", "Links", "My Webring"]), items: relatedLinks(rng, subject, rng.int(3, 5)) }]),
          maybe(0.75, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(3, 5), archetype) }]),
          maybe(0.3, () => [{ kind: "rule" }]),
        ],
        tail: [
          maybe(0.7, () => [{ kind: "badges", items: rng.sample(BADGES, rng.int(3, 5)) }]),
          maybe(0.85, () => [counter(rng)]),
          maybe(0.35, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "personal": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: `${owner}'s Home Page`, tagline: rng.pick(["Welcome to my corner of the internet", "Under constant revision", "Thanks for stopping by"]) }]),
          maybe(0.25, () => [{ kind: "marquee", text: `welcome !! you are visitor number lots !! sign my guestbook !!` }]),
        ],
        body: [
          sec(() => [{ kind: "para", text: rng.pick([
            `Hello. My name is ${owner} and I live in ${townName(rng)}. This is my page about ${item}, ${rng.pick(["among other things", "mostly", "and my other interests"])}.`,
            `Welcome to my home page! I am ${owner}, I live near ${townName(rng)}, and I have finally worked out how to put pictures on here. There will be more of them shortly.`,
            `This is ${owner}. I made this page ${rng.pick(["at work, quietly", "on a rainy weekend", "after the course at the library", "because my son set it up for me"])} and it is mostly about ${item}. Some of it is about the ${rng.pick(["garden", "dog", "car", "allotment"])}.`,
            `You have found the page of ${owner} of ${townName(rng)}. There is not a great deal here yet. What there is, I put here myself, which took longer than anyone would believe.`,
            `${owner} here. I keep this page for the handful of people who share an interest in ${item} and cannot find anything about it anywhere else. If that is you, there is an email address at the bottom.`,
          ]) }]),
          maybe(0.9, () => [
            { kind: "heading", text: rng.pick(["About Me", "A Bit About Myself", "Me"]) },
            { kind: "list", items: rng.sample([
              `I work in ${rng.pick(["insurance", "the school", "the works", "haulage", "the council"])}.`,
              `I have ${rng.int(1, 4)} ${rng.pick(["cats", "dogs", "children", "greenhouses"])}.`,
              `My favourite ${item} is the ${adj()} one.`,
              `I have been online since ${rng.int(1995, 2000)}.`,
              `I do not use the telephone.`,
            ], rng.int(3, 4)) },
          ]),
          maybe(0.7, () => [figure(rng, rng.pick(["Me, last summer", "The garden", "My setup", "Not sure who took this"]))]),
          maybe(0.75, () => [{ kind: "links", title: rng.pick(["Links I Like", "My Favourite Pages", "Friends"]), items: relatedLinks(rng, subject, rng.int(3, 6)) }]),
          maybe(0.6, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(2, 4), archetype) }]),
          maybe(0.35, () => [
            { kind: "heading", text: rng.pick(["What's New", "Coming Soon"]) },
            { kind: "para", text: rng.pick([
              `Still trying to get the ${item} pictures to load properly. Sorry.`,
              `Added a new section last week. Let me know if the links are broken.`,
              `I have a lot more to put up here when I get the time.`,
            ]) },
          ]),
        ],
        tail: [
          maybe(0.7, () => [{ kind: "updated", date: oldDate(rng) }]),
          maybe(0.8, () => [counter(rng)]),
          maybe(0.4, () => [{ kind: "badges", items: rng.sample(BADGES, rng.int(2, 4)) }]),
        ],
      };
    }

    case "corporate": {
      const suffix = rng.pick(["Ltd", "Inc", "GmbH", "& Partners", "Group", "Holdings"]);
      return {
        head: [
          sec(() => [{ kind: "banner", title: `${name} ${suffix}`, tagline: rng.pick(["Delivering value through integrated solutions", "Excellence in every process", "The name industry trusts", "Building tomorrow, today"]) }]),
        ],
        body: [
          sec(() => [
            { kind: "heading", text: rng.pick(["Corporate Profile", "About the Group", "Company Overview"]) },
            /**
             * Corporate prose is the easiest voice here to write once and the
             * hardest to notice repeating, because it is deliberately empty:
             * the reader is not reading closely, so the tell is the RHYTHM
             * rather than the words. Six of them, each with a different one.
             */
            { kind: "para", text: rng.pick([
              `${name} ${suffix} is a leading provider of ${item} products and associated services. Founded in ${rng.int(1948, 1991)}, we operate ${rng.int(2, 40)} facilities and employ over ${rng.int(30, 4000)} people worldwide.`,
              `Since ${rng.int(1948, 1991)} the Group has been at the forefront of the ${item} sector. Our ${rng.int(2, 40)} sites operate to one standard, wherever in the world they happen to be.`,
              `${name} ${suffix} is a diversified group with interests in ${item} and adjacent markets. The Group employs ${rng.int(30, 4000)} people and is directed from ${townName(rng)}.`,
              `The Group was formed by the merger of ${rng.int(2, 4)} established businesses in ${rng.int(1968, 1994)}. ${item.charAt(0).toUpperCase()}${item.slice(1)} remains its principal activity and its largest single market.`,
              `We supply ${who()} in ${rng.int(3, 40)} countries. Our strategy is unchanged: consistent quality, delivered on time, at a price the market recognises as fair.`,
              `${name} ${suffix} exists to add value at every stage of the ${item} chain, from source to end user. This is delivered through scale, through process discipline, and through our people.`,
            ] ) },
          ]),
          maybe(0.85, () => [
            { kind: "heading", text: rng.pick(["Divisions", "Operating Companies", "Our Businesses"]) },
            { kind: "list", items: rng.sample([
              `${name} Manufacturing`, `${name} Logistics`, `${name} Research`,
              `${name} International`, `${name} Consumer`, `${name} Defence`,
              `${name} Agricultural`, `${name} Marine`,
            ], rng.int(3, 5)) },
          ]),
          maybe(0.65, () => [
            { kind: "heading", text: "Investor Relations" },
            { kind: "para", text: rng.pick([
              `Results for the ${rng.pick(["third", "fourth", "second"])} quarter will be announced on ${oldDate(rng)}. Shareholders requiring documentation should contact the registrar.`,
              `The Annual Report and Accounts for ${rng.int(1994, 2001)} are available in printed form. Written requests should be addressed to the company secretary.`,
              `The Board has recommended a final dividend of ${rng.int(2, 14)}p per ordinary share, payable ${oldDate(rng)} to shareholders on the register at the close of business on ${oldDate(rng)}.`,
              `Trading in the ${rng.pick(["first", "second", "third", "fourth"])} quarter was in line with the Board's expectations. A fuller statement will accompany the preliminary results.`,
            ]) },
          ]),
          maybe(0.4, () => [
            { kind: "heading", text: rng.pick(["Quality & Compliance", "Health and Safety", "Environmental Policy"]) },
            { kind: "para", text: rng.pick([
              `All ${item} operations are conducted under our accredited quality system. Incidents involving ${wrong()} are recorded and reviewed by the board.`,
              `Our environmental commitments are reviewed annually. Where ${wrong()} has been identified, remedial measures are implemented and their effectiveness monitored.`,
              `The health and safety of our people is not a matter for negotiation. Every site is audited on a ${rng.pick(["quarterly", "six-monthly", "rolling"])} basis and the findings go to the board unedited.`,
              `We hold accreditation to the relevant standard for each process we operate. Certificates may be inspected on request at the ${townName(rng)} office.`,
            ]) },
          ]),
          // Corporate had no figure at all, which made it the one archetype
          // that could never show a picture. A 1996 company site without a
          // photograph of its own building did not exist.
          maybe(0.55, () => [figure(rng, rng.pick([
            `Group headquarters, ${townName(rng)}`,
            `${item.charAt(0).toUpperCase()}${item.slice(1)} production, ${rng.pick(["Plant 2", "the northern facility", "our largest site"])}`,
            "The Board, at the annual general meeting",
            `${rng.int(1978, 1996)} — the opening of the ${townName(rng)} works`,
          ]))]),
          maybe(0.35, () => [{ kind: "links", title: "Group Companies", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
          maybe(0.3, () => [{ kind: "rule" }]),
        ],
        tail: [
          maybe(0.8, () => [{ kind: "contact", lines: [`Head Office: ${townName(rng)} Business Park, Unit ${rng.int(1, 60)}`, `Fax ${rng.int(100, 999)} ${rng.int(1000, 9999)}`] }]),
          maybe(0.6, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "enthusiast": {
      const society = `${rng.pick(["National", "Regional", "Amateur", "Independent", "Northern", "Western"])} ${name} ${rng.pick(["Society", "Association", "Fellowship", "Register", "Circle"])}`;
      return {
        head: [
          sec(() => [{ kind: "banner", title: society, tagline: `Founded ${rng.int(1921, 1979)} · ${rng.int(40, 3000)} members` }]),
        ],
        body: [
          maybe(0.9, () => [
            { kind: "heading", text: rng.pick(["Meetings", "When We Meet", "Monthly Meeting"]) },
            { kind: "para", text: rng.pick([
              `We meet on the ${rng.pick(["first", "second", "last"])} ${rng.pick(["Tuesday", "Thursday", "Saturday"])} of the month at the ${rng.pick(["village hall", "community centre", "Rose & Crown", "library annexe"])} in ${townName(rng)}. Visitors welcome. Please bring your own ${item} for identification — and label the ${part()}, we had trouble last year.`,
              `Meetings are held monthly at the ${rng.pick(["village hall", "community centre", "scout hut", "library annexe"])} in ${townName(rng)}, ${rng.pick(["7.30 for 8", "from 2pm", "on weekday evenings"])}. Tea is included in the subscription. Come and stand at the back if you would rather not talk to anyone the first time. Several of us did.`,
              `We are a small group and we meet in members' ${rng.pick(["homes", "gardens", "workshops", "sheds"])} by rota. Ring the secretary for the address, as it is different every month and the ${rng.pick(["parking", "gate", "dog"])} takes explaining.`,
              `The ${rng.pick(["first", "second", "last"])} ${rng.pick(["Tuesday", "Thursday", "Saturday"])} of the month, ${townName(rng)}, ${rng.pick(["7pm", "2pm", "after work"])}. Bring anything you want a second opinion on. Somebody in the room will have seen ${wrong()} before and will tell you at length.`,
              `Attendance has been down since the hall put its hire charge up, so we now meet ${rng.pick(["fortnightly", "every other month", "when there is something to see"])} instead. Members are notified by post. If you have not had a card, we have your address wrong.`,
            ]) },
          ]),
          maybe(0.9, () => [
            { kind: "heading", text: rng.pick(["This Year's Programme", "Forthcoming Events", "Calendar"]) },
            { kind: "list", items: rng.sample([
              `Spring field trip — ${where()}, meet at 9am`,
              `Annual show and competition`,
              `Talk: "How to ${doing()} without ${wrong()}" by ${personName(rng)}`,
              `Beginners' evening — bring a friend`,
              `Auction of surplus ${part()}`,
              `Members' slide evening`,
              `Workshop: identifying ${wrong()} before it spreads`,
              `Joint meeting with the ${townName(rng)} branch`,
            ], rng.int(3, 5)) },
          ]),
          maybe(0.6, () => [figure(rng, `Last year's winner (photo: ${personName(rng)})`)]),
          maybe(0.7, () => [
            { kind: "heading", text: rng.pick(["Notices", "Committee Notices", "Announcements"]) },
            { kind: "para", text: rng.pick([
              `The committee reminds members that subscriptions were due in ${rng.pick(["March", "April", "September"])}.`,
              `We are still seeking a new secretary. Please speak to ${personName(rng)}.`,
              `The ${rng.int(1980, 1999)} archive has been donated to the county records office.`,
            ]) },
          ]),
          maybe(0.55, () => [{ kind: "links", title: "Affiliated Groups", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
          maybe(0.35, () => [
            { kind: "heading", text: "Membership" },
            { kind: "para", text: rng.pick([
              `Annual subscription is $${rng.int(3, 24)}, or $${rng.int(2, 15)} for juniors and the retired. Cheques to the treasurer, ${personName(rng)}.`,
              `Membership costs $${rng.int(3, 24)} a year and includes the newsletter, ${rng.pick(["four times a year", "when there is enough to fill it", "whenever the printing is done"])}. Family membership is the same price, which we have never got round to changing.`,
              `There is no membership form. Turn up ${rng.int(2, 3)} times, decide you like us, and give $${rng.int(3, 24)} to ${personName(rng)}, who keeps the book.`,
              `Subscriptions ($${rng.int(3, 24)}, juniors half) fall due in ${rng.pick(["January", "April", "September"])}. They have not risen since ${rng.int(1987, 1998)} and the committee would like that noted.`,
            ]) },
          ]),
        ],
        tail: [
          maybe(0.8, () => [counter(rng)]),
          maybe(0.4, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "institute": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: `Institute of ${name}`, tagline: rng.pick(["Research · Teaching · Publication", `Advancing the study of ${item}`, "Est. 1908"]) }]),
        ],
        body: [
          maybe(0.9, () => [
            { kind: "heading", text: rng.pick(["Departmental Notice", "Access and Enquiries", "The Collection"]) },
            {
              kind: "para", text: rng.pick([
                `The Institute maintains the largest collection of ${item} material in the region. Access to the reading room is by appointment only. Enquiries should be directed to the assistant keeper, ${personName(rng)}.`,
                `Founded in ${rng.int(1888, 1934)}, the Institute holds material relating to ${item} and to the trade that grew around it. The reading room opens on weekday mornings. Readers are asked to sign in.`,
                `Our holdings pass ${rng.int(400, 90000).toLocaleString("en-GB")} items, of which perhaps half are catalogued. Work continues. ${personName(rng)} answers enquiries when the post allows.`,
                `The collection came to us from the estate of ${personName(rng)} and has been added to since, unevenly. Some of it has never been looked at. We say so plainly rather than pretend otherwise.`,
                `This is a working collection, not a museum. Material may be handled by arrangement. We ask that nothing is removed from the building, for reasons the notice by the door explains at length.`,
              ]),
            },
          ]),
          maybe(0.85, () => [
            { kind: "heading", text: rng.pick(["Current Research", "Work in Progress", "Active Programmes"]) },
            { kind: "list", items: rng.sample([
              `Distribution patterns in the ${rng.pick(["upper", "lower", "eastern"])} basin`,
              `A revised classification, ${rng.int(1994, 2002)}`,
              `Preservation techniques for degraded specimens`,
              `Comparative survey with the ${townName(rng)} collection`,
              `Long-term monitoring, year ${rng.int(3, 22)}`,
              `The problem of ${wrong()} in stored material`,
            ], rng.int(3, 4)) },
          ]),
          maybe(0.8, () => [
            { kind: "heading", text: rng.pick(["Publications", "Selected Papers", "Recent Bibliography"]) },
            { kind: "list", items: Array.from({ length: rng.int(2, 4) }, () =>
              `${personName(rng)} (${rng.int(1971, 2001)}). "${adj()} ${item}: a preliminary account". Vol ${rng.int(2, 40)}, pp. ${rng.int(1, 200)}-${rng.int(200, 400)}.`) },
          ]),
          maybe(0.35, () => [figure(rng, rng.pick([`Specimen ${rng.int(100, 9999)}, uncatalogued`, "The reading room", `Plate ${rng.int(2, 40)}, from the ${rng.int(1890, 1930)} survey`]))]),
          maybe(0.3, () => [
            { kind: "heading", text: "Staff" },
            { kind: "list", items: Array.from({ length: rng.int(2, 3) }, () =>
              `${personName(rng)} — ${rng.pick(["Keeper", "Assistant Keeper", "Research Fellow", "Conservator", "Honorary Associate"])}`) },
          ]),
        ],
        tail: [
          maybe(0.8, () => [{ kind: "contact", lines: [`Institute of ${name}, ${townName(rng)}`, `Reading room: Wed-Fri, 10am-4pm`] }]),
          maybe(0.7, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "directory": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: `${name} Directory`, tagline: `${rng.int(30, 900)} sites indexed · last crawl ${oldDate(rng)}` }]),
          maybe(0.65, () => [{ kind: "marquee", text: "ADD YOUR SITE FREE — NO BANNERS REQUIRED" }]),
        ],
        body: [
          sec(() => [{ kind: "links", title: rng.pick(["Featured", "Editor's Picks", "Best of the Web"]), items: relatedLinks(rng, subject, rng.int(4, 7)) }]),
          maybe(0.8, () => [{ kind: "links", title: rng.pick(["Recently Added", "New This Month", "Fresh Submissions"]), items: relatedLinks(rng, subject, rng.int(4, 7)) }]),
          maybe(0.7, () => [{ kind: "para", text: rng.pick([
            `This directory is maintained by hand by one person. Submissions are reviewed within ${rng.int(2, 12)} weeks. Sites that have moved without notice are removed.`,
            `Every link here has been visited. Nothing is listed because somebody paid to be listed, and nothing is listed automatically. That is the whole editorial policy.`,
            `The crawl runs ${rng.pick(["on Sundays", "monthly", "when I remember"])}. Dead links are marked before they are deleted, because a site that has gone down for a fortnight is not the same as a site that has gone.`,
            `Categories are added when there are ${rng.int(3, 9)} sites to put in them and not before. If your site does not fit anywhere, say so in the submission and it will go in the general list.`,
            `Roughly ${rng.int(2, 7)} in ten submissions are rejected, almost always because the site was ${rng.pick(["a single page of links", "an advert", "empty", "already listed under another name"])}. No offence is intended by it.`,
          ]) }]),
          // The one image a link directory ever carried: a picture of the thing
          // the directory is about, sat above the list like a masthead.
          maybe(0.4, () => [figure(rng, rng.pick([
            `${name}, for those who arrived here by accident`,
            "Site of the month",
            `Submitted by ${personName(rng)}`,
          ]))]),
          maybe(0.35, () => [{ kind: "links", title: "Dead Links (kept for reference)", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
          maybe(0.3, () => [{ kind: "rule" }]),
        ],
        tail: [
          maybe(0.6, () => [{ kind: "badges", items: rng.sample(BADGES, rng.int(2, 4)) }]),
          maybe(0.8, () => [counter(rng)]),
          maybe(0.4, () => [{ kind: "updated", date: oldDate(rng) }]),
        ],
      };
    }

    case "cult": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: name.toUpperCase(), tagline: rng.pick(["READ THIS PAGE BEFORE THEY TAKE IT DOWN", "What they are not telling you", "The evidence, collected"]) }]),
          maybe(0.75, () => [{ kind: "marquee", text: rng.pick(CULT_LINES) }]),
        ],
        body: [
          sec(() => [{ kind: "para", text: rng.pick(CULT_LINES) }]),
          maybe(0.95, () => [
            { kind: "heading", text: rng.pick(["The Evidence", "What I Have Recorded", "The Facts, In Order"]) },
            { kind: "list", items: rng.sample([
              `${rng.int(1971, 1996)} — first documented occurrence, ${townName(rng)}.`,
              `${rng.int(1980, 1999)} — records sealed for ${rng.int(30, 99)} years. Why?`,
              `Every instance falls within ${rng.int(4, 60)} miles of a former ${rng.pick(["airfield", "reservoir", "quarry", "signal station"])}.`,
              `The official explanation has changed ${rng.int(3, 9)} times.`,
              `I have written ${rng.int(11, 400)} letters. I have had ${rng.int(0, 2)} replies.`,
              `They call it ${wrong()}. I have seen ${wrong()}. This is not that.`,
              `Ask them why it is always found near ${where()}. Ask them twice.`,
              `${who().charAt(0).toUpperCase()}${who().slice(1)} stopped reporting it in ${rng.int(1988, 1999)}. They were told to.`,
            ], rng.int(3, 5)) },
          ]),
          maybe(0.7, () => [figure(rng, rng.pick(["Enhanced from the original", "Note the upper left corner", "This is the only copy"]))]),
          maybe(0.8, () => [{ kind: "para", text: rng.pick([
            `I am not asking you to believe me. I am asking you to look at the ${item} yourself and draw your own conclusions.`,
            `I was as sceptical as you are. I have the ${rng.pick(["letters", "photographs", "measurements", "cuttings"])} in a box in this room. Ask to see them and I will show you.`,
            `Print this page. I have had to move it ${rng.int(2, 5)} times already and I do not expect it to stay where it is.`,
            `There is a simple explanation for all of it and I would be relieved to hear it. ${rng.int(3, 30)} years and nobody has offered me one that survives ${rng.pick(["a second look", "the dates", "the map", "five minutes of arithmetic"])}.`,
            `Do not write to me to tell me I am wasting my life. I know what this looks like. Look at the ${item} first, then write to me.`,
          ]) }]),
          maybe(0.4, () => [
            { kind: "heading", text: rng.pick(["Correspondence", "Replies I Have Had", "Who Has Written To Me"]) },
            { kind: "guestbook", entries: guestbook(rng, rng.int(2, 3), archetype) },
          ]),
          maybe(0.3, () => [{ kind: "links", title: "Others Who Know", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
        ],
        tail: [
          maybe(0.7, () => [{ kind: "contact", lines: [`Write to me. Do not telephone.`, `${personName(rng)}, PO Box ${rng.int(11, 900)}, ${townName(rng)}`] }]),
          maybe(0.6, () => [{ kind: "updated", date: oldDate(rng) }]),
          maybe(0.7, () => [counter(rng)]),
        ],
      };
    }

    case "news": {
      const town = subject.category === "place" ? name : townName(rng);
      return {
        head: [
          sec(() => [{ kind: "banner", title: `${town} Online`, tagline: rng.pick(["Your community noticeboard", `News and information for ${town}`, "Updated when there is news"]) }]),
        ],
        body: [
          sec(() => [
            { kind: "heading", text: rng.pick(["Latest", "This Week", "Village News", "Notices"]) },
            { kind: "list", items: rng.sample([
              `Council approves ${rng.pick(["new car park", "traffic scheme", "market relocation", "flood defences"])} after ${rng.int(2, 11)} years`,
              `${personName(rng)} retires after ${rng.int(21, 45)} years at the ${rng.pick(["post office", "school", "surgery", "mill"])}`,
              `Fete raises $${rng.int(200, 4000)} — thanks to all who helped`,
              `Roadworks on ${rng.pick(["Mill Lane", "the bypass", "Church Street"])} until ${rng.pick(["March", "further notice"])}`,
              `Lost: ${rng.pick(["a grey cat", "a set of keys", "a brown dog"])}, ${rng.pick(["Tuesday", "last week"])}. Reward.`,
              `Complaints continue about ${wrong()} near ${where()}`,
            ], rng.int(3, 5)) },
          ]),
          maybe(0.7, () => [figure(rng, `${town}, from the ${rng.pick(["church tower", "bridge", "hill"])}`)]),
          maybe(0.65, () => [{ kind: "links", title: rng.pick(["Local Sites", "Around the Parish", "Useful Links"]), items: relatedLinks(rng, subject, rng.int(3, 5)) }]),
          maybe(0.6, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(2, 4), archetype) }]),
          maybe(0.4, () => [
            { kind: "heading", text: rng.pick(["Small Ads", "For Sale & Wanted"]) },
            { kind: "list", items: Array.from({ length: rng.int(2, 4) }, () =>
              `${rng.pick(["For sale", "Wanted", "Free to collector"])}: ${adj()} ${item}, ${rng.pick(["good condition", "needs attention", "no offers", "buyer collects"])}. Ring ${personName(rng)}.`) },
          ]),
        ],
        tail: [
          maybe(0.7, () => [{ kind: "updated", date: oldDate(rng) }]),
          maybe(0.5, () => [counter(rng)]),
        ],
      };
    }

    case "construction": {
      return {
        head: [
          sec(() => [{ kind: "banner", title: name, tagline: "" }]),
        ],
        body: [
          sec(() => [{ kind: "construction", note: rng.pick([
            "This page is under construction. Please check back soon!",
            "Sorry — still building this one. Bear with me.",
            "COMING SOON",
          ]) }]),
          maybe(0.8, () => [{ kind: "para", text: rng.pick([
            `I am still learning HTML. The ${item} section will be up as soon as I work out tables.`,
            `Site moved from my old host. Rebuilding everything by hand.`,
            `Nothing here yet. Email me if you want to be told when it is finished.`,
          ]) }]),
          maybe(0.3, () => [{ kind: "links", title: "In the meantime", items: relatedLinks(rng, subject, rng.int(1, 3)) }]),
        ],
        tail: [
          maybe(0.6, () => [{ kind: "updated", date: oldDate(rng) }]),
          maybe(0.7, () => [counter(rng)]),
        ],
        // An almost-empty page is the whole joke here.
        minBody: 1,
      };
    }
    }
  })();

  const blocks = assemble(rng, recipe);

  if (infusion && infusion.words.length > 0) {
    // Inserted before the counter and the badges, which belong at the bottom of
    // any page from this era.
    const tail = blocks.findIndex((b) => b.kind === "counter" || b.kind === "badges");
    const extra = infusionBlocks(rng, archetype, infusion.words, infusion.sources);
    blocks.splice(tail === -1 ? blocks.length : tail, 0, ...extra);
  }

  // Its own substream, so adding the object generator does not shift a single
  // roll in the prose and every page already shared stays word-for-word itself.
  //
  // The hints come from the same properties the prose is written from, which is
  // the point: a page that says a thing is kept in a hutch and made of wire
  // mesh should not be illustrated with a hard metal spike.
  const solid = shapeFor(subject.category, p.scale, rng.derive("solid"), {
    alive: p.alive,
    materials: p.material,
  });

  return { domain: subject.domain, title: titleFor(archetype, name), archetype, blocks, solid };
}

function titleFor(archetype: Archetype, name: string): string {
  switch (archetype) {
    case "shop": return `${name} — Online Catalogue`;
    case "fan": return `The ${name} Page`;
    case "personal": return `${name} :: home`;
    case "corporate": return `${name} | Corporate`;
    case "enthusiast": return `${name} Society`;
    case "institute": return `Institute of ${name}`;
    case "directory": return `${name} Directory`;
    case "cult": return name.toUpperCase();
    case "news": return `${name} Online`;
    case "construction": return `${name} - under construction`;
  }
}
