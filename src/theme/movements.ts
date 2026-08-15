/**
 * Aesthetic movements.
 *
 * A movement is NOT a theme. It is a set of weights and constraints on the
 * axes — a grammar. The generator picks a movement and then rolls inside it, so
 * two geocities machines differ from each other while both remaining
 * unmistakably geocities. Rolling the axes freely instead would produce mush:
 * variety without identity, which is the failure mode that makes procedural
 * aesthetics feel cheap.
 *
 * The amateur-web era is the loudest branch here, not the whole space. One
 * strong style every boot is the same joke by boot five.
 */

import type { TileKind } from "./texture.ts";

export type ColorScheme = "mono" | "analogous" | "complementary" | "triad" | "chaos";
export type Depth = "none" | "soft" | "hard" | "bevel";
export type Range = readonly [number, number];

export interface Movement {
  id: string;
  label: string;
  /** Relative likelihood of being rolled. */
  weight: number;

  palette: {
    mode: "light" | "dark" | "either";
    saturation: Range;
    scheme: readonly ColorScheme[];
    /** Quantise to the 216-colour palette — does more period work than hue choice. */
    webSafe: boolean;
    /** Chance the titlebar is a loud saturated block rather than a quiet one. */
    loudTitle: number;
  };

  type: {
    ui: readonly string[];
    display: readonly string[];
    mono: readonly string[];
    size: Range;
    transform: readonly ("none" | "uppercase")[];
    tracking: Range;
    strongWeight: readonly number[];
  };

  geometry: {
    radius: Range;
    borderWidth: Range;
    borderStyle: readonly string[];
    titlebar: Range;
    pad: Range;
  };

  depth: readonly Depth[];

  texture: {
    /** Empty means flat. */
    desktop: readonly TileKind[];
    surface: readonly TileKind[];
    titleChance: number;
  };

  /** Fast-transition duration range, ms. */
  motion: Range;
}

const F = {
  comic: `"Comic Sans MS", "Comic Neue", cursive`,
  impact: `Impact, "Haettenschweiler", sans-serif`,
  times: `"Times New Roman", Times, serif`,
  courier: `"Courier New", Courier, monospace`,
  arial: `Arial, Helvetica, sans-serif`,
  verdana: `Verdana, Geneva, sans-serif`,
  georgia: `Georgia, "Times New Roman", serif`,
  trebuchet: `"Trebuchet MS", Tahoma, sans-serif`,
  tahoma: `Tahoma, Verdana, sans-serif`,
  sans98: `"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif`,
  chicago: `Chicago, Charcoal, "Lucida Grande", sans-serif`,
  lucida: `"Lucida Console", "Lucida Sans Typewriter", monospace`,
  consolas: `ui-monospace, Consolas, "Cascadia Mono", monospace`,
  papyrus: `Papyrus, "Brush Script MT", fantasy`,
  brush: `"Brush Script MT", cursive`,
  system: `system-ui, "Segoe UI", sans-serif`,
  helvetica: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
} as const;

