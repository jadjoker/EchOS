/**
 * Pool definitions for the aquarium's lore tables.
 *
 * Different job from expand-props.mjs. That extracted *facts* about a noun,
 * which a model is good at. This is voice work, and the existing tables are the
 * best-written thing in the project — "There were four of us." is not a line a
 * 7B is going to beat. So the gates here are pitched at rejecting anything that
 * reaches for the obvious, and the quotes pool is explicitly a shortlist for a
 * human to cut down rather than something to ship as generated.
 *
 * The voice, stated once: these are notes the machine's previous owner kept
 * about their fish. Mundane, specific, domestic, faintly sad. Never whimsical,
 * never a punchline, never a fish being adorable.
 */

/**
 * Whimsy and poetry, both of which kill the register instantly.
 *
 * The second block is wanting. The quotes brief already said the fish "is not
 * sad about being a fish and does not want to escape", but nothing enforced it,
 * and the first run came back 16% wistful — a fish wishing it could speak, or
 * wondering what is past the glass. That is a different animal from the one in
 * the brief, and it reads as the cheaper one.
 */
const BANNED = new Set(`ocean sea seas wild freedom free dream dreams soul
  destiny adventure journey magical magic wonderful amazing beautiful lovely
  happy joy sparkle shimmer rainbow treasure friend friends bestie buddy
  wisdom eternity infinite majestic glorious splendid delightful whimsical
  yearning boundless azure cerulean depths abyss

  wish wishes wishing wished escape escapes escaping escaped
  hope hopes hoping hoped imagine imagines imagining imagined`
  .trim().split(/\s+/));

/**
 * Anything that must never reach a store page.
 *
 * Asked for 260 British pet names, a 7B produced "Wanker", "Slapper" and
 * "Scroters" — it has no idea which side of "cheeky" those land on, and it is
 * generating into a commercial release with no moderation layer behind it.
 * Matched on the whole entry and on any token within it.
 */
const UNSAFE = new Set(`wanker wank slapper slapperkin slag slut whore tart
  bitch bastard bollocks bollock knob knobhead nob nonce prick pillock tosser
  twat tit tits arse arsehole ass asshole shit shite crap piss pisser fuck
  fucker cunt dick dickhead cock willy minge fanny spastic spaz mong retard
  paki chink coon kike wog wop gyp gypo tranny fag faggot queer homo dyke
  scroters scrote scrotum bellend git wazzock chav pikey junkie tramp
  mugger blagger rapist nazi hitler`.trim().split(/\s+/));

/**
 * Recognisable characters and brands. Not exhaustive — no list could be — but
 * it catches what this model actually reached for, and the review step is
 * where the rest gets caught.
 */
const OWNED = new Set(`squidward daffy nemo dory ariel bubbles2 pikachu sonic
  mario luigi shrek gandalf frodo dumbledore batman superman spongebob patrick2
  droog boaty garfield snoopy pokemon disney marmite2 tigger eeyore piglet
  bambi simba mickey2 minnie goofy pluto2 elmo kermit gonzo`.trim().split(/\s+/));

/** Alphabet-run padding: the tell that the model has run out and is filling. */
const FILLER = new Set(`alpha beta gamma delta epsilon zeta omega sigma omicron
  xylophone yarn zap ugliest ugley aaa abc xyz test example placeholder
  letter number word name entry item thing`.trim().split(/\s+/));

/** A tank fish philosophising about the ocean is the exact cliché to avoid. */
function hasBanned(text) {
  return tokens(text).some((word) => BANNED.has(word));
}

function tokens(text) {
  return text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
}

/**
 * The check every pool runs before its own rules. Returns a reason or null.
 * Kept separate from hasBanned so the reporting distinguishes "wrong register"
 * from "must never ship", which are not the same problem.
 */
export function unsafe(entry) {
  const words = tokens(entry);
  for (const word of words) {
    if (UNSAFE.has(word)) return `unsafe: "${word}"`;
    if (OWNED.has(word)) return `third-party name: "${word}"`;
    if (FILLER.has(word)) return `filler: "${word}"`;
  }
  return null;
}

const NO_EXCLAIM = (text) => !/[!?]/.test(text);

/**
 * The failure mode of a small model asked for a melancholy line: it reaches for
 * cosmic scale. Banning "ocean" was not enough — it wrote "the walls of this
 * universe" and "even time itself feels different here" instead. The shipped
 * voice never leaves the front room.
 */
