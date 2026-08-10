/**
 * What a program is.
 *
 * A program knows nothing about windows, cables or other programs. It says what
 * it radiates and reacts to what arrives. That is the whole contract, and it is
 * what lets any program be plugged into any other without either of them having
 * been written with the other in mind.
 */

import type { InfluenceNode } from "../core/graph.ts";
import type { Influence } from "../core/influence.ts";
import type { Rng } from "../core/rng.ts";
import type { Vfs } from "../fs/vfs.ts";

export interface ChildWindowSpec {
  title: string;
  body: HTMLElement;
  width?: number;
  height?: number;
  resizable?: boolean;
  onClose?: () => void;
}

export interface ChildWindow {
  close(): void;
}

export interface AppContext {
  id: string;
  title: string;
  rng: Rng;
  vfs: Vfs;
  /** Announce that this program's emission has structurally changed. */
  changed(): void;
  /** Merged influence currently arriving. Cheap — safe to poll per frame. */
  incoming(): Influence;
  /**
   * Open a plain window that is not a program — an inspector, a detail panel.
   *
   * A child window has no ports and no presence on the bus. This keeps apps
   * ignorant of the window manager while still letting them do the thing every
   * real OS does: click a thing, get a window about that thing.
   */
  openWindow(spec: ChildWindowSpec): ChildWindow;
}

export interface AppInstance {
  node: InfluenceNode;
  body: HTMLElement;
  dispose(): void;
}

export interface AppDef {
  id: string;
  title: string;
  /** Single character shown on the desktop icon until icons are generated. */
  glyph: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  create(ctx: AppContext): AppInstance;
}
