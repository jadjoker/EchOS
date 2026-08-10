/**
 * The lexicon.
 *
 * Scribblenauts is the reference and it is worth being clear about what it
 * actually was: not comprehension, but a large hand-tagged noun list plus a
 * small system for combining entries. Same bargain here. Every word we know is
 * a word that produces a *specific* site instead of a generic one.
 *
 * Coverage is the whole game. This list is meant to be added to — when a domain
 * produces a disappointing site, the fix is usually one more word in here.
 *
 * Being wrong is cheap. A tackle shop for a word that meant something else is
 * funnier than a correct one, so the classifier is deliberately eager rather
 * than cautious.
 */

export type Category =
  | "animal" | "plant" | "food" | "drink" | "tool" | "vehicle" | "garment"
  | "material" | "mineral" | "place" | "role" | "abstract" | "activity"
  | "field" | "organisation" | "media" | "instrument" | "game" | "weather"
  | "body" | "furniture" | "machine" | "invented";

const WORDS: Record<Exclude<Category, "invented">, string> = {
  animal: `dog cat horse pony cow sheep goat pig hog chicken hen duck goose turkey
    rabbit hare mouse rat hamster gerbil ferret otter badger fox wolf bear deer
    elk moose bison lion tiger leopard cheetah panther lynx bat owl hawk eagle
    falcon kestrel crow raven rook magpie jay sparrow finch robin wren parrot
    pigeon dove penguin seal walrus whale dolphin porpoise shark ray salmon
    trout carp koi perch pike eel squid octopus crab lobster prawn shrimp
    barnacle snail slug worm ant bee wasp hornet beetle moth butterfly cricket
    locust spider scorpion frog toad newt salamander lizard gecko iguana snake
    adder viper turtle tortoise crocodile alligator camel llama alpaca donkey
    mule ox yak buffalo hedgehog mole shrew squirrel chipmunk beaver raccoon
    skunk possum weasel stoat marten heron stork crane swan pelican gull tern
    bird fish insect reptile mammal amphibian rodent creature beast pet
    kitten puppy foal calf lamb piglet chick tadpole caterpillar larva`,

  plant: `tree oak pine fir spruce maple birch willow elm ash beech cedar yew
    hazel rowan hawthorn fern bracken moss lichen ivy vine rose tulip daisy
    poppy orchid lily lotus iris violet pansy marigold sunflower dahlia peony
    cactus succulent bamboo reed grass wheat barley oat rye corn clover thistle
    nettle bramble heather gorse mushroom toadstool truffle algae kelp seaweed
    lavender mint sage thyme basil rosemary parsley fennel`,

  food: `bread loaf cheese butter cream pasta noodle dumpling rice bean lentil
    pea soup broth stew pie tart cake cookie biscuit scone donut pancake waffle
    pizza burger taco sandwich toast sausage bacon ham egg honey jam marmalade
    pickle olive salt pepper spice sugar chocolate candy toffee fudge pretzel
    crisp chip apple pear plum peach cherry grape berry melon lemon orange fig
    date walnut almond pecan chestnut potato carrot turnip onion garlic cabbage
    lettuce tomato pumpkin squash marrow beetroot radish leek celery`,

  drink: `coffee tea juice soda cider beer ale wine milk water lemonade cordial
    punch cocoa brandy whisky rum gin vodka kombucha`,

  tool: `hammer mallet wrench spanner screwdriver saw drill chisel plane plier
    axe hatchet shovel spade rake hoe scythe sickle knife blade scissors shear
    needle pin nail screw bolt rivet clamp vice file rasp sander lathe anvil
    forge bellows ladder trowel level compass caliper ruler tape torch`,

  vehicle: `car truck lorry van bus coach train tram trolley bicycle bike
    motorcycle scooter moped boat ship yacht ferry barge canoe kayak raft
    dinghy plane jet glider helicopter balloon rocket tractor forklift digger
    crane sled sleigh wagon cart carriage`,

  garment: `shirt blouse trouser pant jean sock stocking shoe boot sandal
    slipper hat cap bonnet helmet scarf glove mitten coat jacket blazer sweater
    jumper cardigan vest dress gown skirt tie bowtie belt buckle apron uniform
    robe cloak poncho pyjama swimsuit`,

  material: `wood timber metal steel iron copper brass bronze tin zinc lead
    aluminium plastic rubber glass paper card cardboard leather hide cloth
    fabric wool cotton silk linen velvet denim canvas concrete brick cement
    mortar plaster tar pitch wax resin glue foam felt`,

  mineral: `rock stone pebble boulder granite marble slate limestone sandstone
    quartz crystal diamond ruby emerald sapphire opal topaz amber jade onyx
    obsidian flint chalk coal ore gold silver platinum salt gypsum mica`,

  place: `town city village hamlet borough harbour port dock quay bridge tower
    castle fort keep church chapel abbey temple shrine barn farm ranch mill
    factory foundry warehouse depot market bazaar arcade library museum gallery
    school academy hospital clinic station terminal airport garden park orchard
    grove forest wood meadow field pasture valley glen hill ridge mountain peak
    cliff canyon gorge desert dune beach shore coast island isle lake pond
    river creek brook stream marsh swamp bog fen cave cavern mine quarry tunnel
    lighthouse windmill house home cottage hut shed cabin lodge inn tavern
    bakery brewery dairy smithy forge workshop studio office shop store yard
    alley lane road street avenue square green common heath`,

  role: `baker butcher grocer farmer smith blacksmith miner sailor fisher
    hunter trapper builder mason carpenter joiner plumber glazier tailor
    cobbler weaver spinner potter painter sculptor printer binder writer poet
    teacher tutor doctor nurse surgeon dentist lawyer judge clerk cashier
    driver pilot captain sailor soldier guard sentry priest monk nun hermit
    witch wizard sorcerer alchemist astrologer inventor engineer mechanic
    barber cook chef waiter porter courier`,

  abstract: `love hate fear hope joy sorrow grief truth lie justice mercy
    freedom peace war victory defeat time memory dream nightmare secret mystery
    luck fate destiny chaos order silence noise beauty terror wonder patience
    courage doubt faith reason madness melancholy nostalgia boredom regret
    longing envy pride shame guilt duty honour ruin decay progress`,

  activity: `running swimming climbing hiking walking fishing hunting cooking
    baking brewing sewing knitting quilting weaving painting drawing sketching
    writing reading dancing singing whistling gardening farming camping bowling
    skating skating surfing sailing rowing skiing diving juggling wrestling
    boxing fencing archery cycling jogging birdwatching stargazing beekeeping`,

  field: `biology chemistry physics geology astronomy mathematics history
    geography psychology sociology economics linguistics botany zoology
    archaeology anatomy meteorology cartography philosophy theology metallurgy
    horology entomology ornithology mycology genealogy`,

  organisation: `company corporation firm union guild society club association
    league federation alliance committee council bureau agency ministry
    department institute foundation trust cooperative collective syndicate`,

  media: `movie film book novel story comic magazine journal newspaper album
    record song tune band show series episode cartoon podcast fanzine poster
    postcard photograph portrait`,

  instrument: `guitar piano keyboard drum violin viola cello bass flute clarinet
    oboe bassoon trumpet trombone tuba horn banjo mandolin ukulele harp organ
    accordion harmonica whistle bagpipe xylophone tambourine`,

  game: `chess checkers draughts backgammon poker bridge bingo darts snooker
    billiards pinball marble puzzle domino jigsaw crossword solitaire pinochle
    charade riddle maze trampoline skateboard surfboard snowboard kite frisbee
    hoop swing slide seesaw racket bat ball glove net paddle dice card token
    counter dartboard`,

  weather: `weather rain snow sleet hail fog mist haze storm tempest thunder
    lightning wind gale breeze cloud sun sunshine frost ice thaw drought flood
    rainbow monsoon blizzard climate forecast temperature humidity barometer`,

  body: `hand foot arm leg head face eye ear nose mouth tooth tongue lip chin
    neck shoulder elbow wrist finger thumb knee ankle heel heart lung liver
    bone skull rib spine skin hair beard nail`,

  furniture: `chair stool bench table desk bed cot bunk sofa couch armchair
    shelf bookcase cabinet cupboard dresser drawer wardrobe chest trunk lamp
    lantern mirror rug carpet curtain blind clock vase basket crate barrel`,

  machine: `engine motor pump valve gear cog piston turbine dynamo generator
    compressor boiler furnace kiln radio television telephone telegraph
    computer terminal printer scanner copier camera projector recorder
    typewriter calculator thermostat conveyor elevator escalator`,
};

const LOOKUP = new Map<string, Category>();
for (const [category, list] of Object.entries(WORDS)) {
  for (const word of list.split(/\s+/).filter(Boolean)) {
    // First tag wins, so earlier categories take precedence on the handful of
    // words that legitimately belong to two (salt, skating).
    if (!LOOKUP.has(word)) LOOKUP.set(word, category as Category);
  }
}

export function lookup(word: string): Category | undefined {
  return LOOKUP.get(word.toLowerCase());
}

export function isKnown(word: string): boolean {
  return LOOKUP.has(word.toLowerCase());
}

/** Every word we know, for the browser's generated directory of links. */
export function allWords(): string[] {
  return [...LOOKUP.keys()];
}

export function wordsIn(category: Category): string[] {
  return [...LOOKUP.entries()].filter(([, c]) => c === category).map(([w]) => w);
}

export const LEXICON_SIZE = LOOKUP.size;
