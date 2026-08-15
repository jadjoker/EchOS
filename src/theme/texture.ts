/**
 * Procedural tiled backgrounds.
 *
 * The tiled background is the single most recognisable signal of the amateur
 * web, and it is almost free to generate: draw a small canvas, export it as a
 * data URI, let CSS repeat it. Everything here stays deliberately crude —
 * hand-drawn-in-MSPaint crude — because polish would read as a modern designer
 * imitating 1998 rather than 1998.
 */

import type { Rng } from "../core/rng.ts";
import { toHex, type Hsl } from "./color.ts";

export type TileKind =
  | "checks"
  | "dots"
  | "stars"
  | "plaid"
  | "bricks"
  | "hearts"
  | "noise"
  | "diagonal"
  | "scanlines"
  | "hatch"
  | "grid"
  | "confetti"
  | "waves"
  | "dither"
  | "rings";

export const TILE_KINDS: readonly TileKind[] = [
  "checks", "dots", "stars", "plaid", "bricks", "hearts", "noise",
  "diagonal", "scanlines", "hatch", "grid", "confetti", "waves", "dither", "rings",
];

export interface TileColors {
  bg: Hsl;
  fg: Hsl;
  accent: Hsl;
}

interface Painter {
  size: number;
  paint(ctx: CanvasRenderingContext2D, size: number, c: TileColors, rng: Rng): void;
}

