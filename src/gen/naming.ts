/**
 * Machine identity: who this computer thinks it is.
 *
 * Cheap, and it does a lot of work — the OS name is on the boot screen, the
 * taskbar and every screenshot. Deliberately avoids sci-fi gloss; these should
 * read like equipment that shipped, was used for years, and then stopped.
 */

import type { Rng, Seed } from "../core/rng.ts";

const VENDOR_HEADS = [
  "Cormorant", "Pallas", "Hessian", "Verdigris", "Kestrel", "Antimony",
  "Bellwether", "Ossian", "Grendel", "Farrow", "Ptarmigan", "Sable",
  "Quillon", "Marlinspike", "Halcyon", "Bittern",
];

const VENDOR_TAILS = [
  "Systems", "Instruments", "Dynamics", "Works", "Apparatus", "Electric",
  "Computation", "Industries", "& Sons", "Laboratories", "Telemetry",
];

const OS_HEADS = [
  "TALLOW", "MERIDIAN", "HOLLOWAY", "CINDER", "AUGUR", "PLINTH", "NACRE",
  "UMBRA", "VELLUM", "GANTRY", "LODESTAR", "MIDDEN", "SEXTANT", "WICK",
  "BRACKISH", "QUIETUS", "ANVIL", "ESTUARY",
];

const OS_SUFFIXES = ["OS", "DOS", "EXEC", "MONITOR", "SYSTEM", "WORKBENCH", ""];

export interface MachineIdentity {
  vendor: string;
  osName: string;
  osVersion: string;
  hostname: string;
  /** Fictional build year. Feeds boot text and file timestamps. */
  year: number;
  seed: Seed;
}

export function generateIdentity(rng: Rng): MachineIdentity {
  const r = rng.derive("identity");

  const vendor = `${r.pick(VENDOR_HEADS)} ${r.pick(VENDOR_TAILS)}`;
  const head = r.pick(OS_HEADS);
  const suffix = r.pick(OS_SUFFIXES);

  const osName = r.weighted([
    [suffix ? `${head} ${suffix}` : head, 3],
    [`${head}/${r.int(2, 9)}`, 2],
    [`${head}-${r.pick(["I", "II", "III", "IV", "IX", "X"])}`, 1],
  ]);

  const osVersion = `${r.int(1, 9)}.${r.int(0, 12)}${r.chance(0.4) ? `.${r.int(0, 40)}` : ""}`;

  // Seed word doubles as the hostname so the machine's name and its shareable
  // seed are visibly the same thing.
  const word = rng.seed.split("-")[1]?.toLowerCase() ?? "machine";
  const digits = rng.seed.split("-")[0] ?? "0000";
  const hostname = `${word}-${digits}`;

  return {
    vendor,
    osName,
    osVersion,
    hostname,
    year: r.int(1978, 2004),
    seed: rng.seed,
  };
}
