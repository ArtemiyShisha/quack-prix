import { POOL } from './track.ts';
export type PoolState = {
  age: number;
  openings: number[];
  openSide: number;
  swirl: number;
  flowAngle: number;
};

// Both sluices stay partly open. There is no collecting or waiting phase.
export function wavePoolState(age: number, phase: number): PoolState {
  const wave = Math.sin((age * Math.PI * 2) / POOL.period + phase);
  const openings = [
    0.35 + 0.65 * (0.5 + 0.5 * wave),
    0.35 + 0.65 * (0.5 - 0.5 * wave),
  ];
  return {
    age,
    openings,
    openSide: wave > 0 ? 0 : 1,
    swirl: Math.sin(age * 2.3 + phase),
    flowAngle: 80 * (Math.cos(phase) - Math.cos(age * 2.3 + phase)),
  };
}
