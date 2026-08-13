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
import * as generated from "./fishlore.generated.ts";

/**
 * Hand-written first, generated appended.
 *
 * The originals stay in this file and stay first: they are the reference for
 * the voice, and a build-time pass that produced something flat should never be
 * able to overwrite "There were four of us." Order does not affect selection —
 * rng.pick and rng.sample are uniform — it is here so the file still reads as
 * authored work with bulk behind it.
 */
const LIKES = [
  "the filter bubbles", "being fed first", "the green corner", "the plastic castle",
  "sunlight at about four o'clock", "the underside of the lid", "warm water",
  "the gravel near the heater", "hiding behind the thermometer", "new plants",
  "the tapping noise", "swimming against the current", "the dark side of the tank",
  "being counted", "the reflection in the glass", "flake food, not pellets",
  "the corner nobody cleans", "moving furniture", "company",
  ...generated.LIKES,
];

const DISLIKES = [
  "the vacuum", "Tuesdays", "being looked at directly", "the new gravel",
  "the big one", "sudden lights", "the net", "water changes",
  "the ornament that fell over", "pellets", "the pump when it rattles",
  "strangers", "being photographed", "the cold snap in March",
  "anything red", "the top of the tank", "loud rooms", "being moved",
  ...generated.DISLIKES,
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

  // Written, not generated. A 7B pass produced 188 of these and about eight
  // were usable: it reaches for scale ("the walls of this universe") the moment
  // it is asked for melancholy, and it cannot hold the flat register — note
  // that almost nothing here uses a contraction. Volume was the wrong tool.
  "The vacuum comes on Sundays. I have learned the sound of the cupboard.",
  "A child pressed a face to the glass once. I think about it.",
  "They rearranged the room and did not ask.",
  "I have never seen the floor.",
  "The tall one fed us twice one evening. Nobody spoke of it.",
  "I was told there would be a bigger tank.",
  "The heater clicks. That is the whole of the news.",
  "Once a year they take everything out and I sit in a bucket.",
  "I have counted the gravel. I will not say the number.",
  "The green one and I have an arrangement.",
  "Somebody's birthday happened out there. I saw the hats.",
  "I do not trust the new plant.",
  "There is a wire that goes somewhere. I have never learned where.",
  "The lid was left off for one hour in March.",
  "They moved the tank to paint. Nothing has been the same.",
  "I am the last one who remembers the old gravel.",
  "The dog looks in. We have reached an understanding.",
  "A fly got in once. It was the most interesting week of my life.",
  "I know which one of them is kind.",
  "The curtains open at half past seven. I am ready before that.",
  "There is a chair nobody sits in now.",
  "I have been photographed twice and consulted never.",
  "The bubbles stop at night. I have got used to it.",
  "Something fell behind the tank years ago and is still there.",
  "They talk in front of me as if I am furniture. I listen.",
  "I have outlived two of the plants and one of the children's interests.",
  "The thermometer says one thing. I say another.",
  "I was a prize. I have made something of myself since.",
  "The telly is on most evenings. I face the other way.",
  "Once the power went off and we all just waited.",
  "I have a route. It takes four minutes.",
  "They put a new one in and did not introduce us.",
  "The glass is cleaned on the outside only. I have noticed.",
  "I remember when the wallpaper was different.",
  "Nobody has changed the ornament since it fell.",
  "There is a draught from somewhere in October.",
  "I am not unhappy. I want that on the record.",
  "They named me after an uncle.",
  "The net comes out and we all know why.",
  "I have watched a person cry in this room. I did what I could.",
  "The bulb above went for three days. It was restful.",
  "I do not know what a Tuesday is but I know when it is one.",
  "They kept saying they would move us to the front room.",
  "I have seen the outside of the box we came in.",
  "There is a corner where the gravel is deeper. That is mine.",
  "The tapping is meant kindly. It is still tapping.",
  "One of us went into a jar and did not come back.",
  "I have never been hungry. That is not nothing.",
  "The window is behind me. I have only ever seen the light it makes.",
  "They hoovered right up to the stand and did not slow down.",
  "I know the sound of the front door and I know who it is.",
  "There was a party. Somebody put their drink on the lid.",
  "I have made my peace with the filter.",
  "The plants are plastic. I worked this out for myself.",
  "Nobody in this room knows how old I am, including me.",
];

const SOURCES = [
  "the pet shop on the high street", "a school raffle", "the market",
  "a colleague who was moving", "the garden centre", "a fairground",
  "next door, when they left", "mail order", "a house clearance",
  "the aquarium society's auction",
  ...generated.SOURCES,
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
