/**
 * NEWS — a regional broadcast for a region that does not exist.
 *
 * The copy here is WRITTEN, not generated, and that is the point. Everything
 * else in the machine is rolled from a seed; a bulletin is the one place where
 * a joke has to land on the beat, and a generator that gets it right four times
 * in five still ruins the fifth. Written lines also give the generated web
 * something to be measured against — this is the voice the rest is aiming at.
 *
 * So the chyron is a fixed bank, shuffled. What varies per machine is the
 * order, the station's name, and which stories are on air.
 *
 * On the bus it emits its headlines as words, so anything downstream starts
 * talking about walnuts and golden retrievers. It absorbs agents as breaking
 * news, because a news programme reporting on whatever has been plugged into it
 * writes itself — and rhythm, which drives the speed of the crawl.
 */

import type { AppDef } from "./types.ts";
import type { Influence } from "../core/influence.ts";
import { appShell, button } from "./controls.ts";
import { personName, townName } from "../gen/places.ts";

/**
 * The bank. Local news as it actually reads — an item of national gravity and
 * a lost cat given exactly the same weight — pushed until it tips over.
 *
 * Never generated, never interpolated. Add lines here.
 */
const CHYRON = [
  "Tiny family of 5 seek shelter from storm inside a walnut",
  "Jimothy Jones sadly found alive and in good health",
  "16 injured after runaway golden retriever",
  "Why is everyone green? Tune in at 5pm!",
  "Council confirms the roundabout will remain where it is",
  "Man wins tombola three years running, declines to comment",
  "Library reopens after what it is calling a difficult period",
  "Bus timetable revised. Nobody consulted. Buses unchanged",
  "Local woman has been standing in the same field since Tuesday",
  "Swimming pool closed following the incident with the lane ropes",
  "Full results from the marrow judging after this",
  "Bin collections moved to Thursday. This is the third time",
  "Something has happened at the reservoir. More at six",
  "Retired postmaster still holds the key. Nobody knows to what",
  "Fete cancelled. Organisers thank everyone for their patience",
  "The hum is back. Council says it is not responsible for the hum",
  "Two hundred sandbags delivered to a house on high ground",
  "Golden retriever now believed to be a different golden retriever",
  "Church roof fund reaches target, then falls slightly short again",
  "Man reports his shed is larger on the inside. Surveyor disagrees",
  "All eleven ducks accounted for. The twelfth was never ours",
  "Traffic lights on the bridge working perfectly, say drivers, sarcastically",
  "Woman receives letter addressed to this house in 1974",
  "Allotment dispute enters its ninth year with no clear winner",
  "Nobody has seen the caretaker since the clocks went back",
  "Cricket match abandoned. Reasons given were not weather",
  "Chip shop under new management, same fryer, same oil",
  "Local history society disputes the existence of the local history",
  "Weather station reports conditions it does not have a word for",
  "The lights at the leisure centre are on again overnight",
  "Man builds boat in cellar. Boat remains in cellar",
  "Parish council votes to stop discussing the matter of the pond",
  "Missing bench returned to the green, facing the wrong way",
  "Nobody is quite sure who organised this year's carnival",
  "Reports of a smell near the depot are being taken seriously",
  "School photograph from 1988 contains one child too many",
  "Corner shop closes for good. It reopens Monday",
  "Fireworks display postponed until it is less dark",
  "Hedge cut back to the line agreed in the treaty of 1991",
  "That is all from us. It is not all that happened",
];

/** Which programme is on. Padding between the chyron and the studio. */
const SEGMENTS = [
  "Regional Round-Up",
  "Six O'Clock Report",
  "Your Evening",
  "Midweek Bulletin",
  "The Late Desk",
  "News Where You Are",
];

const STATION_TAIL = ["TV", "Broadcasting", "Regional", "Television", "Network"];

