#!/usr/bin/env node
/**
 * Read the EchOS board on HacknPlan from the terminal.
 *
 * READ ONLY. This cannot modify the board — see tools/lib/hnp.mjs, where any
 * method other than GET throws before a request is built.
 *
 * Usage:
 *   node tools/hnp.mjs whoami                  # check the key works
 *   node tools/hnp.mjs projects                # list projects, with their ids
 *   node tools/hnp.mjs meta <projectId>        # boards, stages, categories, levels
 *   node tools/hnp.mjs board <projectId>       # work items grouped by stage
 *   node tools/hnp.mjs list <projectId> [--board 3] [--stage 2] [--search fish]
 *   node tools/hnp.mjs item <projectId> <itemId>
 *   node tools/hnp.mjs export <projectId> [--out board.json]
 *
 * The project id comes from `projects`, or from the board URL:
 * app.hacknplan.com/p/<projectId>/kanban
 */

import { writeFileSync } from "node:fs";

import { api, readKey, HnpError, moveStage, addComment } from "./lib/hnp.mjs";

const [, , command, ...rest] = process.argv;
const positional = rest.filter((a) => !a.startsWith("--"));
const flags = parseFlags(rest);

try {
  await main();
} catch (err) {
  if (err instanceof HnpError) {
    console.error(`\n  ${err.message}\n`);
  } else {
    console.error(`\n  ${err.message}\n`);
  }
  process.exit(1);
}

async function main() {
  /** Help must work before a key exists, or the first run is a dead end. */
  const commands = ["whoami", "projects", "meta", "board", "list", "item", "export",
    "start", "finish", "comment"];
  if (!commands.includes(command)) return console.log(headerHelp());

  const key = readKey();

  switch (command) {
    case "whoami": {
      const me = await api.me(key);
      console.log(`${me.name ?? me.username ?? "(unnamed)"}  id=${me.id}  ${me.email ?? ""}`);
      return;
    }

    case "projects": {
      const projects = await api.projects(key);
      if (!projects.length) return console.log("No projects visible to this key.");
      for (const p of projects) {
        console.log(`${String(p.id).padStart(6)}  ${p.name}${p.isClosed ? "  [closed]" : ""}`);
      }
      return;
    }

    case "meta": {
      const projectId = requireProjectId();
      const [boards, stages, categories, levels, milestones] = await Promise.all([
        api.boards(projectId, key),
        api.stages(projectId, key),
        api.categories(projectId, key),
        api.importanceLevels(projectId, key),
        api.milestones(projectId, key),
      ]);
      section("Boards", boards, (b) => `${b.boardId ?? b.id}  ${b.name}`);
      section("Stages", stages, (s) => `${s.stageId ?? s.id}  ${s.name}`);
      section("Categories", categories, (c) => `${c.categoryId ?? c.id}  ${c.name}`);
      section("Importance", levels, (l) => `${l.importanceLevelId ?? l.id}  ${l.name}`);
      section("Milestones", milestones, (m) => `${m.milestoneId ?? m.id}  ${m.name}`);
      return;
    }

    case "board": {
      const projectId = requireProjectId();
      const [stages, items] = await Promise.all([
        api.stages(projectId, key),
        api.workItems(projectId, boardQuery(), key),
      ]);
      const byStage = new Map();
      for (const item of items) {
        const id = item.stage?.stageId ?? item.stage?.id ?? item.stageId ?? 0;
        if (!byStage.has(id)) byStage.set(id, []);
        byStage.get(id).push(item);
      }
      for (const stage of stages) {
        const id = stage.stageId ?? stage.id;
        const inStage = byStage.get(id) ?? [];
        console.log(`\n${stage.name.toUpperCase()}  (${inStage.length})`);
        for (const item of inStage) console.log("   " + oneLine(item));
        byStage.delete(id);
      }
      for (const [id, orphans] of byStage) {
        console.log(`\nSTAGE ${id} (not in stage list)  (${orphans.length})`);
        for (const item of orphans) console.log("   " + oneLine(item));
      }
      console.log("");
      return;
    }

    case "list": {
      const projectId = requireProjectId();
      const items = await api.workItems(projectId, boardQuery(), key);
      if (!items.length) return console.log("No work items match.");
      for (const item of items) console.log(oneLine(item));
      console.log(`\n${items.length} item(s)`);
      return;
    }

    case "item": {
      const projectId = requireProjectId();
      const itemId = positional[1];
      if (!itemId) throw new Error("Usage: node tools/hnp.mjs item <projectId> <itemId>");
      const [item, subtasks, comments] = await Promise.all([
        api.workItem(projectId, itemId, key),
        api.subTasks(projectId, itemId, key).catch(() => []),
        api.comments(projectId, itemId, key).catch(() => []),
      ]);
      console.log(`\n#${item.workItemId ?? item.id}  ${item.title}`);
      console.log(`  stage:      ${item.stage?.name ?? "-"}`);
      console.log(`  category:   ${item.category?.name ?? "-"}`);
      console.log(`  importance: ${item.importanceLevel?.name ?? "-"}`);
      console.log(`  board:      ${item.board?.name ?? "backlog"}`);
      console.log(`  type:       ${item.isStory ? "story" : "task"}`);
      if (item.description) console.log(`\n${item.description}\n`);
      section("Subtasks", subtasks, (s) => `[${s.isCompleted ? "x" : " "}] ${s.description ?? s.title}`);
      section("Comments", comments, (c) => `${c.user?.name ?? "?"}: ${(c.text ?? "").slice(0, 160)}`);
      return;
    }

    case "start":
    case "finish": {
      const projectId = requireProjectId();
      const itemId = positional[1];
      if (!itemId) throw new Error(`Usage: node tools/hnp.mjs ${command} <projectId> <itemId>`);

      const item = await api.workItem(projectId, itemId, key);
      const stageName = command === "start" ? "In progress" : "Testing";
      const moved = await moveStage(projectId, itemId, stageName, key);
      console.log(`#${itemId} ${item.title}`);
      console.log(`  ${item.stage?.name ?? "?"} -> ${moved.name}`);

      // A hand-back with no note makes the reviewer go and find out what
      // changed, which is the job the note exists to save them.
      if (flags.note) {
        const posted = await addComment(projectId, itemId, String(flags.note), key);
        console.log(`  commented: ${posted}`);
      } else if (command === "finish") {
        console.log("  (no note posted; pass --note \"what changed\" to leave one)");
      }
      return;
    }

    case "comment": {
      const projectId = requireProjectId();
      const itemId = positional[1];
      const text = positional.slice(2).join(" ");
      if (!itemId || !text) {
        throw new Error('Usage: node tools/hnp.mjs comment <projectId> <itemId> "text"');
      }
      const posted = await addComment(projectId, itemId, text, key);
      console.log(`#${itemId} commented: ${posted}`);
      return;
    }

    case "export": {
      const projectId = requireProjectId();
      const [project, items] = await Promise.all([
        api.project(projectId, key),
        api.workItems(projectId, boardQuery(), key),
      ]);
      const out = flags.out ?? `hnp-${projectId}-export.json`;
      writeFileSync(out, JSON.stringify({ project, items, exportedAt: new Date().toISOString() }, null, 2));
      console.log(`Wrote ${items.length} item(s) to ${out}`);
      return;
    }

    default:
      console.log(headerHelp());
  }
}

