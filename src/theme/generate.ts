/**
 * Roll a complete aesthetic, then force it to be readable.
 *
 * Order matters: generate wild, validate after. Constraining the roll up front
 * to "safe" colours produces timid themes that all look related. Rolling freely
 * and then pushing only the failing text pairings until they clear the contrast
 * floor keeps the character and loses only the unreadability.
 */

import type { Rng } from "../core/rng.ts";
import {
  CONTRAST,
  ensureContrast,
  hsl,
  mix,
  shift,
  toHex,
  webSafe,
  type Hsl,
} from "./color.ts";
import { MOVEMENTS, type ColorScheme, type Depth, type Movement, type Range } from "./movements.ts";
import { generateTile, type TileKind } from "./texture.ts";

export interface Theme {
  /** Movement id, or "a+b" for a hybrid. */
  id: string;
  /** Human-facing name, shown in the About window. */
  label: string;
  tokens: Record<string, string>;
}

/** How often two movements are crossed. Rare on purpose — this is the "boot
 * forty times and finally get one" mechanic, and it stops being special if it
 * fires every third boot. */
const HYBRID_CHANCE = 0.12;

function pickRange(rng: Rng, range: Range): number {
  const [min, max] = range;
  return min === max ? min : rng.range(min, max);
}

function pickIntRange(rng: Rng, range: Range): number {
  const [min, max] = range;
  return min === max ? min : rng.int(min, Math.round(max));
}

function schemeHues(rng: Rng, scheme: ColorScheme, base: number): number[] {
  switch (scheme) {
    case "mono":
      return [base, base, base];
    case "analogous":
      return [base, base + rng.range(18, 40), base - rng.range(18, 40)];
    case "complementary":
      return [base, base + 180, base + rng.range(160, 200)];
    case "triad":
      return [base, base + 120, base + 240];
    case "chaos":
      return [base, rng.int(0, 359), rng.int(0, 359)];
  }
}

/** Cross two movements: palette from one, type and geometry from the other. */
function hybridise(a: Movement, b: Movement): Movement {
  return {
    ...b,
    id: `${a.id}+${b.id}`,
    label: `${a.label} / ${b.label}`,
    palette: a.palette,
    texture: a.texture,
  };
}

function chooseMovement(rng: Rng): Movement {
  const weighted = MOVEMENTS.map((m) => [m, m.weight] as const);
  const first = rng.weighted(weighted);
  if (!rng.chance(HYBRID_CHANCE)) return first;

  const other = rng.weighted(weighted.filter(([m]) => m.id !== first.id));
  return hybridise(first, other);
}

interface Palette {
  desktop: Hsl;
  desktopAlt: Hsl;
  surface: Hsl;
  surfaceAlt: Hsl;
  field: Hsl;
  ink: Hsl;
  inkMuted: Hsl;
  line: Hsl;
  accent: Hsl;
  accentInk: Hsl;
  bevelLight: Hsl;
  bevelDark: Hsl;
  title: Hsl;
  titleInk: Hsl;
  titleBlur: Hsl;
  titleInkBlur: Hsl;
  bootBg: Hsl;
  bootInk: Hsl;
  bootOk: Hsl;
  bootWarn: Hsl;
  bootFail: Hsl;
  bootDim: Hsl;
}

