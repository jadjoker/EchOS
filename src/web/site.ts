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

const ADJECTIVES = `finest quality genuine authentic original classic vintage
  premium deluxe superior handmade custom rare unusual affordable discount
  wholesale reliable trusted traditional modern improved reconditioned
  guaranteed`.trim().split(/\s+/);

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

const GUEST_LINES = [
  "great site!! keep up the good work",
  "found you from the webring. bookmarked.",
  "does anyone else have trouble with the second one",
  "my uncle had one of these. brought back memories",
  "the pictures take forever to load on my machine",
  "please email me i have a question about the blue one",
  "cool page. check out mine too",
  "i disagree with everything on this page",
  "been looking for this info for MONTHS. thank you",
  "is this site still updated?",
  "hi from australia!!",
  "you spelled it wrong in the third paragraph",
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
  const variants = ["Standard", "Deluxe", "Junior", "Professional", "Compact",
    "Heavy Duty", "Twin Pack", "Starter", "Reconditioned", "Weatherproof",
    "Economy", "Trade"];

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

function guestbook(rng: Rng, count: number): GuestEntry[] {
  return rng.sample(GUEST_LINES, Math.min(count, GUEST_LINES.length)).map((text) => ({
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
  const adj = () => rng.pick(ADJECTIVES);

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
            { kind: "heading", text: rng.pick(["About Us", "The Business", "Who We Are"]) },
            { kind: "para", text: `${name} is a family business operating from ${townName(rng)}. We supply ${who()} across the county, and every ${item} is checked before it leaves the premises.` },
          ]),
          maybe(0.7, () => [{ kind: "para", text: rng.pick([
            `A note on returns: we cannot accept ${plural(item)} showing ${wrong()}. Please read the fitting instructions before you ${doing()} anything.`,
            `Most enquiries we get are about ${wrong()}. Ring us before you order — it is usually the ${part()}.`,
            `We keep ${part()} for models going back to ${rng.int(1961, 1988)}. If you cannot see what you need, ask.`,
          ]) }]),
          maybe(0.55, () => [{ kind: "links", title: "Trade Associates", items: relatedLinks(rng, subject, rng.int(2, 4)) }]),
          maybe(0.35, () => [figure(rng, rng.pick([`The workshop, ${rng.int(1978, 1996)}`, "Our premises", `${adj()} ${item}, as supplied`]))]),
          maybe(0.3, () => [
            { kind: "heading", text: "What Customers Say" },
            { kind: "guestbook", entries: guestbook(rng, rng.int(2, 3)) },
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
            { kind: "heading", text: rng.pick([`Why ${name}?`, "About This Page", "Why I Made This"]) },
            { kind: "para", text: `I started this page in ${rng.int(1996, 2001)} because there was nothing else out there. ${rng.pick(["I am not an expert.", "I have been collecting for eleven years.", "My family think I am mad."])} If you have anything to add, email me.` },
          ]),
          maybe(0.85, () => [
            { kind: "heading", text: rng.pick(["Facts", "Did You Know?", "Things People Get Wrong"]) },
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
          maybe(0.75, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(3, 5)) }]),
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
          sec(() => [{ kind: "para", text: `Hello. My name is ${owner} and I live in ${townName(rng)}. This is my page about ${item}, ${rng.pick(["among other things", "mostly", "and my other interests"])}.` }]),
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
          maybe(0.6, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(2, 4)) }]),
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
            { kind: "para", text: `${name} ${suffix} is a leading provider of ${item} products and associated services. Founded in ${rng.int(1948, 1991)}, we operate ${rng.int(2, 40)} facilities and employ over ${rng.int(30, 4000)} people worldwide.` },
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
            { kind: "para", text: `Results for the ${rng.pick(["third", "fourth", "second"])} quarter will be announced on ${oldDate(rng)}. Shareholders requiring documentation should contact the registrar.` },
          ]),
          maybe(0.4, () => [
            { kind: "heading", text: rng.pick(["Quality & Compliance", "Health and Safety", "Environmental Policy"]) },
            { kind: "para", text: `All ${item} operations are conducted under our accredited quality system. Incidents involving ${wrong()} are recorded and reviewed by the board.` },
          ]),
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
            { kind: "para", text: `We meet on the ${rng.pick(["first", "second", "last"])} ${rng.pick(["Tuesday", "Thursday", "Saturday"])} of the month at the ${rng.pick(["village hall", "community centre", "Rose & Crown", "library annexe"])} in ${townName(rng)}. Visitors welcome. Please bring your own ${item} for identification — and label the ${part()}, we had trouble last year.` },
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
            { kind: "para", text: `Annual subscription is $${rng.int(3, 24)}, or $${rng.int(2, 15)} for juniors and the retired. Cheques to the treasurer, ${personName(rng)}.` },
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
            { kind: "para", text: `The Institute maintains the largest collection of ${item} material in the region. Access to the reading room is by appointment only. Enquiries should be directed to the assistant keeper, ${personName(rng)}.` },
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
          maybe(0.7, () => [{ kind: "para", text: `This directory is maintained by hand by one person. Submissions are reviewed within ${rng.int(2, 12)} weeks. Sites that have moved without notice are removed.` }]),
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
          maybe(0.8, () => [{ kind: "para", text: `I am not asking you to believe me. I am asking you to look at the ${item} yourself and draw your own conclusions.` }]),
          maybe(0.4, () => [
            { kind: "heading", text: rng.pick(["Correspondence", "Replies I Have Had", "Who Has Written To Me"]) },
            { kind: "guestbook", entries: guestbook(rng, rng.int(2, 3)) },
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
          maybe(0.6, () => [{ kind: "guestbook", entries: guestbook(rng, rng.int(2, 4)) }]),
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

  return { domain: subject.domain, title: titleFor(archetype, name), archetype, blocks };
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
