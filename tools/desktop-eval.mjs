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
 * Usage:
 *   npm run desktop:debug                       # launch with the port open
 *   node tools/desktop-eval.mjs "document.title"
 *   node tools/desktop-eval.mjs --file probe.js
 *   node tools/desktop-eval.mjs --front "..."   # restore the window first
 *
 * The expression is evaluated in the renderer, exactly as if typed into its
 * console. A promise is awaited. Anything returned is printed as JSON.
 *
 * Reach for --front whenever the thing being checked moves. A minimised or
 * fully occluded window reports visibilityState "hidden" just like a
 * background tab: rAF stops and a probe will report that nothing is animating
 * when the code is perfectly fine.
 */

import { readFileSync } from "node:fs";
import { awaitVisible, bringToFront, connect, findPage } from "./lib/desktop.mjs";

const args = process.argv.slice(2);
const wantsFront = args.includes("--front");
const rest = args.filter((a) => a !== "--front");

const expression = rest[0] === "--file"
  ? readFileSync(rest[1], "utf8")
  : rest.join(" ");

if (!expression.trim()) {
  console.error(`
  Run an expression inside the running desktop build.

    node tools/desktop-eval.mjs "document.title"
    node tools/desktop-eval.mjs --file probe.js
    node tools/desktop-eval.mjs --front "..."   # restore the window first

  Start the app with the port open first:  npm run desktop:debug
`);
  process.exit(1);
}

try {
  if (wantsFront) console.error(`  ${bringToFront()}`);

  const session = await connect(await findPage());
  if (wantsFront) console.error(`  ${await awaitVisible(session)}`);

  const value = await session.evaluate(expression);
  session.close();
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 1));
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}
