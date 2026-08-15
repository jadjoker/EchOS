/**
 * FILES as a program on the bus.
 *
 * Emits the names of everything on the disk, and absorbs words by *writing them
 * to disk*. Hook the browser into it and the pages you visit start leaving
 * files behind — which then travel onward to anything Files is connected to,
 * because those filenames are what Files emits.
 */

import type { AppDef } from "./types.ts";
import type { Influence } from "../core/influence.ts";
import { createFileBrowser } from "../shell/files.ts";
import { createFileView } from "../shell/fileview.ts";
import { basename } from "../fs/vfs.ts";

export const filesApp: AppDef = {
  id: "files",
  title: "Files",
  glyph: "🗀",
  width: 380,
  height: 300,
  minWidth: 260,
  minHeight: 160,

  create(ctx) {
    // Opening a file gets a window per file rather than a preview pane, because
    // a file here is a typed bus value and each type wants a different view (see
    // shell/fileview.ts). Two files of different types side by side is the
    // clearest statement the machine can make that the disk and the cables
    // carry the same seven kinds of thing.
    const open = new Map<string, { close(): void }>();

    const browser = createFileBrowser(ctx.vfs, {
      onOpenFile: (path, file) => {
        // One window per path. Reopening the same file should not stack a
        // second identical window behind the first.
        open.get(path)?.close();
        const child = ctx.openWindow({
          title: basename(path),
          body: createFileView(file, path),
          width: 420,
          height: 320,
          onClose: () => open.delete(path),
        });
        open.set(path, child);
        ctx.nudge("inspect");
      },
      onActivity: () => ctx.nudge("tinker"),
    });

    return {
      body: browser.el,
      dispose: () => {
        // Every viewer this program opened belongs to it, so they go too — a
        // file window outliving the file browser that spawned it would be a
        // window nothing owns.
        for (const child of [...open.values()]) child.close();
        open.clear();
        browser.dispose();
      },
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          const names: string[] = [];
          for (const { file } of ctx.vfs.walk()) {
            names.push(file.name.replace(/\.[a-z]+$/i, ""));
          }
          return {
            sources: [ctx.title],
            tags: ["textual"],
            agents: [],
            words: [...new Set(names)].slice(0, 24),
            palette: [],
            rhythm: [],
            scalars: { files: names.length },
          };
        },
        absorb(influence: Influence) {
          // Counted per call, not cumulatively. A running total is true forever
          // after the first write, so it stops meaning "something happened just
          // now" and re-announces a change on every influence that arrives.
          let wrote = 0;

          // Only take a few per change, or a chatty upstream program buries the
          // disk in a second.
          for (const word of influence.words.slice(0, 4)) {
            const safe = word.replace(/[^a-z0-9-]/gi, "").toLowerCase();
            if (!safe) continue;
            const path = `/desktop/${safe}.txt`;
            if (ctx.vfs.exists(path)) continue;
            ctx.vfs.writeFile(path, {
              type: "text",
              data: `Left here by ${influence.sources.join(" and ") || "something"}.\n\n${word}\n`,
            });
            wrote++;
          }

          // No browser.refresh() here: writeFile notifies the vfs, which the
          // browser is subscribed to. Refreshing by hand as well would render
          // the same directory twice for one write.
          if (wrote > 0) ctx.changed();
        },
      },
    };
  },
};