const PAINTERS: Record<TileKind, Painter> = {
  checks: {
    size: 32,
    paint(ctx, size, c) {
      const half = size / 2;
      ctx.fillStyle = toHex(c.fg);
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
    },
  },

  dots: {
    size: 24,
    paint(ctx, size, c) {
      ctx.fillStyle = toHex(c.fg);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 6, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  stars: {
    size: 48,
    paint(ctx, size, c, rng) {
      // Scattered rather than centred: a regular grid of stars reads as a
      // pattern, an irregular one reads as a night sky someone tiled badly.
      for (let i = 0; i < 5; i++) {
        const x = rng.range(2, size - 2);
        const y = rng.range(2, size - 2);
        const r = rng.range(0.8, 2.2);
        ctx.fillStyle = toHex(rng.chance(0.3) ? c.accent : c.fg);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  plaid: {
    size: 40,
    paint(ctx, size, c, rng) {
      const band = rng.int(4, 9);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = toHex(c.fg);
      ctx.fillRect(0, 0, size, band);
      ctx.fillRect(0, 0, band, size);
      ctx.fillStyle = toHex(c.accent);
      ctx.fillRect(0, size / 2, size, band / 2);
      ctx.fillRect(size / 2, 0, band / 2, size);
      ctx.globalAlpha = 1;
    },
  },

  bricks: {
    size: 32,
    paint(ctx, size, c) {
      const h = size / 2;
      ctx.strokeStyle = toHex(c.fg);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h + 0.5);
      ctx.lineTo(size, h + 0.5);
      ctx.moveTo(0, 0.5);
      ctx.lineTo(size, 0.5);
      ctx.moveTo(size / 2 + 0.5, 0);
      ctx.lineTo(size / 2 + 0.5, h);
      ctx.moveTo(0.5, h);
      ctx.lineTo(0.5, size);
      ctx.stroke();
    },
  },

  hearts: {
    size: 28,
    paint(ctx, size, c) {
      const s = size * 0.3;
      const cx = size / 2;
      const cy = size / 2;
      ctx.fillStyle = toHex(c.accent);
      ctx.beginPath();
      ctx.moveTo(cx, cy + s * 0.7);
      ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.4, cx - s * 0.4, cy - s * 1.2, cx, cy - s * 0.3);
      ctx.bezierCurveTo(cx + s * 0.4, cy - s * 1.2, cx + s * 1.4, cy - s * 0.4, cx, cy + s * 0.7);
      ctx.fill();
    },
  },

  noise: {
    size: 64,
    paint(ctx, size, c, rng) {
      const image = ctx.createImageData(size, size);
      const [br, bg, bb] = hexToBytes(toHex(c.bg));
      const [fr, fg, fb] = hexToBytes(toHex(c.fg));
      for (let i = 0; i < image.data.length; i += 4) {
        const t = rng.float() * 0.35;
        image.data[i] = br + (fr - br) * t;
        image.data[i + 1] = bg + (fg - bg) * t;
        image.data[i + 2] = bb + (fb - bb) * t;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
  },

  diagonal: {
    size: 16,
    paint(ctx, size, c, rng) {
      ctx.strokeStyle = toHex(c.fg);
      ctx.lineWidth = rng.range(1, 4);
      ctx.beginPath();
      // Three passes so the stripe wraps cleanly across the tile seam.
      ctx.moveTo(-size, size);
      ctx.lineTo(size, -size);
      ctx.moveTo(0, size * 2);
      ctx.lineTo(size * 2, 0);
      ctx.moveTo(-size * 2, 0);
      ctx.lineTo(0, -size * 2);
      ctx.stroke();
    },
  },

  scanlines: {
    size: 4,
    paint(ctx, size, c) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = toHex(c.fg);
      ctx.fillRect(0, 0, size, size / 2);
      ctx.globalAlpha = 1;
    },
  },

  hatch: {
    size: 12,
    paint(ctx, size, c) {
      ctx.strokeStyle = toHex(c.fg);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.stroke();
    },
  },

  grid: {
    size: 20,
    paint(ctx, size, c) {
      ctx.strokeStyle = toHex(c.fg);
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    },
  },

  confetti: {
    size: 44,
    paint(ctx, size, c, rng) {
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.translate(rng.range(0, size), rng.range(0, size));
        ctx.rotate(rng.range(0, Math.PI));
        ctx.fillStyle = toHex(rng.chance(0.5) ? c.accent : c.fg);
        ctx.fillRect(0, 0, rng.range(2, 6), rng.range(1, 3));
        ctx.restore();
      }
    },
  },

  waves: {
    size: 32,
    paint(ctx, size, c) {
      ctx.strokeStyle = toHex(c.fg);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= size; x++) {
        const y = size / 2 + Math.sin((x / size) * Math.PI * 2) * (size / 5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
  },

  dither: {
    size: 8,
    paint(ctx, size, c) {
      // Bayer-ish 50% checkerboard at 1px — the early-Mac greyscale trick.
      ctx.fillStyle = toHex(c.fg);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if ((x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
        }
      }
    },
  },

  rings: {
    size: 64,
    paint(ctx, size, c, rng) {
      // Subtle concentric rings for "light imagery" — old monitor rings,
      // watermarks, radar, coffee stains. Very low alpha so it sits behind
      // icons as atmosphere rather than competing with them.
      ctx.strokeStyle = toHex(rng.chance(0.35) ? c.accent : c.fg);
      ctx.lineWidth = rng.range(0.7, 1.4);
      ctx.globalAlpha = 0.16;

      const cx = size * (0.42 + rng.range(-0.05, 0.12));
      const cy = size * (0.38 + rng.range(-0.05, 0.12));

      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (size / 4.5) * i * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Occasional broken/offset ring for lived-in character
      if (rng.chance(0.45)) {
        ctx.globalAlpha = 0.10;
        ctx.beginPath();
        const ox = size - cx * 0.9;
        const oy = size - cy * 0.85;
        ctx.arc(ox, oy, size / 3.2, rng.range(0.2, 1.1), rng.range(4.8, 5.8));
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    },
  },
};

function hexToBytes(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Returns a CSS `url(...)` value, ready to drop into a background property.
 * Returns "none" if canvas is unavailable rather than throwing — a machine
 * with no wallpaper is still a machine.
 */
export function generateTile(
  rng: Rng,
  kind: TileKind,
  colors: TileColors,
): string {
  const painter = PAINTERS[kind];
  const canvas = document.createElement("canvas");
  canvas.width = painter.size;
  canvas.height = painter.size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "none";

  ctx.fillStyle = toHex(colors.bg);
  ctx.fillRect(0, 0, painter.size, painter.size);
  painter.paint(ctx, painter.size, colors, rng);

  return `url("${canvas.toDataURL("image/png")}")`;
}
