import { seededRandom } from './random.ts';
export type Kick = { vx: number; vy: number; at: number };
export type ChaosState = {
  serial: number;
  at: number;
  title: string;
  nextAt: number;
};
export type ChaosEvent = ChaosState & { kicks: Kick[]; spin: number };
const TITLES = ['ГЕЙЗЕРЫ!', 'БОКОВАЯ ВОЛНА!', 'ТУРБО-ЛОТЕРЕЯ!'];

// A separate stream produces new outcomes during the race. It has no identities or ranks.
export class ChaosClock {
  private random: () => number;
  private count: number;
  private nextTick: number;
  private current: ChaosState;
  constructor(seed: number, count: number) {
    this.random = seededRandom((seed ^ 0x9e3779b9) >>> 0);
    this.count = count;
    this.nextTick = 66 + Math.floor(this.random() * 30);
    this.current = {
      serial: 0,
      at: -10,
      title: '',
      nextAt: this.nextTick / 60,
    };
  }
  snapshot(): ChaosState {
    return { ...this.current };
  }
  step(tick: number): ChaosEvent | null {
    if (tick < this.nextTick) return null;
    const kind = Math.floor(this.random() * 3),
      at = tick / 60;
    this.nextTick = tick + 60 + Math.floor(this.random() * 25);
    const kicks = Array.from({ length: this.count }, () => {
      const up = this.random() < (kind === 0 ? 0.6 : kind === 1 ? 0.45 : 0.35);
      return {
        vx:
          (this.random() < 0.5 ? -1 : 1) *
          ((kind === 1 ? 7 : 4) + this.random() * 4),
        vy: up ? -(13 + this.random() * 7) : 10 + this.random() * 8,
        at,
      };
    });
    this.current = {
      serial: this.current.serial + 1,
      at,
      title: TITLES[kind],
      nextAt: this.nextTick / 60,
    };
    return {
      ...this.current,
      kicks,
      spin: (this.random() < 0.5 ? -1 : 1) * (1.3 + this.random() * 1.1),
    };
  }
}
