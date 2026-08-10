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
      }
    }
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
    if (target.kind === "file" && target.readonly) return false;

    return parent.children.delete(name);
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
