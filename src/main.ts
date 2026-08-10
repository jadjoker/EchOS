import "./theme/tokens.css";
import "./style.css";

import { Rng, normalizeSeed, randomSeed } from "./core/rng.ts";
import { generateIdentity } from "./gen/naming.ts";
import { populate } from "./gen/clutter.ts";
import { Vfs } from "./fs/vfs.ts";
import { runBoot } from "./boot/boot.ts";
import { generateTheme, applyTheme } from "./theme/generate.ts";
import { WindowManager } from "./wm/manager.ts";
import { createAbout } from "./shell/about.ts";
import { Workspace } from "./workspace.ts";
import { createDesktopIcons, type IconSpec } from "./desktop/icons.ts";
import { browserApp } from "./apps/browser.ts";
import { fishTankApp } from "./apps/fishtank.ts";
import { weatherApp } from "./apps/weather.ts";
import { filesApp } from "./apps/filesapp.ts";

/**
 * A seed in the URL boots that exact machine; without one you get a new
 * machine. We deliberately do NOT write the seed back to the URL — the whole
 * pitch is that opening it again gives you something else, and a self-populating
 * URL would quietly turn refresh into "the same machine forever". Keeping a
 * machine is an explicit act, via Copy link.
 */
function resolveSeed(): string {
  const requested = new URLSearchParams(window.location.search).get("seed");
  return (requested && normalizeSeed(requested)) || randomSeed();
}

async function main(): Promise<void> {
  const screen = document.getElementById("screen");
  if (!screen) throw new Error("no #screen element");

  const rng = Rng.fromSeed(resolveSeed());
  const identity = generateIdentity(rng);

  // Applied before the boot sequence so the POST screen is already wearing the
  // machine's aesthetic. Theming only the desktop would make the boot a stock
  // intro that happens to precede the game, rather than part of the machine.
  const theme = generateTheme(rng);
  applyTheme(theme);

  // Game name first: browser tabs truncate the end, so leading with EchOS keeps
  // the brand visible while the generated machine name still gets to be there.
  document.title = `EchOS — ${identity.osName}`;

  const vfs = new Vfs();
  populate(vfs, rng, identity);

  await runBoot(screen, rng, identity);

  const desktop = document.createElement("div");
  desktop.className = "desktop";
  screen.append(desktop);

  const wm = new WindowManager(screen);

  const workspace = new Workspace(screen, wm, rng, vfs);

  // Nothing opens on boot. An empty desktop you have to explore reads as a
  // machine somebody left behind; a pre-arranged set of windows reads as a demo.
  const programs = [browserApp, fishTankApp, weatherApp, filesApp];
  const icons: IconSpec[] = programs.map((def) => ({
    id: def.id,
    label: def.title,
    glyph: def.glyph,
    open: () => workspace.openApp(def),
  }));

  let aboutOpen = false;
  icons.push({
    id: "about",
    label: identity.osName,
    glyph: "◈",
    open: () => {
      if (aboutOpen) return;
      aboutOpen = true;
      wm.open({
        title: `About ${identity.osName}`,
        body: createAbout(identity, theme),
        width: 300,
        height: 300,
        resizable: false,
        onClose: () => { aboutOpen = false; },
      });
    },
  });

  createDesktopIcons(desktop, icons, rng);
}

/**
 * A machine that fails to boot should say so. Silently rendering an empty
 * desktop is the worst possible outcome — indistinguishable from a machine that
 * generated nothing.
 */
void main().catch((error: unknown) => {
  console.error("boot failed", error);
  const screen = document.getElementById("screen");
  if (!screen) return;
  const panel = document.createElement("pre");
  panel.className = "boot";
  panel.style.whiteSpace = "pre-wrap";
  panel.textContent = `HALTED\n\n${error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error)}`;
  screen.append(panel);
});