function buildPalette(rng: Rng, m: Movement): Palette {
  const scheme = rng.pick(m.palette.scheme);
  const hues = schemeHues(rng, scheme, rng.int(0, 359));
  const [h0 = 0, h1 = 0, h2 = 0] = hues;
  const sat = pickRange(rng, m.palette.saturation);

  const dark =
    m.palette.mode === "dark" ||
    (m.palette.mode === "either" && rng.chance(0.45));

  const quantise = (c: Hsl) => (m.palette.webSafe ? webSafe(c) : c);

  const surface = quantise(hsl(h0, sat * 0.16, dark ? rng.range(10, 20) : rng.range(82, 93)));
  const surfaceAlt = quantise(shift(surface, dark ? 7 : -8));
  const field = quantise(shift(surface, dark ? -5 : 7));
  const accent = quantise(hsl(h1, sat, dark ? rng.range(45, 62) : rng.range(34, 52)));
  const desktop = quantise(hsl(h2, sat * 0.55, dark ? rng.range(6, 16) : rng.range(38, 66)));
  const desktopAlt = quantise(shift(desktop, dark ? 6 : -12, 0, rng.range(-12, 12)));

  // Title can be a loud accent block or a quiet tint of the surface.
  const loud = rng.chance(m.palette.loudTitle);
  const title = quantise(loud ? accent : mix(surface, accent, rng.range(0.15, 0.4)));
  const titleBlur = quantise(mix(title, surface, rng.range(0.45, 0.7)));

  let ink = quantise(hsl(h0, sat * 0.25, dark ? 88 : 12));
  let inkMuted = quantise(mix(ink, surface, 0.45));
  let titleInk = quantise(hsl(h1, sat * 0.2, dark ? 92 : 96));
  let titleInkBlur = quantise(mix(titleInk, titleBlur, 0.3));
  let accentInk = quantise(hsl(h1, sat * 0.15, 96));

  // The contrast floor. Ink is read against both the window surface and the
  // field behind file lists, so it has to clear both.
  ink = ensureContrast(ink, surface, CONTRAST.body);
  ink = ensureContrast(ink, field, CONTRAST.body);
  inkMuted = ensureContrast(inkMuted, surface, CONTRAST.muted);
  inkMuted = ensureContrast(inkMuted, field, CONTRAST.muted);
  titleInk = ensureContrast(titleInk, title, CONTRAST.chrome);
  titleInkBlur = ensureContrast(titleInkBlur, titleBlur, CONTRAST.muted);
  accentInk = ensureContrast(accentInk, accent, CONTRAST.chrome);

  const line = mix(surface, ink, rng.range(0.35, 0.6));

  const bootBg = quantise(hsl(h2, sat * 0.3, rng.range(3, 10)));
  let bootInk = quantise(hsl(h0, sat * 0.25, 82));
  let bootOk = quantise(hsl(rng.chance(0.7) ? 120 : h1, sat * 0.6, 62));
  let bootWarn = quantise(hsl(45, sat * 0.75, 62));
  let bootFail = quantise(hsl(8, sat * 0.7, 62));
  let bootDim = quantise(mix(bootInk, bootBg, 0.5));

  bootInk = ensureContrast(bootInk, bootBg, CONTRAST.body);
  bootOk = ensureContrast(bootOk, bootBg, CONTRAST.chrome);
  bootWarn = ensureContrast(bootWarn, bootBg, CONTRAST.chrome);
  bootFail = ensureContrast(bootFail, bootBg, CONTRAST.chrome);
  bootDim = ensureContrast(bootDim, bootBg, CONTRAST.muted);

  return {
    desktop, desktopAlt, surface, surfaceAlt, field, ink, inkMuted, line,
    accent, accentInk,
    bevelLight: mix(surface, hsl(h0, 0, 100), 0.55),
    bevelDark: mix(surface, hsl(h0, 0, 0), 0.4),
    title, titleInk, titleBlur, titleInkBlur,
    bootBg, bootInk, bootOk, bootWarn, bootFail, bootDim,
  };
}

function shadowFor(depth: Depth, p: Palette): { window: string; blur: string; control: string } {
  switch (depth) {
    case "none":
      return { window: "none", blur: "none", control: "none" };
    case "soft":
      return {
        window: "0 10px 30px rgb(0 0 0 / 0.34)",
        blur: "0 3px 10px rgb(0 0 0 / 0.18)",
        control: "none",
      };
    case "hard":
      // The flat offset drop shadow of every 90s dialog.
      return {
        window: "5px 5px 0 rgb(0 0 0 / 0.45)",
        blur: "3px 3px 0 rgb(0 0 0 / 0.25)",
        control: "none",
      };
    case "bevel":
      return {
        window: `inset 1px 1px 0 ${toHex(p.bevelLight)}, inset -1px -1px 0 ${toHex(p.bevelDark)}, 3px 3px 0 rgb(0 0 0 / 0.35)`,
        blur: `inset 1px 1px 0 ${toHex(p.bevelLight)}, inset -1px -1px 0 ${toHex(p.bevelDark)}`,
        control: `inset 1px 1px 0 ${toHex(p.bevelLight)}`,
      };
  }
}

/**
 * Some border styles silently degrade below a minimum width: `double` collapses
 * to a single line under 3px, and the bevel styles have nothing to shade with
 * under 2px. Rolling width and style independently therefore throws away the
 * effect a movement asked for, so the style sets a floor on the width.
 */
function minWidthForBorder(style: string): number {
  switch (style) {
    case "double":
      return 3;
    case "ridge":
    case "groove":
    case "outset":
    case "inset":
      return 2;
    default:
      return 0;
  }
}

function textureValue(
  rng: Rng,
  pool: readonly TileKind[],
  colors: { bg: Hsl; fg: Hsl; accent: Hsl },
): string {
  if (pool.length === 0) return "none";
  return generateTile(rng, rng.pick(pool), colors);
}

