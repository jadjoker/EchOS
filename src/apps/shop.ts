/**
 * AQUATICS — the fish shop.
 *
 * Its stock of fish is generated from the MACHINE seed, so every machine sells
 * different fish and rebooting is how you shop. That is the piece that makes
 * the disposable machines matter to the permanent collection: a reboot is no
 * longer only a fresh aesthetic, it is a fresh shelf, and somewhere out there
 * is a machine selling the fish you want.
 *
 * Upgrades and food are stocked everywhere — a machine that happened not to
 * sell a heater would just be an annoyance rather than a discovery.
 */

import type { AppDef } from "./types.ts";
import type { Influence } from "../core/influence.ts";
import type { OwnedFish, UpgradeId } from "../core/collection.ts";
import type { Rng } from "../core/rng.ts";
import { formatCoins } from "../core/economy.ts";
import { generateLore } from "../gen/fishlore.ts";
import { appShell } from "./controls.ts";

const SPECIES_HEAD = `Golden Spotted Ribbon Paper Glass Blue Banded Dwarf Royal
  Common Lesser Marbled Ghost Velvet Copper Whiptail Fantail Moon Emperor
  Clouded Painted`.trim().split(/\s+/);

const SPECIES_TAIL = `barb tetra danio rasbora guppy molly platy loach gourami
  cichlid catfish angelfish killifish minnow carp perch`.trim().split(/\s+/);

const STOCK_NAMES = `Doug Marbles Biscuit Nelson Admiral Tiny Bubbles Kevin Pearl
  Smudge Captain Jaws Gilbert Norman Sausage Duchess Rocket Peppercorn Waldo
  Mabel Clement Hattie`.trim().split(/\s+/);

interface UpgradeOffer {
  id: UpgradeId;
  label: string;
  blurb: string;
  price: number;
}

const UPGRADES: UpgradeOffer[] = [
  { id: "heater", label: "Heater", price: 240,
    blurb: "Holds the temperature. Cold weather plumbed into the tank stops slowing everyone down." },
  { id: "lamp", label: "Hood lamp", price: 190,
    blurb: "Lights the tank properly. The colours were always this bright." },
  { id: "castle", label: "Ceramic castle", price: 160,
    blurb: "Traditional. Hollow, which at least one previous occupant has commented on." },
  { id: "annexe", label: "Tank annexe", price: 520,
    blurb: "Room for three more. Bolts on the side, not entirely straight." },
  { id: "conservatory", label: "Conservatory", price: 900,
    blurb: "Room for four more on top of the annexe. Absurd, and you will want it." },
];

/** A shelf row that owns its element and knows how to update it in place. */
interface Row {
  el: HTMLElement;
  refresh(): void;
}

interface FishOffer {
  key: string;
  name: string;
  species: string;
  hue: number;
  size: number;
  price: number;
  note: string;
}

/**
 * Priced by how unusual the roll was, so a rare-looking fish costs more.
 *
 * `taken` is the set of names already spoken for — your collection, plus
 * whatever else is on the shelf — and is added to as offers are made. The tank
 * is where a duplicate would actually show up, but the shop is where it gets
 * created, and a fish you own can never be renamed to fix it later.
 */
function makeFishOffer(rng: Rng, index: number, taken: Set<string>): FishOffer {
  const rare = rng.chance(0.25);
  const size = rng.range(0.05, rare ? 0.14 : 0.1);
  const free = STOCK_NAMES.filter((candidate) => !taken.has(candidate));
  // A shelf with nothing new to call anything is better than no shelf at all.
  const name = rng.pick(free.length ? free : STOCK_NAMES);
  taken.add(name);
  return {
    key: `offer-${index}`,
    name,
    species: `${rng.pick(SPECIES_HEAD)} ${rng.pick(SPECIES_TAIL)}`,
    hue: rng.int(0, 359),
    size,
    price: Math.round((rare ? 300 : 120) + size * 900 + rng.int(0, 80)),
    note: rare
      ? rng.pick(["only one in", "not usually stocked", "came in by mistake", "the owner is reluctant"])
      : rng.pick(["hardy", "good with others", "eats anything", "no trouble", "young"]),
  };
}

