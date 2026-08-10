/**
 * The composition surface.
 *
 * Owns the graph, the window manager, the port handles and the cables. The
 * window manager only knows about rectangles and programs only know about
 * influence; this layer is the sole place that knows both.
 *
 * Every program gets exactly one input and one output, and anything may be
 * connected to anything. Type-checking connections would be tidier and much
 * less fun — a refused cable teaches you nothing, whereas a cable that does
 * something unexpected is the entire point of the machine.
 */

import { Graph } from "./core/graph.ts";
import { describeInfluence } from "./core/influence.ts";
import type { Economy } from "./core/economy.ts";
import type { Rng } from "./core/rng.ts";
import type { Vfs } from "./fs/vfs.ts";
import type { AppDef } from "./apps/types.ts";
import type { WindowManager } from "./wm/manager.ts";
import type { Win } from "./wm/window.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

interface Placement { x?: number; y?: number }

export class Workspace {
  readonly graph = new Graph();

  private readonly svg: SVGSVGElement;
  private readonly cableGroup: SVGGElement;
  private readonly draftCable: SVGPathElement;
  private readonly ports = new Map<string, HTMLElement>();
  private readonly openApps = new Map<string, string>();

  private frame = 0;
  private dragFrom: string | null = null;
  private dragPoint = { x: 0, y: 0 };
  private instances = 0;

  constructor(
    screen: HTMLElement,
    private readonly wm: WindowManager,
    private readonly rng: Rng,
    private readonly vfs: Vfs,
    private readonly economy: Economy,
  ) {
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "cable-layer");
    this.cableGroup = document.createElementNS(SVG_NS, "g");
    this.draftCable = document.createElementNS(SVG_NS, "path");
    this.draftCable.setAttribute("class", "cable cable-draft");
    this.svg.append(this.cableGroup, this.draftCable);
    screen.append(this.svg);

