#!/usr/bin/env node
/**
 * Screenshot the running desktop build.
 *
 * There was no way to see the real application short of writing the CDP
 * plumbing out by hand each time, which meant a fifteen line script pasted
 * into the terminal for every screenshot of a window that had just been
 * changed. This is that, once.
 *
 * Usage:
 *   npm run desktop:debug                       # launch with the port open
 *   node tools/desktop-shot.mjs shot.png
 *   node tools/desktop-shot.mjs shot.png --front       # restore the window first
 *   node tools/desktop-shot.mjs shot.png --front --run "probe.js"
 *
 * --front matters more than it sounds. A minimised window is throttled exactly
 * like a hidden browser tab, so its canvases never redraw and the screenshot
 * comes back showing whatever was on screen when it was minimised.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { awaitVisible, bringToFront, connect, findPage } from "./lib/desktop.mjs";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const wantsFront = args.includes("--front");
const runIndex = args.indexOf("--run");
const runFile = runIndex === -1 ? null : args[runIndex + 1];

if (!out) {
  console.error(`
  Screenshot the running desktop build.

    node tools/desktop-shot.mjs shot.png [--front] [--run probe.js]

  Start the app with the port open first:  npm run desktop:debug
`);
  process.exit(1);
}

try {
  if (wantsFront) console.error(`  ${bringToFront()}`);

  const session = await connect(await findPage());

  if (wantsFront) console.error(`  ${await awaitVisible(session)}`);

  // Anything the shot needs set up first: open a window, navigate, scroll.
  if (runFile) {
    const value = await session.evaluate(readFileSync(runFile, "utf8"));
    if (value !== undefined) console.error(`  ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }

  writeFileSync(out, await session.screenshot());
  session.close();
  console.log(out);
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}
