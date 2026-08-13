/**
 * Colour, and the contrast floor.
 *
 * The floor is the important part. Real amateur web design was frequently
 * unreadable — red text on a tiled starfield — and a generator rolling freely
 * will reproduce that roughly one boot in five. An unreadable machine is not
 * charmingly authentic, it is a refund. So: roll the palette as wild as you
 * like, then force every text-on-background pairing to clear a minimum ratio.
 *
 * Ratios are WCAG relative luminance. We don't chase AA everywhere — chrome and
 * body text have different needs, and holding decorative text to 4.5 would sand
 * the character off. See CONTRAST for the tiers actually enforced.
 */

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

export function hsl(h: number, s: number, l: number): Hsl {
  return {
    h: ((h % 360) + 360) % 360,
    s: clamp(s, 0, 100),
    l: clamp(l, 0, 100),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Minimum contrast ratios, by how much the text actually has to be read. */
export const CONTRAST = {
  /** Body text, file lists, anything you read for more than a second. */
  body: 4.5,
  /** Titlebars, taskbar labels, buttons — short, and you know what they say. */
  chrome: 3.2,
  /** Muted metadata. Low, but not invisible. */
  muted: 2.6,
} as const;

function hueToRgb(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

/** Each channel 0–1. */
export function toRgb(c: Hsl): [number, number, number] {
  const h = c.h / 360;
  const s = c.s / 100;
  const l = c.l / 100;

  if (s === 0) return [l, l, l];

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

export function toHex(c: Hsl): string {
  const channel = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  const [r, g, b] = toRgb(c);
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** WCAG relative luminance. */
export function luminance(c: Hsl): number {
  const linear = (v: number) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = toRgb(c);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: Hsl, b: Hsl): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Push `fg` away from `bg` in lightness until it clears `min`.
 *
 * Hue and saturation are preserved wherever possible — they carry the theme's
 * identity, and darkening a colour reads as the same colour while desaturating
 * it does not. We try both directions and take the first that passes, so a
 * light theme stays light rather than flipping to black text on the first
 * failure.
 */
export function ensureContrast(fg: Hsl, bg: Hsl, min: number): Hsl {
  // Aim slightly above the floor. We validate in HSL floats but ship 8-bit hex,
  // and that rounding can shave ~0.02 off the ratio — enough to land a colour
  // fractionally under a floor it mathematically cleared.
  const target = min * 1.03;
  if (contrast(fg, bg) >= target) return fg;

  const STEP = 2;
  let best = fg;
  let bestRatio = contrast(fg, bg);

  // Prefer moving away from the background's lightness; if the background is
  // mid-grey both directions are viable and the darker one usually looks less
  // washed out, so darker is tried first on ties.
  const directions = bg.l >= 50 ? [-STEP, STEP] : [STEP, -STEP];

  for (const step of directions) {
    let candidate = fg;
    for (let i = 0; i < 50; i++) {
      const next = hsl(candidate.h, candidate.s, candidate.l + step);
      if (next.l === candidate.l) break; // clamped at 0 or 100
      candidate = next;
      const ratio = contrast(candidate, bg);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
      if (ratio >= target) return candidate;
    }
  }

  // Nothing in this hue reaches the floor — fall back to whichever extreme
  // reads best. Losing the hue is bad; losing the text is worse.
  const black = hsl(fg.h, 0, 0);
  const white = hsl(fg.h, 0, 100);
  const viaBlack = contrast(black, bg);
  const viaWhite = contrast(white, bg);
  if (Math.max(viaBlack, viaWhite) > bestRatio) {
    return viaBlack > viaWhite ? black : white;
  }
  return best;
}

/** Mix two colours in HSL, taking the shorter path around the hue wheel. */
export function mix(a: Hsl, b: Hsl, amount: number): Hsl {
  const t = clamp(amount, 0, 1);
  let delta = b.h - a.h;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return hsl(a.h + delta * t, a.s + (b.s - a.s) * t, a.l + (b.l - a.l) * t);
}

export function shift(c: Hsl, dl: number, ds = 0, dh = 0): Hsl {
  return hsl(c.h + dh, c.s + ds, c.l + dl);
}

/**
 * Snap to the 216-colour web-safe palette.
 *
 * Purely an authenticity device: the web-safe palette is *why* 1998 pages look
 * the way they do, and quantising to it does more period work than any amount
 * of careful hue picking.
 */
export function webSafe(c: Hsl): Hsl {
  const [r, g, b] = toRgb(c);
  const snap = (v: number) => Math.round((v * 255) / 51) * 51;
  return rgbToHsl(snap(r), snap(g), snap(b));
}

/**
 * Read a colour token back out of the live theme.
 *
 * Anything that draws to a canvas needs this: the tokens are the single source
 * of the machine's look, but a canvas cannot use `var(--c-accent)`, so a
 * generated object has to ask what the accent currently is and paint with it.
 * Without this, canvas work is the one place where a colour gets hardcoded and
 * the aesthetic quietly stops being a data change.
 */
export function tokenHsl(name: string, fallback: string): Hsl {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return rgbToHsl(
    parseInt(raw.slice(1, 3), 16),
    parseInt(raw.slice(3, 5), 16),
    parseInt(raw.slice(5, 7), 16),
  );
}

/** Channels 0–255. */
export function rgbToHsl(r255: number, g255: number, b255: number): Hsl {
  const r = clamp(r255, 0, 255) / 255;
  const g = clamp(g255, 0, 255) / 255;
  const b = clamp(b255, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return hsl(0, 0, l * 100);

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return hsl(h * 360, s * 100, l * 100);
}
