/**
 * AQUARIUM.
 *
 * Emits its fish as agents, so anything downstream can be infested by them.
 * Absorbs agents (foreign things join the water), words (fish get renamed after
 * whatever you were reading), rhythm (agitation) and temperature (cold water
 * slows everything down and tints it).
 *
 * One fish is always dead and nobody has removed it.
 */

import type { AppDef } from "./types.ts";
import type { Agent, Influence } from "../core/influence.ts";
import type { Rng } from "../core/rng.ts";
import { appShell, button } from "./controls.ts";
import { generateLore, loreWords, type FishLore } from "../gen/fishlore.ts";
import { formFor, type FishForm } from "../gen/fishform.ts";
import { mountFish3d } from "./fish3d.ts";
import { award } from "../core/achievements.ts";
import tankFootage from "../assets/tank-vintage-scuba.mp4";
import * as generated from "../gen/fishlore.generated.ts";

const SPECIES_HEAD = [...`Golden Spotted Ribbon Paper Glass Blue Banded Dwarf Royal
  Common Lesser Marbled Ghost Velvet Copper Whiptail Fantail Moon`.trim().split(/\s+/),
  ...generated.SPECIES_HEAD];

const SPECIES_TAIL = [...`barb tetra danio rasbora guppy molly platy loach gourami
  cichlid catfish angelfish killifish minnow carp perch`.trim().split(/\s+/),
  ...generated.SPECIES_TAIL];

/**
 * A tank holds 4-8 fish drawn from this list, so its length is not decoration:
 * at the seventeen names it shipped with, about two thirds of tanks contained
 * two fish called the same thing.
 */
const PET_NAMES = [...`Doug Marbles Biscuit Nelson Admiral Tiny Bubbles Kevin Pearl
  Smudge Captain Jaws Gilbert Norman Sausage Duchess Rocket`.trim().split(/\s+/),
  ...generated.NAMES];

/**
 * How an individual fish moves.
 *
 * Derived from the temperament already recorded in its lore, so the profile
 * window and the tank agree: a fish described as "highly strung" darts, and one
 * described as "resigned" sits near the bottom barely moving. The description
 * stops being flavour text the moment it predicts behaviour.
 */
interface Swim {
  /** Speed multiplier. */
  cruise: number;
  /** How much the heading drifts of its own accord. */
  wander: number;
  /** Per-frame chance of a sudden burst. */
  dart: number;
  /** Preferred height, 0 top to 1 bottom. */
  depth: number;
  /** How insistently that depth is held. */
  depthPull: number;
  /** Positive draws toward other fish, negative pushes away. */
  school: number;
  /** 0 roams the whole tank, 1 stays on a patch. */
  home: number;
  homeX: number;
  homeY: number;
  /** Tail animation offset and speed, so they are not all in step. */
  phase: number;
  beat: number;
}

interface Fish {
  x: number; y: number; vx: number; vy: number;
  size: number; hue: number;
  name: string; species: string;
  dead: boolean;
  swim: Swim;
  /**
   * The body its species name asks for. Absent on guests, which keep the
   * shape of whatever program they arrived from.
   */
  form?: FishForm;
  /** Residents have a history. Visitors from other programs do not. */
  lore?: FishLore;
  /** Bought, and therefore carried to the next machine. */
  mine?: boolean;
  /** Links back to the persistent collection entry, for re-syncing. */
  collectionId?: string;
  /** Foreign agents drawn as guests rather than residents. */
  guest?: Agent;
}

/** Movement profiles, keyed by the temperaments fishlore.ts can produce. */
const TEMPERAMENTS: Record<string, Partial<Swim>> = {
  placid: { cruise: 0.6, wander: 0.15, dart: 0.002, depthPull: 0.5 },
  resigned: { cruise: 0.4, wander: 0.08, dart: 0, depth: 0.78, depthPull: 0.7 },
  unbothered: { cruise: 0.8, wander: 0.3, dart: 0.004 },
  restless: { cruise: 1.5, wander: 0.85, dart: 0.02, depthPull: 0.15 },
  "highly strung": { cruise: 1.7, wander: 1, dart: 0.045, depthPull: 0.1 },
  curious: { cruise: 1.05, wander: 0.55, dart: 0.012, school: 0.35 },
  watchful: { cruise: 0.85, wander: 0.25, dart: 0.03, depthPull: 0.6 },
  territorial: { cruise: 0.95, wander: 0.35, home: 0.85, school: -0.2 },
  withdrawn: { cruise: 0.65, wander: 0.2, depth: 0.8, depthPull: 0.75, school: -0.4 },
  sociable: { cruise: 1.0, wander: 0.4, school: 0.7 },
  particular: { cruise: 0.8, wander: 0.2, depthPull: 0.95 },
};

function swimFor(rng: Rng, temperament: string | undefined, x: number, y: number): Swim {
  const base: Swim = {
    cruise: 1, wander: 0.4, dart: 0.008,
    depth: rng.range(0.3, 0.7), depthPull: 0.35,
    school: 0, home: 0, homeX: x, homeY: y,
    phase: rng.range(0, Math.PI * 2),
    beat: rng.range(5, 11),
  };
  const profile = temperament ? TEMPERAMENTS[temperament] : undefined;
  // Every fish still gets its own roll on top of its temperament, so two
  // placid fish are alike without being identical.
  return {
    ...base,
    ...profile,
    cruise: (profile?.cruise ?? base.cruise) * rng.range(0.82, 1.2),
    depth: profile?.depth ?? base.depth,
  };
}

