/**
 * Window manager: z-order, focus, cascade placement, and the taskbar.
 *
 * The taskbar exists because minimise without it is a way to lose a window
 * permanently. It is deliberately thin — this is substrate, not a feature.
 */

import { Win, type WinConfig } from "./window.ts";

export interface OpenSpec {
  title: string;
  body: HTMLElement;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Fired after the window is destroyed, so owners can release timers. */
  onClose?: () => void;
}

const DEFAULTS = {
  width: 420,
  height: 300,
  resizable: true,
  minWidth: 180,
  minHeight: 120,
} as const;

const CASCADE_STEP = 26;
const CASCADE_WRAP = 8;
const BASE_Z = 10;

export class WindowManager {
  private readonly layer: HTMLElement;
  private readonly taskbar: HTMLElement;
  private readonly taskbarItems: HTMLElement;
  private readonly taskbarTray: HTMLElement;
  private readonly windows: Win[] = [];
  private readonly closeHooks = new Map<string, () => void>();

  private nextId = 1;
  private opened = 0;
  private topZ = BASE_Z;

  constructor(screen: HTMLElement) {
    this.layer = document.createElement("div");
    this.layer.className = "window-layer";

    this.taskbar = document.createElement("div");
    this.taskbar.className = "taskbar";

    // The window list is rebuilt wholesale on every change, so anything else
    // living in the taskbar needs its own region or it gets wiped.
    this.taskbarItems = document.createElement("div");
    this.taskbarItems.className = "taskbar-items";
    this.taskbarTray = document.createElement("div");
    this.taskbarTray.className = "taskbar-tray";
    this.taskbar.append(this.taskbarItems, this.taskbarTray);

    screen.append(this.layer, this.taskbar);

    window.addEventListener("resize", () => {
      for (const win of this.windows) win.reclamp();
    });
  }

  open(spec: OpenSpec): Win {
    const width = spec.width ?? DEFAULTS.width;
    const height = spec.height ?? DEFAULTS.height;
    const placed = this.cascadePosition(width, height);

    const config: WinConfig = {
      id: `win-${this.nextId++}`,
      title: spec.title,
      body: spec.body,
      x: spec.x ?? placed.x,
      y: spec.y ?? placed.y,
      width,
      height,
      resizable: spec.resizable ?? DEFAULTS.resizable,
      minWidth: spec.minWidth ?? DEFAULTS.minWidth,
      minHeight: spec.minHeight ?? DEFAULTS.minHeight,
    };

    const win = new Win(config, {
      onFocusRequest: (w) => this.focus(w),
      onClose: (w) => this.close(w),
      onMinimize: (w) => this.setMinimized(w, true),
    });

    if (spec.onClose) this.closeHooks.set(win.id, spec.onClose);

    this.windows.push(win);
    this.layer.append(win.el);
    this.focus(win);
    this.renderTaskbar();
    return win;
  }

  /** Stagger new windows, wrapping before they march off the bottom-right. */
  private cascadePosition(width: number, height: number): { x: number; y: number } {
    const step = this.opened++ % CASCADE_WRAP;
    const originX = 48 + step * CASCADE_STEP;
    const originY = 40 + step * CASCADE_STEP;
    return {
      x: Math.max(0, Math.min(originX, window.innerWidth - width - 16)),
      y: Math.max(0, Math.min(originY, window.innerHeight - height - 64)),
    };
  }

  focus(win: Win): void {
    if (win.isMinimized()) this.setMinimized(win, false);
    for (const other of this.windows) other.setFocused(other === win);
    win.setZ(++this.topZ);
    this.renderTaskbar();
  }

  close(win: Win): void {
    const index = this.windows.indexOf(win);
    if (index === -1) return;
    this.windows.splice(index, 1);
    win.destroy();

    const hook = this.closeHooks.get(win.id);
    this.closeHooks.delete(win.id);
    hook?.();

    // Focus follows the topmost survivor rather than nothing, so the keyboard
    // always has a home.
    const next = this.windows.at(-1);
    if (next) this.focus(next);
    else this.renderTaskbar();
  }

  setMinimized(win: Win, minimized: boolean): void {
    win.setMinimized(minimized);
    if (minimized && win.isFocused()) {
      win.setFocused(false);
      const next = [...this.windows]
        .reverse()
        .find((w) => !w.isMinimized());
      if (next) this.focus(next);
    }
    this.renderTaskbar();
  }

  /** Park a persistent element at the right-hand end of the taskbar. */
  setTray(element: HTMLElement): void {
    this.taskbarTray.replaceChildren(element);
  }

  private renderTaskbar(): void {
    this.taskbarItems.replaceChildren();
    for (const win of this.windows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "taskbar-item";
      button.textContent = win.title;
      button.classList.toggle("is-focused", win.isFocused());
      button.classList.toggle("is-minimized", win.isMinimized());
      button.addEventListener("click", () => {
        // Clicking the focused window's button parks it — the standard
        // taskbar toggle, and the fastest way to see the desktop.
        if (win.isFocused() && !win.isMinimized()) this.setMinimized(win, true);
        else this.focus(win);
      });
      this.taskbarItems.append(button);
    }
  }

  all(): readonly Win[] {
    return this.windows;
  }
}
