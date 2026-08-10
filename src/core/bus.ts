/**
 * The typed data bus.
 *
 * Every app declares what it consumes and what it produces. The desktop is the
 * composition surface: drag one app's output onto another and if the types are
 * compatible, something happens. Without this the machine is a random menu of
 * toys that goes dead by boot 3; with it, players find combinations nobody
 * authored.
 *
 * Only the vocabulary lives here. The compatibility *grammar* — which pairs are
 * allowed, and what each pairing does — arrives with the first three apps,
 * because it should be designed against real apps rather than in the abstract.
 */

export type BusType =
  | "text"
  | "numbers"
  | "samples"
  | "pixels"
  | "events"
  | "nodes"
  | "bytes";

export interface BusTypeInfo {
  /** Shown in file listings and app "accepts:" affordances. */
  label: string;
  /** Single character stand-in until the icon generator exists. */
  glyph: string;
}

export const BUS_TYPES: Record<BusType, BusTypeInfo> = {
  text: { label: "text", glyph: "≡" },
  numbers: { label: "numbers", glyph: "#" },
  samples: { label: "samples", glyph: "∿" },
  pixels: { label: "pixels", glyph: "▦" },
  events: { label: "events", glyph: "♩" },
  nodes: { label: "nodes", glyph: "⬡" },
  bytes: { label: "bytes", glyph: "⬚" },
};

/**
 * Runtime payloads, keyed by BusType. `VFile.data` is narrowed through this,
 * so adding a bus type forces every switch over payloads to be updated.
 */
export interface BusPayloads {
  text: string;
  numbers: number[];
  samples: Float32Array;
  pixels: ImageData;
  events: BusEvent[];
  nodes: BusGraph;
  bytes: Uint8Array;
}

export interface BusEvent {
  /** Beats, seconds, or arbitrary steps — whoever produced it decides. */
  at: number;
  value: number;
  duration?: number;
}

export interface BusGraph {
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string }[];
}

export type BusValue = {
  [K in BusType]: { type: K; data: BusPayloads[K] };
}[BusType];

/**
 * Coercion is where the surprise lives.
 *
 * Strict typing would make the bus safe and boring: numbers to numbers, and
 * nothing else connects. Letting text arrive at a port that wanted numbers —
 * as character codes — is what makes dragging somebody's note into a waveform
 * viewer do something, and that is the whole product in one interaction.
 *
 * Deliberately lossy and deliberately literal. A clever conversion would be
 * less interesting than an obvious one.
 */
const COERCIONS: Partial<Record<BusType, Partial<Record<BusType, (v: never) => BusValue>>>> = {
  text: {
    numbers: (v: string) => ({ type: "numbers", data: [...v].map((c) => c.charCodeAt(0)) }),
    bytes: (v: string) => ({ type: "bytes", data: new TextEncoder().encode(v) }),
  },
  numbers: {
    text: (v: number[]) => ({ type: "text", data: v.join(", ") }),
    samples: (v: number[]) => ({ type: "samples", data: Float32Array.from(v) }),
  },
  samples: {
    numbers: (v: Float32Array) => ({ type: "numbers", data: Array.from(v) }),
  },
  bytes: {
    numbers: (v: Uint8Array) => ({ type: "numbers", data: Array.from(v) }),
    text: (v: Uint8Array) => ({ type: "text", data: new TextDecoder().decode(v) }),
  },
  events: {
    numbers: (v: BusEvent[]) => ({ type: "numbers", data: v.map((e) => e.value) }),
  },
};

export function canCoerce(from: BusType, to: BusType): boolean {
  return from === to || COERCIONS[from]?.[to] !== undefined;
}

/** Returns null when there is no route from `value` to any accepted type. */
export function coerce(
  value: BusValue,
  accepted: readonly BusType[],
): BusValue | null {
  if (accepted.includes(value.type)) return value;
  for (const target of accepted) {
    const convert = COERCIONS[value.type]?.[target];
    if (convert) return (convert as (v: unknown) => BusValue)(value.data);
  }
  return null;
}
