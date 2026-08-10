/**
 * Place and person names.
 *
 * Shared by the generated web and the weather app. Built from real English
 * toponym morphemes rather than invented syllables, because "Thornmere" reads
 * as a town that exists and "Zyx'thar" reads as a fantasy novel.
 */

import type { Rng } from "../core/rng.ts";

const HEADS = `Ash Bram Wold Ket Marl Ober Thorn Kirk Hollow Pine Stone Fox
  Raven Mill Bel Whit Black Green Long Little Great Nether Upper Lower Old
  Cold Wind Water Salt Bridge Kings Bishops Abbots Hart Elm Oak Birch Fern
  Moss Grim Dun Wick Har Bal Cran Ted Wen Alder`.trim().split(/\s+/);

const TAILS = `ford bury ton field stead wick haven mere dale combe worth by
  thorpe moor bridge gate church ley den hurst wold ridge bourne beck holm
  cote sett mouth head cliff`.trim().split(/\s+/);

const FIRST = `Margaret Doris Eileen Brenda Maureen Janet Sylvia Pauline Gladys
  Norma Harold Kenneth Trevor Raymond Clifford Stanley Melvin Bernard Douglas
  Roy Debbie Sharon Karen Tracey Michelle Wendy Susan Linda Carol Dawn Gary
  Wayne Keith Barry Dennis Neil Colin Graham Ian Malcolm Terry`.trim().split(/\s+/);

const LAST = `Pike Hollis Braddock Wren Ashby Mercer Thorne Bagley Crick Dunmore
  Fenwick Gadsby Harker Ingham Jessop Kettle Lowry Marbury Nunn Ockley Prentice
  Quill Rundle Stagg Tuppen Vance Weeks Yardley Bicker Coombes Dill Frayne`
  .trim().split(/\s+/);

export function townName(rng: Rng): string {
  const head = rng.pick(HEADS);
  const tail = rng.pick(TAILS);
  // Two-word names ("Great Ashford") read as older and break up the rhythm.
  return rng.chance(0.22)
    ? `${rng.pick(["Great", "Little", "Upper", "Nether", "Old"])} ${head}${tail}`
    : `${head}${tail}`;
}

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

export function handle(rng: Rng): string {
  // The names people actually signed guestbooks with.
  const styles = [
    () => `${rng.pick(FIRST).toLowerCase()}${rng.int(1, 99)}`,
    () => `${rng.pick(LAST).toLowerCase()}_${rng.int(60, 99)}`,
    () => `${rng.pick(["the", "mr", "ms", "dr", "lil", "big"])}${rng.pick(LAST).toLowerCase()}`,
    () => `${rng.pick(FIRST).toLowerCase()}.${rng.pick(LAST).toLowerCase()}`,
    () => `${rng.pick(["xX", "~*~", "..", ""])}${rng.pick(FIRST).toLowerCase()}${rng.pick(["Xx", "~*~", "..", ""])}`,
  ];
  return rng.pick(styles)();
}

/** Dates skewed to the era the whole aesthetic is quoting. */
export function oldDate(rng: Rng): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${rng.int(1, 28)} ${rng.pick(months)} ${rng.int(1996, 2004)}`;
}
