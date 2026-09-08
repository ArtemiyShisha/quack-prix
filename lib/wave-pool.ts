import { POOL } from './track.ts';

export type PoolState = {
  phase: 'waiting' | 'filling' | 'releasing';
  age: number;
  fill: number;
  opening: number;
  openSide: number | null;
  swirl: number;
  flowAngle: number;
};
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

// One shared water cycle; identities and race positions are never inputs.
export function wavePoolState(age: number | null, phase: number): PoolState {
  const base = {
    age: age ?? 0,
    fill: 0,
    opening: 0,
    openSide: null,
    swirl: Math.sin((age ?? 0) * 0.8 + phase),
    flowAngle: 50 * (Math.cos(phase) - Math.cos((age ?? 0) * 0.8 + phase)),
  };
  if (age === null) return { ...base, phase: 'waiting' };
  if (age < POOL.fillSeconds)
    return { ...base, phase: 'filling', fill: age / POOL.fillSeconds };
  const period = POOL.releaseSeconds + POOL.resetSeconds;
  const elapsed = age - POOL.fillSeconds;
  const cycle = Math.floor(elapsed / period);
  const local = elapsed % period;
  if (local >= POOL.releaseSeconds)
    return {
      ...base,
      phase: 'filling',
      fill: (local - POOL.releaseSeconds) / POOL.resetSeconds,
    };
  return {
    ...base,
    phase: 'releasing',
    fill: 1 - local / POOL.releaseSeconds,
    opening:
      smooth(local / 0.35) * smooth((POOL.releaseSeconds - local) / 0.35),
    openSide: (cycle + (phase >= Math.PI ? 1 : 0)) % 2,
  };
}