export const fishTankApp: AppDef = {
  id: "fishtank",
  title: "Aquarium",
  glyph: "🐟",
  width: 400,
  height: 300,
  minWidth: 240,
  minHeight: 180,

  create(ctx) {
    const { root, controls, stage } = appShell();
    const rng = ctx.rng;

    const canvas = document.createElement("canvas");
    canvas.className = "tank-canvas";
    stage.append(canvas);

    const caption = document.createElement("div");
    caption.className = "tank-caption";

    const count = rng.int(4, 8);

    /**
     * Names are drawn without replacement, so no two fish in the tank answer to
     * the same thing. Lengthening the list only ever made the collision rarer,
     * never impossible: at 258 names and 8 fish it still lands about one tank
     * in ten, which is often enough to notice and never often enough to debug.
     *
     * The pool starts with your collection's names already removed. Yours cannot
     * be renamed — you bought them and they outlive the machine — so the
     * machine's own fish are the ones that give way.
     */
    const namePool = PET_NAMES.filter(
      (name) => !ctx.collection.fish.slice(0, ctx.collection.capacity)
        .some((f) => f.name === name),
    );

    /** Exactly one roll per call, either branch, so seeds stay reproducible. */
    function takeName(): string {
      if (!namePool.length) return `${rng.pick(PET_NAMES)} II`;
      const index = rng.int(0, namePool.length - 1);
      return namePool.splice(index, 1)[0]!;
    }

    /**
     * Very rarely, whoever had this machine before you left nothing alive.
     *
     * One boot in 250. It has to stay rare enough that the first person to hit
     * it does not think it is the normal tank, and rare enough to be worth
     * telling somebody the seed.
     *
     * Rolled on its own substream, so adding it shifts no other draw and every
     * seed already shared still boots exactly the machine it did before.
     *
     * The machine's own fish only. Fish you bought are yours and travel
     * between machines, so drowning them to land a joke would be deleting
     * somebody's save. Your fish swim through the previous owner's graveyard,
     * which is the better image anyway.
     */
    const graveyard = rng.derive("calamity").chance(0.004);
    if (graveyard) award("all_my_fish_are_dead");

    const residents: Fish[] = Array.from({ length: count }, (_, i) => {
      const x = rng.range(0.1, 0.9);
      const y = rng.range(0.15, 0.85);
      const lore = generateLore(rng, graveyard || i === 0);
      const size = rng.range(0.05, 0.11);
      const hue = rng.int(0, 359);
      const name = takeName();
      const species = `${rng.pick(SPECIES_HEAD)} ${rng.pick(SPECIES_TAIL)}`;
      // Its own substream, so giving fish bodies shifted no other roll and
      // every seed already shared still boots the same machine.
      const form = formFor(species, hue, rng.derive(`form:${name}:${species}`));
      return {
        x, y,
        vx: rng.range(-0.0016, 0.0016) || 0.001,
        vy: rng.range(-0.0006, 0.0006),
        // Scaled here rather than at draw time so that clicking a Dwarf, and
        // the shoal keeping its distance from an Emperor, both use the size
        // the fish actually appears to be.
        size: size * form.scale,
        hue,
        name,
        species,
        dead: graveyard || i === 0,
        form,
        lore,
        swim: swimFor(rng, lore.temperament, x, y),
      };
    });

    // Your fish join the machine's own. The previous owner's fish and yours
    // sharing a tank is the whole premise in one window: the computer is
    // borrowed, the collection is not.
    //
    // Kept in a SEPARATE list that is re-synced whenever the collection
    // changes. Building it once at open time was the bug that made the shop
    // feel fake — you bought a fish and the tank, already open, never noticed.
    let owned: Fish[] = [];

    /**
     * Open fish panels, so a purchase reaches the list as well as the water.
     *
     * Driven from syncOwned rather than from collection.onChange directly. A
     * panel reads `owned`, so it must not run until `owned` has been rebuilt,
     * and registering a second listener would leave that ordering resting on
     * which listener happened to subscribe first. This way the dependency is
     * the call itself.
     */
    const panels = new Set<() => void>();

    function syncOwned(): void {
      const existing = new Map(owned.map((f) => [f.collectionId, f]));
      owned = ctx.collection.fish
        .slice(0, ctx.collection.capacity)
        .map((f) => {
          const already = existing.get(f.id);
          if (already) return already; // keep it swimming where it was

          // New arrivals swim in from the edge, so a purchase is visible as an
          // event rather than appearing fully formed mid-tank.
          const fromLeft = rng.chance(0.5);
          const x = fromLeft ? 0.04 : 0.96;
          const y = rng.range(0.25, 0.75);
          // Keyed on the collection id, so a fish you have owned for months
          // has the same markings in every machine it is carried into.
          const form = formFor(f.species, f.hue, rng.derive(`form:${f.id}`));
          return {
            x, y,
            vx: (fromLeft ? 1 : -1) * rng.range(0.0012, 0.0022),
            vy: rng.range(-0.0006, 0.0006),
            size: f.size * form.scale, hue: f.hue,
            form,
            name: f.name, species: f.species,
            // On a graveyard machine yours float too, so the joke actually
            // lands. Nothing is written back: this is a property of the tank
            // you are standing in, not of the fish, and the collection on disk
            // never hears about it. Boot another machine and they are fine.
            dead: graveyard, lore: f.lore, mine: true, collectionId: f.id,
            swim: swimFor(rng, f.lore.temperament, rng.range(0.2, 0.8), y),
          };
        });
      updateCaption();
      for (const refresh of panels) refresh();
    }

    /** Everything currently swimming: the machine's, yours, and visitors. */
    const everyone = (): Fish[] => [...residents, ...owned, ...guests];

    let guests: Fish[] = [];
    let arriving: Influence | null = null;

    /** Flakes drifting down after a feed. */
    const flakes: { x: number; y: number; vy: number }[] = [];

    /**
     * How many fish, and nothing else.
     *
     * This line used to carry the keeper's name, the flake count, how many were
     * yours, how many were kept, and every piece of fitted equipment. All of it
     * was true and none of it was asked for — a status bar stacked under a
     * title that already said what the window was.
     */
    function updateCaption(): void {
      // Total, not the machine's own count: fish you brought are in the tank
      // and visibly swimming, so a number that excluded them would be wrong.
      caption.textContent = `${count + owned.length} fish`;
    }
    syncOwned();

    // The whole point of the shop: buy something and the tank changes now.
    const offCollection = ctx.collection.onChange(syncOwned);

    controls.append(
      button("Feed", () => {
        // Flake is optional. Tapping the glass still works when the tin is
        // empty — gating a free interaction behind a purchase would make the
        // shop feel like a tollbooth.
        if (ctx.collection.useFood()) {
          for (let i = 0; i < 14; i++) {
            flakes.push({ x: rng.range(0.15, 0.85), y: -0.02, vy: rng.range(0.0012, 0.0032) });
          }
        }
        for (const f of everyone()) {
          if (f.dead) continue;
          f.vy -= rng.range(0.001, 0.003);
          f.vx += rng.range(-0.002, 0.002);
        }
        updateCaption();
        ctx.nudge("tinker");
      }),
      button("Fish", () => {
        openFishPanel();
        ctx.nudge("inspect");
      }),
      caption,
    );

    // Click a fish to read about it. Tracked so a second click on the same fish
    // focuses nothing new rather than stacking duplicate windows.
    const openProfiles = new Set<Fish>();

    stage.addEventListener("click", (event: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      let best: Fish | null = null;
      let bestDistance = Infinity;
      for (const f of everyone()) {
        // Compare in stage space, correcting x for aspect so the hit area is
        // round on screen rather than an ellipse.
        const dx = (f.x - px) * (rect.width / rect.height);
        const dy = f.y - py;
        const distance = Math.hypot(dx, dy);
        if (distance < f.size * 1.6 && distance < bestDistance) {
          best = f;
          bestDistance = distance;
        }
      }

      if (!best || openProfiles.has(best)) return;
      openProfile(best);
      ctx.nudge("inspect");
    });

    /**
     * Everyone in the tank, as a list you can read.
     *
     * The tank is the real interface and this does not replace it: the point of
     * the aquarium is watching. But finding one particular fish by waiting for
     * it to swim past is a game nobody asked to play, and a dead one never
     * swims past at all.
     *
     * Residents and yours only. Visitors arriving over the bus are foreign
     * agents wearing fish shapes, with no lore behind them, so a row for one
     * would open nothing.
     *
     * The list follows the collection. Built once at open time, it had the
     * same fault the tank itself used to have: buy a fish with the panel
     * already open and the fish swam in while the list of what was in the tank
     * carried on saying otherwise.
     */
    function openFishPanel(): void {
      const list = document.createElement("div");
      list.className = "fish-panel";

      /**
       * Keyed by the fish, so a refresh keeps the rows it already has.
       *
       * Rebuilding the list wholesale would be simpler and would restart every
       * row's model mid-turn and throw away the scroll position, which is a
       * strange thing to happen to the window you are reading because you
       * bought something in another one.
       */
      const rows = new Map<Fish, { el: HTMLElement; model: { stop(): void } }>();

      function buildRow(fish: Fish): { el: HTMLElement; model: { stop(): void } } {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "fish-row";

        const bust = document.createElement("div");
        bust.className = "fish-row-model";
        const model = mountFish3d(bust, { hue: fish.hue, deceased: fish.dead, form: fish.form });

        const name = document.createElement("span");
        name.className = "fish-row-name";
        name.textContent = fish.name;

        const note = document.createElement("span");
        note.className = "fish-row-note";
        note.textContent = fish.dead ? "deceased" : fish.mine ? "yours" : fish.species;

        row.append(bust, name, note);
        row.addEventListener("click", () => {
          openProfile(fish);
          ctx.nudge("inspect");
        });
        return { el: row, model };
      }

      function refresh(): void {
        const wanted = [...residents, ...owned];
        const present = new Set(wanted);

        // A fish can leave the list as well as join it: an upgrade sold on
        // would drop the ones past the new capacity.
        for (const [fish, row] of rows) {
          if (present.has(fish)) continue;
          row.model.stop();
          row.el.remove();
          rows.delete(fish);
        }

        for (const fish of wanted) {
          let row = rows.get(fish);
          if (!row) {
            row = buildRow(fish);
            rows.set(fish, row);
          }
          // Appending one that is already last leaves it where it is, and
          // moving a canvas does not disturb the loop drawing into it, so this
          // keeps the order right without rebuilding anything.
          list.append(row.el);
        }
      }

      refresh();
      panels.add(refresh);

      ctx.openWindow({
        title: "Fish",
        body: list,
        width: 260,
        height: 300,
        // Every row owns a running animation loop. Without this they keep
        // turning in a window nobody can see.
        onClose: () => {
          panels.delete(refresh);
          for (const row of rows.values()) row.model.stop();
        },
      });
    }

    function openProfile(fish: Fish): void {
      if (!fish.lore) return;
      openProfiles.add(fish);

      const { body, dispose } = buildProfile(fish, fish.lore);
      ctx.openWindow({
        title: fish.name,
        body,
        ...fitToContent(body, 300),
        resizable: true,
        onClose: () => {
          dispose();
          openProfiles.delete(fish);
        },
      });
    }

    let frame = 0;

    /**
     * The backdrop: real footage, behind everything the tank draws.
     *
     * Drawn into the canvas as the base layer rather than sat behind it as a
     * DOM element, because every effect the tank already has is painted in
     * order on top of this one fill: the borrowed hue from whatever is plugged
     * in, the cold water wash, the lamp you can buy, the gravel. Putting the
     * video underneath the canvas would have meant reimplementing all of that
     * in CSS, and the lamp would have stopped being worth 190 coins.
     *
     * Muted and inline, so it autoplays without a gesture.
     */
    const backdrop = document.createElement("video");
    backdrop.className = "tank-footage";
    backdrop.muted = true;
    backdrop.loop = true;
    backdrop.playsInline = true;
    backdrop.preload = "auto";

    /**
     * Each machine gets its own stretch of the reel.
     *
     * Playing the whole thing start to finish would make every tank identical
     * once you had seen it twice. The offset is seeded, so a shared seed still
     * reproduces the same tank down to which divers are in it.
     */
    const segmentRng = rng.derive("backdrop");
    let segmentStart = 0;
    const SEGMENT_SECONDS = 24;

    function chooseSegment(): void {
      const usable = Math.max(0, backdrop.duration - SEGMENT_SECONDS);
      segmentStart = Number.isFinite(usable) ? segmentRng.range(0, usable) : 0;
      backdrop.currentTime = segmentStart;
    }

    // Registered before src is set, and checked again straight after. A warm
    // cache can have metadata ready before a listener added afterwards ever
    // runs, which is how this silently played from the top instead.
    backdrop.addEventListener("loadedmetadata", chooseSegment);

    // loop alone would run to the end of the file. This keeps it on its own
    // stretch instead.
    backdrop.addEventListener("timeupdate", () => {
      if (backdrop.currentTime > segmentStart + SEGMENT_SECONDS) {
        backdrop.currentTime = segmentStart;
      }
    });

    backdrop.src = tankFootage;
    // Kept in the document, one pixel and invisible, rather than orphaned.
    // Detached media elements are not reliably allowed to play, and this is
    // never looked at directly: it exists to be sampled by drawImage.
    stage.append(backdrop);
    if (backdrop.readyState >= 1) chooseSegment();

    /**
     * Keep it playing, and keep trying.
     *
     * One call at startup was not enough, and the reason is worth writing down
     * because it looked like flakiness: asking to play and then seeking to the
     * machine's segment aborts the pending play, the rejection is silent, and
     * nothing ever asked again. The tank sat on a single frozen frame at
     * exactly its start offset. It was not intermittent, it only looked that
     * way, because a warm cache changes which of the two happens first.
     *
     * So this is called from every event that could plausibly leave it stopped,
     * and again from the draw loop as a backstop. A backdrop that quietly stops
     * is worse than one that never started, since nothing on screen says why.
     */
    function ensurePlaying(): void {
      if (!backdrop.paused || !backdrop.isConnected || backdrop.readyState < 2) return;
      void backdrop.play().catch(() => {
        // Refused for now. The tank falls back to its painted water, which is
        // what it always was, and the draw loop will ask again shortly.
      });
    }
    for (const event of ["loadeddata", "canplay", "seeked", "stalled", "suspend"]) {
      backdrop.addEventListener(event, ensurePlaying);
    }
    ensurePlaying();
    document.addEventListener("visibilitychange", ensurePlaying);

    /** Throttle for the backstop, so a refusal is not retried every frame. */
    let lastPlayAttempt = 0;

    /**
     * Cover, not contain. The footage is a fixed shape and the window is not,
     * so something has to give: stretching distorts people, and letterboxing
     * reads as a bug. Cropping the overflow is the only one of the three that
     * looks deliberate.
     */
    function drawBackdrop(c: CanvasRenderingContext2D, w: number, h: number): boolean {
      const vw = backdrop.videoWidth;
      const vh = backdrop.videoHeight;
      if (!vw || !vh || backdrop.readyState < 2) return false;

      // The backstop. Anything that stopped playback without telling us gets
      // undone within a second, whatever the cause was.
      if (backdrop.paused) {
        const now = performance.now();
        if (now - lastPlayAttempt > 900) {
          lastPlayAttempt = now;
          ensurePlaying();
        }
      }

      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      c.drawImage(backdrop, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return true;
    }

    const token = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    function step(time: number): void {
      const dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
      const c = canvas.getContext("2d");
      if (!c) return;

      const live = ctx.incoming();
      // Cold water slows everything and drains the colour out of it. A heater
      // is what the upgrade is for — it does not warm the tank so much as stop
      // the weather from reaching it.
      const temperature = live.scalars["temperature"] ?? 14;
      const rawChill = Math.max(0, Math.min(1, (12 - temperature) / 22));
      const chill = ctx.collection.has("heater") ? rawChill * 0.15 : rawChill;
      const agitation = live.rhythm.length
        ? Math.abs(live.rhythm[Math.floor(time / 60) % live.rhythm.length] ?? 0)
        : 0;

      // Painted water is the fallback, not the default: it is what you get
      // while the footage is still buffering, and if the file never arrives.
      if (!drawBackdrop(c, w, h)) {
        c.fillStyle = token("--c-boot-bg") || "#04121a";
        c.fillRect(0, 0, w, h);
      }
      // Borrowed hues tint the water, so a connection is visible at a glance.
      const tint = live.palette[0];
      if (tint !== undefined) {
        c.fillStyle = `hsl(${tint} 60% 45% / ${0.12 + agitation * 0.1})`;
        c.fillRect(0, 0, w, h);
      }
      if (chill > 0.05) {
        c.fillStyle = `hsl(200 70% 70% / ${chill * 0.22})`;
        c.fillRect(0, 0, w, h);
      }

      // The lamp has to be worth 190 coins, so an unlit tank is genuinely
      // murky and a lit one is genuinely bright. A faint gradient nobody
      // notices is the same as not selling the thing at all.
      const lit = ctx.collection.has("lamp");
      if (lit) {
        const glow = c.createLinearGradient(0, 0, 0, h);
        glow.addColorStop(0, "rgb(255 248 214 / 0.30)");
        glow.addColorStop(0.55, "rgb(255 248 214 / 0.08)");
        glow.addColorStop(1, "rgb(255 248 214 / 0)");
        c.fillStyle = glow;
        c.fillRect(0, 0, w, h);
        // The hood itself, so you can see what you bought.
        c.fillStyle = token("--c-surface") || "#999";
        c.fillRect(0, 0, w, Math.max(2, h * 0.035));
      } else {
        c.fillStyle = "rgb(0 0 0 / 0.28)";
        c.fillRect(0, 0, w, h);
      }

      c.fillStyle = token("--c-surface-alt") || "#333";
      c.fillRect(0, h * 0.9, w, h * 0.1);

      if (ctx.collection.has("castle")) drawCastle(c, w, h, token("--c-surface") || "#888");

      // The heater is a visible tube on the back wall that bubbles when it is
      // working — otherwise it is an invisible statistic that only matters if
      // you happen to have Weather patched in.
      if (ctx.collection.has("heater")) {
        const hx = w * 0.06;
        c.fillStyle = "#3a3a3a";
        c.fillRect(hx - w * 0.008, h * 0.35, Math.max(2, w * 0.016), h * 0.55);
        c.fillStyle = rawChill > 0.05 ? "#e2603f" : "#7a4a3a";
        c.fillRect(hx - w * 0.008, h * 0.8, Math.max(2, w * 0.016), h * 0.08);
        // Bubbles rise faster when it is actually fighting something.
        const bubbleRate = 900 - rawChill * 600;
        for (let b = 0; b < 4; b++) {
          const phase = ((time / bubbleRate) + b * 0.25) % 1;
          c.fillStyle = `rgb(255 255 255 / ${0.32 * (1 - phase)})`;
          c.beginPath();
          c.arc(hx + Math.sin(phase * 9 + b) * w * 0.006, h * (0.86 - phase * 0.5),
            Math.max(1, w * 0.004), 0, Math.PI * 2);
          c.fill();
        }
      }

      // Flakes sink, and are eaten when they reach the gravel.
      c.fillStyle = "#c9a227";
      for (let i = flakes.length - 1; i >= 0; i--) {
        const flake = flakes[i]!;
        flake.y += flake.vy;
        flake.x += Math.sin(time / 700 + flake.y * 20) * 0.0006;
        if (flake.y > 0.9) { flakes.splice(i, 1); continue; }
        c.fillRect(flake.x * w, flake.y * h, Math.max(1, w * 0.005), Math.max(1, h * 0.008));
      }

      const speed = (1 - chill * 0.7) * (1 + agitation * 1.6);

      const crowd = everyone();

      for (const f of crowd) {
        if (f.dead) {
          f.x += 0.0002;
          if (f.x > 1) f.x = 0;
          f.y = 0.06 + Math.sin(time / 1400) * 0.004;
        } else {
          const s = f.swim;

          // Flake is what makes the tin worth buying: fish break off whatever
          // they were doing and go for it, and it disappears when eaten.
          let target = -1;
          let nearest = 0.32;
          for (let i = 0; i < flakes.length; i++) {
            const flake = flakes[i]!;
            const distance = Math.hypot(flake.x - f.x, flake.y - f.y);
            if (distance < nearest) { nearest = distance; target = i; }
          }

          if (target >= 0) {
            const flake = flakes[target]!;
            if (nearest < 0.03) {
              flakes.splice(target, 1);
            } else {
              f.vx += Math.sign(flake.x - f.x) * 0.00035;
              f.vy += Math.sign(flake.y - f.y) * 0.00030;
            }
          } else {
            // Hold a preferred depth. This alone separates the tank into
            // layers instead of everything milling around the middle.
            f.vy += (s.depth - f.y) * 0.00006 * s.depthPull;

            // Aimless drift. Math.random rather than the seeded stream —
            // frame-by-frame noise is not part of a machine's identity, and
            // consuming the seed at 60fps would make it meaningless.
            f.vx += (Math.random() - 0.5) * 0.00036 * s.wander;
            f.vy += (Math.random() - 0.5) * 0.00024 * s.wander;

            // Sudden bursts. The single biggest contributor to a tank looking
            // alive rather than mechanical.
            if (Math.random() < s.dart) {
              f.vx += (Math.random() - 0.5) * 0.012;
              f.vy += (Math.random() - 0.5) * 0.006;
            }

            if (s.home > 0) {
              f.vx += (s.homeX - f.x) * 0.00008 * s.home;
              f.vy += (s.homeY - f.y) * 0.00008 * s.home;
            }

            if (s.school !== 0) {
              let nx = 0, ny = 0, closest = 0.4;
              for (const other of crowd) {
                if (other === f || other.dead) continue;
                const distance = Math.hypot(other.x - f.x, other.y - f.y);
                if (distance < closest && distance > 0.001) {
                  closest = distance;
                  nx = other.x - f.x;
                  ny = other.y - f.y;
                }
              }
              if (closest < 0.4) {
                f.vx += Math.sign(nx) * 0.00014 * s.school;
                f.vy += Math.sign(ny) * 0.00011 * s.school;
              }
            }
          }

          // Per-fish speed limit, so a placid fish stays placid however much
          // it has been jostled.
          const ceiling = 0.0038 * s.cruise;
          const magnitude = Math.hypot(f.vx, f.vy);
          if (magnitude > ceiling) {
            f.vx = (f.vx / magnitude) * ceiling;
            f.vy = (f.vy / magnitude) * ceiling;
          }

          f.x += f.vx * speed;
          f.y += f.vy * speed;
          f.vy *= 0.995;

          // Reverse ONLY when actually heading into the wall. Testing position
          // alone was the bug: the clamp holds a fish inside the boundary band,
          // so it flipped its velocity every frame and vibrated in place.
          if ((f.x < 0.05 && f.vx < 0) || (f.x > 0.95 && f.vx > 0)) f.vx *= -1;
          if ((f.y < 0.1 && f.vy < 0) || (f.y > 0.88 && f.vy > 0)) f.vy *= -1;

          f.x = Math.min(0.97, Math.max(0.03, f.x));
          f.y = Math.min(0.9, Math.max(0.08, f.y));
        }

        drawCreature(c, f, w, h, time);
      }

      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);

    return {
      body: root,
      dispose: () => {
        cancelAnimationFrame(frame);
        offCollection();
        // Closing the window has to stop the decoder too. A paused video with
        // its src cleared is the only way to be sure it is not still being
        // decoded for a canvas nobody is drawing.
        document.removeEventListener("visibilitychange", ensurePlaying);
        backdrop.pause();
        backdrop.removeAttribute("src");
        backdrop.load();
      },
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          // Yours travel too — a fish you bought should infest the browser
          // exactly like one that came with the machine.
          const stock = [...residents, ...owned];
          return {
            sources: [ctx.title],
            tags: ["aquatic"],
            // Only living fish travel. A dead one stays in its own tank.
            agents: stock.filter((f) => !f.dead).map((f) => ({
              kind: "fish" as const,
              label: f.name,
              hue: f.hue,
              size: f.size * 6,
              speed: Math.abs(f.vx) * 400,
            })),
            words: [
              ...stock.map((f) => f.name),
              ...stock.map((f) => f.species.toLowerCase()),
              // What the fish are fond of travels too, so a shop plugged into
              // the tank starts stocking it.
              ...stock.flatMap((f) => (f.lore ? loreWords(f.lore) : [])),
            ],
            palette: stock.map((f) => f.hue),
            // Depths ride in rhythm, which the change-signature ignores — so
            // swimming does not make every connected program rebuild itself.
            rhythm: stock.map((f) => 1 - f.y * 2),
            scalars: { wetness: 1, crowding: stock.length / 10 },
          };
        },
        absorb(influence: Influence) {
          arriving = influence;
          guests = influence.agents
            .filter((a) => a.kind !== "fish" || ![...residents, ...owned].some((f) => f.name === a.label))
            .slice(0, 10)
            .map((agent) => {
              const x = rng.range(0.1, 0.9);
              const y = rng.range(0.2, 0.8);
              return {
                x, y,
                vx: (rng.chance(0.5) ? 1 : -1) * (0.0006 + agent.speed * 0.0016),
                vy: rng.range(-0.0004, 0.0004),
                size: 0.03 + agent.size * 0.05,
                hue: agent.hue,
                name: agent.label,
                species: agent.kind,
                dead: false,
                guest: agent,
                // Visitors have no temperament on record, so they get the
                // baseline roll — restless enough to read as out of place.
                swim: swimFor(rng, undefined, x, y),
              };
            });

          // Borrowed vocabulary renames the machine's fish — hook the browser
          // up and they are named after whatever you were reading.
          //
          // YOUR fish keep their names. A collection you carry between machines
          // stops being a collection if each machine relabels it.
          const names = arriving.words.filter((word) => /^[a-z]+$/i.test(word));
          residents.forEach((f, i) => {
            const borrowed = names[i];
            if (borrowed) f.name = borrowed.charAt(0).toUpperCase() + borrowed.slice(1);
          });

          updateCaption();
          ctx.changed();
        },
      },
    };
  },
};

