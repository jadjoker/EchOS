/**
 * File browser: substrate, not an app.
 *
 * It exists so the filesystem is visible and so bus types are legible from the
 * first boot. Every row shows its type glyph, because "this file is samples,
 * that one is numbers" is the fact the whole composition idea rests on.
 *
 * It is also the machine's proof that the disk is real. A browser that only
 * lists things invites the reading that the filesystem is set dressing, so the
 * ordinary verbs are all here: open, make, rename, delete. They are cheap
 * because the vfs already had them, and without them the disk is a picture of
 * a disk.
 *
 * Selection is a path, not a node. A row can be rebuilt underneath the player
 * at any moment, since anything on the bus can write to the disk while this is
 * on screen, and a remembered element would be stale by the next influence.
 */

import { BUS_TYPES } from "../core/bus.ts";
import {
  basename,
  dirname,
  fileSize,
  joinPath,
  type VFile,
  type Vfs,
} from "../fs/vfs.ts";
import { openMenu, type MenuItem } from "./menu.ts";
import { renameInPlace } from "./rename.ts";

export interface FileBrowserOptions {
  startPath?: string;
  /** Opening a file. Without this, files can only be selected. */
  onOpenFile?(path: string, file: VFile): void;
  /** Anything the player did that counts as activity, for the economy. */
  onActivity?(): void;
}

export interface FileBrowser {
  el: HTMLElement;
  /** Re-read the directory. Wired to the vfs already; call after external writes. */
  refresh(): void;
  /** Stop listening to the disk. */
  dispose(): void;
}

