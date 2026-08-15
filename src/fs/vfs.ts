/**
 * In-memory virtual filesystem.
 *
 * Files carry a BusValue rather than a string, because the bus is the point:
 * a file is not "text that an app might parse", it is a typed value that some
 * apps can accept and others can't. Everything the player drags between
 * windows travels through here.
 */

import type { BusType, BusValue } from "../core/bus.ts";

export interface VFile {
  kind: "file";
  name: string;
  value: BusValue;
  created: number;
  /** System files the player can open but not clobber. */
  readonly: boolean;
}

export interface VDir {
  kind: "dir";
  name: string;
  children: Map<string, VNode>;
}

export type VNode = VFile | VDir;

export const SEP = "/";

/** "/a//b/../c/" -> ["a", "c"]. Absolute only; there is no cwd. */
export function splitPath(path: string): string[] {
  const parts: string[] = [];
  for (const raw of path.split(SEP)) {
    if (raw === "" || raw === ".") continue;
    if (raw === "..") parts.pop();
    else parts.push(raw);
  }
  return parts;
}

export function joinPath(...parts: string[]): string {
  return SEP + splitPath(parts.join(SEP)).join(SEP);
}

export function basename(path: string): string {
  return splitPath(path).at(-1) ?? "";
}

export function dirname(path: string): string {
  return SEP + splitPath(path).slice(0, -1).join(SEP);
}

export class Vfs {
  private readonly root: VDir = { kind: "dir", name: "", children: new Map() };
  private readonly listeners = new Set<() => void>();

  /**
   * Tell me when the disk changes.
   *
   * The desktop and every open Files window show the same disk, and anything on
   * the bus can write to it at any moment (see apps/filesapp.ts, which turns
   * arriving words into files). Without this each viewer has to be refreshed by
   * whoever happened to cause the write, which means a viewer nobody thought
   * about goes stale and silently lies about what is on the machine.
   *
   * Returns its own unsubscribe, so an owner releases exactly what it added.
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    // Copied first: a listener that re-renders may well subscribe or drop
    // another listener while this loop is running.
    for (const listener of [...this.listeners]) listener();
  }

  /** The node at `path`, or null. The root is a directory named "". */
  resolve(path: string): VNode | null {
    let node: VNode = this.root;
    for (const part of splitPath(path)) {
      if (node.kind !== "dir") return null;
      const next = node.children.get(part);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  exists(path: string): boolean {
    return this.resolve(path) !== null;
  }

  /** Creates every missing directory along `path`. Throws if a file is in the way. */
  mkdirp(path: string): VDir {
    let dir = this.root;
    let made = false;
    for (const part of splitPath(path)) {
      const existing = dir.children.get(part);
      if (existing) {
        if (existing.kind !== "dir") {
          throw new Error(`mkdirp: ${part} exists and is a file`);
        }
        dir = existing;
      } else {
        const created: VDir = { kind: "dir", name: part, children: new Map() };
        dir.children.set(part, created);
        dir = created;
        made = true;
      }
    }
    // Only when something was actually created, or every writeFile would fire a
    // second time for the directories it walked through.
    if (made) this.notify();
    return dir;
  }

  writeFile(
    path: string,
    value: BusValue,
    options: { readonly?: boolean } = {},
  ): VFile {
    const name = basename(path);
    if (!name) throw new Error("writeFile: path has no filename");

    const dir = this.mkdirp(dirname(path));
    const existing = dir.children.get(name);
    if (existing?.kind === "file" && existing.readonly) {
      throw new Error(`writeFile: ${path} is readonly`);
    }
    if (existing?.kind === "dir") {
      throw new Error(`writeFile: ${path} is a directory`);
    }

    const file: VFile = {
      kind: "file",
      name,
      value,
      created: existing?.kind === "file" ? existing.created : Date.now(),
      readonly: options.readonly ?? false,
    };
    dir.children.set(name, file);
    this.notify();
    return file;
  }

  readFile(path: string): VFile | null {
    const node = this.resolve(path);
    return node?.kind === "file" ? node : null;
  }

  /** Directory contents, dirs first then files, each alphabetical. */
  list(path: string): VNode[] {
    const node = this.resolve(path);
    if (node?.kind !== "dir") return [];
    return [...node.children.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  remove(path: string): boolean {
    const parts = splitPath(path);
    const name = parts.at(-1);
    if (!name) return false; // refuse to remove the root

    const parent = this.resolve(dirname(path));
    if (parent?.kind !== "dir") return false;

    const target = parent.children.get(name);
    if (!target) return false;
    // A readonly file is protected wherever it is, including inside a folder
    // being deleted whole. Checking only the top node let /var/log go, and the
    // readonly last-session file inside it with no complaint.
    if (holdsReadonly(target)) return false;

    const removed = parent.children.delete(name);
    if (removed) this.notify();
    return removed;
  }

  /**
   * Rename in place. Directories move with everything under them, because the
   * children hang off the node rather than off its path.
   *
   * Returns the reason it refused, or null when it worked. The caller is a menu
   * item that has to say why nothing happened, and a bare false cannot.
   */
  rename(path: string, next: string): string | null {
    const name = basename(path);
    if (!name) return "the root has no name";

    const clean = next.trim();
    if (!clean) return "a name cannot be empty";
    if (clean.includes(SEP)) return `a name cannot contain ${SEP}`;
    if (clean === name) return null;

    const parent = this.resolve(dirname(path));
    if (parent?.kind !== "dir") return "the parent is gone";

    const target = parent.children.get(name);
    if (!target) return "it is no longer there";
    if (target.kind === "file" && target.readonly) return `${name} is readonly`;
    if (parent.children.has(clean)) return `${clean} already exists`;

    parent.children.delete(name);
    target.name = clean;
    parent.children.set(clean, target);
    this.notify();
    return null;
  }

  /**
   * `base` if it is free, otherwise `base 2`, `base 3` and so on.
   *
   * New folders and notes are created before they are named, the way they are
   * everywhere else, so they need a name that is guaranteed not to collide.
   */
  uniqueName(dir: string, base: string, extension = ""): string {
    const node = this.resolve(dir);
    const taken = node?.kind === "dir" ? node.children : new Map<string, VNode>();
    if (!taken.has(`${base}${extension}`)) return `${base}${extension}`;
    for (let n = 2; ; n++) {
      const candidate = `${base} ${n}${extension}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /** Every file under `path`, depth-first, with its absolute path. */
  *walk(path = SEP): Generator<{ path: string; file: VFile }> {
    const node = this.resolve(path);
    if (!node) return;
    if (node.kind === "file") {
      yield { path, file: node };
      return;
    }
    for (const child of this.list(path)) {
      yield* this.walk(joinPath(path, child.name));
    }
  }
}

/** True if `node` is, or contains at any depth, a file the player may not clobber. */
function holdsReadonly(node: VNode): boolean {
  if (node.kind === "file") return node.readonly;
  for (const child of node.children.values()) {
    if (holdsReadonly(child)) return true;
  }
  return false;
}

/** Rough byte count, for display only. */
export function fileSize(file: VFile): number {
  const { type, data } = file.value;
  switch (type) {
    case "text":
      return data.length;
    case "numbers":
      return data.length * 8;
    case "samples":
      return data.byteLength;
    case "bytes":
      return data.byteLength;
    case "pixels":
      return data.data.byteLength;
    case "events":
      return data.length * 24;
    case "nodes":
      return (data.nodes.length + data.edges.length) * 32;
  }
}

export function fileType(file: VFile): BusType {
  return file.value.type;
}