/**
 * The ceramic castle. Hollow, which is the point — one of the generated fish
 * quotes is "It is not a castle. I have been inside it.", and the ornament
 * existing makes that line land instead of floating free.
 */
function drawCastle(c: CanvasRenderingContext2D, w: number, h: number, colour: string): void {
  const base = h * 0.9;
  const width = Math.min(w * 0.16, h * 0.3);
  const height = width * 1.1;
  const x = w * 0.78;

  c.fillStyle = colour;
  c.fillRect(x - width / 2, base - height, width, height);
  // Crenellations.
  const merlon = width / 5;
  for (let i = 0; i < 3; i++) {
    c.fillRect(x - width / 2 + i * merlon * 2, base - height - merlon, merlon, merlon);
  }
  // The doorway everyone keeps going into.
  c.fillStyle = "rgb(0 0 0 / 0.55)";
  c.beginPath();
  c.arc(x, base - height * 0.28, width * 0.16, Math.PI, 0);
  c.fillRect(x - width * 0.16, base - height * 0.28, width * 0.32, height * 0.28);
  c.fill();
}

/**
 * How big a window has to be for a card to fit in it.
 *
 * Profiles vary: a fish with three likes, a long quote and a keeper's name
 * needs noticeably more room than one whose record was never finished, and a
 * fixed height meant the first was scrolled and the second was mostly padding.
 *
 * Measured off-screen at the width the window will actually use, wearing the
 * same class as the real window body so it wraps identically. The titlebar is
 * measured from a real one rather than guessed, since window height includes
 * the chrome.
 */