    this.graph.onChange(() => this.redraw());
    // Windows move without announcing it, so cables are redrawn from live DOM
    // positions each frame. Cheap at this cable count and never desynchronises.
    const loop = () => { this.redraw(); this.frame = requestAnimationFrame(loop); };
    this.frame = requestAnimationFrame(loop);
  }

  /** True if this program already has a window open. */
  isOpen(defId: string): boolean {
    return this.openApps.has(defId);
  }

  focusExisting(defId: string): boolean {
    const nodeId = this.openApps.get(defId);
    if (!nodeId) return false;
    const win = this.wm.all().find((w) => w.el.dataset["node"] === nodeId);
    if (!win) return false;
    this.wm.focus(win);
    return true;
  }

  openApp(def: AppDef, placement: Placement = {}): string {
    if (this.focusExisting(def.id)) return this.openApps.get(def.id) ?? "";

    const id = `${def.id}-${++this.instances}`;
    const instance = def.create({
      id,
      title: def.title,
      rng: this.rng.derive(`app:${def.id}`),
      vfs: this.vfs,
      changed: () => this.graph.touch(),
      incoming: () => this.graph.incoming(id),
      openWindow: (spec) => {
        const child = this.wm.open({
          title: spec.title,
          body: spec.body,
          ...(spec.width !== undefined ? { width: spec.width } : {}),
          ...(spec.height !== undefined ? { height: spec.height } : {}),
          ...(spec.resizable !== undefined ? { resizable: spec.resizable } : {}),
          ...(spec.onClose ? { onClose: spec.onClose } : {}),
        });
        return { close: () => this.wm.close(child) };
      },
      nudge: (kind) => this.economy.nudge(kind),
    });

    this.graph.add(instance.node);
    this.openApps.set(def.id, id);

    const win = this.wm.open({
      title: def.title,
      body: instance.body,
      width: def.width,
      height: def.height,
      ...(def.minWidth !== undefined ? { minWidth: def.minWidth } : {}),
      ...(def.minHeight !== undefined ? { minHeight: def.minHeight } : {}),
      ...(placement.x !== undefined ? { x: placement.x } : {}),
      ...(placement.y !== undefined ? { y: placement.y } : {}),
      onClose: () => {
        instance.dispose();
        this.graph.remove(id);
        this.openApps.delete(def.id);
        this.ports.delete(`${id}:in`);
        this.ports.delete(`${id}:out`);
      },
    });

    win.el.dataset["node"] = id;
    this.attachPort(win, id, "in");
    this.attachPort(win, id, "out");
    this.economy.nudge("window");
    return id;
  }

  private attachPort(win: Win, nodeId: string, direction: "in" | "out"): void {
    const el = document.createElement("div");
    el.className = `port port-${direction}`;
    el.dataset["node"] = nodeId;
    el.title = direction === "out"
      ? "Drag to another program to influence it"
      : "Influences arrive here";

    if (direction === "out") this.armDrag(el, nodeId);

    win.el.append(el);
    this.ports.set(`${nodeId}:${direction}`, el);
  }

  private armDrag(el: HTMLElement, from: string): void {
    el.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation(); // don't start a window drag

      this.dragFrom = from;
      this.dragPoint = { x: event.clientX, y: event.clientY };
      document.body.classList.add("is-patching");

      const onMove = (m: PointerEvent) => { this.dragPoint = { x: m.clientX, y: m.clientY }; };
      const onUp = (up: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.classList.remove("is-patching");

        // Hit-test on release: the port is a small target and the pointer may
        // never have entered it cleanly.
        const target = document
          .elementFromPoint(up.clientX, up.clientY)
          ?.closest<HTMLElement>(".port-in");
        this.dragFrom = null;
        if (!target) return;

        const to = target.dataset["node"] ?? "";
        const reason = this.graph.rejectReason(from, to);
        if (reason) {
          target.classList.add("is-reject");
          target.title = reason;
          setTimeout(() => target.classList.remove("is-reject"), 700);
        } else {
          this.graph.connect(from, to);
          this.economy.nudge("connect");
          target.classList.add("is-flash");
          setTimeout(() => target.classList.remove("is-flash"), 500);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  private centre(key: string): { x: number; y: number } | null {
    const el = this.ports.get(key);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const host = this.svg.getBoundingClientRect();
    if (rect.width === 0) return null; // minimised
    return {
      x: rect.left + rect.width / 2 - host.left,
      y: rect.top + rect.height / 2 - host.top,
    };
  }

  private redraw(): void {
    this.cableGroup.replaceChildren();

    for (const conn of this.graph.all()) {
      const a = this.centre(`${conn.from}:out`);
      const b = this.centre(`${conn.to}:in`);
      if (!a || !b) continue;

      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "cable");
      path.setAttribute("d", cablePath(a, b));
      path.addEventListener("click", () => this.graph.disconnect(conn.id));

      const title = document.createElementNS(SVG_NS, "title");
      const flowing = this.graph.node(conn.from)?.emit();
      title.textContent = flowing
        ? `${describeInfluence(flowing)} — click to disconnect`
        : "click to disconnect";
      path.append(title);
      this.cableGroup.append(path);
    }

    if (this.dragFrom) {
      const a = this.centre(`${this.dragFrom}:out`);
      const host = this.svg.getBoundingClientRect();
      if (a) {
        const b = { x: this.dragPoint.x - host.left, y: this.dragPoint.y - host.top };
        this.draftCable.setAttribute("d", cablePath(a, b));
        this.draftCable.style.display = "";
      }
    } else {
      this.draftCable.style.display = "none";
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.graph.dispose();
  }
}

/** Horizontal-tangent bezier, so cables leave and arrive like patch leads. */
function cablePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const slack = Math.max(30, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + slack} ${a.y}, ${b.x - slack} ${b.y}, ${b.x} ${b.y}`;
}
