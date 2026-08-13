#!/usr/bin/env node
/**
 * Run an expression inside the running desktop build, and print what it says.
 *
 * The browser pane cannot see into an Electron window, which meant the desktop
 * app was the one place the game could not be checked. That was the wrong way
 * round: the desktop build is the product, and it is also the only place where
 * a few things are even true. A hidden browser tab never fires
 * requestAnimationFrame and refuses to play video, so animation, the influence
 * bus and the tank backdrop could all only be reasoned about. In a real window
 * they simply run.
 *
 * This talks to Electron's remote debugging port over CDP. Node has a
 * WebSocket built in now, so there is no dependency and nothing to install.
 *
 * Usage:
 *   npm run desktop:debug                       # launch with the port open
 *   node tools/desktop-eval.mjs "document.title"
 *   node tools/desktop-eval.mjs --file probe.js
 *
 * The expression is evaluated in the renderer, exactly as if typed into its
 * console. A promise is awaited. Anything returned is printed as JSON.
 */

import { readFileSync } from "node:fs";

const PORT = Number(process.env.ECHOS_DEBUG_PORT ?? 9222);
const args = process.argv.slice(2);

const expression = args[0] === "--file"
  ? readFileSync(args[1], "utf8")
  : args.join(" ");

if (!expression.trim()) {
  console.error(`
  Run an expression inside the running desktop build.

    node tools/desktop-eval.mjs "document.title"
    node tools/desktop-eval.mjs --file probe.js

  Start the app with the port open first:  npm run desktop:debug
`);
  process.exit(1);
}

/** The renderer, as opposed to devtools or a service worker. */
async function findPage() {
  let targets;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    targets = await res.json();
  } catch {
    throw new Error(
      `Nothing listening on ${PORT}. Start the app with: npm run desktop:debug`,
    );
  }
  const page = targets.find(
    (t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string",
  );
  if (!page) throw new Error("Debugger is up but no page target. Is the window open?");
  return page;
}

async function evaluate(page, expr) {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not open the debugger socket")), { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const settle = pending.get(message.id);
    if (settle) {
      pending.delete(message.id);
      settle(message);
    }
  });

  const send = (method, params) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send("Runtime.enable", {});
  const reply = await send("Runtime.evaluate", {
    expression: expr,
    // So an async probe can be written as a plain IIFE, the same as in the
    // browser pane. Without this every result would come back as a Promise.
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  socket.close();

  if (reply.result?.exceptionDetails) {
    const detail = reply.result.exceptionDetails;
    throw new Error(detail.exception?.description ?? detail.text ?? "threw");
  }
  return reply.result?.result?.value;
}

try {
  const page = await findPage();
  const value = await evaluate(page, expression);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 1));
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}
