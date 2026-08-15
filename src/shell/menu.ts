/**
 * Popup menus. Right now: right clicking a file, and the space around one.
 *
 * Written as one general implementation rather than the two cases Files needs,
 * because a menu is the single piece of chrome a player will judge the machine
 * by fastest. Everyone has used thousands of them, so the small behaviours are
 * not polish: a menu that stays open when you click elsewhere, or runs off the
 * bottom of the screen, or cannot be driven with the arrow keys, reads as a
 * mock-up of an OS rather than an OS. Getting those right once here is much
 * cheaper than getting them wrong in each place that wants a menu.
 *
 * `up`, and the submenu support, are deliberately ahead of their callers: a
 * start button on the taskbar is the obvious next menu and it opens upwards.
 *
 * Nothing in here knows what it is a menu of. Callers hand over labels and
 * functions.
 */

export interface MenuAction {
  label: string;
  /** Leading column. Space is reserved whether or not an item fills it. */
  glyph?: string;
  /** Trailing column, for a shortcut or a value. Never interactive. */
  hint?: string;
  disabled?: boolean;
  action(): void;
}

export interface MenuSubmenu {
  label: string;
  glyph?: string;
  /**
   * Read when the submenu opens rather than when the parent does, so a menu can
   * list something that changes while it is on screen.
   */
  items: MenuItem[] | (() => MenuItem[]);
}

export type MenuItem = MenuAction | MenuSubmenu | "separator";

export interface MenuPosition {
  x: number;
  y: number;
  /**
   * Grow upwards from y instead of down. The start button sits on the taskbar
   * at the bottom of the screen, where a menu that opens downwards is off it.
   */
  up?: boolean;
}

export interface MenuHandle {
  close(): void;
}

function isSubmenu(item: MenuItem): item is MenuSubmenu {
  return item !== "separator" && "items" in item;
}

/**
 * The menu currently on screen, if any.
 *
 * Module level because the rule is global: opening any menu dismisses whatever
 * was already open. Tracking this per caller would let a right click while the
 * start menu is up leave two menus on screen, which no OS does.
 */
let openRoot: { close(): void } | null = null;

export function closeMenus(): void {
  openRoot?.close();
}

export function openMenu(items: MenuItem[], at: MenuPosition): MenuHandle {
  closeMenus();

  const teardown: (() => void)[] = [];
  let closed = false;

  const close = (): void => {
    if (closed) return;
    closed = true;
    for (const undo of teardown.splice(0)) undo();
    if (openRoot === handle) openRoot = null;
  };

  const handle: MenuHandle = { close };
  openRoot = handle;

  // build() registers the panel's own removal on `teardown`, so there is
  // nothing to add here.
  build(items, at, close, teardown);

  // Deferred by a frame: the pointerdown or click that opened this menu is
  // often still travelling, and a listener added synchronously catches it and
  // closes the menu before it has been seen.
  const frame = requestAnimationFrame(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (!target?.closest(".menu")) close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    // A menu anchored to a point on screen is wrong the instant the screen
    // changes shape, and there is nothing sensible to re-anchor it to.
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    teardown.push(() => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    });
  });
  teardown.push(() => cancelAnimationFrame(frame));

  return handle;
}

