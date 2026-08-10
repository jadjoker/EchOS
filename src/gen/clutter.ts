/**
 * Desktop clutter — the files that were already on the machine.
 *
 * A machine with an empty disk reads as a demo. A machine with somebody's
 * half-finished work on it reads as recovered. This is thin on purpose: it is
 * here to give the filesystem and the bus something real to carry, not to tell
 * a story. Real content generation belongs with the template apps.
 */

import type { Rng } from "../core/rng.ts";
import type { MachineIdentity } from "./naming.ts";
import { Vfs } from "../fs/vfs.ts";

const NOTE_FRAGMENTS = [
  "ring back about the second batch",
  "do not run this while the transport is warm",
  "numbers from tuesday, unverified",
  "if it clicks twice, power down",
  "left column is the good one",
  "ask before deleting any of this",
  "copy of the copy — original is gone",
  "this worked once",
];

const FILE_STEMS = [
  "notes", "scratch", "batch", "log", "draft", "readings", "tally",
  "transcript", "sample", "index", "backup", "untitled",
];

export function populate(vfs: Vfs, rng: Rng, identity: MachineIdentity): void {
  const r = rng.derive("clutter");

  vfs.mkdirp("/desktop");
  vfs.mkdirp("/home");
  vfs.mkdirp("/apps");
  vfs.mkdirp("/var/log");

  vfs.writeFile(
    "/readme",
    {
      type: "text",
      data: [
        `${identity.osName} ${identity.osVersion}`,
        `${identity.vendor}, ${identity.year}`,
        "",
        `This machine is ${identity.hostname}.`,
        `It was assembled from seed ${identity.seed}.`,
        "",
        "Everything here is generated. Nothing here is the same twice.",
      ].join("\n"),
    },
    { readonly: true },
  );

  const noteCount = r.int(2, 5);
  const stems = r.sample(FILE_STEMS, noteCount);
  for (const stem of stems) {
    const where = r.pick(["/desktop", "/home"]);
    const suffix = r.chance(0.35) ? `-${r.int(2, 19)}` : "";

    if (r.chance(0.6)) {
      vfs.writeFile(`${where}/${stem}${suffix}.txt`, {
        type: "text",
        data: r.sample(NOTE_FRAGMENTS, r.int(1, 3)).join("\n"),
      });
    } else {
      const length = r.int(6, 24);
      vfs.writeFile(`${where}/${stem}${suffix}.num`, {
        type: "numbers",
        data: Array.from({ length }, () => Math.round(r.range(-50, 200) * 100) / 100),
      });
    }
  }

  vfs.writeFile(
    "/var/log/last-session",
    {
      type: "text",
      data: r.chance(0.5)
        ? "session ended normally"
        : "session did not end normally",
    },
    { readonly: true },
  );
}