const ABSTRACT = new Set(`universe eternity forever lifetime lifetimes existence
  infinity infinite meaning purpose reality void cosmos endless timeless ancient
  profound essence being consciousness awareness perception mortality vastness
  boundary boundaries limitless`.trim().split(/\s+/));

/** The house is in Britain. */
const AMERICAN = new Set(`faucet drapes closet sidewalk apartment trash cookie
  elevator diaper gotten yard candy flashlight garbage stroller vacation
  aluminum recognize realize apologize color favorite gray airplane`
  .trim().split(/\s+/));

/**
 * "There were four of us." is five words. Length is the single strongest
 * predictor of whether a generated line has the voice: the model pads, and
 * padding is where the register dies.
 */
const MAX_QUOTE_WORDS = 13;

/**
 * Likes and dislikes leave the aquarium.
 *
 * loreWords() in fishlore.ts strips these to bare nouns and puts them on the
 * influence bus, which is how plugging the tank into the browser makes a shop
 * stock what the fish are fond of. So an entry has to survive becoming a
 * product: "the green corner" works, "cleaning the glass" and "the sound of a
 * pencil tapping" do not. Activities are rejected here rather than filtered
 * downstream, because the pool should not contain them in the first place.
 */
function notAThing(entry) {
  const bare = entry.replace(/^(the|a|an)\s+/i, "");
  if (/^sound of /i.test(bare)) return "a sound, not a thing";
  // Gerund followed by an article is a verb phrase: "cleaning the glass".
  if (/^\w+ing (the|a|an) /i.test(bare)) return "an activity, not a thing";
  if (/^(feeling|being|getting|having) /i.test(bare)) return "an experience, not a thing";
  return null;
}

