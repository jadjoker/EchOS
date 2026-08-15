/**
 * Leaving the machine you are on.
 *
 * The URL *is* the machine, so everywhere that offers to leave one has to agree
 * on how a seed becomes an address — otherwise "New machine" means something
 * subtly different depending on where it was clicked. About is the only caller
 * today; this is shared rather than private because the next menu that offers
 * it must not reimplement it.
 *
 * Note the asymmetry with main.ts, which deliberately does NOT write the seed
 * back to the URL. Arriving at a machine is explicit; staying on one is not
 * automatic.
 */

import { randomSeed } from "../core/rng.ts";

/** The shareable address of a specific machine. */
export function machineUrl(seed: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  return url.toString();
}

/** Reload into a specific machine. */
export function bootInto(seed: string): void {
  window.location.href = machineUrl(seed);
}

export function newMachine(): void {
  bootInto(randomSeed());
}
