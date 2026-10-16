export const STEP_MS = 1000 / 60,
  COUNTDOWN_SECONDS = 3;
export type DuckState = {
  slot: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  progress: number;
  stage: number;
  inTube: boolean;
  hiddenInDrain: boolean;
};
export type Finish = {
  slot: number;
  time: number;
  reason: 'finish' | 'distance';
};
export type Frame = {
  elapsed: number;
  ducks: DuckState[];
  paddles: { x: number; y: number; angle: number }[];
  flushing: boolean;
  result: Finish | null;
};
