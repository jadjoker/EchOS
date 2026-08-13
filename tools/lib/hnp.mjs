/**
 * A narrowly-scoped client for the HacknPlan v0 API.
 *
 * The board is the tracker and it is the user's. This client can do exactly
 * three things to it and nothing else:
 *
 *   1. read anything
 *   2. move a work item to "In progress" or "Testing"
 *   3. post a comment on a work item
 *
 * It cannot create items, create boards, retitle, reassign, reprioritise,
 * delete, or move anything to Planned or Completed. Those belong to the user:
 * they write the work and they decide when it is done.
 *
 * That is enforced by `request()` against the table below rather than by
 * convention, because "I will only call the safe endpoints" is not a
 * guarantee, it is an intention. Stage changes go via PATCH with a single
 * field: the PUT form requires title, importance and estimate in every call,
 * so a bug there could blank fields that were never being edited.
 *
 * Auth is an API key from Profile > Settings > API > Create. Supply it as
 * HACKNPLAN_API_KEY, or drop it in tools/.hnp-key.local (already covered by the
 * `*.local` rule in .gitignore, so it cannot be committed by accident).
 *
 * The public API is capped at 5 calls/sec/IP, so requests are serialised behind
 * a minimum gap rather than fired in parallel — a 429 mid-page would otherwise
 * leave a half-read board that looks like real data.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TOOLS = dirname(dirname(fileURLToPath(import.meta.url)));
const KEY_FILE = join(TOOLS, ".hnp-key.local");
const BASE = "https://api.hacknplan.com/v0";

/** 5/sec is the documented ceiling; 220ms leaves headroom for clock jitter. */
const MIN_GAP_MS = 220;
let lastCall = 0;

export function readKey() {
  const fromEnv = process.env.HACKNPLAN_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(KEY_FILE)) {
    // Blank lines and # comments are skipped, so the file can carry its own
    // instructions. Without this the instructions would be sent as the key and
    // come back as a puzzling 401.
    const fromFile = readFileSync(KEY_FILE, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    if (fromFile) return fromFile;
  }
  throw new Error(
    "No API key. Set HACKNPLAN_API_KEY, or write the key to tools/.hnp-key.local\n" +
      "Get one at HacknPlan > Profile > Settings > API > Create (read scopes are enough).",
  );
}

export class HnpError extends Error {
  constructor(status, path, body) {
    super(`HTTP ${status} on ${path}${body ? ` — ${body.slice(0, 300)}` : ""}`);
    this.status = status;
    this.path = path;
  }
}

