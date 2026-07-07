/**
 * Deterministic, dependency-free randomness for procedural generation.
 * All world geometry must be reproducible from a spec-derived seed so that
 * the same book pack renders identically on every device and every load.
 */

/** FNV-1a 32-bit hash of a string. Stable across platforms. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function latticeHash(seed: number, xi: number, yi: number): number {
  let h = seed ^ Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Seeded 2D value noise in [0, 1). Bilinear interpolation over a hashed
 * integer lattice — enough for stylized low-poly terrain, no deps.
 */
export function noise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = latticeHash(seed, x0, y0);
  const b = latticeHash(seed, x0 + 1, y0);
  const c = latticeHash(seed, x0, y0 + 1);
  const d = latticeHash(seed, x0 + 1, y0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}
