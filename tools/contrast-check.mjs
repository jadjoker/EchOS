#!/usr/bin/env node
/**
 * Prove that no machine boots unreadable.
 *
 * The contrast floor is the one aesthetic rule that is not a matter of taste:
 * an unreadable machine is a refund, not charming authenticity. theme/color.ts
 * enforces it and theme/generate.ts applies it — but nothing reproduced the
 * check, so the README's "verified at 18,000 pairings" was folklore. A rule
 * with no harness is a rule that regresses silently the first time a token is
 * added.
 *
 * This drives the REAL generator over thousands of seeds and re-measures every
 * text-on-background pairing that ships. It deliberately does not reimplement
 * the palette maths: a second copy of the rule would agree with itself and
 * prove nothing.
 *
 * If you add a token that puts text on a background, add it to PAIRINGS below.
 * That is the whole maintenance burden, and it is the same instruction the
 * README gives.
 *
 * Usage:
 *   node tools/contrast-check.mjs               # 3000 seeds
 *   node tools/contrast-check.mjs --n 20000
 *   node tools/contrast-check.mjs --verbose     # list every failure
 *
 * Exits non-zero if anything is below its floor, so it can gate a build.
 */

import { Rng, randomSeed } from "../src/core/rng.ts";
import { CONTRAST, contrast, rgbToHsl } from "../src/theme/color.ts";
import { generateTheme } from "../src/theme/generate.ts";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

const COUNT = flag("n", 3000);
const VERBOSE = args.includes("--verbose");

/**
 * Every pairing where the machine puts text on a background.
 *
 * The tier matters as much as the pair. Body text is read for minutes and gets
 * 4.5; chrome is short and known and gets 3.2; muted metadata gets 2.6, low but
 * never invisible. Holding decorative text to the body floor would sand the
 * character off, which is the failure mode on the other side of this.
 */
const PAIRINGS = [
  // Window surfaces. Ink is read against both the surface and the field behind
  // file lists, so it has to clear both — one of these is easy to forget.
  ["--c-ink", "--c-surface", CONTRAST.body, "body text on a window"],
  ["--c-ink", "--c-field", CONTRAST.body, "body text on a field"],
  ["--c-ink-muted", "--c-surface", CONTRAST.muted, "metadata on a window"],
  ["--c-ink-muted", "--c-field", CONTRAST.muted, "metadata on a field"],

  // Chrome.
  ["--c-title-ink", "--c-title", CONTRAST.chrome, "focused titlebar"],
  ["--c-title-ink-blur", "--c-title-blur", CONTRAST.muted, "unfocused titlebar"],
  ["--c-accent-ink", "--c-accent", CONTRAST.chrome, "accent button"],

  // The boot screen, which runs before the desktop palette exists and so has
  // its own slots. A machine that halts unreadably has failed before it began.
  ["--c-boot-ink", "--c-boot-bg", CONTRAST.body, "boot log"],
  ["--c-boot-ok", "--c-boot-bg", CONTRAST.chrome, "boot ok line"],
  ["--c-boot-warn", "--c-boot-bg", CONTRAST.chrome, "boot warn line"],
  ["--c-boot-fail", "--c-boot-bg", CONTRAST.chrome, "boot fail line"],
  ["--c-boot-dim", "--c-boot-bg", CONTRAST.muted, "boot dim line"],

  // Anything highlighted under the cursor inverts to the accent: a selected file
  // row, a hovered menu item, a focused taskbar button. Held to the chrome floor
  // rather than the body floor, because all three are short labels you are
  // pointing at, and raising them to 4.5 would force the accent lighter on every
  // machine — sanding the character off to fix a problem nobody has. Listed
  // separately from "accent button" because style.css puts filenames here, and a
  // selected filename you cannot read is a selection you cannot use.
  ["--c-accent-ink", "--c-accent", CONTRAST.chrome, "selected row / menu item"],
];

/** "#aabbcc" -> Hsl, via the same conversion the app uses. */
function parse(hex) {
  return rgbToHsl(
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  );
}

/**
 * The smallest possible stand-in for a browser.
 *
 * theme/texture.ts paints its tiles on a real canvas, and this check has no DOM.
 * Rather than fake one, the stub hands back a canvas whose 2D context is null —
 * which is the "canvas is unavailable" path generateTile already documents and
 * already handles, by returning "none". Textures are backgrounds behind text,
 * not text, so dropping them changes nothing this check measures, and every
 * colour token still comes from the real generator untouched.
 */
globalThis.document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
};

const failures = [];
const worst = new Map();
const movements = new Map();
let checked = 0;

for (let i = 0; i < COUNT; i++) {
  const seed = randomSeed();
  const theme = generateTheme(Rng.fromSeed(seed));
  movements.set(theme.id, (movements.get(theme.id) ?? 0) + 1);

  for (const [fgName, bgName, floor, what] of PAIRINGS) {
    const fg = theme.tokens[fgName];
    const bg = theme.tokens[bgName];
    // A missing token is a failure in itself: it means the generator stopped
    // emitting something this check believes ships.
    if (!fg || !bg) {
      failures.push({ seed, what, ratio: 0, floor, note: `missing ${!fg ? fgName : bgName}` });
      continue;
    }

    const ratio = contrast(parse(fg), parse(bg));
    checked++;

    const seen = worst.get(what);
    if (!seen || ratio < seen.ratio) worst.set(what, { ratio, floor, seed, movement: theme.id });

    // Rounded to two places before comparing. The floor is validated in HSL
    // floats but shipped as 8-bit hex, and a pairing landing 0.001 under after
    // quantising is not the unreadability this guards against.
    if (Math.round(ratio * 100) / 100 < floor) {
      failures.push({ seed, what, ratio, floor, movement: theme.id });
    }
  }
}

console.log(`\n  ${COUNT} machines, ${checked} pairings\n`);
console.log(`  movements seen           ${movements.size}`);
console.log(`  failures                 ${failures.length}`);

console.log(`\n  tightest margin per pairing`);
const byMargin = [...worst.entries()]
  .sort((a, b) => (a[1].ratio - a[1].floor) - (b[1].ratio - b[1].floor));
for (const [what, { ratio, floor, movement }] of byMargin) {
  const margin = ratio - floor;
  const mark = margin < 0 ? "FAIL" : margin < 0.1 ? "tight" : "ok";
  console.log(
    `    ${ratio.toFixed(2).padStart(6)} / ${floor.toFixed(2)}` +
    `  ${mark.padEnd(6)} ${what.padEnd(24)} ${movement}`,
  );
}

if (failures.length) {
  console.log(`\n  FAILURES`);
  const show = VERBOSE ? failures : failures.slice(0, 20);
  for (const f of show) {
    console.log(
      `    ${f.seed.padEnd(14)} ${f.what.padEnd(24)} ` +
      `${f.ratio.toFixed(2)} < ${f.floor}${f.note ? `  (${f.note})` : ""}`,
    );
  }
  if (!VERBOSE && failures.length > show.length) {
    console.log(`    ... and ${failures.length - show.length} more (--verbose for all)`);
  }
  console.log(`\n  A machine that cannot be read is a refund. Fix the floor in`);
  console.log(`  theme/generate.ts, not the number in this file.\n`);
  process.exit(1);
}

console.log(`\n  Every pairing clears its floor.\n`);