async function throttle() {
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/**
 * Every write this client is permitted to make. A call that does not match one
 * of these exactly, in method, path shape AND body keys, is refused before a
 * request is built.
 */
const ALLOWED_WRITES = [
  {
    what: "move a work item's stage",
    method: "PATCH",
    path: /^\/projects\/\d+\/workitems\/\d+$/,
    keys: ["stageId"],
  },
  {
    what: "comment on a work item",
    method: "POST",
    path: /^\/projects\/\d+\/workitems\/\d+\/comments$/,
    // This endpoint takes the comment as a bare JSON string, not an object
    // with a text field, and answers 400 "Invalid comment text." otherwise.
    bodyIsString: true,
  },
];

function checkWrite(method, path, body) {
  const rule = ALLOWED_WRITES.find((r) => r.method === method && r.path.test(path));
  if (!rule) {
    throw new Error(
      `Refusing ${method} ${path}. This client may only read, move an item to ` +
        "In progress or Testing, and comment. Everything else on the board is " +
        "the user's to change.",
    );
  }
  if (rule.bodyIsString) {
    if (typeof body !== "string") {
      throw new Error(`Refusing ${method} ${path}: expected the body to be plain text.`);
    }
    return;
  }
  const sent = Object.keys(body ?? {});
  const extra = sent.filter((k) => !rule.keys.includes(k));
  if (extra.length) {
    throw new Error(
      `Refusing ${method} ${path}: may only send ${rule.keys.join(", ")} when asked to ` +
        `${rule.what}, but the body also carried ${extra.join(", ")}.`,
    );
  }
}

/**
 * The single door to the API. Everything goes through here so the guard cannot
 * be sidestepped by a helper that builds its own fetch.
 */
export async function request(path, { query = {}, method = "GET", body, key } = {}) {
  if (method !== "GET") checkWrite(method, path, body);

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  await throttle();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `ApiKey ${key ?? readKey()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    throw new HnpError(401, path, "Key rejected. Check it is current and not expired.");
  }
  if (res.status === 403) {
    throw new HnpError(403, path,
      "Key lacks permission. Stage moves and comments need a key with write scope; " +
      "a read-only key can still do everything else here.");
  }
  if (res.status === 429) {
    throw new HnpError(429, path, "Rate limited (5/sec). Re-run; requests are already spaced.");
  }
  if (!res.ok) throw new HnpError(res.status, path, await res.text().catch(() => ""));

  // A successful PATCH may answer 204 with no body.
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Walks an offset/limit endpoint to completion. The API defaults to 20 per page
 * and a partially-read backlog is worse than an error, so this keeps going until
 * a short page proves the end.
 */
export async function paged(path, { query = {}, key, pageSize = 100, max = 2000 } = {}) {
  const out = [];
  for (let offset = 0; offset < max; offset += pageSize) {
    const page = await request(path, { query: { ...query, offset, limit: pageSize }, key });
    const rows = Array.isArray(page) ? page : (page.items ?? page.data ?? []);
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export const api = {
  me: (key) => request("/users/me", { key }),
  workspaces: (key) => request("/workspaces", { key }),
  projects: (key) => paged("/projects", { key }),
  project: (projectId, key) => request(`/projects/${projectId}`, { key }),
  boards: (projectId, key) => paged(`/projects/${projectId}/boards`, { key }),
  stages: (projectId, key) => paged(`/projects/${projectId}/stages`, { key }),
  categories: (projectId, key) => paged(`/projects/${projectId}/categories`, { key }),
  importanceLevels: (projectId, key) => paged(`/projects/${projectId}/importancelevels`, { key }),
  tags: (projectId, key) => paged(`/projects/${projectId}/tags`, { key }),
  milestones: (projectId, key) => paged(`/projects/${projectId}/milestones`, { key }),
  designElements: (projectId, key) => paged(`/projects/${projectId}/designelements`, { key }),
  /** boardId 0 is the backlog, not "no board" — omit it entirely for everything. */
  workItems: (projectId, query, key) => paged(`/projects/${projectId}/workitems`, { query, key }),
  workItem: (projectId, id, key) => request(`/projects/${projectId}/workitems/${id}`, { key }),
  subTasks: (projectId, id, key) => paged(`/projects/${projectId}/workitems/${id}/subtasks`, { key }),
  comments: (projectId, id, key) => paged(`/projects/${projectId}/workitems/${id}/comments`, { key }),
};

/**
 * The only stages this client may move an item into.
 *
 * Planned is where the user puts work, and Completed is the user's call after
 * they have looked at it. Moving either way would be this tool marking its own
 * homework, so neither is reachable from here.
 */
export const MOVABLE = ["in progress", "testing"];

/** Resolve a stage by name, so a renamed column does not silently move nothing. */
export async function findStage(projectId, wanted, key) {
  const want = wanted.trim().toLowerCase();
  if (!MOVABLE.includes(want)) {
    throw new Error(
      `Refusing to move anything to "${wanted}". This client may only move an item to ` +
        `${MOVABLE.join(" or ")}. Planned and Completed are yours.`,
    );
  }
  const stages = await api.stages(projectId, key);
  const match = stages.find((s) => (s.name ?? "").trim().toLowerCase() === want);
  if (!match) {
    throw new Error(
      `No stage called "${wanted}" on this project. Stages are: ` +
        stages.map((s) => s.name).join(", "),
    );
  }
  return { id: match.stageId ?? match.id, name: match.name };
}

export async function moveStage(projectId, itemId, stageName, key) {
  const stage = await findStage(projectId, stageName, key);
  await request(`/projects/${projectId}/workitems/${itemId}`, {
    method: "PATCH",
    body: { stageId: stage.id },
    key,
  });
  return stage;
}

/**
 * House style for comments, enforced rather than remembered: short, and no em
 * dashes. Both are the user's stated preference for this board.
 */
export function checkCommentStyle(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw new Error("Refusing to post an empty comment.");
  if (/[—–]/.test(trimmed)) {
    throw new Error("Comment contains an em or en dash. Rewrite it without one.");
  }
  if (trimmed.length > 600) {
    throw new Error(`Comment is ${trimmed.length} characters. Keep it under 600.`);
  }
  return trimmed;
}

export async function addComment(projectId, itemId, text, key) {
  const clean = checkCommentStyle(text);
  await request(`/projects/${projectId}/workitems/${itemId}/comments`, {
    method: "POST",
    body: clean,
    key,
  });
  return clean;
}