export const newsApp: AppDef = {
  id: "news",
  title: "News",
  glyph: "▤",
  width: 380,
  height: 300,
  minWidth: 300,
  minHeight: 200,

  create(ctx) {
    const { root, controls, stage } = appShell();
    const rng = ctx.rng;

    const station = `${townName(rng).toUpperCase()} ${rng.pick(STATION_TAIL)}`;
    const anchor = personName(rng);
    const segment = rng.pick(SEGMENTS);

    /**
     * Shuffled once per machine, then read in order and wrapped. A fresh random
     * pick each time would eventually show the same line twice in a row, which
     * on a crawl that never stops is the one thing that gives it away.
     */
    const order = rng.shuffle(CHYRON);
    let at = 0;

    const panel = document.createElement("div");
    panel.className = "news";
    stage.append(panel);

    let arriving: Influence | null = null;

    /** The three stories currently on air, from the same shuffled bank. */
    function headlines(): string[] {
      return [0, 1, 2].map((i) => order[(at + i) % order.length] ?? "");
    }

    function render(): void {
      panel.replaceChildren();

      const head = document.createElement("div");
      head.className = "news-head";
      const name = document.createElement("div");
      name.className = "news-station";
      name.textContent = station;
      const strap = document.createElement("div");
      strap.className = "news-segment";
      strap.textContent = `${segment} · with ${anchor}`;
      head.append(name, strap);

      const stories = document.createElement("div");
      stories.className = "news-stories";
      const [lead, ...rest] = headlines();
      const leadEl = document.createElement("div");
      leadEl.className = "news-lead";
      leadEl.textContent = lead ?? "";
      stories.append(leadEl);
      for (const line of rest) {
        const item = document.createElement("div");
        item.className = "news-item";
        item.textContent = line;
        stories.append(item);
      }

      // Anything plugged in is reported as it comes in. The line is written;
      // only the thing being reported on is borrowed.
      const agents = arriving?.agents ?? [];
      if (agents.length) {
        const breaking = document.createElement("div");
        breaking.className = "news-breaking";
        // No article, and never the label pluralised: agents arrive labelled
        // either as proper nouns (a fish called Marmite) or as mass nouns
        // (rain), and "5 Marmite" or "a rain" gives the game away instantly.
        breaking.textContent = agents.length > 2
          ? `BREAKING · ${agents.length} sightings in the area. One of them is ${agents[0]?.label ?? "unclear"}`
          : `BREAKING · ${agents[0]?.label ?? "something"} has been seen. We are staying with this`;
        stories.append(breaking);
      }

      const crawl = document.createElement("div");
      crawl.className = "news-chyron";
      const track = document.createElement("div");
      track.className = "news-chyron-track";
      // Two copies, so the loop has no gap at the wrap. The second is drawn by
      // a ::after pseudo-element: pseudo content is invisible to textContent,
      // so the crawl is not put on the bus twice, and is read aloud once.
      const text = order.join("   ·   ");
      track.style.setProperty("--chyron-text", JSON.stringify(text));
      // Rhythm arriving from elsewhere drives the crawl: plug a fast thing in
      // and the news gets hurried.
      const pulse = arriving?.rhythm?.length
        ? Math.abs(arriving.rhythm.reduce((a, b) => a + b, 0) / arriving.rhythm.length)
        : 0;
      track.style.setProperty("--chyron-seconds", `${Math.round(90 / (1 + pulse * 2))}s`);
      const first = document.createElement("span");
      first.className = "news-chyron-text";
      first.textContent = text;
      track.append(first);
      crawl.append(track);

      panel.append(head, stories, crawl);
    }

    controls.append(button("Next story", () => {
      at = (at + 1) % order.length;
      render();
      ctx.changed();
      ctx.nudge("tinker");
    }));
    render();

    return {
      body: root,
      dispose: () => {},
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          // Headlines travel as words, which is the whole reason a news
          // programme belongs on this bus: everything downstream starts
          // talking about whatever is currently on air.
          const words = headlines()
            .join(" ")
            .toLowerCase()
            .split(/[^a-z]+/)
            .filter((w) => w.length > 4);

          return {
            sources: [ctx.title],
            tags: ["broadcast"],
            agents: [],
            words: [...new Set(words)].slice(0, 12),
            palette: [355],
            // A steady read, in contrast to the weather's wave. Anything
            // downstream that animates to rhythm gets a newsreader's cadence.
            rhythm: [0.9, 0.2, 0.5, 0.2, 0.8, 0.2, 0.4, 0.2],
            scalars: {},
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