export function generateTheme(rootRng: Rng): Theme {
  // Its own substream, so adding aesthetic axes later never shifts the rolls
  // that decide identity, clutter or boot text.
  const rng = rootRng.derive("theme");

  const movement = chooseMovement(rng);
  const p = buildPalette(rng, movement);

  const depth = rng.pick(movement.depth);
  const shadows = shadowFor(depth, p);

  const sizeUi = Math.round(pickRange(rng, movement.type.size));
  const motionFast = Math.round(pickRange(rng, movement.motion));

  const borderStyle = rng.pick(movement.geometry.borderStyle);
  const borderWidth = Math.max(
    pickIntRange(rng, movement.geometry.borderWidth),
    minWidthForBorder(borderStyle),
  );

  const desktopTexture =
    movement.texture.desktop.length > 0
      ? textureValue(rng, movement.texture.desktop, {
          bg: p.desktop,
          fg: p.desktopAlt,
          accent: p.accent,
        })
      : `linear-gradient(${Math.round(rng.range(120, 200))}deg, ${toHex(p.desktop)} 0%, ${toHex(p.desktopAlt)} 100%)`;

  // Light imagery layer: subtle "found object" marks (rings, stains, old monitor
  // ghosts) that sit behind the main desktop pattern. Always uses the imagery
  // tile so it stays very faint and atmospheric. Deterministic, no new RNG
  // streams. This is the main lever for "the machine was used".
  const desktopImagery = rng.chance(0.72)
    ? textureValue(rng, ["rings"], {
        bg: p.desktop,
        fg: p.desktopAlt,
        accent: p.accent,
      })
    : "none";

  const surfaceTexture = textureValue(rng, movement.texture.surface, {
    bg: p.surface,
    fg: p.surfaceAlt,
    accent: p.accent,
  });

  const titleTexture = rng.chance(movement.texture.titleChance)
    ? textureValue(rng, ["scanlines", "hatch", "noise", "diagonal"], {
        bg: p.title,
        fg: p.titleInk,
        accent: p.accent,
      })
    : "none";

  const tokens: Record<string, string> = {
    "--c-desktop": toHex(p.desktop),
    "--c-desktop-alt": toHex(p.desktopAlt),
    "--c-surface": toHex(p.surface),
    "--c-surface-alt": toHex(p.surfaceAlt),
    "--c-ink": toHex(p.ink),
    "--c-ink-muted": toHex(p.inkMuted),
    "--c-line": toHex(p.line),
    "--c-accent": toHex(p.accent),
    "--c-accent-ink": toHex(p.accentInk),
    "--c-field": toHex(p.field),
    "--c-bevel-light": toHex(p.bevelLight),
    "--c-bevel-dark": toHex(p.bevelDark),
    "--c-title": toHex(p.title),
    "--c-title-ink": toHex(p.titleInk),
    "--c-title-blur": toHex(p.titleBlur),
    "--c-title-ink-blur": toHex(p.titleInkBlur),

    "--font-ui": rng.pick(movement.type.ui),
    "--font-mono": rng.pick(movement.type.mono),
    "--font-display": rng.pick(movement.type.display),
    "--size-ui": `${sizeUi}px`,
    "--size-small": `${Math.max(9, sizeUi - 2)}px`,
    "--weight-ui": "400",
    "--weight-strong": String(rng.pick(movement.type.strongWeight)),
    "--tracking-ui": `${pickRange(rng, movement.type.tracking).toFixed(3)}em`,
    "--leading-ui": rng.range(1.3, 1.6).toFixed(2),
    "--title-transform": rng.pick(movement.type.transform),

    "--radius-window": `${pickIntRange(rng, movement.geometry.radius)}px`,
    "--radius-control": `${pickIntRange(rng, movement.geometry.radius)}px`,
    "--border-width": `${borderWidth}px`,
    "--border-style": borderStyle,
    "--titlebar-height": `${pickIntRange(rng, movement.geometry.titlebar)}px`,
    "--window-pad": `${pickIntRange(rng, movement.geometry.pad)}px`,
    "--control-height": `${sizeUi + 9}px`,
    "--taskbar-height": `${sizeUi + 17}px`,

    "--shadow-window": shadows.window,
    "--shadow-window-blur": shadows.blur,
    "--shadow-control": shadows.control,

    "--texture-desktop": desktopTexture,
    "--texture-desktop-imagery": desktopImagery,
    "--texture-surface": surfaceTexture,
    "--texture-title": titleTexture,

    "--motion-fast": `${motionFast}ms`,
    "--motion-slow": `${Math.round(motionFast * 2.4)}ms`,
    "--ease-ui": rng.pick([
      "cubic-bezier(0.2, 0, 0.2, 1)",
      "linear",
      "ease-out",
      "cubic-bezier(0.34, 1.4, 0.64, 1)",
    ]),

    "--c-boot-bg": toHex(p.bootBg),
    "--c-boot-ink": toHex(p.bootInk),
    "--c-boot-ok": toHex(p.bootOk),
    "--c-boot-warn": toHex(p.bootWarn),
    "--c-boot-fail": toHex(p.bootFail),
    "--c-boot-dim": toHex(p.bootDim),
    "--font-boot": rng.pick(movement.type.mono),
    "--size-boot": `${sizeUi}px`,
  };

  return { id: movement.id, label: movement.label, tokens };
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(name, value);
  }
  root.dataset["movement"] = theme.id;
}
