/**
 * Coins.
 *
 * They accrue on a timer. Using the machine makes them accrue faster. Nothing
 * pays out for a specific action, which is deliberate — the earlier proposal
 * was a coin per article read, and paying per page turns the browser from
 * somewhere you explore into somewhere you farm. A rate means curiosity is
 * still free; you are paid for being here, slightly more for being busy.
 *
 * The trap in "more interaction means more coins" is that the optimal strategy
 * becomes hammering one button. So heat is tracked PER KIND of activity and
 * each kind saturates: doing five different things holds the rate at maximum,
 * while spamming one thing holds it at a fifth of maximum. Variety is the only
 * way up, and variety is indistinguishable from playing properly.
 */

export type ActivityKind =
  | "window"   // opening and closing programs
  | "connect"  // patching programs together
  | "navigate" // going somewhere in the browser
  | "inspect"  // opening a detail view
  | "tinker";  // operating a control

const KINDS: ActivityKind[] = ["window", "connect", "navigate", "inspect", "tinker"];

/** Coins per second with the machine sitting idle. */
const BASE_RATE = 0.15;
/** Multiplier at full heat, so varied play earns five times idle. */
const HEAT_BONUS = 4;
/** One nudge is worth a third of a kind's saturation — three uses maxes it. */
const NUDGE_STEP = 0.34;
/** Per second. Heat half-life is a bit under a minute. */
const DECAY = 0.985;
const TICK_MS = 250;

const STORAGE_KEY = "echos.coins";

export class Economy {
  private coins = 0;
  /** Per-kind saturation, each 0–1. */
  private readonly recent = new Map<ActivityKind, number>();
  private readonly listeners = new Set<() => void>();
  private timer = 0;
  private last = 0;

  constructor() {
    this.coins = readStoredBalance();
  }

  get balance(): number {
    return this.coins;
  }

  /** 0–1. Shown as a small activity meter rather than a number. */
  get heat(): number {
    let sum = 0;
    for (const kind of KINDS) sum += this.recent.get(kind) ?? 0;
    return sum / KINDS.length;
  }

  /** Coins per second at this instant. */
  get rate(): number {
    return BASE_RATE * (1 + this.heat * HEAT_BONUS);
  }

  /**
   * Register a piece of activity. Cheap and safe to call often — a kind that is
   * already saturated gains nothing, which is what stops button-mashing from
   * outperforming ordinary use.
   */
  nudge(kind: ActivityKind): void {
    this.recent.set(kind, Math.min(1, (this.recent.get(kind) ?? 0) + NUDGE_STEP));
  }

  /** Returns false and changes nothing if the balance is too low. */
  spend(amount: number): boolean {
    if (amount < 0 || this.coins < amount) return false;
    this.coins -= amount;
    this.persist();
    this.changed();
    return true;
  }

  /** For rewards that are not rate-based. Nothing grants yet; the shop will. */
  grant(amount: number): void {
    if (amount <= 0) return;
    this.coins += amount;
    this.persist();
    this.changed();
  }

  start(): void {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = 0;
  }

  private tick(): void {
    const now = performance.now();
    // Wall-clock delta rather than a fixed step: a throttled background tab
    // fires this far less often, and players should not be quietly robbed for
    // having switched away.
    const dt = Math.min(5, (now - this.last) / 1000);
    this.last = now;

    this.coins += this.rate * dt;

    const decay = DECAY ** dt;
    for (const kind of KINDS) {
      const value = (this.recent.get(kind) ?? 0) * decay;
      if (value < 0.001) this.recent.delete(kind);
      else this.recent.set(kind, value);
    }

    this.persist();
    this.changed();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Coins survive a reboot when nothing else about the machine does.
   *
   * That is a deliberate exception rather than an oversight — the design doc
   * wanted exactly one thing that persists across installs, and a balance you
   * carry between machines is a better candidate than a mysterious file.
   */
  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.floor(this.coins * 100) / 100));
    } catch {
      /* private browsing, storage disabled — the session still works */
    }
  }
}

function readStoredBalance(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function formatCoins(value: number): string {
  return Math.floor(value).toLocaleString();
}
