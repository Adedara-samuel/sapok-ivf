/** Deterministic PRNG (mulberry32) so every reset produces the identical demo. */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  float(min: number, max: number, decimals?: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;
  return {
    next,
    int,
    float: (min, max, decimals = 1) => {
      const f = 10 ** decimals;
      return Math.round((next() * (max - min) + min) * f) / f;
    },
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("Cannot pick from an empty list");
      return item;
    },
    chance: (p) => next() < p,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const a = copy[i];
        const b = copy[j];
        if (a !== undefined && b !== undefined) {
          copy[i] = b;
          copy[j] = a;
        }
      }
      return copy;
    },
  };
}