export function createFileBrowser(vfs: Vfs, options: FileBrowserOptions = {}): FileBrowser {
  const root = document.createElement("div");
  root.className = "files";

  const bar = document.createElement("div");
  bar.className = "files-bar";

  const up = document.createElement("button");
  up.type = "button";
  up.className = "files-up";
  up.textContent = "↑";
  up.title = "Parent directory";

  const pathLabel = document.createElement("span");
  pathLabel.className = "files-path";

  const spacer = document.createElement("span");
  spacer.className = "files-spacer";

  const newFolder = toolButton("New folder", () => create("dir"));
  const newNote = toolButton("New note", () => create("file"));

  bar.append(up, pathLabel, spacer, newFolder, newNote);

  const list = document.createElement("div");
  list.className = "files-list";
  list.setAttribute("role", "listbox");

  const status = document.createElement("div");
  status.className = "files-status";

  root.append(bar, list, status);

  let current = options.startPath ?? "/";
  let selected: string | null = null;
  /** Set by create(), consumed by the next render, which opens the editor. */
  let renaming: string | null = null;

  function say(message: string): void {
    status.textContent = message;
  }

  function go(path: string): void {
    current = path;
    selected = null;
    render();
  }

  function open(path: string): void {
    const node = vfs.resolve(path);
    if (!node) {
      say("it is no longer there");
      render();
      return;
    }
    options.onActivity?.();
    if (node.kind === "dir") go(path);
    else options.onOpenFile?.(path, node);
  }

  /**
   * Make a thing, then immediately offer to name it.
   *
   * Named after the fact, the way it works everywhere else: the item exists
   * first with a placeholder name, and the rename editor is already open on it.
   */
  function create(kind: "dir" | "file"): void {
    if (kind === "dir") {
      const name = vfs.uniqueName(current, "New folder");
      vfs.mkdirp(joinPath(current, name));
      renaming = joinPath(current, name);
    } else {
      const name = vfs.uniqueName(current, "untitled", ".txt");
      vfs.writeFile(joinPath(current, name), { type: "text", data: "" });
      renaming = joinPath(current, name);
    }
    selected = renaming;
    options.onActivity?.();
    // The vfs change already triggered a render; this one opens the editor.
    render();
  }

  function remove(path: string): void {
    const name = basename(path);
    if (vfs.remove(path)) {
      if (selected === path) selected = null;
      say(`deleted ${name}`);
      options.onActivity?.();
    } else {
      // The only reasons remove refuses are readonly content or a path that has
      // already gone, and both are worth saying out loud.
      say(`${name} is protected`);
    }
  }

  /**
   * The label element for a path, looked up live.
   *
   * Never held onto. Rows are rebuilt whenever the disk changes, so an element
   * captured when a menu opened may already be detached by the time the menu
   * item is clicked — and renaming into a detached element does nothing at all,
   * visibly. Same rule as selection: address rows by path.
   */
  function labelFor(path: string): HTMLElement | null {
    return list.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"] .files-name`);
  }

  function beginRename(path: string): void {
    const label = labelFor(path);
    if (!label) return;

    // Recorded so a render mid-edit reopens the editor rather than discarding
    // it. Anything on the bus can write to the disk while a name is being
    // typed, and that write rebuilds every row underneath the player.
    renaming = path;

    renameInPlace(label, basename(path), {
      commit: (next) => {
        const refused = vfs.rename(path, next);
        if (refused) {
          say(refused);
        } else {
          const moved = joinPath(dirname(path), next);
          if (selected === path) selected = moved;
          // Cleared before the render below, or the editor reopens on a path
          // that no longer exists.
          renaming = null;
          options.onActivity?.();
        }
        render();
      },
      done: () => { renaming = null; },
    });
  }

  function rowMenu(path: string, at: { x: number; y: number }): void {
    const node = vfs.resolve(path);
    if (!node) return;
    const locked = node.kind === "file" && node.readonly;

    const items: MenuItem[] = [
      {
        label: node.kind === "dir" ? "Open" : "Open in a window",
        glyph: "▸",
        action: () => open(path),
      },
      "separator",
      {
        label: "Rename",
        hint: "F2",
        disabled: locked,
        action: () => beginRename(path),
      },
      {
        label: "Delete",
        hint: "Del",
        disabled: locked,
        action: () => { remove(path); render(); },
      },
    ];
    openMenu(items, at);
  }

  function render(): void {
    pathLabel.textContent = current;
    up.disabled = current === "/";
    list.replaceChildren();

    const entries = vfs.list(current);
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "files-empty";
      empty.textContent = "(empty)";
      list.append(empty);
    }

    for (const entry of entries) {
      const path = joinPath(current, entry.name);

      const row = document.createElement("div");
      row.className = `files-row files-row-${entry.kind}`;
      row.setAttribute("role", "option");
      // Addressed by path so anything acting later — a menu item, a reopened
      // rename — can find its row again after a rebuild. See labelFor.
      row.dataset["path"] = path;
      // One tab stop for the whole list, which is what `listbox` means: Tab
      // reaches the list, arrows move within it. A tab stop per row makes
      // escaping a full directory a dozen presses.
      row.tabIndex = selected === path ? 0 : -1;
      row.classList.toggle("is-selected", selected === path);
      row.setAttribute("aria-selected", String(selected === path));

      const glyph = document.createElement("span");
      glyph.className = "files-glyph";
      glyph.textContent =
        entry.kind === "dir" ? "▸" : BUS_TYPES[entry.value.type].glyph;

      const name = document.createElement("span");
      name.className = "files-name";
      name.textContent = entry.name;

      const meta = document.createElement("span");
      meta.className = "files-meta";
      meta.textContent =
        entry.kind === "dir"
          ? `${entry.children.size} items`
          : `${BUS_TYPES[entry.value.type].label} · ${fileSize(entry)}b`;

      row.append(glyph, name, meta);

      const select = (): void => {
        selected = path;
        for (const other of list.children) {
          other.classList.remove("is-selected");
          other.setAttribute("aria-selected", "false");
          if (other instanceof HTMLElement) other.tabIndex = -1;
        }
        row.classList.add("is-selected");
        row.setAttribute("aria-selected", "true");
        row.tabIndex = 0;
        say(
          entry.kind === "dir"
            ? `${entry.name} · ${entry.children.size} items`
            : `${entry.name} · ${BUS_TYPES[entry.value.type].label}${
                entry.readonly ? " · readonly" : ""
              }`,
        );
      };

      row.addEventListener("click", select);
      row.addEventListener("dblclick", () => open(path));
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        select();
        rowMenu(path, { x: event.clientX, y: event.clientY });
      });
      row.addEventListener("keydown", (event) => {
        switch (event.key) {
          case "Enter":
            event.preventDefault();
            open(path);
            break;
          case "F2":
            event.preventDefault();
            beginRename(path);
            break;
          case "Delete":
            event.preventDefault();
            remove(path);
            render();
            break;
          // Arrow keys move the selection the way every file list does. Without
          // them the rows are reachable but not navigable, which is worse than
          // no keyboard support at all: it looks supported and isn't.
          case "ArrowDown":
            event.preventDefault();
            step(path, 1);
            break;
          case "ArrowUp":
            event.preventDefault();
            step(path, -1);
            break;
          case "Home":
            event.preventDefault();
            step(path, -entries.length);
            break;
          case "End":
            event.preventDefault();
            step(path, entries.length);
            break;
          case "Backspace":
            event.preventDefault();
            if (current !== "/") go(dirname(current));
            break;
          default:
            break;
        }
      });

      list.append(row);

      if (renaming === path) beginRename(path);
    }

    // Only while nothing is selected. Once a row is chosen the status line
    // belongs to it, and overwriting the count back over "deleted notes.txt"
    // would erase the only confirmation the player gets.
    if (!selected) say(`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`);
  }

  /**
   * Move the selection `delta` rows and give it focus.
   *
   * Clamped rather than wrapped: a list that jumps from the last row back to
   * the first on one more press of Down reads as a carousel, not a directory.
   */
  function step(from: string, delta: number): void {
    const names = vfs.list(current).map((entry) => joinPath(current, entry.name));
    const at = names.indexOf(from);
    if (at === -1) return;
    const next = names[Math.max(0, Math.min(names.length - 1, at + delta))];
    if (next === undefined || next === from) return;
    selected = next;
    render();
    list.querySelector<HTMLElement>(`[data-path="${CSS.escape(next)}"]`)?.focus();
  }

  up.addEventListener("click", () => go(dirname(current)));

  // Right clicking the empty space below the rows is still right clicking this
  // directory, and is where "new folder" is looked for first.
  list.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMenu(
      [
        { label: "New folder", glyph: "▸", action: () => create("dir") },
        { label: "New note", glyph: "≡", action: () => create("file") },
        "separator",
        { label: "Up", disabled: current === "/", action: () => go(dirname(current)) },
        { label: "Refresh", action: render },
      ],
      { x: event.clientX, y: event.clientY },
    );
  });

  // The disk changes without this window doing anything: see fs/vfs.ts.
  const unsubscribe = vfs.onChange(render);

  render();
  return { el: root, refresh: render, dispose: unsubscribe };
}

function toolButton(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "files-tool";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}
