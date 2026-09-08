export type Uint32Source = () => number;
export function freshSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
export function randomBelow(
  bound: number,
  source: Uint32Source = freshSeed,
): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 2 ** 32)
    throw new Error('Invalid random bound');
  const limit = Math.floor(2 ** 32 / bound) * bound;
  let value: number;
  do {
    value = source();
  } while (value >= limit);
  return value % bound;
}
export function shuffled<T>(
  values: readonly T[],
  source: Uint32Source = freshSeed,
): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, source);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Mulberry32 is used only for reproducible physical conditions. Identity draws use crypto directly.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