function fitToContent(body: HTMLElement, width: number): { width: number; height: number } {
  const probe = document.createElement("div");
  probe.className = "win-body";
  probe.style.cssText =
    `position:absolute; left:-9999px; top:0; visibility:hidden; width:${width}px;`;
  probe.append(body);
  document.body.append(probe);
  const content = Math.ceil(body.getBoundingClientRect().height);
  probe.remove();

  const chrome = document.querySelector(".win-titlebar")?.getBoundingClientRect().height ?? 26;

  return {
    width,
    // Clamped at both ends: a fish with an enormous quote must not open taller
    // than the screen, and a nearly empty record should still look like a card
    // rather than a strip.
    height: Math.round(
      Math.max(240, Math.min(content + chrome + 2, window.innerHeight * 0.8)),
    ),
  };
}

/** The profile window's contents, plus a teardown for its animation loop. */
function buildProfile(fish: Fish, lore: FishLore): { body: HTMLElement; dispose: () => void } {
  const root = document.createElement("div");
  root.className = "profile";

  const stage = document.createElement("div");
  stage.className = "profile-model";
  const model = mountFish3d(stage, { hue: fish.hue, deceased: fish.dead, form: fish.form });

  const name = document.createElement("div");
  name.className = "profile-name";
  name.textContent = fish.name;

  const species = document.createElement("div");
  species.className = "profile-species";
  // The tank is the truth here, not the stored lore. A fish of yours floating
  // in a graveyard machine is deceased for as long as you are in that machine,
  // whatever its saved record says.
  species.textContent = fish.dead
    ? `${fish.species} · deceased`
    : fish.mine
      ? `${fish.species} · ${lore.temperament} · yours`
      : `${fish.species} · ${lore.temperament}`;

  const rows = document.createElement("dl");
  rows.className = "profile-rows";
  /**
   * An empty row is omitted rather than left blank. Lore restored from an old
   * or hand-edited save can be missing fields (see repairLore in
   * core/collection.ts), and "Likes:" with nothing after it reads as a bug,
   * where a card that simply lacks that line reads as a record nobody finished.
   */
  const row = (label: string, value: string) => {
    if (!value) return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    rows.append(dt, dd);
  };

  row("Age", lore.age);
  row("Likes", lore.likes.join(", "));
  row("Dislikes", lore.dislikes.join(", "));
  row("From", lore.acquired);

  root.append(stage, name, species, rows);

  if (lore.quote) {
    const quote = document.createElement("blockquote");
    quote.className = "profile-quote";
    quote.textContent = lore.quote;
    root.append(quote);
  }

  if (lore.recordedBy && lore.recordedBy !== "nobody") {
    const credit = document.createElement("div");
    credit.className = "profile-credit";
    credit.textContent = `Recorded by ${lore.recordedBy}`;
    root.append(credit);
  }
  return { body: root, dispose: () => model.stop() };
}

