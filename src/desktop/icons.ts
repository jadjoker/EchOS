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
  const iconRng = rng.derive("icons");
  const palette = {
    bg: tokenHsl("--c-surface", "#cccccc"),
    fg: tokenHsl("--c-accent", "#3355aa"),
    accent: tokenHsl("--c-ink", "#111111"),
  };

  // Desktop "personality": how the previous user left the icons.
  // Deterministic per machine, no effect on apps or bus.
  const layout = iconRng.pick(["grid", "jitter", "scattered"] as const);

  const layer = document.createElement("div");
  layer.className = "icons";
  if (layout === "scattered") {
    layer.classList.add("icons--scattered");
  }

  let selected: HTMLElement | null = null;

  icons.forEach((spec, index) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "icon";
    el.dataset["app"] = spec.id;

    // Per-icon substream so adding more visual rolls never shifts other icons.
    const faceRng = iconRng.derive(`icon:${index}:${spec.id}`);

    const face = document.createElement("span");
    face.className = "icon-face";
    // Each icon gets its own generated tile behind the glyph, so the icon set
    // changes with the machine like everything else does.
    face.style.backgroundImage = generateTile(faceRng, faceRng.pick(TILE_KINDS), palette);

    // Subtle lived-in character: occasional rotation, wear mark, or scuff.
    // All visual only; no impact on functionality or seed sharing.
    const rot = faceRng.chance(0.28) ? faceRng.range(-4.5, 4.5) : 0;
    if (rot !== 0) {
      face.style.transform = `rotate(${rot.toFixed(1)}deg)`;
    }
    if (faceRng.chance(0.55)) {
      face.classList.add("worn");
      // Tiny residue mark in the corner (coffee ring / scuff / tape edge).
      const residue = document.createElement("span");
      residue.className = "icon-residue";
      // A few variants so not every worn icon looks identical.
      if (faceRng.chance(0.4)) {
        residue.style.borderRadius = "1px";
        residue.style.width = "9px";
        residue.style.height = "5px";
        residue.style.top = "4px";
        residue.style.right = "5px";
      } else if (faceRng.chance(0.3)) {
        residue.style.opacity = "0.15";
        residue.style.border = "1px solid var(--c-line)";
      }
      face.append(residue);
    }

    const glyph = document.createElement("span");
    glyph.className = "icon-glyph";
    glyph.textContent = spec.glyph;
    face.append(glyph);

    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = spec.label;

    el.append(face, label);

    // Placement variety for "someone used this machine".
    if (layout === "scattered") {
      // Loose, human placement — not a tidy grid. Still fully deterministic.
      const x = Math.round(faceRng.range(6, 260));
      const y = Math.round(faceRng.range(6, 320));
      el.style.position = "absolute";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    } else if (layout === "jitter") {
      // Grid but the previous user nudged things around.
      const jx = faceRng.range(-7, 7);
      const jy = faceRng.range(-5, 9);
      el.style.marginLeft = `${jx.toFixed(0)}px`;
      el.style.marginTop = `${jy.toFixed(0)}px`;
    }

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
  });

  // Clicking bare desktop clears the selection, as it should.
  desktop.addEventListener("pointerdown", (event) => {
    if (event.target === desktop || event.target === layer) {
      selected?.classList.remove("is-selected");
      selected = null;
    }
  });

  desktop.append(layer);

  // Light lived-in clutter on the desktop surface itself.
  // The "residue" of a machine somebody actually used — post-its, scuffs,
  // coffee rings, paperclips. Non-interactive for now (Phase 1), purely
  // aesthetic. Deterministic, token-driven, very low visual weight.
  // Clicking the bare desktop still clears selection (already handled above).
  const clutterLayer = document.createElement("div");
  clutterLayer.className = "desktop-clutter";
  clutterLayer.setAttribute("aria-hidden", "true");

  const clutterRng = rng.derive("desktop-clutter");

  // 2–4 small items. Placement biased toward edges/corners so they don't
  // fight the icon area too much (more "desk used by a person").
  const clutterCount = clutterRng.int(2, 4);
  for (let i = 0; i < clutterCount; i++) {
    const item = document.createElement("div");
    item.className = "clutter-item";

    const kind = clutterRng.pick(["note", "ring", "clip", "smudge"] as const);

    // Edge-biased placement: each axis independently has a good chance
    // of landing near one of the two edges rather than floating in the middle.
    const x = edgeBiased(clutterRng, 8, 420);
    const y = edgeBiased(clutterRng, 8, 340);

    item.style.left = `${x}px`;
    item.style.top = `${y}px`;

    if (kind === "note") {
      item.classList.add("clutter-note");
      // Tiny generated "found note" flavour text. Keeps the amateur-web voice.
      const phrases = ["back soon", "don't forget", "fix later", "call mom", "patch #3", "milk"];
      item.textContent = clutterRng.pick(phrases);
      // Slight rotation so it doesn't look placed by a designer.
      const rot = clutterRng.range(-6, 7);
      item.style.transform = `rotate(${rot.toFixed(1)}deg)`;
    } else if (kind === "ring") {
      item.classList.add("clutter-ring");
      // A faint coffee-ring / water stain mark.
    } else if (kind === "clip") {
      item.classList.add("clutter-clip");
      item.textContent = "📎";
    } else {
      item.classList.add("clutter-smudge");
      // Just a soft smudge / wear patch.
    }

    clutterLayer.append(item);
  }

  desktop.append(clutterLayer);
}

/** Edge-biased random: 50% chance of near-min, 50% near-max, else uniform. */
function edgeBiased(rng: Rng, min: number, max: number): number {
  if (rng.chance(0.5)) {
    // Near the low edge
    return Math.round(rng.range(min, min + (max - min) * 0.22));
  } else if (rng.chance(0.5)) {
    // Near the high edge
    return Math.round(rng.range(max - (max - min) * 0.22, max));
  } else {
    return Math.round(rng.range(min, max));
  }
}
