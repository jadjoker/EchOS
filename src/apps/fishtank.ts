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
    }));

    let guests: Fish[] = [];
    let arriving: Influence | null = null;
    const keeper = personName(rng);

    function updateCaption(): void {
      const extra = guests.length ? ` · ${guests.length} visitors` : "";
      caption.textContent = `${count} fish${extra} · kept by ${keeper}`;
    }
    updateCaption();

    controls.append(
      button("Feed", () => {
        for (const f of residents) {
          if (f.dead) continue;
          f.vy -= rng.range(0.001, 0.003);
          f.vx += rng.range(-0.002, 0.002);
        }
      }),
      caption,
    );

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
      // Cold water slows everything and drains the colour out of it.
      const temperature = live.scalars["temperature"] ?? 14;
      const chill = Math.max(0, Math.min(1, (12 - temperature) / 22));
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

      c.fillStyle = token("--c-surface-alt") || "#333";
      c.fillRect(0, h * 0.9, w, h * 0.1);

      const speed = (1 - chill * 0.7) * (1 + agitation * 1.6);

      for (const f of [...residents, ...guests]) {
        if (f.dead) {
          f.x += 0.0002;
          if (f.x > 1) f.x = 0;
          f.y = 0.06 + Math.sin(time / 1400) * 0.004;
        } else {
          f.x += f.vx * speed;
          f.y += f.vy * speed;
          f.vy += (0.5 - f.y) * 0.00004;
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
      dispose: () => cancelAnimationFrame(frame),
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          return {
            sources: [ctx.title],
            tags: ["aquatic"],
            // Only living residents travel. A dead fish stays in its own tank.
            agents: residents.filter((f) => !f.dead).map((f) => ({
              kind: "fish" as const,
              label: f.name,
              hue: f.hue,
              size: f.size * 6,
              speed: Math.abs(f.vx) * 400,
            })),
            words: [
              ...residents.map((f) => f.name),
              ...residents.map((f) => f.species.toLowerCase()),
            ],
            palette: residents.map((f) => f.hue),
            // Depths ride in rhythm, which the change-signature ignores — so
            // swimming does not make every connected program rebuild itself.
            rhythm: residents.map((f) => 1 - f.y * 2),
            scalars: { wetness: 1, crowding: residents.length / 10 },
          };
        },
        absorb(influence: Influence) {
          arriving = influence;
          guests = influence.agents
            .filter((a) => a.kind !== "fish" || !residents.some((f) => f.name === a.label))
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

          // Borrowed vocabulary renames the residents — hook the browser up and
          // your fish are named after whatever you were reading.
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
