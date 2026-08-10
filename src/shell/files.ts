/**
 * File browser — substrate, not an app.
 *
 * It exists so the filesystem is visible and so bus types are legible from the
 * first boot. Every row shows its type glyph, because "this file is samples,
 * that one is numbers" is the fact the whole composition idea rests on.
 */

import { BUS_TYPES } from "../core/bus.ts";
import { fileSize, joinPath, dirname, type Vfs } from "../fs/vfs.ts";

export interface FileBrowser {
  el: HTMLElement;
  /** Re-read the directory. Call after anything writes to the vfs. */
  refresh(): void;
}

export function createFileBrowser(vfs: Vfs, startPath = "/"): FileBrowser {
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

  bar.append(up, pathLabel);

  const list = document.createElement("div");
  list.className = "files-list";

  const status = document.createElement("div");
  status.className = "files-status";

  root.append(bar, list, status);

  let current = startPath;

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
      const row = document.createElement("button");
      row.type = "button";
      row.className = `files-row files-row-${entry.kind}`;

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

      if (entry.kind === "dir") {
        row.addEventListener("click", () => {
          current = joinPath(current, entry.name);
          render();
        });
      } else {
        row.addEventListener("click", () => {
          status.textContent = `${entry.name} — ${BUS_TYPES[entry.value.type].label}${
            entry.readonly ? " · readonly" : ""
          }`;
        });
      }

      list.append(row);
    }

    status.textContent = `${entries.length} entries`;
  }

  up.addEventListener("click", () => {
    current = dirname(current);
    render();
  });

  render();
  return { el: root, refresh: render };
}
