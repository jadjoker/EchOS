# EchOS

*Echo + OS, sharing the O.* An echo is what is left after the source is gone —
which is what every machine here is: a version of a computer that never existed,
assembled from the residue of one that did.

A game that is an operating system. Every boot generates a new machine — new
aesthetic, new software that didn't exist last time. No fail state, no goal.

The capitalisation carries the name, and capitalisation is the first thing lost
in a URL or a search box. The wordmark should render the **O once**, shared
between both words, so the logo teaches the joke without a caption.

Design doc: `C:\Users\smitt\.claude\plans\game-where-each-time-linear-reef.md`
Issue tracker: HacknPlan. Read it from here with `node tools/hnp.mjs board <projectId>`.

## What this ships as

**A Steam application.** The browser is the development surface, not a product:
there is no free web build feeding a paid one, and nothing is designed around
being embeddable, linkable or shareable-by-URL any more.

```bash
npm run desktop       # build, then run it as the real application
npm run desktop:dev   # same window, pointed at a running `npm run dev`
```

`electron/main.cjs` is the whole shell and is deliberately thin: no game logic,
no generation, no window management. Those live inside the machine, which has
its own. The renderer runs sandboxed with no Node access, and navigation and
window-opening are both denied, because this game renders arbitrary generated
content by design and none of it should be able to reach the disk or the
outside.

Not done yet: no installer or packaging step, no Steamworks integration, and
the Steam overlay's behaviour with Electron is still the one unresolved bet in
the stack. Achievements need an app ID before any of that can be written.

**Double-click `play.cmd`** to play it. That builds and launches the real
application, and is the same thing as `npm run desktop`.

## Running it in a browser

For development the browser is the faster loop: changes reload instantly and
the dev tools are there. It is not the product.

**Double-click `dev-browser.cmd`**, or from a terminal:

```bash
npm start
```

`npm run dev` is the identical server without opening a browser, for when one
is already pointed at the page. `npm run check` typechecks without emitting.

A seed in the URL boots that exact machine: `?seed=7141-ESTUARY`. Without one you
get a new machine every load — the seed is deliberately *not* written back to the
URL, because a self-populating URL would quietly turn refresh into "the same
machine forever". Keeping a machine is an explicit act, via **Copy link** in the
About window.

## Where the build is

Steps 1 (substrate), 2 (three apps on the bus) and 5 (aesthetic generator) are
done. **Step 3 is the gate and it has not been answered** — see below.

### The generated web

The browser is the centre of the game. Type any domain and a site is generated
for it. `glorbus.com` gives you Glorbus GmbH, "a leading provider of glorb
products"; `otter.org` gives you an otter society that runs an auction of
surplus holts.

Pipeline: `web/domain.ts` classifies the address → `web/site.ts` picks an
archetype and builds a Page (data, not DOM) → `web/render.ts` draws it and rolls
the site its **own** aesthetic from the existing movements.

