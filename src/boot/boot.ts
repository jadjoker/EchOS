/**
 * The boot sequence.
 *
 * Eight seconds of generated POST text before the desktop exists. It is the
 * first thing anyone screenshots and it carries most of the machine's tone
 * before a single window opens, so it is worth more than its line count
 * suggests.
 *
 * Always skippable. On the fortieth boot this is furniture, and furniture you
 * cannot skip becomes a reason to stop launching the game.
 */

import type { Rng } from "../core/rng.ts";
import type { MachineIdentity } from "../gen/naming.ts";

interface BootLine {
  text: string;
  /** Pause *after* this line, in ms. */
  pause: number;
  tone?: "ok" | "warn" | "fail" | "dim";
}

const DEVICE_NOUNS = [
  "cassette transport", "thermal printer", "light pen", "acoustic coupler",
  "plotter bed", "tape streamer", "graphics tablet", "paper tape reader",
  "modem", "trackball", "colour card", "sound module", "clock crystal",
  "coprocessor", "expansion cage", "serial multiplexer",
];

const MOUNT_POINTS = ["/", "/home", "/apps", "/var", "/mnt/store"];

const ODDITIES = [
  "checksum differs from label; continuing",
  "clock is ahead of last shutdown",
  "one sector marked bad and remapped",
  "unrecognised card in slot 3",
  "battery low; time may be wrong",
  "previous session did not close cleanly",
  "thermal sensor reads implausible value",
  "found files not listed in the index",
];

function generateLines(rng: Rng, id: MachineIdentity): BootLine[] {
  const r = rng.derive("boot");
  const lines: BootLine[] = [];

  lines.push({ text: `${id.vendor}`, pause: 340, tone: "dim" });
  lines.push({
    text: `${id.osName} ${id.osVersion}  (c) ${id.year}`,
    pause: 620,
  });
  lines.push({ text: "", pause: 180 });

  const memory = r.int(2, 96) * 64;
  lines.push({ text: `Memory test ....... ${memory}K OK`, pause: 260, tone: "ok" });
  lines.push({
    text: `Processor ......... ${r.pick(["8-bit", "16-bit", "32-bit"])} @ ${r.int(1, 48)}MHz`,
    pause: 220,
  });

  for (const device of r.sample(DEVICE_NOUNS, r.int(3, 5))) {
    const present = r.chance(0.72);
    lines.push({
      text: `${device.padEnd(24, ".")} ${present ? "present" : "absent"}`,
      pause: r.int(90, 240),
      tone: present ? "ok" : "dim",
    });
  }

  lines.push({ text: "", pause: 160 });

  for (const mount of r.sample(MOUNT_POINTS, r.int(2, 4))) {
    lines.push({ text: `mounting ${mount}`, pause: r.int(110, 260), tone: "ok" });
  }

  // A machine that boots perfectly every time reads as sterile. Malfunction is
  // the texture here, so most boots carry at least one complaint.
  if (r.chance(0.75)) {
    lines.push({ text: "", pause: 200 });
    for (const oddity of r.sample(ODDITIES, r.int(1, 2))) {
      lines.push({ text: `warning: ${oddity}`, pause: r.int(400, 900), tone: "warn" });
    }
  }

  lines.push({ text: "", pause: 240 });
  lines.push({ text: `host ${id.hostname}`, pause: 200, tone: "dim" });
  lines.push({ text: `seed ${id.seed}`, pause: 900, tone: "dim" });
  lines.push({ text: "", pause: 120 });
  lines.push({ text: "starting desktop", pause: 700, tone: "ok" });

  return lines;
}

export async function runBoot(
  screen: HTMLElement,
  rng: Rng,
  identity: MachineIdentity,
): Promise<void> {
  const overlay = document.createElement("div");
  overlay.className = "boot";

  const log = document.createElement("pre");
  log.className = "boot-log";

  const hint = document.createElement("div");
  hint.className = "boot-hint";
  hint.textContent = "press any key to skip";

  overlay.append(log, hint);
  screen.append(overlay);

  let skipped = false;
  // Held so a skip can cut short a pause that is already running. Checking the
  // flag only at the top of wait() would make skip lag by up to a second on the
  // long dramatic pauses, which is exactly where people reach for it.
  let cancelPending: (() => void) | null = null;

  const skip = () => {
    skipped = true;
    cancelPending?.();
  };
  window.addEventListener("keydown", skip);
  overlay.addEventListener("pointerdown", skip);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      if (skipped) {
        resolve();
        return;
      }
      const finish = () => {
        clearTimeout(timer);
        cancelPending = null;
        resolve();
      };
      const timer = setTimeout(finish, ms);
      cancelPending = finish;
    });

  for (const line of generateLines(rng, identity)) {
    const el = document.createElement("div");
    el.className = "boot-line";
    if (line.tone) el.dataset["tone"] = line.tone;
    // Non-breaking space keeps blank lines from collapsing to zero height.
    el.textContent = line.text || " ";
    log.append(el);
    log.scrollTop = log.scrollHeight;
    await wait(line.pause);
  }

  window.removeEventListener("keydown", skip);

  // Wait on the transition itself rather than a hardcoded duration: the fade
  // length is a token the aesthetic generator owns, and it is 0ms under
  // reduced-motion. A fallback timer covers the case where no transition runs
  // at all, since transitionend would never fire.
  overlay.classList.add("is-leaving");
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(fallback);
      overlay.removeEventListener("transitionend", done);
      resolve();
    };
    const fallback = setTimeout(done, 600);
    overlay.addEventListener("transitionend", done);
  });
  overlay.remove();
}
