/**
 * What we know about a thing, beyond what kind of thing it is.
 *
 * A category alone can only produce "Deluxe Trampoline, $89.99". Properties
 * produce "Replacement safety netting, all sizes" — because the generator knows
 * a trampoline has springs, a mat and netting, lives in a garden, is bought by
 * families, and hurts people. This is the difference between filling slots and
 * appearing to know something.
 *
 * Authored as CATEGORY DEFAULTS plus PER-WORD OVERRIDES. Tagging a thousand
 * words individually would be weeks of typing for a fraction of the benefit;
 * every `tool` sharing a workshop and a rust problem is right often enough, and
 * the words people actually type get overrides.
 */

import { lookup, type Category } from "./lexicon.ts";

export type Scale = "tiny" | "small" | "medium" | "large" | "huge";

export interface Props {
  /** Components, spares, things a shop sells separately. */
  parts: string[];
  /** Where it is found. Drives shop addresses, club meeting places, photos. */
  setting: string[];
  /** What you do with/to it. */
  verb: string[];
  /** Who cares about it. Drives testimonials and club membership. */
  buyer: string[];
  /** What goes wrong. The single most characterful property. */
  risk: string[];
  material: string[];
  /** Things sold alongside. */
  accessory: string[];
  scale: Scale;
  alive: boolean;
}

const BLANK: Props = {
  parts: ["parts", "fittings", "spares"],
  setting: ["the premises", "the yard", "storage"],
  verb: ["use", "handle", "keep"],
  buyer: ["collectors", "the trade", "enthusiasts"],
  risk: ["wear", "damp", "misuse"],
  material: ["steel", "wood", "plastic"],
  accessory: ["a carrying case", "a manual", "a cover"],
  scale: "medium",
  alive: false,
};

