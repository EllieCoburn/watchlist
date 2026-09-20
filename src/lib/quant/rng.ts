/** Seeded, reproducible randomness so every simulation run can be replayed for audit. */

export type Rng = {
  /** Uniform in [0, 1). */
  uniform(): number;
  /** Standard normal. */
  gaussian(): number;
  /** Integer in [0, n). */
  int(n: number): number;
};

export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** xoshiro128** — fast, good quality, 32-bit state ×4. */
export function createRng(seed: number): Rng {
  let s0 = (seed ^ 0x9e3779b9) >>> 0 || 1;
  let s1 = (Math.imul(seed, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0 || 2;
  let s2 = (Math.imul(seed + 1, 0x27d4eb2f) ^ 0x165667b1) >>> 0 || 3;
  let s3 = (Math.imul(seed + 2, 0x9e3779b1) ^ 0x3c6ef372) >>> 0 || 4;
  // Warm up so nearby seeds diverge.
  const next = (): number => {
    const result = (Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0) / 4294967296;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };
  for (let i = 0; i < 16; i++) next();

  let spare: number | null = null;
  return {
    uniform: next,
    gaussian() {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      // Marsaglia polar method.
      let u: number, v: number, s: number;
      do {
        u = next() * 2 - 1;
        v = next() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const m = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * m;
      return u * m;
    },
    int(n) {
      return Math.floor(next() * n);
    },
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Weighted sampler over indices 0..n-1 (Walker alias method): O(1) per draw.
 */
export function createWeightedSampler(weights: ArrayLike<number>): (rng: Rng) => number {
  const n = weights.length;
  if (n === 0) throw new Error("weighted sampler needs at least one weight");
  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i];
  const prob = new Float64Array(n);
  const alias = new Int32Array(n);
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 0; i < n; i++) {
    prob[i] = (weights[i] / total) * n;
    (prob[i] < 1 ? small : large).push(i);
  }
  while (small.length && large.length) {
    const s = small.pop()!;
    const l = large.pop()!;
    alias[s] = l;
    prob[l] = prob[l] + prob[s] - 1;
    (prob[l] < 1 ? small : large).push(l);
  }
  for (const i of [...small, ...large]) prob[i] = 1;
  return (rng) => {
    const i = rng.int(n);
    return rng.uniform() < prob[i] ? i : alias[i];
  };
}
