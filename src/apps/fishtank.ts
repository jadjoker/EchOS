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
import { appShell, button } from "./controls.ts";
import { personName } from "../gen/places.ts";
import { generateLore, loreWords, type FishLore } from "../gen/fishlore.ts";
import { mountFish3d } from "./fish3d.ts";

const SPECIES_HEAD = `Golden Spotted Ribbon Paper Glass Blue Banded Dwarf Royal
  Common Lesser Marbled Ghost Velvet Copper Whiptail Fantail Moon`.trim().split(/\s+/);

const SPECIES_TAIL = `barb tetra danio rasbora guppy molly platy loach gourami
  cichlid catfish angelfish killifish minnow carp perch`.trim().split(/\s+/);

const PET_NAMES = `Doug Marbles Biscuit Nelson Admiral Tiny Bubbles Kevin Pearl
  Smudge Captain Jaws Gilbert Norman Sausage Duchess Rocket`.trim().split(/\s+/);

interface Fish {
  x: number; y: number; vx: number; vy: number;
  size: number; hue: number;
  name: string; species: string;
  dead: boolean;
  /** Residents have a history. Visitors from other programs do not. */
  lore?: FishLore;
  /** Bought, and therefore carried to the next machine. */
  mine?: boolean;
  /** Links back to the persistent collection entry, for re-syncing. */
  collectionId?: string;
  /** Foreign agents drawn as guests rather than residents. */
  guest?: Agent;
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
    const residents: Fish[] = Array.from({ length: count }, (_, i) => ({
      x: rng.range(0.1, 0.9), y: rng.range(0.15, 0.85),
      vx: rng.range(-0.0016, 0.0016) || 0.001,
      vy: rng.range(-0.0006, 0.0006),
      size: rng.range(0.05, 0.11),
      hue: rng.int(0, 359),
      name: rng.pick(PET_NAMES),
      species: `${rng.pick(SPECIES_HEAD)} ${rng.pick(SPECIES_TAIL)}`,
      dead: i === 0,
      lore: generateLore(rng, i === 0),
    }));

    // Your fish join the machine's own. The previous owner's fish and yours
    // sharing a tank is the whole premise in one window: the computer is
    // borrowed, the collection is not.
    //
    // Kept in a SEPARATE list that is re-synced whenever the collection
    // changes. Building it once at open time was the bug that made the shop
    // feel fake — you bought a fish and the tank, already open, never noticed.
    let owned: Fish[] = [];

    function syncOwned(): void {
      const existing = new Map(owned.map((f) => [f.collectionId, f]));
      owned = ctx.collection.fish
        .slice(0, ctx.collection.capacity)
        .map((f) => {
          const already = existing.get(f.id);
          if (already) return already; // keep it swimming where it was
          return {
            // New arrivals swim in from the edge, so a purchase is visible as
            // an event rather than appearing fully formed mid-tank.
            x: rng.chance(0.5) ? 0.04 : 0.96,
            y: rng.range(0.25, 0.75),
            vx: rng.range(-0.0016, 0.0016) || 0.0012,
            vy: rng.range(-0.0006, 0.0006),
            size: f.size, hue: f.hue,
            name: f.name, species: f.species,
            dead: false, lore: f.lore, mine: true, collectionId: f.id,
          };
        });
      updateCaption();
    }

    /** Everything currently swimming: the machine's, yours, and visitors. */
    const everyone = (): Fish[] => [...residents, ...owned, ...guests];

    let guests: Fish[] = [];
    let arriving: Influence | null = null;
    const keeper = personName(rng);

    /** Flakes drifting down after a feed. */
    const flakes: { x: number; y: number; vy: number }[] = [];

