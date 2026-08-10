/**
 * The browser.
 *
 * Type any domain and the web generates it. A given domain always produces the
 * same site, because the page's randomness derives from the address rather than
 * a running stream — a web that reshuffled on every visit would be noise rather
 * than a place.
 *
 * As a receiver it is the most fun target in the machine: agents wander loose
 * over the page, borrowed words work their way into whatever the site sells or
 * claims to have seen, and a borrowed hue stains the whole thing.
 */

import type { AppDef } from "./types.ts";
import type { Influence } from "../core/influence.ts";
import { parseDomain } from "../web/domain.ts";
import { buildPage, type Page } from "../web/site.ts";
import { renderPage } from "../web/render.ts";
import { allWords } from "../web/lexicon.ts";

const HOME = "home";

export const browserApp: AppDef = {
  id: "browser",
  title: "Browser",
  glyph: "🌐",
  width: 560,
  height: 460,
  minWidth: 320,
  minHeight: 240,

  create(ctx) {
    const root = document.createElement("div");
    root.className = "browser";

    const bar = document.createElement("div");
    bar.className = "browser-bar";

    const mkNav = (glyph: string, title: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "browser-nav";
      b.textContent = glyph;
      b.title = title;
      return b;
    };
    const back = mkNav("◀", "Back");
    const forward = mkNav("▶", "Forward");
    const home = mkNav("⌂", "Home");

    const address = document.createElement("input");
    address.className = "browser-address";
    address.spellcheck = false;
    address.placeholder = "type any address…";
    address.setAttribute("aria-label", "Address");

    const go = document.createElement("button");
    go.type = "button";
    go.className = "browser-go";
    go.textContent = "Go";

    bar.append(back, forward, home, address, go);

    const viewport = document.createElement("div");
    viewport.className = "browser-viewport";

    // Agents live above the page and never intercept clicks.
    const overlay = document.createElement("canvas");
    overlay.className = "browser-overlay";

    const frame = document.createElement("div");
    frame.className = "browser-frame";
    frame.append(viewport, overlay);

    const status = document.createElement("div");
    status.className = "browser-status";

    root.append(bar, frame, status);

    const history: string[] = [];
    let cursor = -1;
    let arriving: Influence | null = null;
    let current: Page | null = null;
    let currentDomain = HOME;

    interface Wanderer { x: number; y: number; vx: number; vy: number; hue: number; size: number; label: string; kind: string }
    let wanderers: Wanderer[] = [];

    function rebuildWanderers(): void {
      const agents = arriving?.agents ?? [];
      wanderers = agents.map((a, i) => ({
        x: (i * 0.17 + 0.1) % 1,
        y: (i * 0.29 + 0.15) % 1,
        vx: (i % 2 === 0 ? 1 : -1) * (0.0009 + a.speed * 0.0022),
        vy: (i % 3 === 0 ? 1 : -1) * 0.0004,
        hue: a.hue,
        size: 8 + a.size * 16,
        label: a.label,
        kind: a.kind,
      }));
    }

    let raf = 0;
    function animate(time: number): void {
      const dpr = window.devicePixelRatio || 1;
      const rect = frame.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w; overlay.height = h;
      }
      const c = overlay.getContext("2d");
      if (!c) { raf = requestAnimationFrame(animate); return; }
      c.clearRect(0, 0, w, h);

      const rhythm = ctx.incoming().rhythm;
      for (const p of wanderers) {
        // Live rhythm from upstream wobbles them, so a connected oscillator is
        // visible in the way things move rather than only in what they are.
        const wobble = rhythm.length
          ? (rhythm[Math.floor(time / 90 + p.x * 10) % rhythm.length] ?? 0) * 0.0016
          : 0;
        p.x += p.vx;
        p.y += p.vy + wobble;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0.02 || p.y > 0.98) p.vy *= -1;

        const px = p.x * w;
        const py = p.y * h;
        const size = p.size * dpr;

        c.save();
        c.translate(px, py);
        c.globalAlpha = 0.9;
        c.fillStyle = `hsl(${p.hue} 75% 55%)`;

        if (p.kind === "fish") {
          c.scale(p.vx >= 0 ? 1 : -1, 1);
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
          c.arc(size * 0.45, -size * 0.12, Math.max(1, size * 0.1), 0, Math.PI * 2);
          c.fill();
        } else if (p.kind === "drop" || p.kind === "mote") {
          c.beginPath();
          c.ellipse(0, 0, size * 0.4, size * 0.7, 0, 0, Math.PI * 2);
          c.fill();
        } else {
          c.font = `${size * 1.4}px serif`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText(p.label.slice(0, 1).toUpperCase(), 0, 0);
        }
        c.restore();
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    function renderHome(): void {
      const rng = ctx.rng.derive("home");
      const wrap = document.createElement("div");
      wrap.className = "browser-home";

      const heading = document.createElement("h1");
      heading.className = "browser-home-title";
      heading.textContent = "Where do you want to go?";

      const hint = document.createElement("p");
      hint.className = "browser-home-hint";
      hint.textContent = "Type any address. Anything at all — a real word, a made-up one. It exists.";
      wrap.append(heading, hint);

      const list = document.createElement("div");
      list.className = "browser-home-links";
      const tails = ["", "", "world", "shop", "club", "central", "ology", "corp"];
      // Borrowed words become suggested addresses, so a connection changes
      // where the web even offers to take you.
      const pool = [...(arriving?.words ?? []), ...rng.sample(allWords(), 14)];
      for (const word of rng.sample(pool, 14)) {
        const clean = word.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!clean) continue;
        const domain = `${clean}${rng.pick(tails)}.${rng.weighted([["com", 6], ["org", 3], ["net", 2]])}`;
        const link = document.createElement("a");
        link.className = "browser-home-link";
        link.href = `#${domain}`;
        link.textContent = domain;
        link.addEventListener("click", (e) => { e.preventDefault(); visit(domain); });
        list.append(link);
      }
      wrap.append(list);

      viewport.replaceChildren(wrap);
      address.value = "";
      current = null;
      status.textContent = `${allWords().length} words known · every address resolves`;
    }

    function show(target: string): void {
      currentDomain = target;
      if (target === HOME) { renderHome(); updateNav(); return; }

      const subject = parseDomain(target);
      const pageRng = ctx.rng.derive(`page:${subject.domain}`);
      const words = arriving?.words ?? [];
      const page = buildPage(
        pageRng,
        subject,
        words.length ? { words, sources: arriving?.sources ?? [] } : undefined,
      );
      current = page;

      const tint = arriving?.palette[0];
      viewport.replaceChildren(
        renderPage(page, pageRng, {
          onNavigate: (next) => visit(next),
          ...(tint !== undefined ? { tint } : {}),
        }),
      );
      viewport.scrollTop = 0;
      address.value = subject.domain;

      const influence = arriving && arriving.sources.length
        ? ` · influenced by ${arriving.sources.join(" + ")}`
        : "";
      status.textContent = subject.reading
        ? `${page.archetype} · invented · sounds like ${subject.reading.gloss}${influence}`
        : `${page.archetype} · ${subject.category}${subject.hint ? ` · ${subject.hint}` : ""}${influence}`;

      ctx.changed();
      updateNav();
    }

    function visit(target: string): void {
      history.splice(cursor + 1);
      history.push(target);
      cursor = history.length - 1;
      show(target);
      // Going somewhere counts as activity. Note this raises the *rate* — it
      // does not pay per page, so refreshing the same site earns nothing extra.
      ctx.nudge("navigate");
    }

    function updateNav(): void {
      back.disabled = cursor <= 0;
      forward.disabled = cursor >= history.length - 1;
    }

    function submit(): void {
      const typed = address.value.trim();
      if (typed) visit(typed);
    }

    go.addEventListener("click", submit);
    address.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    back.addEventListener("click", () => { if (cursor > 0) show(history[--cursor] ?? HOME); });
    forward.addEventListener("click", () => { if (cursor < history.length - 1) show(history[++cursor] ?? HOME); });
    home.addEventListener("click", () => visit(HOME));

    visit(HOME);

    return {
      body: root,
      dispose: () => cancelAnimationFrame(raf),
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          if (!current) {
            return {
              sources: [ctx.title], tags: ["textual"], agents: [], words: [],
              palette: [], rhythm: [], scalars: {},
            };
          }
          // The page's own nouns travel onward — hook the browser into the tank
          // and the fish are renamed after whatever you were reading.
          const text = current.blocks
            .map((b) => ("text" in b ? b.text : "items" in b ? JSON.stringify(b.items) : ""))
            .join(" ");
          const words = [...new Set(
            (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)),
          )].slice(0, 24);

          return {
            sources: [ctx.title],
            tags: ["textual", current.archetype],
            agents: words.slice(0, 5).map((w, i) => ({
              kind: "glyph" as const,
              label: w,
              hue: (i * 67) % 360,
              size: 0.5,
              speed: 0.3,
            })),
            words,
            palette: [(currentDomain.length * 37) % 360],
            rhythm: [],
            scalars: { pages: history.length },
          };
        },
        absorb(influence: Influence) {
          arriving = influence;
          rebuildWanderers();
          // Re-render so borrowed words reach the page content, not just the
          // overlay. Cheap because the graph only calls this on real change.
          show(currentDomain);
        },
      },
    };
  },
};

const STOP = new Set(`this that with from have been they them their there here
  will would could should about which when what where your yours ours been
  more most some such only over under were what page site please thank`.trim().split(/\s+/));
