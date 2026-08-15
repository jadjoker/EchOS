/**
 * Opening a file and actually seeing what is in it.
 *
 * A file here is a typed bus value, not a blob of text (see fs/vfs.ts), so
 * there is no single viewer: numbers want a plot, samples want a waveform,
 * pixels want a canvas. That is the point rather than an inconvenience. The
 * machine claims the disk and the cables carry the same seven kinds of thing,
 * and a viewer per kind is what makes that claim visible instead of asserted.
 *
 * The switch is exhaustive on BusType, so adding an eighth kind fails the build
 * here rather than rendering a blank window.
 */

import { BUS_TYPES, type BusValue } from "../core/bus.ts";
import { fileSize, type VFile } from "../fs/vfs.ts";

/** Long files are truncated: this is a peek, not an editor. */
const TEXT_LIMIT = 20000;
const LIST_LIMIT = 400;
const HEX_LIMIT = 2048;

export function createFileView(file: VFile, path: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "viewer";

  const head = document.createElement("div");
  head.className = "viewer-head";

  const where = document.createElement("span");
  where.className = "viewer-path";
  where.textContent = path;

  const meta = document.createElement("span");
  meta.className = "viewer-meta";
  const info = BUS_TYPES[file.value.type];
  meta.textContent = `${info.glyph} ${info.label} · ${fileSize(file)}b${
    file.readonly ? " · readonly" : ""
  }`;

  head.append(where, meta);

  const body = document.createElement("div");
  body.className = "viewer-body";
  body.append(renderValue(file.value));

  root.append(head, body);
  return root;
}

function renderValue(value: BusValue): HTMLElement {
  switch (value.type) {
    case "text": return renderText(value.data);
    case "numbers": return renderNumbers(value.data);
    case "samples": return renderSamples(value.data);
    case "bytes": return renderBytes(value.data);
    case "pixels": return renderPixels(value.data);
    case "events": return renderEvents(value.data);
    case "nodes": return renderNodes(value.data);
  }
}

function renderText(text: string): HTMLElement {
  const pre = document.createElement("pre");
  pre.className = "viewer-text";
  pre.textContent = text.length > TEXT_LIMIT
    ? `${text.slice(0, TEXT_LIMIT)}\n\n[truncated]`
    : text;
  return pre;
}

function renderNumbers(numbers: number[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";
  if (numbers.length === 0) return empty("no numbers");

  wrap.append(plot(numbers));

  const grid = document.createElement("div");
  grid.className = "viewer-grid";
  for (const n of numbers.slice(0, LIST_LIMIT)) {
    const cell = document.createElement("span");
    cell.className = "viewer-cell";
    cell.textContent = Number.isInteger(n) ? String(n) : n.toFixed(3);
    grid.append(cell);
  }
  wrap.append(grid, note(numbers.length, LIST_LIMIT, "values"));
  return wrap;
}

function renderSamples(samples: Float32Array): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";
  if (samples.length === 0) return empty("no samples");
  wrap.append(plot(Array.from(samples), true), caption(`${samples.length} samples`));
  return wrap;
}

/**
 * A plot rather than a canvas, so it inherits the machine's ink colour and
 * stays sharp at any window size without being redrawn on resize.
 */
function plot(values: number[], centred = false): SVGSVGElement {
  const width = 600;
  const height = 120;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "viewer-plot");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  let low = Math.min(...values);
  let high = Math.max(...values);
  if (centred) {
    const reach = Math.max(Math.abs(low), Math.abs(high), 1e-6);
    low = -reach;
    high = reach;
  }
  // A constant series has no range to scale into and would divide by zero.
  const span = high - low || 1;

  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - low) / span) * height).toFixed(2)}`)
    .join(" ");

  const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  line.setAttribute("points", points);
  svg.append(line);

  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = `${values.length} values, ${low.toFixed(2)} to ${high.toFixed(2)}`;
  svg.append(title);
  return svg;
}

function renderBytes(bytes: Uint8Array): HTMLElement {
  if (bytes.length === 0) return empty("no bytes");

  const shown = bytes.subarray(0, HEX_LIMIT);
  const lines: string[] = [];
  for (let at = 0; at < shown.length; at += 16) {
    const row = shown.subarray(at, at + 16);
    const hex = [...row].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    // Anything unprintable becomes a dot, the way every hex dump has always
    // done it. Without the text column a dump of a text file is unreadable.
    const text = [...row].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${at.toString(16).padStart(6, "0")}  ${hex.padEnd(47)}  ${text}`);
  }

  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";
  const pre = document.createElement("pre");
  pre.className = "viewer-text";
  pre.textContent = lines.join("\n");
  wrap.append(pre, note(bytes.length, HEX_LIMIT, "bytes"));
  return wrap;
}

function renderPixels(pixels: ImageData): HTMLElement {
  const canvas = document.createElement("canvas");
  canvas.className = "viewer-pixels";
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  canvas.getContext("2d")?.putImageData(pixels, 0, 0);

  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";
  wrap.append(canvas, caption(`${pixels.width} by ${pixels.height}`));
  return wrap;
}

function renderEvents(events: { at: number; value: number; duration?: number }[]): HTMLElement {
  if (events.length === 0) return empty("no events");

  const list = document.createElement("div");
  list.className = "viewer-rows";
  for (const event of events.slice(0, LIST_LIMIT)) {
    const row = document.createElement("div");
    row.className = "viewer-row";
    row.textContent = `${event.at}  ${event.value}${
      event.duration === undefined ? "" : `  for ${event.duration}`
    }`;
    list.append(row);
  }

  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";
  wrap.append(list, note(events.length, LIST_LIMIT, "events"));
  return wrap;
}

function renderNodes(graph: {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string }[];
}): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "viewer-stack";

  const list = document.createElement("div");
  list.className = "viewer-rows";
  for (const node of graph.nodes) {
    const row = document.createElement("div");
    row.className = "viewer-row";
    row.textContent = `⬡ ${node.label}`;
    list.append(row);
  }
  for (const edge of graph.edges) {
    const row = document.createElement("div");
    row.className = "viewer-row viewer-row-dim";
    row.textContent = `${edge.from} → ${edge.to}`;
    list.append(row);
  }

  wrap.append(list, caption(`${graph.nodes.length} nodes, ${graph.edges.length} edges`));
  return wrap;
}

function empty(what: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "viewer-empty";
  el.textContent = `(${what})`;
  return el;
}

function caption(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "viewer-caption";
  el.textContent = text;
  return el;
}

/** Says how much was held back, so a truncated view never passes as the whole file. */
function note(total: number, limit: number, unit: string): HTMLElement {
  return caption(
    total > limit ? `${limit} of ${total} ${unit} shown` : `${total} ${unit}`,
  );
}
