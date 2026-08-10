/**
 * Who a fish is.
 *
 * The register matters more than the content here. These are not jokes told by
 * the game — they are things the machine's owner wrote down about their fish,
 * in the same voice as the boot warnings and the unattended weather station.
 * Mundane, specific, and a little sad. A fish with a favourite corner of the
 * tank is more affecting than a fish with a punchline.
 */

import type { Rng } from "../core/rng.ts";
import { personName, townName, oldDate } from "./places.ts";

const LIKES = [
  "the filter bubbles", "being fed first", "the green corner", "the plastic castle",
  "sunlight at about four o'clock", "the underside of the lid", "warm water",
  "the gravel near the heater", "hiding behind the thermometer", "new plants",
  "the tapping noise", "swimming against the current", "the dark side of the tank",
  "being counted", "the reflection in the glass", "flake food, not pellets",
  "the corner nobody cleans", "moving furniture", "company",
];

const DISLIKES = [
  "the vacuum", "Tuesdays", "being looked at directly", "the new gravel",
  "the big one", "sudden lights", "the net", "water changes",
  "the ornament that fell over", "pellets", "the pump when it rattles",
  "strangers", "being photographed", "the cold snap in March",
  "anything red", "the top of the tank", "loud rooms", "being moved",
];

const QUOTES = [
  "I have been here longer than the sofa.",
  "There is a corner I do not go to and I will not explain why.",
  "Every day is the same and I have made my peace with that.",
  "The light comes on. The light goes off. This is the arrangement.",
  "I remember the bag.",
  "I am not the one who broke the ornament.",
  "It is not a castle. I have been inside it.",
  "Somebody used to sit and watch. They stopped.",
  "The water tastes different since Thursday.",
  "I know exactly how big this is.",
  "I would like to see the rest of the room.",
  "There were four of us.",
  "Nothing has happened today, which is the best kind of day.",
  "I am aware of the glass.",
  "They put a mirror here once. It was a difficult week.",
];

const SOURCES = [
  "the pet shop on the high street", "a school raffle", "the market",
  "a colleague who was moving", "the garden centre", "a fairground",
  "next door, when they left", "mail order", "a house clearance",
  "the aquarium society's auction",
];

const TEMPERAMENTS = [
  "placid", "territorial", "curious", "withdrawn", "restless", "watchful",
  "unbothered", "highly strung", "sociable", "particular", "resigned",
];

export interface FishLore {
  /** Human-readable, e.g. "3 years 7 months" — or honestly unknown. */
  age: string;
  temperament: string;
  likes: string[];
  dislikes: string[];
  quote: string;
  /** Where it came from and roughly when. */
  acquired: string;
  /** Who wrote all this down. */
  recordedBy: string;
  /** Only true for the one nobody removed. */
  deceased: boolean;
}

export function generateLore(rng: Rng, deceased: boolean): FishLore {
  const years = rng.int(0, 9);
  const months = rng.int(0, 11);

  const age = rng.chance(0.15)
    ? "unknown — records were not kept"
    : years === 0
      ? `${months} months`
      : `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;

  return {
    age,
    temperament: rng.pick(TEMPERAMENTS),
    likes: rng.sample(LIKES, rng.int(2, 3)),
    dislikes: rng.sample(DISLIKES, rng.int(1, 3)),
    quote: rng.pick(QUOTES),
    acquired: `${rng.pick(SOURCES)}, ${oldDate(rng)}`,
    recordedBy: `${personName(rng)}, ${townName(rng)}`,
    deceased,
  };
}

/**
 * What a fish contributes to the influence bus.
 *
 * Likes and dislikes travel as words, which is why plugging the tank into the
 * browser makes a shop stock the things the fish are fond of. Stripped to bare
 * nouns — "the filter bubbles" arrives as "filter bubbles", because a shop
 * selling "the filter bubbles" reads as a bug rather than a joke.
 */
export function loreWords(lore: FishLore): string[] {
  return [...lore.likes, ...lore.dislikes]
    // "being counted" and "anything red" describe experiences, not things.
    // Stripping the prefix leaves a bare participle, and a shop stocking
    // "Counted" reads as a bug rather than a joke — so drop them entirely
    // rather than mangling them into nouns they were never going to be.
    .filter((phrase) => !/^(being|anything)\s/i.test(phrase))
    .map((phrase) => phrase.replace(/^(the|a|an)\s+/i, "").trim())
    .filter((phrase) => phrase.length > 2 && !phrase.includes(" not "));
}