function drawCreature(
  c: CanvasRenderingContext2D,
  f: Fish,
  w: number,
  h: number,
  time: number,
): void {
  const px = f.x * w;
  const py = f.y * h;
  const size = f.size * h;
  const facing = f.vx >= 0 ? 1 : -1;
  const colour = f.dead ? "#8a8a8a" : `hsl(${f.hue} 70% 60%)`;

  // Tail beat scales with effort, so a darting fish visibly thrashes and a
  // drifting one barely moves. Rigid sliding shapes were most of why the tank
  // read as mechanical.
  const effort = Math.min(1, Math.hypot(f.vx, f.vy) / 0.004);
  const beat = f.dead
    ? 0
    : Math.sin(time / 1000 * f.swim.beat + f.swim.phase) * (0.25 + effort * 0.75);

  c.save();
  c.translate(px, py);

  if (f.guest && f.guest.kind !== "fish") {
    // Visitors keep the shape of whatever they came from, so you can tell at a
    // glance that something from another program is loose in the tank.
    c.fillStyle = colour;
    switch (f.guest.kind) {
      case "drop":
        c.beginPath();
        c.ellipse(0, 0, size * 0.5, size * 0.8, 0, 0, Math.PI * 2);
        c.fill();
        break;
      case "spark":
      case "mote":
        c.beginPath();
        c.arc(0, 0, size * 0.35, 0, Math.PI * 2);
        c.fill();
        break;
      case "leaf":
        c.rotate(Math.sin(px / 40) * 0.6);
        c.beginPath();
        c.ellipse(0, 0, size * 0.9, size * 0.32, 0, 0, Math.PI * 2);
        c.fill();
        break;
      case "glyph":
        c.font = `${size * 1.6}px serif`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(f.name.slice(0, 1).toUpperCase(), 0, 0);
        break;
    }
    c.restore();
    return;
  }

  c.scale(facing, f.dead ? -1 : 1);
  // The whole body leans into the stroke, not just the tail.
  c.rotate(beat * 0.09);

  drawBody(c, f, size, beat);
  c.restore();
}

