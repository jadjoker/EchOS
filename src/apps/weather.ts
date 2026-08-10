/**
 * WEATHER — for a town that does not exist.
 *
 * Emits its temperature series as rhythm and its town and conditions as words,
 * so it can drive anything downstream. Absorbs rhythm (something else's motion
 * becomes this town's weather), words (the forecast starts mentioning them) and
 * agents, which are reported as sightings — because a town newspaper is exactly
 * where a loose fish would end up being written about.
 */

import type { AppDef } from "./types.ts";
import type { Influence } from "../core/influence.ts";
import { appShell, button } from "./controls.ts";
import { townName } from "../gen/places.ts";

const CONDITIONS = [
  ["clear", "☀"], ["fair", "☀"], ["cloudy", "☁"], ["overcast", "☁"],
  ["rain", "☂"], ["heavy rain", "☂"], ["drizzle", "☂"], ["fog", "≈"],
  ["mist", "≈"], ["snow", "❄"], ["sleet", "❄"], ["thunder", "⚡"],
  ["gales", "≋"], ["frost", "❄"],
] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const REMARKS = [
  "Station unattended since the reorganisation.",
  "Readings taken manually at 0900 and 1500.",
  "Anemometer damaged in the storm. Wind speeds estimated.",
  "No data for the eleventh. Nobody is sure why.",
  "The gauge is under the sycamore and probably reads low.",
  "Figures provisional until confirmed by the county office.",
];

export const weatherApp: AppDef = {
  id: "weather",
  title: "Weather",
  glyph: "☂",
  width: 340,
  height: 320,
  minWidth: 260,
  minHeight: 220,

  create(ctx) {
    const { root, controls, stage } = appShell();
    const rng = ctx.rng;

    const town = townName(rng);
    const base = rng.range(-2, 22);
    const swing = rng.range(3, 11);

    const panel = document.createElement("div");
    panel.className = "weather";
    stage.append(panel);

    let offset = 0;
    let arriving: Influence | null = null;

    function history(): number[] {
      const borrowed = arriving?.rhythm ?? [];
      return Array.from({ length: 14 }, (_, i) => {
        const t = i + offset;
        const own = Math.sin(t / 3.1) * swing + Math.sin(t / 1.7) * (swing / 3);
        // Anything plugged in bends the weather rather than replacing it, so
        // the town keeps its own character underneath.
        const outside = borrowed.length
          ? (borrowed[i % borrowed.length] ?? 0) * swing * 1.2
          : 0;
        return base + own + outside;
      });
    }

    function render(): void {
      const temps = history();
      const now = temps.at(-1) ?? base;
      const fRng = ctx.rng.derive(`forecast:${offset}`);
      const borrowedWords = (arriving?.words ?? []).filter((w) => /^[a-z ]+$/i.test(w));

      panel.replaceChildren();

      const head = document.createElement("div");
      head.className = "weather-head";
      const [label, glyph] = fRng.pick(CONDITIONS);
      const place = document.createElement("div");
      place.className = "weather-town";
      place.textContent = town;
      const nowLine = document.createElement("div");
      nowLine.className = "weather-now";
      nowLine.textContent = `${glyph}  ${now.toFixed(1)}°  ${label}`;
      head.append(place, nowLine);

      const chart = document.createElement("div");
      chart.className = "weather-chart";
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const span = Math.max(0.5, max - min);
      for (const value of temps) {
        const bar = document.createElement("div");
        bar.className = "weather-bar";
        bar.style.height = `${8 + ((value - min) / span) * 92}%`;
        bar.title = `${value.toFixed(1)}°`;
        chart.append(bar);
      }

      const list = document.createElement("div");
      list.className = "weather-forecast";
      for (let i = 0; i < 5; i++) {
        const [cond, sym] = fRng.pick(CONDITIONS);
        // A borrowed word occasionally becomes the weather itself.
        const word = borrowedWords.length && fRng.chance(0.35)
          ? fRng.pick(borrowedWords)
          : cond;
        const row = document.createElement("div");
        row.className = "weather-row";
        const day = document.createElement("span");
        day.textContent = DAYS[(offset + i) % 7] ?? "—";
        const c = document.createElement("span");
        c.textContent = `${sym} ${word}`;
        const t = document.createElement("span");
        t.className = "weather-temp";
        t.textContent = `${(base + fRng.range(-swing, swing)).toFixed(0)}°`;
        row.append(day, c, t);
        list.append(row);
      }

      const remark = document.createElement("div");
      remark.className = "weather-remark";
      const sighting = arriving?.agents[0];
      remark.textContent = sighting
        ? `Reported near the station: ${sighting.label}. ${arriving?.agents.length ?? 0} in total. Nobody has explained it.`
        : ctx.rng.derive(`remark:${town}`).pick(REMARKS);

      panel.append(head, chart, list, remark);
    }

    controls.append(button("Next reading", () => { offset += 1; render(); ctx.changed(); }));
    render();

    return {
      body: root,
      dispose: () => {},
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          const temps = history();
          const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
          return {
            sources: [ctx.title],
            tags: ["meteorological"],
            // Rain and snow travel as drops; they will fall through anything
            // downstream that can draw agents.
            agents: mean < 3
              ? Array.from({ length: 8 }, (_, i) => ({
                  kind: "mote" as const, label: "snow", hue: 200,
                  size: 0.3, speed: 0.2 + i * 0.05,
                }))
              : Array.from({ length: 6 }, (_, i) => ({
                  kind: "drop" as const, label: "rain", hue: 205,
                  size: 0.4, speed: 0.5 + i * 0.06,
                })),
            words: [town.toLowerCase(), "forecast", "station", "readings"],
            palette: [mean < 6 ? 205 : 40],
            rhythm: temps.map((t) => (t - base) / Math.max(1, swing * 1.5)),
            scalars: { temperature: mean },
          };
        },
        absorb(influence: Influence) {
          arriving = influence;
          render();
          ctx.changed();
        },
      },
    };
  },
};
