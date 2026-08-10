/**
 * What you own, as opposed to what the machine happens to be.
 *
 * Everything else in EchOS is thrown away on reboot — the aesthetic, the
 * programs, the whole web. This is the exception, and it is the exception on
 * purpose:
 *
 *   The machine is different every time you turn it on. The fish are yours.
 *
 * Coins alone could not carry that, because a balance you can only spend on
 * things that evaporate is worse than no economy at all. A small permanent
 * collection travelling between disposable machines is the thing the design
 * doc's "one thing that survives a reinstall" was reaching for.
 */

import type { FishLore } from "../gen/fishlore.ts";

export interface OwnedFish {
  id: string;
  name: string;
  species: string;
  hue: number;
  size: number;
  lore: FishLore;
  /** Epoch ms, so the tank can show who has been with you longest. */
  acquiredAt: number;
}

export type UpgradeId = "heater" | "lamp" | "castle" | "annexe" | "conservatory";

/** Base tank capacity before any expansion is bought. */
const BASE_CAPACITY = 3;

const CAPACITY_BONUS: Partial<Record<UpgradeId, number>> = {
  annexe: 3,
  conservatory: 4,
};

const STORAGE_KEY = "echos.collection";

interface Stored {
  fish: OwnedFish[];
  upgrades: UpgradeId[];
  food: number;
}

export class Collection {
  private fishOwned: OwnedFish[] = [];
  private upgradesOwned = new Set<UpgradeId>();
  private foodCount = 0;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const stored = read();
    this.fishOwned = stored.fish;
    this.upgradesOwned = new Set(stored.upgrades);
    this.foodCount = stored.food;
  }

  get fish(): readonly OwnedFish[] {
    return this.fishOwned;
  }

  get food(): number {
    return this.foodCount;
  }

  /** How many owned fish the tank can show at once. */
  get capacity(): number {
    let capacity = BASE_CAPACITY;
    for (const id of this.upgradesOwned) capacity += CAPACITY_BONUS[id] ?? 0;
    return capacity;
  }

  has(upgrade: UpgradeId): boolean {
    return this.upgradesOwned.has(upgrade);
  }

  addFish(fish: OwnedFish): void {
    this.fishOwned.push(fish);
    this.save();
  }

  addUpgrade(id: UpgradeId): void {
    this.upgradesOwned.add(id);
    this.save();
  }

  addFood(count: number): void {
    this.foodCount += count;
    this.save();
  }

  /** Returns false when the tin is empty; feeding by hand still works. */
  useFood(): boolean {
    if (this.foodCount <= 0) return false;
    this.foodCount -= 1;
    this.save();
    return true;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private save(): void {
    const payload: Stored = {
      fish: this.fishOwned,
      upgrades: [...this.upgradesOwned],
      food: this.foodCount,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage unavailable — the session still works, it just won't carry */
    }
    for (const listener of this.listeners) listener();
  }
}

function read(): Stored {
  const empty: Stored = { fish: [], upgrades: [], food: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return empty;

    // Hand-checked rather than trusted: this is player-editable storage that
    // has to survive schema changes across versions without wiping a
    // collection somebody has spent real sessions building.
    const record = parsed as Partial<Stored>;
    return {
      fish: Array.isArray(record.fish) ? record.fish.filter(isOwnedFish) : [],
      upgrades: Array.isArray(record.upgrades) ? record.upgrades : [],
      food: typeof record.food === "number" && record.food >= 0 ? record.food : 0,
    };
  } catch {
    return empty;
  }
}

function isOwnedFish(value: unknown): value is OwnedFish {
  if (typeof value !== "object" || value === null) return false;
  const fish = value as Partial<OwnedFish>;
  return (
    typeof fish.id === "string" &&
    typeof fish.name === "string" &&
    typeof fish.hue === "number" &&
    typeof fish.lore === "object" &&
    fish.lore !== null
  );
}