const BY_CATEGORY: Partial<Record<Category, Partial<Props>>> = {
  animal: {
    parts: ["feed", "bedding", "a hutch", "a water bottle", "grooming kit"],
    setting: ["the garden", "the paddock", "a hutch", "the wild", "the shed"],
    verb: ["breed", "show", "keep", "photograph", "ring", "record"],
    buyer: ["breeders", "keepers", "showing families", "the society"],
    risk: ["mites", "damp bedding", "escaping", "the neighbour's cat", "overfeeding"],
    material: ["straw", "wire mesh", "timber"],
    accessory: ["a travel box", "a judging card", "a breed standard booklet"],
    alive: true, scale: "small",
  },
  plant: {
    parts: ["seed", "cuttings", "rootstock", "compost", "feed"],
    setting: ["the greenhouse", "the border", "a cold frame", "the allotment"],
    verb: ["propagate", "prune", "show", "graft", "overwinter"],
    buyer: ["growers", "the horticultural society", "allotment holders"],
    risk: ["frost", "blackfly", "root rot", "a late spring", "slugs"],
    material: ["terracotta", "peat", "cane"],
    accessory: ["labels", "a dibber", "netting"],
    alive: true, scale: "small",
  },
  food: {
    parts: ["the recipe", "ingredients", "a starter", "packaging"],
    setting: ["the kitchen", "the bakery", "a market stall", "the pantry"],
    verb: ["make", "cure", "keep", "judge", "sell"],
    buyer: ["households", "caterers", "the market"],
    risk: ["spoilage", "the damp", "a poor season"],
    material: ["greaseproof paper", "glass", "tin"],
    accessory: ["a storage tin", "a printed label", "a gift box"],
    scale: "tiny",
  },
  drink: {
    parts: ["bottles", "caps", "a siphon", "the recipe"],
    setting: ["the cellar", "the brewery", "a back room"],
    verb: ["brew", "bottle", "age", "taste"],
    buyer: ["publicans", "home brewers", "the society"],
    risk: ["a stuck fermentation", "wild yeast", "exploding bottles"],
    material: ["glass", "oak", "copper"],
    accessory: ["a hydrometer", "labels", "a crown capper"],
    scale: "small",
  },
  tool: {
    parts: ["handles", "blades", "spare heads", "a sharpening stone"],
    setting: ["the workshop", "the shed", "a toolroom", "the van"],
    verb: ["sharpen", "restore", "collect", "use daily"],
    buyer: ["the trade", "restorers", "collectors", "apprentices"],
    risk: ["rust", "a loose handle", "the wrong grind", "theft from vans"],
    material: ["forged steel", "beech", "brass"],
    accessory: ["a roll", "an oilstone", "a leather guard"],
    scale: "small",
  },
  vehicle: {
    parts: ["the gearbox", "brake shoes", "a wiring loom", "seals", "trim"],
    setting: ["the garage", "a lock-up", "the road", "a rally field"],
    verb: ["restore", "rally", "maintain", "register", "road test"],
    buyer: ["owners' clubs", "restorers", "the trade"],
    risk: ["corrosion", "the head gasket", "an unobtainable part", "MOT failure"],
    material: ["steel", "chrome", "vinyl"],
    accessory: ["a workshop manual", "a dust sheet", "a battery conditioner"],
    scale: "large",
  },
  garment: {
    parts: ["buttons", "linings", "thread", "a pattern"],
    setting: ["the fitting room", "a workroom", "the wardrobe"],
    verb: ["make", "alter", "press", "store"],
    buyer: ["dressmakers", "re-enactors", "the theatre"],
    risk: ["moth", "shrinkage", "fading"],
    material: ["wool", "cotton drill", "horn"],
    accessory: ["a garment bag", "cedar blocks", "a pattern book"],
    scale: "small",
  },
  material: {
    parts: ["offcuts", "sheets", "lengths", "fixings"],
    setting: ["the yard", "a warehouse", "the site"],
    verb: ["cut", "season", "grade", "deliver"],
    buyer: ["builders", "the trade", "makers"],
    risk: ["warping", "the weather", "delivery damage"],
    material: ["itself"],
    accessory: ["a cutting service", "delivery", "a sample card"],
    scale: "large",
  },
  mineral: {
    parts: ["specimens", "a display case", "labels"],
    setting: ["the quarry", "a spoil heap", "the cabinet", "a field site"],
    verb: ["collect", "identify", "polish", "catalogue"],
    buyer: ["collectors", "the museum", "lapidaries"],
    risk: ["fakes", "mislabelling", "the site being fenced off"],
    material: ["rock"],
    accessory: ["a hand lens", "a field guide", "specimen trays"],
    scale: "tiny",
  },
  place: {
    parts: ["the old wing", "the car park", "the annexe"],
    setting: ["the valley", "the coast", "the edge of town"],
    verb: ["visit", "photograph", "survey", "restore"],
    buyer: ["visitors", "the trust", "local historians"],
    risk: ["closure", "the roof", "funding", "flooding"],
    material: ["stone", "slate", "brick"],
    accessory: ["a guidebook", "a postcard set", "an audio tour"],
    scale: "huge",
  },
  role: {
    parts: ["the tools of the trade", "an apron", "a ledger"],
    setting: ["the workshop", "the shop floor", "the road"],
    verb: ["train", "qualify", "practise", "retire from"],
    buyer: ["apprentices", "the guild", "employers"],
    risk: ["the trade dying out", "no apprentices", "cheap imports"],
    material: ["leather", "canvas"],
    accessory: ["a certificate", "a trade directory"],
    alive: true, scale: "medium",
  },
  instrument: {
    parts: ["strings", "reeds", "a case", "pads", "a bow"],
    setting: ["the front room", "a rehearsal hall", "the bandstand"],
    verb: ["play", "restore", "tune", "teach"],
    buyer: ["players", "teachers", "the band"],
    risk: ["a cracked soundboard", "central heating", "woodworm"],
    material: ["spruce", "brass", "ebony"],
    accessory: ["a stand", "a tutor book", "a humidifier"],
    scale: "medium",
  },
  game: {
    parts: ["boards", "pieces", "a net", "spare springs", "a scorecard"],
    setting: ["the garden", "the club", "a village hall", "the back room"],
    verb: ["play", "compete at", "coach", "referee"],
    buyer: ["clubs", "families", "the league"],
    risk: ["lost pieces", "injury", "rain stopping play", "arguments"],
    material: ["hardwood", "canvas", "sprung steel"],
    accessory: ["a carrying bag", "a rulebook", "spare parts"],
    scale: "medium",
  },
  machine: {
    parts: ["belts", "bearings", "a control board", "seals", "brushes"],
    setting: ["the plant", "a workshop", "the basement"],
    verb: ["service", "overhaul", "commission", "decommission"],
    buyer: ["industry", "preservationists", "engineers"],
    risk: ["obsolete spares", "the control board", "no documentation"],
    material: ["cast iron", "copper", "bakelite"],
    accessory: ["a service manual", "a spares kit", "a wiring diagram"],
    scale: "large",
  },
  furniture: {
    parts: ["castors", "upholstery", "a leaf", "hinges"],
    setting: ["the front room", "a saleroom", "the workshop"],
    verb: ["restore", "reupholster", "french polish", "date"],
    buyer: ["dealers", "collectors", "householders"],
    risk: ["woodworm", "sun bleaching", "a bad repair"],
    material: ["mahogany", "horsehair", "brass"],
    accessory: ["a polish kit", "castor cups", "a valuation"],
    scale: "large",
  },
  weather: {
    parts: ["readings", "a gauge", "the log book", "a chart"],
    setting: ["the station", "the roof", "the field"],
    verb: ["record", "predict", "log", "compare"],
    buyer: ["observers", "farmers", "the county office"],
    risk: ["a gap in the record", "an unattended station", "a faulty gauge"],
    material: ["glass", "brass", "paper"],
    accessory: ["a barometer", "a record book", "a spare thermometer"],
    scale: "huge",
  },
  activity: {
    parts: ["kit", "a permit", "a logbook"],
    setting: ["the club", "the field", "the coast", "the hills"],
    verb: ["take up", "compete in", "teach", "give up"],
    buyer: ["beginners", "the club", "veterans"],
    risk: ["injury", "the weather", "losing access to the site"],
    material: ["canvas", "aluminium"],
    accessory: ["a beginner's kit", "insurance", "a club badge"],
    scale: "medium",
  },
  field: {
    parts: ["the literature", "specimens", "field notes", "the archive"],
    setting: ["the department", "the field", "the reading room"],
    verb: ["study", "publish on", "survey", "revise"],
    buyer: ["students", "the institute", "amateurs"],
    risk: ["funding", "a contested classification", "lost records"],
    material: ["paper", "glass slides"],
    accessory: ["offprints", "a bibliography", "a hand lens"],
    scale: "huge",
  },
  body: {
    parts: ["the joint", "tissue", "a cast"],
    setting: ["the clinic", "the surgery", "the ward"],
    verb: ["treat", "study", "exercise", "diagram"],
    buyer: ["practitioners", "students", "sufferers"],
    risk: ["strain", "misdiagnosis", "waiting lists"],
    material: ["plaster", "linen"],
    accessory: ["a support", "a chart", "a leaflet"],
    alive: true, scale: "small",
  },
  media: {
    parts: ["the back issues", "a sleeve", "the reel", "liner notes"],
    setting: ["the shelf", "a convention", "the archive"],
    verb: ["collect", "review", "trade", "restore"],
    buyer: ["fans", "collectors", "completists"],
    risk: ["a missing issue", "vinegar syndrome", "a torn sleeve"],
    material: ["paper", "acetate", "vinyl"],
    accessory: ["sleeves", "a checklist", "storage boxes"],
    scale: "tiny",
  },
  organisation: {
    parts: ["the divisions", "the board", "subsidiaries"],
    setting: ["head office", "the business park", "the plant"],
    verb: ["restructure", "acquire", "float", "wind up"],
    buyer: ["shareholders", "clients", "the sector"],
    risk: ["a takeover", "the pension deficit", "a regulator"],
    material: ["glass", "carpet tile"],
    accessory: ["an annual report", "a corporate video"],
    scale: "huge",
  },
  abstract: {
    parts: ["the evidence", "accounts", "the records"],
    setting: ["everywhere", "nowhere in particular", "the archive"],
    verb: ["study", "resist", "document", "measure"],
    buyer: ["the curious", "sceptics", "believers"],
    risk: ["misinterpretation", "official denial", "lost testimony"],
    material: ["paper", "microfilm"],
    accessory: ["a bibliography", "photocopies"],
    scale: "huge",
  },
};

