/**
 * "About this machine" — the one app that is always present.
 *
 * Two jobs. It is the fixed point that makes the variation legible: without a
 * constant, "totally different every boot" reads as "no identity". And it is
 * where seeds are copied and pasted, which is the sharing mechanic and
 * therefore load-bearing rather than a debug panel.
 */

import type { MachineIdentity } from "../gen/naming.ts";
import type { Theme } from "../theme/generate.ts";
import { normalizeSeed, randomSeed } from "../core/rng.ts";

function row(label: string, value: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "about-row";

  const key = document.createElement("span");
  key.className = "about-key";
  key.textContent = label;

  const val = document.createElement("span");
  val.className = "about-value";
  val.textContent = value;

  el.append(key, val);
  return el;
}

/** Reload into a specific machine. The seed lives in the URL so it is shareable. */
function bootInto(seed: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  window.location.href = url.toString();
}

export function createAbout(identity: MachineIdentity, theme: Theme): HTMLElement {
  const root = document.createElement("div");
  root.className = "about";

  const heading = document.createElement("div");
  heading.className = "about-heading";
  heading.textContent = identity.osName;

  const sub = document.createElement("div");
  sub.className = "about-sub";
  sub.textContent = `${identity.vendor} · ${identity.year}`;

  const info = document.createElement("div");
  info.className = "about-rows";
  info.append(
    row("version", identity.osVersion),
    row("host", identity.hostname),
    row("theme", theme.label),
    row("seed", identity.seed),
  );

  const seedInput = document.createElement("input");
  seedInput.className = "about-seed-input";
  seedInput.value = identity.seed;
  seedInput.spellcheck = false;
  seedInput.setAttribute("aria-label", "Seed");

  const actions = document.createElement("div");
  actions.className = "about-actions";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "about-button";
  copy.textContent = "Copy link";
  copy.addEventListener("click", async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", identity.seed);
    try {
      await navigator.clipboard.writeText(url.toString());
      copy.textContent = "Copied";
    } catch {
      // Clipboard is permission-gated and fails silently in some contexts;
      // fall back to showing the URL rather than pretending it worked.
      seedInput.value = url.toString();
      seedInput.select();
      copy.textContent = "Select + copy";
    }
    setTimeout(() => (copy.textContent = "Copy link"), 1600);
  });

  const boot = document.createElement("button");
  boot.type = "button";
  boot.className = "about-button";
  boot.textContent = "Boot seed";
  boot.addEventListener("click", () => {
    const seed = normalizeSeed(seedInput.value);
    if (!seed) {
      seedInput.classList.add("is-invalid");
      setTimeout(() => seedInput.classList.remove("is-invalid"), 900);
      return;
    }
    bootInto(seed);
  });

  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = "about-button about-button-primary";
  fresh.textContent = "New machine";
  fresh.addEventListener("click", () => bootInto(randomSeed()));

  // The heading above is the *machine's* generated OS name, which changes every
  // boot. This is the name of the thing you are actually running, and it is the
  // one piece of text on screen that is never generated.
  const brand = document.createElement("div");
  brand.className = "about-brand";
  brand.textContent = "EchOS";

  actions.append(copy, boot, fresh);
  root.append(heading, sub, info, seedInput, actions, brand);
  return root;
}
