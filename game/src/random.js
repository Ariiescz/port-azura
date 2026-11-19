// Deterministic seeded pseudo-random generator.
//
// The city layout must be identical on every load, so we avoid Math.random
// entirely and instead advance a 32-bit integer state with the well-known
// mulberry32 mixing steps. The returned function yields floats in [0, 1).

export function createRandom(seed) {
  let state = Number(seed) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
