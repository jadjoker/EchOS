/**
 * The connection graph.
 *
 * Recompute-on-change rather than push-propagation. When anything moves, every
 * node's inputs are re-merged from scratch and handed over. That is slightly
 * wasteful at this scale and buys two things worth far more: many-to-one
 * connections compose correctly (three programs feeding the browser stack
 * instead of the last one winning), and cycles are trivially safe because the
 * whole thing is a bounded number of passes rather than an unbounded chain.
 */

import {
  emptyInfluence,
  mergeInfluences,
  type Influence,
} from "./influence.ts";

export interface InfluenceNode {
  readonly id: string;
  readonly title: string;
  /**
   * What this program currently radiates.
   *
   * Called often. Keep it cheap, and keep fast-changing data in `rhythm` —
   * the signature that decides whether receivers get re-notified deliberately
   * ignores rhythm, so a program that animates does not force its neighbours
   * to rebuild sixty times a second.
   */
  emit(): Influence;
  /** Called when the merged upstream influence *structurally* changes. */
  absorb(influence: Influence): void;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
}

/** Passes per recompute. Enough for feedback to travel and settle, not loop. */
const PASSES = 2;

/**
 * Structural identity of an influence.
 *
 * Excludes `rhythm` on purpose: it changes every frame and nothing that reads
 * it needs to be told. Receivers pull rhythm live via `incoming()`.
 */
function signature(influence: Influence): string {
  const scalars = Object.entries(influence.scalars)
    .map(([k, v]) => `${k}:${v.toFixed(1)}`)
    .sort()
    .join(",");
  return [
    influence.sources.join("|"),
    influence.agents.map((a) => `${a.kind}${a.label}${Math.round(a.hue)}`).join("|"),
    influence.words.join("|"),
    influence.palette.map(Math.round).join("|"),
    scalars,
  ].join("::");
}

export class Graph {
  private readonly nodes = new Map<string, InfluenceNode>();
  private readonly connections: Connection[] = [];
  private readonly delivered = new Map<string, string>();
  private readonly merged = new Map<string, Influence>();
  private readonly listeners = new Set<() => void>();

  private nextId = 1;
  private recomputing = false;
  private scheduled = 0;

  add(node: InfluenceNode): void {
    this.nodes.set(node.id, node);
    this.touch();
  }

  remove(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.delivered.delete(nodeId);
    this.merged.delete(nodeId);
    for (const conn of [...this.connections]) {
      if (conn.from === nodeId || conn.to === nodeId) this.disconnect(conn.id, true);
    }
    this.touch();
    this.changed();
  }

  node(id: string): InfluenceNode | undefined {
    return this.nodes.get(id);
  }

  /** Why a connection is refused, or null if allowed. */
  rejectReason(from: string, to: string): string | null {
    if (from === to) return "a program cannot feed itself";
    if (!this.nodes.has(from) || !this.nodes.has(to)) return "no such program";
    if (this.connections.some((c) => c.from === from && c.to === to)) {
      return "already connected";
    }
    return null;
  }

  connect(from: string, to: string): Connection | null {
    if (this.rejectReason(from, to)) return null;
    const conn: Connection = { id: `c${this.nextId++}`, from, to };
    this.connections.push(conn);
    this.touch();
    this.changed();
    return conn;
  }

  disconnect(id: string, quiet = false): void {
    const index = this.connections.findIndex((c) => c.id === id);
    if (index === -1) return;
    this.connections.splice(index, 1);
    this.touch();
    if (!quiet) this.changed();
  }

  all(): readonly Connection[] {
    return this.connections;
  }

  /** The merged influence currently arriving at a node. Safe to poll. */
  incoming(nodeId: string): Influence {
    return this.merged.get(nodeId) ?? emptyInfluence();
  }

  /** Ask for a recompute. Coalesced to one per frame. */
  touch(): void {
    if (this.scheduled) return;
    this.scheduled = requestAnimationFrame(() => {
      this.scheduled = 0;
      this.recompute();
    });
  }

  private recompute(): void {
    if (this.recomputing) return;
    this.recomputing = true;
    try {
      for (let pass = 0; pass < PASSES; pass++) {
        for (const node of this.nodes.values()) {
          const upstream = this.connections
            .filter((c) => c.to === node.id)
            .map((c) => this.nodes.get(c.from)?.emit())
            .filter((v): v is Influence => v !== undefined);

          const merged = mergeInfluences(upstream);
          this.merged.set(node.id, merged);

          // Only notify on structural change, or an animating neighbour would
          // rebuild this program's contents every frame.
          const sig = signature(merged);
          if (this.delivered.get(node.id) !== sig) {
            this.delivered.set(node.id, sig);
            node.absorb(merged);
          }
        }
      }
    } finally {
      this.recomputing = false;
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    if (this.scheduled) cancelAnimationFrame(this.scheduled);
  }
}
