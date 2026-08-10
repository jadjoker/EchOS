/**
 * A single window.
 *
 * Knows nothing about the manager or about apps — it renders chrome, moves,
 * resizes, and reports intent through callbacks. Everything visual comes from
 * the token contract so the aesthetic generator can restyle it wholesale.
 */

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_EDGES: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** How much of a window must stay on screen. Enough to grab it back. */
const KEEP_VISIBLE = 64;

export interface WinConfig {
  id: string;
  title: string;
  body: HTMLElement;
  x: number;
  y: number;
  width: number;
  height: number;
  resizable: boolean;
  minWidth: number;
  minHeight: number;
}

export interface WinCallbacks {
  onFocusRequest(win: Win): void;
  onClose(win: Win): void;
  onMinimize(win: Win): void;
}

/**
 * Pointer capture keeps a gesture alive when the pointer leaves the element,
 * but it throws if the pointer is no longer active. Losing capture should
 * degrade the drag, not abort the handler that sets it up.
 */
function tryCapture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* gesture still works while the pointer stays over the element */
  }
}

function tryRelease(el: HTMLElement, pointerId: number): void {
  try {
    el.releasePointerCapture(pointerId);
  } catch {
    /* never captured, or already released */
  }
}

export class Win {
  readonly id: string;
  readonly el: HTMLElement;
  readonly bodyEl: HTMLElement;

  private readonly titleEl: HTMLElement;
  private readonly cb: WinCallbacks;
  private readonly config: WinConfig;

  private x: number;
  private y: number;
  private width: number;
  private height: number;

  private focused = false;
  private minimized = false;

  constructor(config: WinConfig, callbacks: WinCallbacks) {
    this.id = config.id;
    this.config = config;
    this.cb = callbacks;
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;

    this.el = document.createElement("div");
    this.el.className = "win";
    this.el.dataset["winId"] = config.id;

    const titlebar = document.createElement("div");
    titlebar.className = "win-titlebar";

    this.titleEl = document.createElement("span");
    this.titleEl.className = "win-title";
    this.titleEl.textContent = config.title;

    const controls = document.createElement("div");
    controls.className = "win-controls";
    controls.append(
      this.makeControl("minimize", "–", () => this.cb.onMinimize(this)),
      this.makeControl("close", "✕", () => this.cb.onClose(this)),
    );

    titlebar.append(this.titleEl, controls);

    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "win-body";
    this.bodyEl.append(config.body);

    this.el.append(titlebar, this.bodyEl);

    if (config.resizable) {
      for (const edge of RESIZE_EDGES) this.el.append(this.makeGrip(edge));
    }

    // Pointerdown rather than click: focus must land before the drag starts,
    // otherwise dragging a background window leaves it behind its neighbours.
    this.el.addEventListener("pointerdown", () => this.cb.onFocusRequest(this));
    this.attachDrag(titlebar);

    this.applyGeometry();
  }

  private makeControl(
    name: string,
    glyph: string,
    action: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `win-control win-control-${name}`;
    button.type = "button";
    button.textContent = glyph;
    button.setAttribute("aria-label", name);
    // Stop the titlebar drag from arming when a control is pressed.
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", action);
    return button;
  }

  private makeGrip(edge: ResizeEdge): HTMLElement {
    const grip = document.createElement("div");
    grip.className = `win-grip win-grip-${edge}`;
    this.attachResize(grip, edge);
    return grip;
  }

  private attachDrag(handle: HTMLElement): void {
    handle.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      tryCapture(handle, event.pointerId);

      const grabX = event.clientX - this.x;
      const grabY = event.clientY - this.y;
      this.el.classList.add("is-dragging");

      const onMove = (move: PointerEvent) => {
        this.setPosition(move.clientX - grabX, move.clientY - grabY);
      };
      const onUp = () => {
        tryRelease(handle, event.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        this.el.classList.remove("is-dragging");
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  private attachResize(grip: HTMLElement, edge: ResizeEdge): void {
    grip.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      tryCapture(grip, event.pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const start = { x: this.x, y: this.y, w: this.width, h: this.height };
      this.el.classList.add("is-resizing");

      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;

        let { x, y, w, h } = start;

        if (edge.includes("e")) w = start.w + dx;
        if (edge.includes("s")) h = start.h + dy;
        // Dragging a top/left edge moves the origin as well as the size, and
        // must stop moving it once the size clamps — otherwise the window
        // creeps while the far edge stays put.
        if (edge.includes("w")) {
          w = Math.max(this.config.minWidth, start.w - dx);
          x = start.x + (start.w - w);
        }
        if (edge.includes("n")) {
          h = Math.max(this.config.minHeight, start.h - dy);
          y = start.y + (start.h - h);
        }

        this.setSize(w, h);
        this.setPosition(x, y);
      };
      const onUp = () => {
        tryRelease(grip, event.pointerId);
        grip.removeEventListener("pointermove", onMove);
        grip.removeEventListener("pointerup", onUp);
        grip.removeEventListener("pointercancel", onUp);
        this.el.classList.remove("is-resizing");
      };

      grip.addEventListener("pointermove", onMove);
      grip.addEventListener("pointerup", onUp);
      grip.addEventListener("pointercancel", onUp);
    });
  }

  setPosition(x: number, y: number): void {
    // Never let a window be lost: the titlebar stays reachable on all sides.
    const maxX = window.innerWidth - KEEP_VISIBLE;
    const maxY = window.innerHeight - KEEP_VISIBLE;
    const minX = KEEP_VISIBLE - this.width;
    this.x = Math.min(maxX, Math.max(minX, x));
    this.y = Math.min(maxY, Math.max(0, y));
    this.applyGeometry();
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(this.config.minWidth, width);
    this.height = Math.max(this.config.minHeight, height);
    this.applyGeometry();
  }

  private applyGeometry(): void {
    this.el.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.y)}px)`;
    this.el.style.width = `${Math.round(this.width)}px`;
    this.el.style.height = `${Math.round(this.height)}px`;
  }

  setZ(z: number): void {
    this.el.style.zIndex = String(z);
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.el.classList.toggle("is-focused", focused);
  }

  isFocused(): boolean {
    return this.focused;
  }

  setMinimized(minimized: boolean): void {
    this.minimized = minimized;
    this.el.classList.toggle("is-minimized", minimized);
    this.el.setAttribute("aria-hidden", String(minimized));
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  get title(): string {
    return this.titleEl.textContent ?? "";
  }

  set title(value: string) {
    this.titleEl.textContent = value;
  }

  /** Pull a window back on screen after the viewport shrinks. */
  reclamp(): void {
    this.setPosition(this.x, this.y);
  }

  destroy(): void {
    this.el.remove();
  }
}