export const shopApp: AppDef = {
  id: "shop",
  title: "Aquatics",
  glyph: "🛒",
  width: 380,
  height: 420,
  minWidth: 300,
  minHeight: 260,

  create(ctx) {
    const { root, controls, stage } = appShell();

    const balance = document.createElement("div");
    balance.className = "shop-balance";
    controls.append(balance);

    const list = document.createElement("div");
    list.className = "shop-list";
    stage.append(list);

    const notice = document.createElement("div");
    notice.className = "shop-notice";

    // Stock is seeded from the machine, so it is the same shelf all session and
    // a different shelf on the next boot.
    const stockRng = ctx.rng.derive("stock");
    // Shared across the shelf, so no two offers are called the same thing
    // either — seeded with what you already own.
    const stocked = new Set(ctx.collection.fish.map((f) => f.name));
    const offers = Array.from({ length: stockRng.int(2, 4) }, (_, i) =>
      makeFishOffer(stockRng, i, stocked));
    const sold = new Set<string>();

    let flash = "";
    let flashTimer = 0;

    function say(message: string): void {
      flash = message;
      clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => { flash = ""; render(); }, 2400);
      render();
    }

    function buyFish(offer: FishOffer): void {
      if (sold.has(offer.key)) return;
      if (ctx.collection.fish.length >= ctx.collection.capacity) {
        say("Your tank is full. Buy an annexe first.");
        return;
      }
      if (!ctx.economy.spend(offer.price)) {
        say(`Not enough coins — ${formatCoins(offer.price - ctx.economy.balance)} short.`);
        return;
      }
      const owned: OwnedFish = {
        id: `${Date.now().toString(36)}-${offer.key}`,
        name: offer.name,
        species: offer.species,
        hue: offer.hue,
        size: offer.size,
        lore: generateLore(ctx.rng.derive(`lore:${offer.key}:${Date.now()}`), false),
        acquiredAt: Date.now(),
      };
      ctx.collection.addFish(owned);
      sold.add(offer.key);
      ctx.nudge("tinker");
      say(`${offer.name} is yours. Bagged and ready.`);
    }

    function buyEgg(): void {
      const price = 70;
      if (ctx.collection.fish.length >= ctx.collection.capacity) {
        say("Your tank is full. Buy an annexe first.");
        return;
      }
      if (!ctx.economy.spend(price)) {
        say(`Not enough coins — ${formatCoins(price - ctx.economy.balance)} short.`);
        return;
      }
      // Eggs roll fresh every time: the gamble is the product.
      const eggRng = ctx.rng.derive(`egg:${Date.now()}:${ctx.collection.fish.length}`);
      const hatched = makeFishOffer(eggRng, 99, new Set(ctx.collection.fish.map((f) => f.name)));
      ctx.collection.addFish({
        id: `${Date.now().toString(36)}-egg`,
        name: hatched.name,
        species: hatched.species,
        hue: hatched.hue,
        size: hatched.size,
        lore: generateLore(eggRng, false),
        acquiredAt: Date.now(),
      });
      ctx.nudge("tinker");
      say(`It hatched. ${hatched.name}, a ${hatched.species.toLowerCase()}.`);
    }

    function buyFood(): void {
      const price = 20;
      if (!ctx.economy.spend(price)) {
        say(`Not enough coins — ${formatCoins(price - ctx.economy.balance)} short.`);
        return;
      }
      ctx.collection.addFood(10);
      ctx.nudge("tinker");
      say("Ten feeds of flake.");
    }

    function buyUpgrade(upgrade: UpgradeOffer): void {
      if (ctx.collection.has(upgrade.id)) return;
      if (!ctx.economy.spend(upgrade.price)) {
        say(`Not enough coins — ${formatCoins(upgrade.price - ctx.economy.balance)} short.`);
        return;
      }
      ctx.collection.addUpgrade(upgrade.id);
      ctx.nudge("tinker");
      say(`${upgrade.label} fitted.`);
    }

    function itemRow(
      title: string,
      price: number,
      action: () => void,
      detailNow: () => string,
      stateNow: () => "" | "sold" | "owned",
    ): Row {
      const row = document.createElement("div");
      row.className = "shop-item";

      const text = document.createElement("div");
      text.className = "shop-item-text";
      const heading = document.createElement("div");
      heading.className = "shop-item-title";
      heading.textContent = title;
      const sub = document.createElement("div");
      sub.className = "shop-item-detail";
      text.append(heading, sub);

      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "shop-buy";
      // Bound ONCE. Rebuilding this button on every economy tick was the bug:
      // the balance changes four times a second, so a real press-and-release
      // straddled a rebuild and the click event never fired. Programmatic
      // .click() is synchronous and never noticed.
      buy.addEventListener("click", action);

      row.append(text, buy);

      return {
        el: row,
        refresh() {
          const state = stateNow();
          row.classList.toggle("is-sold", state === "sold");
          row.classList.toggle("is-owned", state === "owned");
          sub.textContent = detailNow();

          if (state === "sold") {
            buy.textContent = "sold";
            buy.disabled = true;
          } else if (state === "owned") {
            buy.textContent = "fitted";
            buy.disabled = true;
          } else {
            buy.textContent = formatCoins(price);
            buy.disabled = ctx.economy.balance < price;
          }
        },
      };
    }

    function section(label: string): HTMLElement {
      const el = document.createElement("div");
      el.className = "shop-section";
      el.textContent = label;
      return el;
    }

    // Built once; only the labels and disabled states change afterwards.
    const rows: Row[] = [];

    list.append(section("Livestock"));
    for (const offer of offers) {
      const row = itemRow(
        `${offer.name} — ${offer.species}`,
        offer.price,
        () => buyFish(offer),
        () => offer.note,
        () => (sold.has(offer.key) ? "sold" : ""),
      );
      rows.push(row);
      list.append(row.el);
    }
    {
      const row = itemRow("Unmarked egg", 70, buyEgg,
        () => "Nobody is certain what is in it.", () => "");
      rows.push(row);
      list.append(row.el);
    }

    list.append(section("Sundries"));
    {
      const row = itemRow("Tin of flake", 20, buyFood,
        () => (ctx.collection.food > 0 ? `${ctx.collection.food} feeds left` : "Ten feeds"),
        () => "");
      rows.push(row);
      list.append(row.el);
    }

    list.append(section("Fittings"));
    for (const upgrade of UPGRADES) {
      const row = itemRow(upgrade.label, upgrade.price, () => buyUpgrade(upgrade),
        () => upgrade.blurb,
        () => (ctx.collection.has(upgrade.id) ? "owned" : ""));
      rows.push(row);
      list.append(row.el);
    }

    list.append(notice);

    function render(): void {
      balance.textContent = `${formatCoins(ctx.economy.balance)} coins · tank ${ctx.collection.fish.length}/${ctx.collection.capacity}`;
      for (const row of rows) row.refresh();
      notice.textContent = flash || "Stock varies by machine. A different computer sells different fish.";
    }

    // Prices grey out as the balance moves, so affordability is visible without
    // having to click and be refused.
    const offEconomy = ctx.economy.onChange(render);
    const offCollection = ctx.collection.onChange(render);
    render();

    return {
      body: root,
      dispose: () => {
        offEconomy();
        offCollection();
        clearTimeout(flashTimer);
      },
      node: {
        id: ctx.id,
        title: ctx.title,
        emit(): Influence {
          return {
            sources: [ctx.title],
            tags: ["commercial", "aquatic"],
            agents: [],
            // What is on the shelf travels: a site fed by the shop starts
            // mentioning the species nobody has bought yet.
            words: [
              ...offers.map((o) => o.species.toLowerCase()),
              ...offers.map((o) => o.name),
            ],
            palette: offers.map((o) => o.hue),
            rhythm: [],
            scalars: { stock: offers.length - sold.size },
          };
        },
        absorb() {
          /* the shop sells; it does not listen */
        },
      },
    };
  },
};
