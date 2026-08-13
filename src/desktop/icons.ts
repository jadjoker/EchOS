/**
 * Desktop icons.
 *
 * The machine boots to an empty desktop and you open things yourself. Windows
 * arranged for you is a demo; a desktop you have to explore is a machine
 * somebody left behind.
 *
 * Single click selects, double click opens — the OS-authentic pairing. Getting
 * this wrong is immediately noticeable in a way that undermines everything else
 * the fiction is doing.
 */

import type { Rng } from "../core/rng.ts";
import { generateTile, TILE_KINDS } from "../theme/texture.ts";
import { tokenHsl } from "../theme/color.ts";

export interface IconSpec {
  id: string;
  label: string;
  glyph: string;
  open(): void;
}

export function createDesktopIcons(
  desktop: HTMLElement,
  icons: readonly IconSpec[],
  rng: Rng,
): void {
  const layer = document.createElement("div");
  layer.className = "icons";

  const iconRng = rng.derive("icons");
  const palette = {
    bg: tokenHsl("--c-surface", "#cccccc"),
    fg: tokenHsl("--c-accent", "#3355aa"),
    accent: tokenHsl("--c-ink", "#111111"),
  };

  let selected: HTMLElement | null = null;

  for (const spec of icons) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "icon";
    el.dataset["app"] = spec.id;

    const face = document.createElement("span");
    face.className = "icon-face";
    // Each icon gets its own generated tile behind the glyph, so the icon set
    // changes with the machine like everything else does.
    face.style.backgroundImage = generateTile(iconRng, iconRng.pick(TILE_KINDS), palette);

    const glyph = document.createElement("span");
    glyph.className = "icon-glyph";
    glyph.textContent = spec.glyph;
    face.append(glyph);

    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = spec.label;

    el.append(face, label);

    const select = () => {
      selected?.classList.remove("is-selected");
      selected = el;
      el.classList.add("is-selected");
    };

    el.addEventListener("click", select);
    el.addEventListener("dblclick", () => { select(); spec.open(); });
    // Keyboard users get one press to open — a double keypress is not a gesture.
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
        spec.open();
      }
    });

    layer.append(el);
  }

  // Clicking bare desktop clears the selection, as it should.
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target === desktop || event.target === layer) {
      selected?.classList.remove("is-selected");
      selected = null;
    }
  });

  desktop.append(layer);
}
