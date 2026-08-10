/**
 * Page data to DOM.
 *
 * Sites are styled with the *same* token contract as the OS, but the tokens are
 * set on the page container rather than :root — so every site can roll its own
 * aesthetic from the existing movements and still inherit every rule already
 * written. That reuse is the reason a generated web was cheap to add at all.
 */

import type { Rng } from "../core/rng.ts";
import { generateTheme } from "../theme/generate.ts";
import { generateTile } from "../theme/texture.ts";
import { rgbToHsl } from "../theme/color.ts";
import type { Block, Page } from "./site.ts";

export interface RenderOptions {
  onNavigate(domain: string): void;
  /** Hue borrowed from a connected program. Visibly stains the whole site. */
  tint?: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Hex string to Hsl, for feeding generated tiles the page's own palette. */
function hex(value: string) {
  const clean = value.trim();
  return rgbToHsl(
    parseInt(clean.slice(1, 3), 16),
    parseInt(clean.slice(3, 5), 16),
    parseInt(clean.slice(5, 7), 16),
  );
}

export function renderPage(page: Page, rng: Rng, options: RenderOptions): HTMLElement {
  const root = el("div", `site site-${page.archetype}`);

  // Each site is its own machine, aesthetically. Derived from the domain so a
  // given address always looks the same however you arrive at it.
  const theme = generateTheme(rng.derive(`site:${page.domain}`));
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(name, value);
  }
  root.style.background = theme.tokens["--c-surface"] ?? "";
  root.style.backgroundImage = theme.tokens["--texture-surface"] ?? "none";

  // hue-rotate rather than re-rolling the palette: it preserves the contrast
  // the floor already guaranteed, so a connected program can stain a page
  // without any chance of making it unreadable.
  if (options.tint !== undefined) {
    root.style.filter = `hue-rotate(${Math.round(options.tint)}deg)`;
  }

  const palette = {
    bg: hex(theme.tokens["--c-surface"] ?? "#888888"),
    fg: hex(theme.tokens["--c-ink"] ?? "#111111"),
    accent: hex(theme.tokens["--c-accent"] ?? "#cc00cc"),
  };

  for (const block of page.blocks) {
    root.append(renderBlock(block, rng, palette, options));
  }
  return root;
}

function renderBlock(
  block: Block,
  rng: Rng,
  palette: { bg: ReturnType<typeof hex>; fg: ReturnType<typeof hex>; accent: ReturnType<typeof hex> },
  options: RenderOptions,
): HTMLElement {
  switch (block.kind) {
    case "banner": {
      const wrap = el("div", "site-banner");
      wrap.append(el("h1", "site-title", block.title));
      if (block.tagline) wrap.append(el("p", "site-tagline", block.tagline));
      return wrap;
    }

    case "marquee": {
      const wrap = el("div", "site-marquee");
      // The loop needs two copies so there is no gap as it wraps, but the
      // second one is drawn by a ::after pseudo-element rather than a real
      // node. Pseudo-element content is invisible to textContent, so the
      // marquee stops appearing twice in the page text the browser puts on the
      // influence bus — and screen readers only hear it once.
      const track = el("div", "site-marquee-track");
      track.style.setProperty("--marquee-text", JSON.stringify(block.text));
      track.append(el("span", "site-marquee-text", block.text));
      wrap.append(track);
      return wrap;
    }

    case "heading":
      return el("h2", "site-heading", block.text);

    case "para":
      return el("p", "site-para", block.text);

    case "list": {
      const list = el("ul", "site-list");
      for (const item of block.items) list.append(el("li", "site-list-item", item));
      return list;
    }

    case "products": {
      const table = el("div", "site-products");
      for (const product of block.items) {
        const row = el("div", "site-product");
        row.append(
          el("span", "site-product-name", product.name),
          el("span", "site-product-note", product.note),
          el("span", "site-product-price", product.price),
        );
        table.append(row);
      }
      return table;
    }

    case "guestbook": {
      const wrap = el("div", "site-guestbook");
      wrap.append(el("h2", "site-heading", "Guestbook"));
      for (const entry of block.entries) {
        const item = el("div", "site-guest");
        const head = el("div", "site-guest-head");
        head.append(el("span", "site-guest-who", entry.who));
        head.append(el("span", "site-guest-when", entry.when));
        item.append(head, el("div", "site-guest-text", entry.text));
        wrap.append(item);
      }
      return wrap;
    }

    case "links": {
      const wrap = el("div", "site-links");
      wrap.append(el("h2", "site-heading", block.title));
      const list = el("ul", "site-list");
      for (const link of block.items) {
        const li = el("li", "site-list-item");
        const anchor = el("a", "site-link", link.label);
        anchor.href = `#${link.href}`;
        anchor.title = link.href;
        anchor.addEventListener("click", (event) => {
          event.preventDefault();
          options.onNavigate(link.href);
        });
        li.append(anchor);
        list.append(li);
      }
      wrap.append(list);
      return wrap;
    }

    case "counter": {
      const wrap = el("div", "site-counter");
      wrap.append(el("span", "site-counter-label", "You are visitor number"));
      const digits = el("span", "site-counter-digits");
      // Zero-padded like a real odometer graphic.
      for (const char of String(block.hits).padStart(6, "0")) {
        digits.append(el("span", "site-counter-digit", char));
      }
      wrap.append(digits, el("span", "site-counter-since", `since ${block.since}`));
      return wrap;
    }

    case "construction": {
      const wrap = el("div", "site-construction");
      const bar = el("div", "site-construction-bar");
      bar.style.backgroundImage = generateTile(rng, "diagonal", palette);
      wrap.append(bar, el("p", "site-construction-note", block.note), bar.cloneNode(true) as HTMLElement);
      return wrap;
    }

    case "badges": {
      const wrap = el("div", "site-badges");
      for (const badge of block.items) wrap.append(el("span", "site-badge", badge));
      return wrap;
    }

    case "rule":
      return el("hr", "site-rule");

    case "figure": {
      const wrap = el("figure", "site-figure");
      const image = el("div", "site-figure-image");
      image.style.backgroundImage = generateTile(rng, block.tile, palette);
      wrap.append(image, el("figcaption", "site-figure-caption", block.caption));
      return wrap;
    }

    case "contact": {
      const wrap = el("address", "site-contact");
      for (const line of block.lines) wrap.append(el("div", "site-contact-line", line));
      return wrap;
    }

    case "updated":
      return el("p", "site-updated", `Last updated ${block.date}`);
  }
}