export const MOVEMENTS: readonly Movement[] = [
  {
    id: "geocities",
    label: "personal homepage",
    weight: 14,
    palette: {
      mode: "either",
      saturation: [55, 100],
      scheme: ["chaos", "complementary", "triad"],
      webSafe: true,
      loudTitle: 0.9,
    },
    type: {
      ui: [F.comic, F.times, F.arial, F.courier],
      display: [F.comic, F.impact, F.brush],
      mono: [F.courier],
      size: [12, 16],
      transform: ["none"],
      tracking: [0, 0.02],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 2],
      borderWidth: [1, 4],
      borderStyle: ["outset", "ridge", "groove", "double", "solid"],
      titlebar: [24, 32],
      pad: [6, 12],
    },
    depth: ["none", "hard"],
    texture: {
      desktop: ["stars", "checks", "hearts", "confetti", "plaid", "bricks", "rings"],
      surface: ["dots", "grid", "hearts"],
      titleChance: 0.35,
    },
    motion: [0, 90],
  },

  {
    id: "myspace",
    label: "profile layout",
    weight: 10,
    palette: {
      mode: "dark",
      saturation: [50, 95],
      scheme: ["complementary", "chaos"],
      webSafe: false,
      loudTitle: 0.7,
    },
    type: {
      ui: [F.verdana, F.tahoma, F.arial],
      display: [F.impact, F.comic],
      mono: [F.courier],
      size: [10, 12],
      transform: ["none", "uppercase"],
      tracking: [0, 0.06],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 4],
      borderWidth: [1, 3],
      borderStyle: ["solid", "dashed", "double"],
      titlebar: [22, 28],
      pad: [4, 10],
    },
    depth: ["none", "hard"],
    texture: {
      desktop: ["stars", "confetti", "noise", "hearts", "rings"],
      surface: ["noise", "scanlines"],
      titleChance: 0.4,
    },
    motion: [0, 120],
  },

  {
    id: "winamp",
    label: "skinned player",
    weight: 9,
    palette: {
      mode: "dark",
      saturation: [25, 80],
      scheme: ["analogous", "complementary"],
      webSafe: false,
      loudTitle: 0.5,
    },
    type: {
      ui: [F.sans98, F.tahoma],
      display: [F.sans98],
      mono: [F.lucida, F.consolas],
      size: [10, 12],
      transform: ["none", "uppercase"],
      tracking: [0, 0.04],
      strongWeight: [600, 700],
    },
    geometry: {
      radius: [0, 2],
      borderWidth: [1, 2],
      borderStyle: ["outset", "solid", "ridge"],
      titlebar: [18, 24],
      pad: [4, 8],
    },
    depth: ["bevel", "hard"],
    texture: {
      desktop: ["noise", "diagonal", "scanlines"],
      surface: ["noise", "scanlines"],
      titleChance: 0.6,
    },
    motion: [0, 60],
  },

  {
    id: "win31",
    label: "program manager",
    weight: 9,
    palette: {
      mode: "light",
      saturation: [0, 20],
      scheme: ["mono"],
      webSafe: true,
      loudTitle: 1,
    },
    type: {
      ui: [F.sans98],
      display: [F.sans98],
      mono: [F.courier, F.lucida],
      size: [12, 13],
      transform: ["none"],
      tracking: [0, 0],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [2, 2],
      borderStyle: ["outset"],
      titlebar: [20, 24],
      pad: [4, 8],
    },
    depth: ["bevel"],
    texture: { desktop: [], surface: [], titleChance: 0 },
    motion: [0, 0],
  },

  {
    id: "bbs",
    label: "bulletin board",
    weight: 8,
    palette: {
      mode: "dark",
      saturation: [60, 100],
      scheme: ["triad", "chaos"],
      webSafe: true,
      loudTitle: 0.8,
    },
    type: {
      ui: [F.consolas, F.lucida, F.courier],
      display: [F.consolas],
      mono: [F.consolas, F.courier],
      size: [12, 15],
      transform: ["uppercase"],
      tracking: [0, 0.08],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [0, 1],
      borderStyle: ["solid", "double"],
      titlebar: [20, 26],
      pad: [4, 10],
    },
    depth: ["none"],
    texture: {
      desktop: ["scanlines", "hatch", "grid"],
      surface: ["scanlines"],
      titleChance: 0.2,
    },
    motion: [0, 0],
  },

  {
    id: "mac1bit",
    label: "one-bit desktop",
    weight: 7,
    palette: {
      mode: "light",
      saturation: [0, 6],
      scheme: ["mono"],
      webSafe: false,
      loudTitle: 0.1,
    },
    type: {
      ui: [F.chicago, F.sans98],
      display: [F.chicago],
      mono: [F.courier],
      size: [12, 14],
      transform: ["none"],
      tracking: [0, 0.01],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 3],
      borderWidth: [1, 2],
      borderStyle: ["solid"],
      titlebar: [20, 24],
      pad: [6, 10],
    },
    depth: ["none", "hard"],
    texture: {
      desktop: ["dither", "hatch"],
      surface: [],
      titleChance: 0.7,
    },
    motion: [0, 0],
  },

  {
    id: "amiga",
    label: "workbench",
    weight: 6,
    palette: {
      mode: "either",
      saturation: [30, 90],
      scheme: ["complementary", "triad"],
      webSafe: true,
      loudTitle: 0.9,
    },
    type: {
      ui: [F.sans98, F.verdana],
      display: [F.impact, F.sans98],
      mono: [F.lucida],
      size: [12, 14],
      transform: ["none", "uppercase"],
      tracking: [0, 0.03],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [2, 3],
      borderStyle: ["outset", "ridge"],
      titlebar: [22, 28],
      pad: [6, 10],
    },
    depth: ["bevel", "hard"],
    texture: { desktop: ["dither", "checks"], surface: [], titleChance: 0.3 },
    motion: [0, 40],
  },

  {
    id: "swiss",
    label: "grid system",
    weight: 7,
    palette: {
      mode: "light",
      saturation: [0, 15],
      scheme: ["mono"],
      webSafe: false,
      loudTitle: 0.15,
    },
    type: {
      ui: [F.helvetica, F.arial],
      display: [F.helvetica],
      mono: [F.consolas],
      size: [13, 15],
      transform: ["none", "uppercase"],
      tracking: [0, 0.04],
      strongWeight: [600, 700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [0, 1],
      borderStyle: ["solid"],
      titlebar: [28, 36],
      pad: [12, 20],
    },
    depth: ["none"],
    texture: { desktop: [], surface: [], titleChance: 0 },
    motion: [120, 240],
  },

  {
    id: "brutalist",
    label: "raw concrete",
    weight: 6,
    palette: {
      mode: "either",
      saturation: [0, 100],
      scheme: ["mono", "complementary"],
      webSafe: false,
      loudTitle: 0.6,
    },
    type: {
      ui: [F.system, F.times, F.courier],
      display: [F.impact, F.times],
      mono: [F.courier],
      size: [13, 17],
      transform: ["none", "uppercase"],
      tracking: [0, 0.02],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [2, 6],
      borderStyle: ["solid"],
      titlebar: [30, 40],
      pad: [8, 16],
    },
    depth: ["none", "hard"],
    texture: { desktop: ["hatch", "grid"], surface: [], titleChance: 0.1 },
    motion: [0, 60],
  },

  {
    id: "corporate",
    label: "productivity suite",
    weight: 7,
    palette: {
      mode: "light",
      saturation: [8, 40],
      scheme: ["analogous", "mono"],
      webSafe: false,
      loudTitle: 0.5,
    },
    type: {
      ui: [F.tahoma, F.verdana, F.trebuchet],
      display: [F.trebuchet, F.georgia],
      mono: [F.consolas],
      size: [12, 13],
      transform: ["none"],
      tracking: [0, 0.01],
      strongWeight: [600],
    },
    geometry: {
      radius: [2, 5],
      borderWidth: [1, 1],
      borderStyle: ["solid"],
      titlebar: [24, 30],
      pad: [8, 12],
    },
    depth: ["soft", "bevel"],
    texture: { desktop: [], surface: [], titleChance: 0.1 },
    motion: [90, 200],
  },

  {
    id: "alien",
    label: "unfamiliar equipment",
    weight: 5,
    palette: {
      mode: "dark",
      saturation: [35, 90],
      scheme: ["triad", "chaos"],
      webSafe: false,
      loudTitle: 0.6,
    },
    type: {
      ui: [F.papyrus, F.georgia, F.consolas],
      display: [F.papyrus, F.impact],
      mono: [F.consolas],
      size: [12, 16],
      transform: ["none", "uppercase"],
      tracking: [0.02, 0.14],
      strongWeight: [400, 700],
    },
    geometry: {
      radius: [0, 14],
      borderWidth: [1, 3],
      borderStyle: ["solid", "double", "groove"],
      titlebar: [26, 38],
      pad: [8, 16],
    },
    depth: ["none", "soft"],
    texture: {
      desktop: ["waves", "noise", "confetti", "hatch"],
      surface: ["noise", "waves"],
      titleChance: 0.5,
    },
    motion: [140, 320],
  },

  {
    id: "organic",
    label: "wet interface",
    weight: 5,
    palette: {
      mode: "either",
      saturation: [30, 75],
      scheme: ["analogous"],
      webSafe: false,
      loudTitle: 0.4,
    },
    type: {
      ui: [F.georgia, F.trebuchet, F.system],
      display: [F.georgia, F.brush],
      mono: [F.consolas],
      size: [13, 16],
      transform: ["none"],
      tracking: [0, 0.02],
      strongWeight: [600],
    },
    geometry: {
      radius: [8, 22],
      borderWidth: [0, 2],
      borderStyle: ["solid"],
      titlebar: [28, 38],
      pad: [10, 18],
    },
    depth: ["soft"],
    texture: {
      desktop: ["waves", "noise", "dots"],
      surface: ["waves"],
      titleChance: 0.3,
    },
    motion: [180, 400],
  },

  {
    id: "terminal",
    label: "serial console",
    weight: 7,
    palette: {
      mode: "dark",
      saturation: [40, 100],
      scheme: ["mono"],
      webSafe: false,
      loudTitle: 0.2,
    },
    type: {
      ui: [F.consolas, F.lucida],
      display: [F.consolas],
      mono: [F.consolas],
      size: [13, 15],
      transform: ["none", "uppercase"],
      tracking: [0, 0.05],
      strongWeight: [700],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [1, 1],
      borderStyle: ["solid"],
      titlebar: [20, 26],
      pad: [6, 12],
    },
    depth: ["none"],
    texture: {
      desktop: ["scanlines", "noise"],
      surface: ["scanlines"],
      titleChance: 0.3,
    },
    motion: [0, 40],
  },

  {
    id: "blueprint",
    label: "technical drawing",
    weight: 5,
    palette: {
      mode: "dark",
      saturation: [30, 70],
      scheme: ["mono", "analogous"],
      webSafe: false,
      loudTitle: 0.2,
    },
    type: {
      ui: [F.consolas, F.arial],
      display: [F.consolas],
      mono: [F.consolas],
      size: [12, 14],
      transform: ["uppercase"],
      tracking: [0.03, 0.1],
      strongWeight: [400, 600],
    },
    geometry: {
      radius: [0, 0],
      borderWidth: [1, 1],
      borderStyle: ["solid", "dashed"],
      titlebar: [24, 30],
      pad: [8, 14],
    },
    depth: ["none"],
    texture: { desktop: ["grid", "hatch"], surface: ["grid"], titleChance: 0.4 },
    motion: [60, 160],
  },

  {
    id: "vapor",
    label: "mall atrium",
    weight: 5,
    palette: {
      mode: "either",
      saturation: [35, 85],
      scheme: ["complementary", "analogous"],
      webSafe: false,
      loudTitle: 0.7,
    },
    type: {
      ui: [F.times, F.verdana, F.impact],
      display: [F.impact, F.times],
      mono: [F.courier],
      size: [13, 17],
      transform: ["uppercase"],
      tracking: [0.06, 0.22],
      strongWeight: [400, 700],
    },
    geometry: {
      radius: [0, 6],
      borderWidth: [1, 2],
      borderStyle: ["solid", "double"],
      titlebar: [28, 36],
      pad: [10, 18],
    },
    depth: ["soft", "hard"],
    texture: {
      desktop: ["grid", "waves", "checks", "stars"],
      surface: ["scanlines"],
      titleChance: 0.5,
    },
    motion: [160, 360],
  },
];

export function movementById(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id);
}
