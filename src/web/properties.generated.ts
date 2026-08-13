/**
 * GENERATED — do not edit by hand.
 *
 * Written by tools/expand-props.mjs from the lexicon. Build-time output only:
 * by the time the game runs this is an ordinary static table, so seeds stay
 * exact and nothing here touches core/rng.ts.
 *
 * Hand-authored entries in properties.ts always win over anything in here. To
 * correct a word, add it to OVERRIDES there rather than editing this file —
 * the next regeneration would discard the edit.
 *
 * 11 words, model qwen2.5:7b-instruct-q4_K_M, generated 2026-08-11.
 */

import type { Props } from "./properties.ts";

export const GENERATED: Record<string, Partial<Props>> = {
  badger: {
    parts: ["setts", "signs", "tracks", "holes"],
    setting: ["the hedgerow", "the woodland edge", "a setted area"],
    verb: ["spot", "record", "excavate", "trouble"],
    buyer: ["wildlife trusts", "gamekeepers", "local residents"],
    risk: ["road deaths", "pest control", "settle disputes", "disturbance"],
    material: ["earth", "wood"],
    accessory: ["a spade", "a trail camera"],
    scale: "small", alive: true,
  },
  brewery: {
    parts: ["barrels", "fermenters", "the mash tun", "the copper", "coolship"],
    setting: ["the town", "the countryside", "an industrial estate"],
    verb: ["brew", "taste test", "store", "barrel age"],
    buyer: ["home brewers", "locals", "beer clubs"],
    risk: ["a stuck fermentation", "wild yeast infection", "vats leaking"],
    material: ["wooden barrels", "copper kettles", "stainless steel tanks"],
    accessory: ["bottles", "hops", "yeast"],
    scale: "large", alive: false,
  },
  cardigan: {
    parts: ["buttons", "the ribbing", "stitching", "the collar"],
    setting: ["the knitting circle", "the charity shop", "the living room"],
    verb: ["knit", "mend", "display", "repair"],
    buyer: ["housewives", "charities", "the elderly"],
    risk: ["a dropped stitch", "shrinking", "the wrong yarn", "rips"],
    material: ["wool", "alpaca", "cotton"],
    accessory: ["a knitting needle", "a button box"],
    scale: "medium", alive: false,
  },
  darts: {
    parts: ["dartboard", "score card", "thrower"],
    setting: ["the pub", "the clubroom", "the kitchen"],
    verb: ["throw", "toss", "record"],
    buyer: ["pubs", "leagues", "households"],
    risk: ["split shafts", "dartboard damage", "accidents from poor technique"],
    material: ["wooden tips", "resin fletching"],
    accessory: ["a dart bag", "a score sheet"],
    scale: "small", alive: false,
  },
  ferret: {
    parts: ["a run", "tweezers", "a water bottle", "a grooming brush"],
    setting: ["the hunt field", "the farmyard", "the tunnel"],
    verb: ["run", "cull", "flush out", "chase"],
    buyer: ["ferreting clubs", "gamekeepers", "farmers"],
    risk: ["hunting accidents", "the neighbour's cat", "loss of scent", "wet bedding"],
    material: ["leather", "plastic"],
    accessory: ["a hunting jacket", "a collar and lead", "tweezers for mites"],
    scale: "small", alive: true,
  },
  harmonica: {
    parts: ["reed plates", "the comb", "a mouthpiece", "straps", "a case"],
    setting: ["the kitchen table", "the folk club", "a picnic"],
    verb: ["play", "tune", "fix the reeds on", "learn"],
    buyer: ["folk players", "teachers", "buskers"],
    risk: ["reeds going out of tune", "a cracked comb", "the mouthpiece drying out"],
    material: ["wood", "metal"],
    accessory: ["a tuning fork", "a harmonica cleaner"],
    scale: "small", alive: false,
  },
  kayak: {
    parts: ["blades", "hull", "deck line", "spray skirt"],
    setting: ["the river", "the lake", "estuary"],
    verb: ["pole", "portage", "roll"],
    buyer: ["weekend warriors", "canoe clubs", "holidaymakers"],
    risk: ["a capsize", "water ingress", "swamping"],
    material: ["rotomoulded plastic", "fibreglass"],
    accessory: ["a spray skirt", "a paddle"],
    scale: "medium", alive: false,
  },
  nostalgia: {
    parts: ["the smell of polish", "old photographs", "family gatherings"],
    setting: ["the grandmother's house", "the old school", "the local park"],
    verb: ["recall", "cherish", "wistfully remember"],
    buyer: ["retired folk", "nostalgic collectors", "the history buff"],
    risk: ["the passing years", "forgotten memories", "a lost photo album"],
    material: ["the memories themselves", "the stories passed down"],
    accessory: ["an old record player", "a vintage camera"],
    scale: "large", alive: false,
  },
  slate: {
    parts: ["the surface", "a chisel", "a hammer", "a running bond"],
    setting: ["the quarry", "the stables", "the roof"],
    verb: ["lay", "split", "cut", "hammer down"],
    buyer: ["roofers", "builders", "the local church"],
    risk: ["slips", "edge damage", "the wrong thickness", "moss growth"],
    material: ["natural stone", "limestone"],
    accessory: ["a running board", "a spirit level", "a trowel"],
    scale: "large", alive: false,
  },
  tractor: {
    parts: ["tyres", "belts", "clutch plates", "oil filter"],
    setting: ["the farmyard", "the field", "the workshop"],
    verb: ["service", "rebuild", "recondition", "test"],
    buyer: ["farmers", "mechanics", "agricultural societies"],
    risk: ["a seized clutch", "exhaust fumes", "tyre failure"],
    material: ["steel", "rubber"],
    accessory: ["a trailer", "a plough"],
    scale: "large", alive: false,
  },
  typewriter: {
    parts: ["typebars", "carriage", "the ribbon", "keycaps", "the bell"],
    setting: ["the office", "the schoolroom", "the writer's den"],
    verb: ["type", "repair", "clean", "collect"],
    buyer: ["writers", "teachers", "antique dealers"],
    risk: ["a broken typebar", "sticky keys", "ribbon wear"],
    material: ["cast iron", "ivory keycaps"],
    accessory: ["a ribbon box", "a spare typebar"],
    scale: "medium", alive: false,
  },
};

export const GENERATED_COUNT = Object.keys(GENERATED).length;
