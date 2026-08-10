/**
 * Turning a typed domain into something the page generator can reason about.
 *
 * The order of attack matters: suffix stripping first (because "trampolineworld"
 * is about trampolines, not worlds), then compound splitting, then
 * singularisation, then the lexicon. Anything that survives all of that is
 * *invented* — and that is a first-class result, not a failure. "glorbus.com"
 * reaching the invented path and becoming a brand that sells Glorbs is the
 * feature, not the fallback.
 */

import { lookup, type Category } from "./lexicon.ts";
import { propsFor, type Props } from "./properties.ts";
import { readInvented, type Reading } from "./phonetics.ts";

/** A structural steer from the domain itself, independent of the noun. */
export type SiteHint =
  | "shop" | "fan" | "place" | "org" | "field" | "activity"
  | "role" | "product" | "web" | null;

export interface Subject {
  /** As typed, normalised: "glorbus.com". */
  domain: string;
  host: string;
  tld: string;
  /** The content noun, singular where we could tell. */
  stem: string;
  /** Title-case, for headings: "Glorbus". */
  display: string;
  plural: boolean;
  category: Category;
  invented: boolean;
  /** The other half of a compound: "trampoline" in "trampolineworld". */
  modifier: string | null;
  hint: SiteHint;
  /** What the generator knows about the thing itself. */
  props: Props;
  /** Present only for invented words: what the sound suggested. */
  reading: Reading | null;
}

/** Longest first — "supplies" must beat "supply" and "s". */
const SUFFIXES: readonly (readonly [string, SiteHint])[] = [
  ["emporium", "shop"], ["supplies", "shop"], ["supply", "shop"],
  ["outlet", "shop"], ["depot", "shop"], ["store", "shop"], ["shop", "shop"],
  ["mart", "shop"], ["market", "shop"], ["bazaar", "shop"], ["trader", "shop"],

  ["fanclub", "fan"], ["fanpage", "fan"], ["fans", "fan"], ["fan", "fan"],
  ["club", "fan"], ["zone", "fan"], ["world", "fan"], ["land", "fan"],
  ["ring", "fan"], ["pages", "fan"], ["page", "fan"], ["central", "fan"],

  ["ville", "place"], ["town", "place"], ["city", "place"], ["burg", "place"],
  ["field", "place"], ["ford", "place"], ["shire", "place"], ["haven", "place"],
  ["port", "place"], ["bury", "place"], ["stead", "place"], ["wick", "place"],

  ["industries", "org"], ["solutions", "org"], ["holdings", "org"],
  ["dynamics", "org"], ["systems", "org"], ["works", "org"], ["group", "org"],
  ["labs", "org"], ["corp", "org"], ["tech", "org"], ["soft", "org"],
  ["inc", "org"],

  ["ology", "field"], ["ography", "field"], ["onomy", "field"],
  ["istry", "field"], ["ics", "field"],

  ["ware", "product"], ["gear", "product"], ["kit", "product"],

  ["online", "web"], ["site", "web"], ["web", "web"], ["net", "web"],
];

function singular(word: string): { stem: string; plural: boolean } {
  if (word.length > 4 && word.endsWith("ies")) {
    return { stem: `${word.slice(0, -3)}y`, plural: true };
  }
  if (word.length > 4 && /(?:s|x|z|ch|sh)es$/.test(word)) {
    return { stem: word.slice(0, -2), plural: true };
  }
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return { stem: word.slice(0, -1), plural: true };
  }
  return { stem: word, plural: false };
}

/** Head-final split where both halves are real words. Longest head wins. */
function splitCompound(host: string): { modifier: string; head: string } | null {
  for (let i = 3; i <= host.length - 3; i++) {
    const modifier = host.slice(0, i);
    const head = host.slice(i);
    if (lookup(modifier) && lookup(head)) return { modifier, head };
    const headSingular = singular(head).stem;
    if (lookup(modifier) && lookup(headSingular)) {
      return { modifier, head: headSingular };
    }
  }
  return null;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Which noun a hint prefers to sit on. A shop suffix wants a *product* noun in
 * front of it, so we keep the remainder as the subject; a place suffix on an
 * unknown remainder ("glorbusville") leaves the remainder as an invented place
 * name, which is also right.
 */
/**
 * Attach what we know about the thing.
 *
 * Known words look their properties up. Invented words get theirs *inferred
 * from their sound* — so glorbus, flumph and kraxdor produce three different
 * kinds of site rather than three copies of one.
 */
export function parseDomain(input: string): Subject {
  const subject = classify(input);
  if (!subject.invented) {
    return { ...subject, props: propsFor(subject.stem, subject.category), reading: null };
  }
  const reading = readInvented(subject.stem);
  return { ...subject, category: reading.category, props: reading.props, reading };
}

type Classified = Omit<Subject, "props" | "reading">;

function classify(input: string): Classified {
  const cleaned = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const [rawHost = "", ...rest] = cleaned.split(".");
  const tld = rest.at(-1) || "com";
  const host = rawHost.replace(/[^a-z0-9-]/g, "");
  const bare = host.replace(/-/g, "");
  const domain = `${host}.${tld}`;

  const base: Omit<Classified, "stem" | "display" | "category" | "invented" | "plural" | "modifier" | "hint"> =
    { domain, host, tld };

  if (!bare) {
    return { ...base, stem: "nothing", display: "Nothing", plural: false, category: "abstract", invented: true, modifier: null, hint: null };
  }

  // 0. The whole word, first.
  //
  // This MUST precede suffix stripping and compound splitting, or words that
  // merely look decomposable get destroyed: "mycology" loses its "ology" and
  // becomes "myc", "pinball" splits into pin + ball. If we know the word as
  // typed, no further analysis can improve on that.
  {
    const { stem, plural } = singular(bare);
    const category = lookup(bare) ?? lookup(stem);
    if (category) {
      const whole = lookup(bare) ? bare : stem;
      return {
        ...base,
        stem: whole,
        display: titleCase(whole),
        plural: plural && !lookup(bare),
        category,
        invented: false,
        modifier: null,
        hint: plural && !lookup(bare) ? "product" : null,
      };
    }
  }

  // 1. Suffix, with a remainder we recognise. "trampolineworld", "birdmart".
  for (const [suffix, hint] of SUFFIXES) {
    if (!bare.endsWith(suffix) || bare.length <= suffix.length + 2) continue;
    const remainder = bare.slice(0, -suffix.length);
    const { stem, plural } = singular(remainder);
    const category = lookup(stem) ?? lookup(remainder);
    if (category) {
      return { ...base, stem, display: titleCase(stem), plural, category, invented: false, modifier: null, hint };
    }
    // Suffix present but the remainder is nonsense — still informative.
    // "glorbusville" is a place, it just isn't a place we can name.
    return { ...base, stem: remainder, display: titleCase(remainder), plural: false, category: "invented", invented: true, modifier: null, hint };
  }

  // 2. Compound of two known words. "birdhouse", "stonebridge".
  const compound = splitCompound(bare);
  if (compound) {
    const category = lookup(compound.head);
    if (category) {
      return {
        ...base,
        stem: compound.head,
        display: `${titleCase(compound.modifier)} ${titleCase(compound.head)}`,
        plural: false,
        category,
        invented: false,
        modifier: compound.modifier,
        hint: null,
      };
    }
  }

  // 3. Invented. The interesting case.
  return { ...base, stem: bare, display: titleCase(bare), plural: false, category: "invented", invented: true, modifier: null, hint: null };
}