    function updateCaption(): void {
      const extra = guests.length ? ` · ${guests.length} visitors` : "";
      const yours = owned.length ? ` · ${owned.length} yours` : "";
      const tin = ctx.collection.food > 0 ? ` · ${ctx.collection.food} feeds` : " · no flake";
      // Total, not the machine's own count — "8 fish · 2 yours" otherwise reads
      // as two of the eight rather than two on top of them.
      const total = count + owned.length;

      // Fitted equipment is listed so a purchase is legible even before you
      // notice what it changed.
      const fitted = (["heater", "lamp", "castle", "annexe", "conservatory"] as const)
        .filter((id) => ctx.collection.has(id));
      const kit = fitted.length ? ` · ${fitted.join(", ")}` : "";

      caption.textContent =
        `${total} fish${yours}${extra} · ${ctx.collection.fish.length}/${ctx.collection.capacity} kept` +
        ` · ${keeper}${tin}${kit}`;
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

    function openProfile(fish: Fish): void {
      if (!fish.lore) return;
      openProfiles.add(fish);

      const { body, dispose } = buildProfile(fish, fish.lore);
      ctx.openWindow({
        title: fish.name,
        body,
        width: 300,
        height: 340,
        resizable: false,
        onClose: () => {
          dispose();
          openProfiles.delete(fish);
        },
      });
    }

    let frame = 0;

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

      c.fillStyle = token("--c-boot-bg") || "#04121a";
      c.fillRect(0, 0, w, h);
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

      for (const f of everyone()) {
        if (f.dead) {
          f.x += 0.0002;
          if (f.x > 1) f.x = 0;
          f.y = 0.06 + Math.sin(time / 1400) * 0.004;
        } else {
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
              f.vx = Math.max(-0.006, Math.min(0.006, f.vx));
              f.vy = Math.max(-0.005, Math.min(0.005, f.vy));
            }
          } else {
            f.vy += (0.5 - f.y) * 0.00004;
          }

          f.x += f.vx * speed;
          f.y += f.vy * speed;
          f.vy *= 0.995;
          if (f.x < 0.05 || f.x > 0.95) f.vx *= -1;
          if (f.y < 0.1 || f.y > 0.88) f.vy *= -1;
          f.x = Math.min(0.97, Math.max(0.03, f.x));
          f.y = Math.min(0.9, Math.max(0.08, f.y));
        }

        drawCreature(c, f, w, h);
      }

      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);

    return {
      body: root,
      dispose: () => {
        cancelAnimationFrame(frame);
        offCollection();
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
            .map((agent) => ({
              x: rng.range(0.1, 0.9), y: rng.range(0.2, 0.8),
              vx: (rng.chance(0.5) ? 1 : -1) * (0.0006 + agent.speed * 0.0016),
              vy: rng.range(-0.0004, 0.0004),
              size: 0.03 + agent.size * 0.05,
              hue: agent.hue,
              name: agent.label,
              species: agent.kind,
              dead: false,
              guest: agent,
            }));

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

/** The profile window's contents, plus a teardown for its animation loop. */
function buildProfile(fish: Fish, lore: FishLore): { body: HTMLElement; dispose: () => void } {
  const root = document.createElement("div");
  root.className = "profile";

  const stage = document.createElement("div");
  stage.className = "profile-model";
  const model = mountFish3d(stage, { hue: fish.hue, deceased: fish.dead });

  const name = document.createElement("div");
  name.className = "profile-name";
  name.textContent = fish.name;

  const species = document.createElement("div");
  species.className = "profile-species";
  species.textContent = lore.deceased
    ? `${fish.species} · deceased`
    : fish.mine
      ? `${fish.species} · ${lore.temperament} · yours`
      : `${fish.species} · ${lore.temperament}`;

  const rows = document.createElement("dl");
  rows.className = "profile-rows";
  const row = (label: string, value: string) => {
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

  const quote = document.createElement("blockquote");
  quote.className = "profile-quote";
  quote.textContent = lore.quote;

  const credit = document.createElement("div");
  credit.className = "profile-credit";
  credit.textContent = `Recorded by ${lore.recordedBy}`;

  root.append(stage, name, species, rows, quote, credit);
  return { body: root, dispose: () => model.stop() };
}

function drawCreature(
  c: CanvasRenderingContext2D,
  f: Fish,
  w: number,
  h: number,
): void {
  const px = f.x * w;
  const py = f.y * h;
  const size = f.size * h;
  const facing = f.vx >= 0 ? 1 : -1;
  const colour = f.dead ? "#8a8a8a" : `hsl(${f.hue} 70% 60%)`;

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
  c.fillStyle = colour;
  c.beginPath();
  c.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-size, 0);
  c.lineTo(-size * 1.7, -size * 0.5);
  c.lineTo(-size * 1.7, size * 0.5);
  c.closePath();
  c.fill();
  c.fillStyle = "#000";
  c.beginPath();
  c.arc(size * 0.45, -size * 0.12, Math.max(1, size * 0.09), 0, Math.PI * 2);
  c.fill();
  c.restore();
}