/** One panel. Submenus recurse through here with their own anchor point. */
function build(
  items: MenuItem[],
  at: MenuPosition,
  closeAll: () => void,
  teardown: (() => void)[],
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "menu";
  panel.setAttribute("role", "menu");

  // Submenus are tracked so hovering a sibling can shut the one already open.
  let openChild: { row: HTMLElement; panel: HTMLElement } | null = null;
  const closeChild = (): void => {
    if (!openChild) return;
    openChild.row.classList.remove("is-open");
    openChild.panel.remove();
    openChild = null;
  };

  const rows: HTMLElement[] = [];

  for (const item of items) {
    if (item === "separator") {
      const rule = document.createElement("div");
      rule.className = "menu-separator";
      rule.setAttribute("role", "separator");
      panel.append(rule);
      continue;
    }

    const row = document.createElement("div");
    row.className = "menu-item";
    row.setAttribute("role", "menuitem");
    row.tabIndex = -1;

    const glyph = document.createElement("span");
    glyph.className = "menu-glyph";
    glyph.textContent = item.glyph ?? "";

    const label = document.createElement("span");
    label.className = "menu-label";
    label.textContent = item.label;

    const hint = document.createElement("span");
    hint.className = "menu-hint";

    row.append(glyph, label, hint);

    if (isSubmenu(item)) {
      row.classList.add("menu-item-parent");
      hint.textContent = "▸";
      row.setAttribute("aria-haspopup", "true");

      const openSub = (): void => {
        if (openChild?.row === row) return;
        closeChild();
        const rect = row.getBoundingClientRect();
        const resolved = typeof item.items === "function" ? item.items() : item.items;
        // Anchored to the row's top right, so the child sits alongside the
        // parent rather than under the pointer.
        const child = build(resolved, { x: rect.right - 2, y: rect.top }, closeAll, teardown);
        row.classList.add("is-open");
        openChild = { row, panel: child };
      };

      row.addEventListener("pointerenter", openSub);
      row.addEventListener("click", openSub);
      rows.push(row);
    } else if (item.disabled) {
      row.classList.add("is-disabled");
      row.setAttribute("aria-disabled", "true");
      if (item.hint) hint.textContent = item.hint;
      // Left out of `rows` on purpose: arrow keys should skip it.
    } else {
      if (item.hint) hint.textContent = item.hint;
      // Hovering a plain item retracts an open submenu, the same as moving off
      // the parent would.
      row.addEventListener("pointerenter", closeChild);
      row.addEventListener("click", () => {
        // Closed first. An action that opens a window would otherwise leave the
        // menu floating over the thing it just created.
        closeAll();
        item.action();
      });
      rows.push(row);
    }

    panel.append(row);
  }

  document.body.append(panel);
  place(panel, at);
  armKeys(panel, rows, closeAll);
  teardown.push(() => panel.remove());

  // Focusing the first item means the keyboard has somewhere to be immediately,
  // and it is what takes focus off whatever opened the menu.
  rows[0]?.focus();
  return panel;
}

/**
 * Put the panel on screen and keep it there.
 *
 * Measured after it is in the document, because its size depends on its
 * content and the machine's generated font and padding. Flipping rather than
 * merely clamping matters at the edges: a menu clamped to the right edge sits
 * under the pointer and covers what was right clicked.
 */
function place(panel: HTMLElement, at: MenuPosition): void {
  const margin = 4;
  const rect = panel.getBoundingClientRect();

  let x = at.x;
  if (x + rect.width > window.innerWidth - margin) {
    x = Math.max(margin, at.x - rect.width);
  }

  let y = at.up ? at.y - rect.height : at.y;
  if (y + rect.height > window.innerHeight - margin) {
    y = Math.max(margin, window.innerHeight - margin - rect.height);
  }
  if (y < margin) y = margin;

  panel.style.left = `${Math.max(margin, x)}px`;
  panel.style.top = `${y}px`;
}

/** Arrow keys, Home/End, Enter and Space. */
function armKeys(panel: HTMLElement, rows: HTMLElement[], closeAll: () => void): void {
  panel.addEventListener("keydown", (event: KeyboardEvent) => {
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const move = (to: number): void => {
      event.preventDefault();
      event.stopPropagation();
      rows[(to + rows.length) % rows.length]?.focus();
    };

    switch (event.key) {
      case "ArrowDown": move(index + 1); break;
      case "ArrowUp": move(index - 1); break;
      case "Home": move(0); break;
      case "End": move(rows.length - 1); break;
      case "Enter":
      case " ":
        event.preventDefault();
        event.stopPropagation();
        rows[index]?.click();
        break;
      case "Tab":
        // Tabbing away from a menu dismisses it everywhere else.
        closeAll();
        break;
      default:
        break;
    }
  });
}
