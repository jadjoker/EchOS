/**
 * Talking to the running desktop build over CDP.
 *
 * Extracted because the same three things kept being rewritten by hand every
 * time something needed checking in the real application: open the debugger
 * socket, evaluate an expression, grab a screenshot. Each was a dozen lines of
 * WebSocket plumbing pasted afresh, which is both slow to write and a way to
 * get a subtly different pending-message map every time.
 *
 * The window handling is here for a reason that cost a session's worth of
 * confusion once already. A minimised or fully occluded Electron window reports
 * `visibilityState: hidden`, exactly like a background browser tab: rAF stops,
 * canvases sit at their unresized default, and any probe of animation reports
 * that nothing is moving when the code is fine. `Page.bringToFront` does not
 * fix it. Restoring the OS window does, which needs a Win32 call, which is why
 * there is PowerShell in a file otherwise made of WebSockets.
 */

import { execFileSync } from "node:child_process";

const PORT = Number(process.env.ECHOS_DEBUG_PORT ?? 9222);

/** The renderer, as opposed to devtools or a service worker. */
export async function findPage() {
  let targets;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    targets = await res.json();
  } catch {
    throw new Error(`Nothing listening on ${PORT}. Start the app with: npm run desktop:debug`);
  }
  const page = targets.find(
    (t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string",
  );
  if (!page) throw new Error("Debugger is up but no page target. Is the window open?");
  return page;
}

/**
 * A connection that can be asked several things before it is closed.
 *
 * Returned rather than wrapped one-call-at-a-time so a caller that wants to
 * evaluate and then screenshot does not pay for two sockets.
 */
export async function connect(page) {
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

  return {
    send,
    async evaluate(expression) {
      await send("Runtime.enable", {});
      const reply = await send("Runtime.evaluate", {
        expression,
        // So an async probe can be written as a plain IIFE. Without this every
        // result would come back as a Promise.
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (reply.result?.exceptionDetails) {
        const detail = reply.result.exceptionDetails;
        throw new Error(detail.exception?.description ?? detail.text ?? "threw");
      }
      return reply.result?.result?.value;
    },
    async screenshot() {
      await send("Page.enable", {});
      const shot = await send("Page.captureScreenshot", { format: "png" });
      return Buffer.from(shot.result.data, "base64");
    },
    close: () => socket.close(),
  };
}

/**
 * Restore and focus whichever window owns the debug port.
 *
 * Finds it by port rather than by title, because a leftover instance from an
 * earlier session is common and only one of them is the one being debugged.
 * Best effort: if the window cannot be found the probe should still run, it
 * will just be probing a throttled renderer, so this reports rather than
 * throws.
 */
export function bringToFront() {
  const script = `
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EchosWin {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
    $owner = (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
    if (-not $owner) { "no listener"; exit }
    $p = Get-Process -Id $owner -ErrorAction SilentlyContinue
    if (-not $p -or $p.MainWindowHandle -eq 0) { "no window"; exit }
    [EchosWin]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
    [EchosWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
    "restored " + $p.MainWindowTitle
  `;
  try {
    return execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
  } catch (error) {
    return `could not restore the window (${error.message.split("\n")[0]})`;
  }
}

/** Give the renderer a moment, then confirm rAF is actually running. */
export async function awaitVisible(session, timeoutMs = 4000) {
  return session.evaluate(`new Promise((resolve) => {
    let frames = 0;
    const tick = () => { if (++frames >= 3) resolve("visible"); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => resolve(frames >= 3 ? "visible" : "throttled: " + document.visibilityState), ${timeoutMs});
  })`);
}
