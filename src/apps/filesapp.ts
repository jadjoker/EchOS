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

export const filesApp: AppDef = {
  id: "files",
  title: "Files",
  glyph: "🗀",
  width: 380,
  height: 300,
  minWidth: 260,
  minHeight: 160,

  create(ctx) {
    const browser = createFileBrowser(ctx.vfs);
    let dropped = 0;

    return {
      body: browser.el,
      dispose: () => {},
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
            dropped++;
          }
          if (dropped > 0) {
            browser.refresh();
            ctx.changed();
          }
        },
      },
    };
  },
};