/** Query filters shared by `board`, `list` and `export`. */
function boardQuery() {
  return {
    boardId: flags.board,
    stageId: flags.stage,
    categoryId: flags.category,
    milestoneId: flags.milestone,
    searchTerms: flags.search,
  };
}

function oneLine(item) {
  const id = String(item.workItemId ?? item.id).padStart(5);
  const kind = item.isStory ? "story" : " task";
  const stage = (item.stage?.name ?? "").padEnd(12).slice(0, 12);
  return `${id}  ${kind}  ${stage}  ${item.title}`;
}

function section(label, rows, format) {
  if (!rows?.length) return;
  console.log(`\n${label}`);
  for (const row of rows) console.log("  " + format(row));
}

function requireProjectId() {
  const id = positional[0];
  if (!id) throw new Error(`Usage: node tools/hnp.mjs ${command} <projectId>   (get ids from \`projects\`)`);
  return id;
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const name = argv[i].slice(2);
    const next = argv[i + 1];
    out[name] = next && !next.startsWith("--") ? next : true;
  }
  return out;
}

function headerHelp() {
  return `
  hnp — the HacknPlan board

  read
    whoami                      check the API key
    projects                    list projects and their ids
    meta <projectId>            boards, stages, categories, importance levels
    board <projectId>           work items grouped by stage
    list <projectId>            flat list; --board --stage --category --search
    item <projectId> <itemId>   one item, with subtasks and comments
    export <projectId>          dump to JSON; --out <file>

  write (all this tool can do)
    start <projectId> <itemId>  move to In progress
    finish <projectId> <itemId> move to Testing; --note "what changed"
    comment <projectId> <itemId> "text"

  It cannot create, retitle, delete, reprioritise, or move anything to Planned
  or Completed. Those are yours.

  Key: HACKNPLAN_API_KEY, or tools/.hnp-key.local
`;
}