export function propsFor(word: string, category?: Category): Props {
  const resolved = category ?? lookup(word) ?? "abstract";
  const override = OVERRIDES[word];
  return { ...BLANK, ...BY_CATEGORY[resolved], ...override };
}

/**
 * Words worth knowing personally. These are the ones people actually type, and
 * one override turns a generic page into one that appears to understand.
 */
const OVERRIDES: Record<string, Partial<Props>> = {
  trampoline: {
    parts: ["springs", "the mat", "safety netting", "frame pads", "leg caps"],
    setting: ["the garden", "the back lawn", "a sports hall"],
    verb: ["bounce on", "assemble", "anchor down", "winter-proof"],
    buyer: ["families", "gymnastics clubs", "schools"],
    risk: ["a broken wrist", "wind damage", "perished springs", "the neighbours"],
    accessory: ["an anchor kit", "a weather cover", "a spring tool"],
    scale: "large",
  },
  bicycle: {
    parts: ["a bottom bracket", "brake blocks", "spokes", "a saddle", "toe clips"],
    setting: ["the shed", "the towpath", "a lock-up"],
    verb: ["ride", "true the wheels on", "restore", "tour on"],
    buyer: ["commuters", "the cycling club", "tourers"],
    risk: ["theft", "a buckled wheel", "punctures", "seized seatposts"],
    accessory: ["panniers", "a puncture kit", "a track pump"],
  },
  lighthouse: {
    parts: ["the lamp", "the lens", "the keeper's cottage", "the foghorn"],
    setting: ["the headland", "a sandbank", "the point"],
    verb: ["automate", "decommission", "photograph", "preserve"],
    buyer: ["trusts", "photographers", "maritime historians"],
    risk: ["erosion", "automation", "the roof", "storm damage"],
    accessory: ["a postcard set", "a keeper's log facsimile"],
  },
  accordion: {
    parts: ["reeds", "bellows", "straps", "the keyboard", "a bass mechanism"],
    setting: ["the front room", "a dance hall", "the folk club"],
    verb: ["play", "re-wax", "tune", "learn"],
    buyer: ["folk players", "teachers", "dance bands"],
    risk: ["a split bellows", "reed rust", "the weight of it"],
    accessory: ["a hard case", "straps", "a tutor book"],
  },
  pinball: {
    parts: ["flippers", "the playfield", "a backglass", "rubbers", "the score reel"],
    setting: ["the arcade", "the back room", "a garage"],
    verb: ["restore", "shop out", "play", "level"],
    buyer: ["collectors", "operators", "arcades"],
    risk: ["a flaking backglass", "cold solder joints", "playfield wear"],
    accessory: ["a rubber kit", "a schematic", "leg levellers"],
    scale: "large",
  },
  otter: {
    parts: ["holts", "spraint", "tracks"],
    setting: ["the riverbank", "the estuary", "a holt"],
    verb: ["survey", "photograph", "record", "protect"],
    buyer: ["the wildlife trust", "surveyors", "photographers"],
    risk: ["road deaths", "pollution", "disturbance", "loss of habitat"],
    accessory: ["a survey form", "a trail camera"],
  },
  hammer: {
    parts: ["heads", "handles", "wedges", "a claw"],
    setting: ["the workshop", "the toolbag", "site"],
    verb: ["rehandle", "re-face", "collect", "date"],
    buyer: ["joiners", "collectors", "farriers"],
    risk: ["a loose head", "the wrong weight", "chipping"],
    accessory: ["spare wedges", "a leather loop"],
    scale: "small",
  },
  cheese: {
    parts: ["the rind", "a starter culture", "cloth", "rennet"],
    setting: ["the dairy", "a cave", "the cheese room"],
    verb: ["make", "turn", "grade", "wax"],
    buyer: ["delicatessens", "households", "the show"],
    risk: ["mites", "cracking", "the wrong humidity", "a blown batch"],
    accessory: ["a cheese iron", "muslin", "a wooden press"],
    scale: "small",
  },
};

export function hasOverride(word: string): boolean {
  return word in OVERRIDES;
}

export const OVERRIDE_COUNT = Object.keys(OVERRIDES).length;