**Generation is build-time, not runtime — deliberately.** A runtime LLM would
kill seed sharing (output isn't stable), kill offline play, cost money per
player on a one-time purchase, require a permanent proxy server, and make you
the owner of whatever it generates. The knowledge lives in static data instead.

Three layers do the work:

- **`web/lexicon.ts`** — ~1000 nouns tagged by category. When a domain produces
  a disappointing site, one more word in here is usually the fix.
- **`web/properties.ts`** — what we know *about* a thing: parts, setting, verbs,
  buyers, risks. Category defaults plus per-word overrides. This is why a shop
  sells "replacement safety netting" rather than "Deluxe Trampoline" — the
  difference between filling slots and appearing to know something.
- **`web/phonetics.ts`** — for invented words. A made-up domain does **not** fall
  back to generic; its character is inferred from its *sound*. Bouba/kiki is a
  real effect: `skritt` reads as a tiny hard tool, `mooloona` as a huge soft
  creature. Deterministic, so an invented word is always the same thing.

Note on "how many combinations": by raw permutation count this passes trillions
already and the number is meaningless. The metric that matters is **how many
pages before two feel the same**, and that is governed by structural variety —
archetypes and sentence shapes — not by slot permutations.

### The influence bus

Connecting two programs does not pass *values*, it causes a **qualitative change
in behaviour**. Plug the Aquarium into the Browser and websites become infested
with fish, and the shops start stocking them.

**Nothing is authored per pair.** Five programs is twenty ordered pairs, fifteen
is two hundred and ten, and a pair table cannot compose when three things feed
one input. Instead each program *emits* a bundle of traits (`core/influence.ts`
— agents, words, palette, rhythm, scalars, tags) and *absorbs* the traits it has
a receptor for. Effects are **emitter × receptor**, each authored once. A new
program adds one of each and gets every combination for free.

**Influences merge**, so many-to-one connections stack rather than overwrite —
that is what makes hooking several things together work at all.

`core/graph.ts` recomputes on change rather than push-propagating. Slightly
wasteful at this scale, and it buys correct merging plus trivially safe cycles
(bounded passes instead of an unbounded chain).

**Fast-changing data belongs in `rhythm`.** The signature that decides whether
receivers get re-notified deliberately ignores it, so an animating program does
not force its neighbours to rebuild sixty times a second. Receivers poll it live
via `graph.incoming()`.

Current receptors — Browser: agents wander over the page, words work into the
site's own content, palette stains it, rhythm wobbles them. Aquarium: foreign
agents join the water, words rename the fish, temperature chills it. Weather:
rhythm bends the forecast, agents get reported as sightings. Files: words become
files on disk, which Files then emits onward.

### Desktop

Boots to an **empty desktop** with generated icons. Nothing opens automatically —
a pre-arranged set of windows reads as a demo, a desktop you explore reads as a
machine somebody left behind. Single click selects, double click opens.

Icons use deterministic per-machine layouts (grid / jitter / scattered), occasional
rotations, "worn" faces with residue marks, and a light non-interactive clutter
layer (notes, rings, clips, smudges) placed with edge bias. This gives a lived-in,
"someone actually used this machine" atmosphere on top of the rings texture.

The aesthetic generator was pulled forward out of order deliberately: it is
independent of the data bus, so it doesn't compromise the step-3 gate, and it is
far cheaper to build while only two windows exist to restyle.

### How the aesthetic generator works

A **movement** (`theme/movements.ts`) is not a theme — it's a set of weights and
constraints on the axes. The generator picks one and rolls *inside* it, so two
`geocities` machines differ from each other while both stay recognisably
geocities. Rolling the axes freely instead gives variety without identity, which
is what makes procedural aesthetics feel cheap.

Fifteen movements, spanning amateur-web (geocities, myspace, winamp, win31, bbs,
mac1bit, amiga) and beyond it (swiss, brutalist, corporate, alien, organic,
terminal, blueprint, vapor). 12% of boots cross two movements — that's the
rarity mechanic, and it stops being special if it fires often.

**The contrast floor is load-bearing.** Real amateur web design was frequently
unreadable, and a free-rolling generator reproduces that about one boot in five.
An unreadable machine is a refund, not charming authenticity. So: roll wild,
then force every text-on-background pairing past a minimum ratio
(`theme/color.ts`).

```bash
npm run check:contrast              # 3,000 machines
npm run check:contrast -- --n 20000 # before shipping a palette change
```

That drives the real generator and re-measures every pairing that ships;
currently 260,000 pairings over 20,000 machines and 225 movement variants, zero
failures. It exits non-zero on any failure, so it can gate a build. If you add a
token that puts text on a background, **add it to `PAIRINGS` in
`tools/contrast-check.mjs`** — a floor with no harness regresses silently.

**On the gate.** The original plan put a stop/go gate after three hand-written
apps on the bus. Those three (Signal, Shaper, Scope) were built, found to be a
test harness wearing app clothes — architecturally sound, no reason to exist on
a salvaged desktop — and cut. They were replaced by programs with fiction:
Browser, Aquarium, Weather, Files. The gate's question still stands and is still
unanswered: **is connecting things fun?** It can only be answered by playing.

## The two rules that matter

**Everything generated derives from `core/rng.ts`.** If a seed doesn't reproduce
a machine exactly, seed sharing dies. That used to matter because a free web
build was meant to feed the paid one; it now matters because a machine you can
hand to somebody else is the only way this game gets talked about, and because
"the same seed, the same machine" is the promise the whole thing rests on.
Use `rng.derive("namespace")` for each subsystem so adding a generator later
doesn't shift every downstream roll and invalidate seeds people have shared.

**Nothing hardcodes a colour, radius, font or duration.** Everything reads a
token from `theme/tokens.css`. Honour that and "a new aesthetic every boot"
stays a data change; break it and it becomes a refactor.

## Layout

```
src/
  core/       rng, influence traits, the connection graph, coins, collection
  web/        lexicon, properties, phonetics, archetypes, page renderer
  apps/       browser, aquarium, shop, weather, files, news
  theme/      the token contract, movements, colour, textures
  wm/         window manager
  desktop/    generated icons
  fs/         virtual filesystem
  boot/       generated boot sequence
  gen/        machine identity, names, clutter, fish forms and lore, solids
  shell/      About, the file browser, popup menus, rename, file viewers
  workspace.ts  ports, cables, and the only place that knows about both
                windows and the bus
```

Two things in `core/` outlive the machine and nothing else does: the coin
balance (`economy.ts`) and the fish (`collection.ts`). Both are in
`localStorage`, both are hand-validated on read because a player can edit them,
and both are deliberate exceptions to "every boot is a new machine" — see the
header comments, which argue the case.

## Not done yet

Archetype expansion is the known gap — ten archetypes means pages start rhyming
after a dozen or so, even now that layout varies.

The points economy is parked pending a decision, not forgotten.

The values in `theme/tokens.css` are only a fallback for before the generator
runs — not a house style.

**Phase 2 desktop priorities (after this pass):**
- Make clutter items interactive or draggable (tiny "found objects").
- Cursor variety (generated per-machine, already in tokens).
- More liveness on the desktop (subtle movement, reactions).
- Revisit connection nodes (currently hidden from top of windows for a cleaner look; the graph still works).