/**
 * The fish itself, built to whatever its species name asked for.
 *
 * Everything here reads from `f.form` (see gen/fishform.ts) and falls back to
 * the plain ellipse-and-triangle if there is not one, because guests and
 * anything generated before this existed still have to draw.
 */
function drawBody(c: CanvasRenderingContext2D, f: Fish, size: number, beat: number): void {
  const form = f.form;
  const len = form?.len ?? 1;
  const depth = form?.depth ?? 0.9;
  const halfDepth = size * depth * 0.5;
  const tailScale = form?.tailScale ?? 1;

  // A dead fish is grey and unmarked. Markings on a corpse read as a rendering
  // fault rather than as a fish, and the grey is what says "this one is not
  // coming back" at a glance.
  const hue = form?.hue ?? f.hue;
  const finish = f.dead ? null : form?.finish ?? null;
  const alpha = finish === "glass" ? 0.5 : finish === "ghost" ? 0.36 : 1;
  const sat = finish === "metal" ? 62 : finish === "velvet" ? 34 : 70;
  const light = finish === "velvet" ? 46 : finish === "ghost" ? 78 : 60;

  const skin = f.dead ? "#8a8a8a" : `hsla(${hue} ${sat}% ${light}% / ${alpha})`;
  const dark = f.dead ? "#6f6f6f" : `hsla(${hue} ${sat}% ${Math.max(12, light - 26)}% / ${alpha})`;
  const pale = f.dead ? "#a2a2a2" : `hsla(${hue} ${sat}% ${Math.min(92, light + 24)}% / ${alpha})`;

  const bodyPath = (): void => {
    c.beginPath();
    c.ellipse(0, 0, size * len, halfDepth, 0, 0, Math.PI * 2);
  };

  // Tail first, so the body sits over the root of it.
  const tx = -size * len;
  const sweep = -beat * size * 0.34;
  c.fillStyle = dark;
  c.beginPath();
  switch (form?.tail ?? "plain") {
    case "whip":
      c.moveTo(tx, 0);
      c.quadraticCurveTo(tx - size * 1.5 * tailScale, sweep * 2.2, tx - size * 2.4 * tailScale, sweep * 3 - size * 0.1);
      c.quadraticCurveTo(tx - size * 1.4 * tailScale, sweep * 1.6 + size * 0.18, tx, size * 0.16);
      break;
    case "fan":
      c.moveTo(tx, 0);
      c.quadraticCurveTo(tx - size * 1.5 * tailScale, -size * 1.5 * tailScale + sweep, tx - size * 1.9 * tailScale, sweep * 1.4);
      c.quadraticCurveTo(tx - size * 1.5 * tailScale, size * 1.5 * tailScale + sweep, tx, 0);
      break;
    case "ribbon":
      c.moveTo(tx, -size * 0.1);
      c.quadraticCurveTo(tx - size * 1.2, sweep * 2, tx - size * 2.1, sweep * 2.6);
      c.quadraticCurveTo(tx - size * 1.1, sweep * 1.2 + size * 0.1, tx, size * 0.12);
      break;
    default:
      c.moveTo(tx, 0);
      c.lineTo(tx - size * 0.78 * tailScale, -size * 0.52 * tailScale + sweep);
      c.lineTo(tx - size * 0.78 * tailScale, size * 0.52 * tailScale + sweep);
  }
  c.closePath();
  c.fill();

  // Dorsal. A perch carries a row of spines where a molly carries a sail, and
  // that difference is most of what tells the two apart in silhouette.
  if (form?.spiny) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = size * (0.42 - i * 0.19) * len;
      c.moveTo(x, -halfDepth * 0.82);
      c.lineTo(x + size * 0.05, -halfDepth - size * (form.dorsal) * 0.42);
      c.lineTo(x + size * 0.12, -halfDepth * 0.82);
    }
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(size * 0.3 * len, -halfDepth * 0.75);
    c.quadraticCurveTo(
      -size * 0.1 * len, -halfDepth - size * (form?.dorsal ?? 0.75) * 0.62 - beat * size * 0.05,
      -size * 0.55 * len, -halfDepth * 0.55);
    c.closePath();
    c.fill();
  }

  // Anal fin. Small, and the tank looks wrong without it once the dorsal varies.
  c.beginPath();
  c.moveTo(-size * 0.05 * len, halfDepth * 0.7);
  c.quadraticCurveTo(
    -size * 0.4 * len, halfDepth + size * (form?.anal ?? 0.6) * 0.5 + beat * size * 0.04,
    -size * 0.62 * len, halfDepth * 0.5);
  c.closePath();
  c.fill();

  c.fillStyle = skin;
  bodyPath();
  c.fill();

  // Markings, clipped to the body so a band runs off the edge of the flank
  // rather than stopping short of it.
  if (form && form.marks.length > 0 && !f.dead) {
    c.save();
    bodyPath();
    c.clip();
    for (const mark of form.marks) {
      switch (mark.kind) {
        case "band":
          c.fillStyle = dark;
          c.save();
          c.translate(mark.x * size, 0);
          c.rotate(mark.tilt);
          c.fillRect(-size * 0.075, -halfDepth * 1.2, size * 0.15, halfDepth * 2.4);
          c.restore();
          break;
        case "spot":
          c.fillStyle = dark;
          c.beginPath();
          c.arc(mark.x * size, mark.y * size, mark.r * size, 0, Math.PI * 2);
          c.fill();
          break;
        case "blob": {
          c.fillStyle = pale;
          const bx = mark.x * size;
          const by = mark.y * size;
          c.beginPath();
          c.moveTo(bx, by);
          for (const step of mark.steps) {
            c.quadraticCurveTo(bx + step.cx * size, by + step.cy * size,
                               bx + step.x * size, by + step.y * size);
          }
          c.fill();
          break;
        }
        case "cloud": {
          const cx = mark.x * size;
          const cy = mark.y * size;
          const gradient = c.createRadialGradient(cx, cy, 1, cx, cy, mark.r * size);
          gradient.addColorStop(0, `hsla(${hue} ${sat}% 22% / 0.55)`);
          gradient.addColorStop(1, `hsla(${hue} ${sat}% 22% / 0)`);
          c.fillStyle = gradient;
          c.fillRect(-size * len * 1.2, -halfDepth * 1.2, size * len * 2.4, halfDepth * 2.4);
          break;
        }
        case "splash":
          c.fillStyle = `hsla(${mark.hue} 78% 58% / 0.85)`;
          c.beginPath();
          c.ellipse(mark.x * size, mark.y * size, mark.rx * size, mark.ry * size,
                    mark.rot, 0, Math.PI * 2);
          c.fill();
          break;
      }
    }
    c.restore();
  }

  if (finish === "metal") {
    c.save();
    bodyPath();
    c.clip();
    c.fillStyle = `hsla(${hue} 90% 82% / 0.5)`;
    c.fillRect(-size * len, -halfDepth * 0.55, size * len * 2, halfDepth * 0.3);
    c.restore();
  }
  // Glass and ghost are nearly transparent, so without an edge they disappear
  // against the backdrop entirely.
  if (finish === "glass" || finish === "ghost") {
    c.strokeStyle = `hsla(${hue} ${sat}% ${light + 10}% / 0.8)`;
    c.lineWidth = Math.max(1, size * 0.035);
    bodyPath();
    c.stroke();
  }

  // The details that name a catfish.
  if (form?.barbels || form?.feelers) {
    c.strokeStyle = dark;
    c.lineWidth = Math.max(1, size * 0.045);
    if (form.barbels) {
      for (const dir of [-1, 1]) {
        c.beginPath();
        c.moveTo(size * len * 0.86, size * 0.06);
        c.quadraticCurveTo(size * len * 1.2, size * 0.16 * dir + beat * size * 0.05,
                           size * len * 1.32, size * 0.34 * dir);
        c.stroke();
      }
    }
    if (form.feelers) {
      c.beginPath();
      c.moveTo(-size * 0.1, halfDepth * 0.8);
      c.quadraticCurveTo(size * 0.5, halfDepth * 1.5 + beat * size * 0.1,
                         size * len * 1.15, halfDepth * 1.1);
      c.stroke();
    }
  }

  c.fillStyle = "#000";
  c.beginPath();
  c.arc(size * len * 0.6, -size * 0.06, Math.max(1, size * 0.085), 0, Math.PI * 2);
  c.fill();
}