export const POOLS = {
  names: {
    export: "NAMES",
    target: 260,
    batch: 30,
    describe: "pet names for a fish, of the kind a British household actually uses",
    system: `You write pet names for fish kept by ordinary British households between roughly 1975 and 1999.

The joke is that these are not fish names. They are the names of a neighbour, a dog, a naval officer, or a snack. A few are grandiose for something four inches long. A few are simply a bloke's name.

One word only. Capitalised. No puns on water or swimming. No "Finley", "Bubbles Jr", nothing cute or American. Nothing that sounds like it was chosen by a marketing team.`,
    validate(entry) {
      if (!/^[A-Z][A-Za-z]{2,11}$/.test(entry)) return "not a single capitalised word";
      if (hasBanned(entry)) return "whimsy";
      return null;
    },
  },

  sources: {
    export: "SOURCES",
    target: 90,
    batch: 20,
    describe: "places a British household acquired a fish from",
    system: `You write where a fish came from — the place an ordinary British household got it, between roughly 1975 and 1999.

Lowercase. A noun phrase, not a sentence. No full stop. Mundane and specific: jumble sales, a colleague who was moving, a pub that closed. Somewhere real and slightly sad, never a pet superstore and never anything charming.

Three to six words.`,
    validate(entry) {
      const words = entry.split(" ");
      if (words.length < 2 || words.length > 7) return "wrong length";
      if (/^[A-Z]/.test(entry)) return "capitalised";
      if (/[.!?]$/.test(entry)) return "trailing punctuation";
      if (hasBanned(entry)) return "whimsy";
      return null;
    },
  },

  likes: {
    export: "LIKES",
    target: 130,
    batch: 25,
    describe: "things a fish in a home aquarium is fond of",
    system: `You write what a fish likes, as recorded by the person who keeps it.

Lowercase noun phrase. No full stop. Two to six words.

These are things inside or immediately around a tank in someone's front room: a specific corner, a noise, a time of day, an object, a routine. Specific beats general — "sunlight at about four o'clock" not "sunlight", "flake food, not pellets" not "food".

Never the ocean, never freedom, never anything the fish could not actually perceive from inside a glass box in a living room.`,
    validate(entry) {
      const words = entry.split(" ");
      if (words.length < 2 || words.length > 6) return "wrong length";
      if (/^[A-Z]/.test(entry)) return "capitalised";
      if (/[.!?]$/.test(entry)) return "trailing punctuation";
      if (hasBanned(entry)) return "whimsy";
      return notAThing(entry);
    },
  },

  dislikes: {
    export: "DISLIKES",
    target: 130,
    batch: 25,
    describe: "things a fish in a home aquarium dislikes",
    system: `You write what a fish dislikes, as recorded by the person who keeps it.

Lowercase noun phrase. No full stop. One to six words.

Domestic irritations observed from inside a tank: an appliance, a person, a day of the week, a change to the furniture, a specific weather event. Dry and deadpan. "Tuesdays" is the register. "the ornament that fell over" is the register.

Never the ocean, never predators, never anything dramatic.`,
    validate(entry) {
      const words = entry.split(" ");
      if (words.length > 6) return "too long";
      if (/[.!?]$/.test(entry)) return "trailing punctuation";
      // "Tuesdays" and "Christmas" are legitimately capitalised; a sentence is not.
      if (/^[A-Z]/.test(entry) && words.length > 1) return "capitalised phrase";
      if (hasBanned(entry)) return "whimsy";
      return notAThing(entry);
    },
  },

  quotes: {
    export: "QUOTES",
    target: 200,
    batch: 15,
    curate: true,
    describe: "things a fish in a home aquarium might say about its life",
    system: `You write a single line said by a fish in a tank in someone's front room.

First person. One or two short sentences. Ends with a full stop. Never a question, never an exclamation.

The fish is not sad about being a fish and does not want to escape. It is matter-of-fact about a small life it has fully accepted, and it knows things about the room it should not know. The comedy and the sadness are the same sentence — the reader should not be sure whether to laugh.

It notices: the furniture, the people who stopped watching, the arrangement of the day, the exact dimensions of what it has, other fish that are no longer here.

Never mention the ocean, the sea, freedom, dreams, or wishing. Never be whimsical. Never make a joke about water or being wet.`,
    validate(entry) {
      const words = entry.split(" ");
      if (words.length > MAX_QUOTE_WORDS) return `${words.length} words, max ${MAX_QUOTE_WORDS}`;
      if (entry.length < 14) return "too short";
      if (!/^[A-Z]/.test(entry)) return "not capitalised";
      if (!entry.endsWith(".")) return "must end in a full stop";
      if (!NO_EXCLAIM(entry)) return "exclamation or question";
      if (hasBanned(entry)) return "whimsy";
      if (!/\b(I|me|my|we|us|our)\b/.test(entry)) return "not first person";
      if ((entry.match(/\./g) ?? []).length > 2) return "too many sentences";

      // Wanting, phrased so no single banned word appears. "If only I could
      // tell them" is the exact register the brief rules out, and the
      // word-level gate cannot see it.
      if (/\b(if only|i could tell|could i|were i able|long(?:s|ed|ing)? to)\b/i.test(entry)) {
        return "wanting";
      }

      for (const word of tokens(entry)) {
        if (ABSTRACT.has(word)) return `philosophising: "${word}"`;
        if (AMERICAN.has(word)) return `American: "${word}"`;
      }

      // The strongest voice marker in the shipped lines, and the one the model
      // never picked up: "I do not", "There is", "I am not". A possessive 's is
      // fine — "Somebody's birthday" — so only verb contractions are rejected.
      if (/\b(?:\w+n't|\w+'(?:ve|ll|re|d|m)|(?:it|there|that|what|he|she|who|here)'s)\b/i.test(entry)) {
        return "contraction";
      }
      return null;
    },
  },

  speciesHead: {
    export: "SPECIES_HEAD",
    target: 70,
    batch: 20,
    describe: "adjectives that begin an aquarium fish species name",
    system: `You write the first word of an aquarium fish's species name, as printed on a shop tank label.

One word. Capitalised. A colour, a pattern, a texture, a size, or a rank. "Marbled", "Whiptail", "Lesser", "Royal" are the register.

Plausible enough that an aquarist would not blink. No invented Latin, no fantasy words.`,
    validate(entry) {
      if (!/^[A-Z][a-z]{2,11}$/.test(entry)) return "not a single capitalised word";
      if (hasBanned(entry)) return "whimsy";
      return null;
    },
  },

  speciesTail: {
    export: "SPECIES_TAIL",
    target: 55,
    batch: 20,
    describe: "common names of small aquarium fish families",
    system: `You write the second word of an aquarium fish's species name — the family or common type.

One word. Lowercase. Real aquarium fish types: barb, tetra, danio, rasbora, loach, gourami, corydoras, pleco, swordtail, oto.

Real names only. Nothing invented.`,
    validate(entry) {
      if (!/^[a-z]{3,12}$/.test(entry)) return "not a single lowercase word";
      if (hasBanned(entry)) return "whimsy";
      return null;
    },
  },
};
