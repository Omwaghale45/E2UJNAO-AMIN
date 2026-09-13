// Deterministic PRNG so the same seed (e.g. a location's id) always
// produces the same synthetic series — used everywhere we render
// illustrative data instead of a real sensor feed.
function mulberry32(seed: number) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function createSeededRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

export function randRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

export function pick<T>(random: () => number, options: T[]): T {
  return options[Math.floor(random() * options.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
