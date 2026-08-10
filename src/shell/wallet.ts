/**
 * The coin readout, parked in the taskbar tray.
 *
 * Shows the balance and a small activity meter. The meter matters more than it
 * looks: without it the rate multiplier is invisible, and an invisible
 * multiplier is one players never learn about and never feel rewarded by.
 */

import { formatCoins, type Economy } from "../core/economy.ts";

export function createWallet(economy: Economy): HTMLElement {
  const root = document.createElement("div");
  root.className = "wallet";

  const glyph = document.createElement("span");
  glyph.className = "wallet-glyph";
  glyph.textContent = "◉";

  const amount = document.createElement("span");
  amount.className = "wallet-amount";

  const meter = document.createElement("span");
  meter.className = "wallet-meter";
  const fill = document.createElement("span");
  fill.className = "wallet-meter-fill";
  meter.append(fill);

  root.append(glyph, amount, meter);

  const render = () => {
    amount.textContent = formatCoins(economy.balance);
    fill.style.width = `${Math.round(economy.heat * 100)}%`;
    root.title =
      `${formatCoins(economy.balance)} coins · ` +
      `${economy.rate.toFixed(2)}/sec · ` +
      `activity ${Math.round(economy.heat * 100)}%\n` +
      `Coins accrue on their own. Doing several different things keeps the rate up; ` +
      `repeating one thing does not.`;
  };

  economy.onChange(render);
  render();
  return root;
}
