import { seededRandom, shuffled } from './random.ts';
import type { Frame } from './race.ts';

// A compact game sheet in metres, rather than a regulation competition sheet.
export const CURLING = {
  length: 17,
  width: 4.8,
  targetX: 13.4,
  houseRadius: 1.75,
  stoneRadius: 0.22,
  friction: 0.9,
  releaseX: 1.4,
} as const;
const DT = 1 / 120;
const REST_SPEED = 0.035;
const BETWEEN_SHOTS = 0.65;

export type CurlingStone = {
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  delivered: boolean;
};
export type CurlingFrame = Frame & {
  stones: CurlingStone[];
  delivered: number;
  activeSlot: number | null;
  closestSlot: number | null;
};

export function distanceToButton(stone: Pick<CurlingStone, 'x' | 'y'>) {
  return Math.hypot(stone.x - CURLING.targetX, stone.y);
}

export class CurlingSimulation {
  private stones: CurlingStone[];
  private shots: { speed: number; aim: number; spin: number }[];
  private ranks: number[];
  private ticks = 0;
  private delivered = 0;
  private restingSince = 0;
  private result: Frame['result'] = null;

  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('В кёрлинге может быть от одного до восьми участников.');
    const random = seededRandom(seed);
    this.stones = Array.from({ length: count }, (_, slot) => ({
      slot,
      x: CURLING.releaseX,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      spin: 0,
      delivered: false,
    }));
    this.shots = this.stones.map(() => {
      const spin = random() < 0.5 ? -1 : 1;
      return {
        speed:
          Math.sqrt(
            2 * CURLING.friction * (CURLING.targetX - CURLING.releaseX),
          ) +
          (random() - 0.5) * 0.38,
        aim: -spin * 0.07 + (random() - 0.5) * 0.11,
        spin: spin * (1.7 + random() * 0.8),
      };
    });
    this.ranks = shuffled(
      this.stones.map((s) => s.slot),
      () => Math.floor(random() * 2 ** 32),
    );
  }

  private moving() {
    return this.stones.some((s) => s.delivered && Math.hypot(s.vx, s.vy) > 0);
  }

  private closestSlot() {
    const order = this.stones
      .filter((s) => s.delivered)
      .sort((a, b) => {
        const difference = distanceToButton(a) - distanceToButton(b);
        return Math.abs(difference) > 1e-8
          ? difference
          : this.ranks[a.slot] - this.ranks[b.slot];
      });
    return order[0]?.slot ?? null;
  }

  snapshot(): CurlingFrame {
    return {
      elapsed: this.ticks * DT,
      stones: this.stones.map((s) => ({ ...s })),
      delivered: this.delivered,
      activeSlot: this.moving() ? this.delivered - 1 : null,
      closestSlot: this.closestSlot(),
      ducks: this.stones.map((s) => ({
        slot: s.slot,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        angle: s.angle,
        progress: s.delivered ? 4000 : 0,
        stage: 0,
        inTube: false,
        hiddenInDrain: !s.delivered,
      })),
      paddles: [],
      flushing: false,
      result: this.result && { ...this.result },
    };
  }

  step(): CurlingFrame {
    if (this.result) return this.snapshot();
    for (let substep = 0; substep < 2 && !this.result; substep++) {
      if (
        !this.moving() &&
        (this.delivered === 0 ||
          this.ticks * DT - this.restingSince >= BETWEEN_SHOTS)
      ) {
        if (this.delivered === this.stones.length) {
          this.result = {
            slot: this.closestSlot()!,
            time: this.ticks * DT,
            reason: 'closest',
          };
          break;
        }
        const stone = this.stones[this.delivered];
        const shot = this.shots[this.delivered];
        stone.delivered = true;
        stone.vx = shot.speed * Math.cos(shot.aim);
        stone.vy = shot.speed * Math.sin(shot.aim);
        stone.spin = shot.spin;
        this.delivered++;
      }
      const wasMoving = this.moving();
      for (const stone of this.stones) {
        if (!stone.delivered) continue;
        const speed = Math.hypot(stone.vx, stone.vy);
        if (speed <= REST_SPEED + CURLING.friction * DT) {
          stone.vx = 0;
          stone.vy = 0;
          stone.spin = 0;
          continue;
        }
        // Uniform dry friction; spin bends the direction without adding energy.
        const turn = stone.spin * 0.018 * DT;
        const ratio = (speed - CURLING.friction * DT) / speed;
        const vx = stone.vx;
        stone.vx = (vx * Math.cos(turn) - stone.vy * Math.sin(turn)) * ratio;
        stone.vy = (vx * Math.sin(turn) + stone.vy * Math.cos(turn)) * ratio;
        stone.x += stone.vx * DT;
        stone.y += stone.vy * DT;
        stone.angle += stone.spin * DT;
        stone.spin *= Math.exp(-0.08 * DT);
      }
      // Equal-mass disc impulses. Repeated passes resolve groups of touching stones.
      for (let pass = 0; pass < 4; pass++) {
        for (let a = 0; a < this.delivered; a++) {
          for (let b = a + 1; b < this.delivered; b++) {
            const first = this.stones[a],
              second = this.stones[b];
            const dx = second.x - first.x,
              dy = second.y - first.y;
            const distance = Math.hypot(dx, dy);
            const diameter = CURLING.stoneRadius * 2;
            if (distance >= diameter) continue;
            const nx = distance > 1e-10 ? dx / distance : 1;
            const ny = distance > 1e-10 ? dy / distance : 0;
            const separation = (diameter - distance + 1e-6) / 2;
            first.x -= nx * separation;
            first.y -= ny * separation;
            second.x += nx * separation;
            second.y += ny * separation;
            const approach =
              (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
            if (approach >= 0) continue;
            const impulse = (-(1 + 0.86) * approach) / 2;
            first.vx -= impulse * nx;
            first.vy -= impulse * ny;
            second.vx += impulse * nx;
            second.vy += impulse * ny;
          }
        }
        for (const stone of this.stones) {
          if (!stone.delivered) continue;
          const r = CURLING.stoneRadius;
          if (stone.x < r || stone.x > CURLING.length - r) {
            stone.x = Math.max(r, Math.min(CURLING.length - r, stone.x));
            stone.vx *= -0.35;
          }
          const edge = CURLING.width / 2 - r;
          if (Math.abs(stone.y) > edge) {
            stone.y = Math.sign(stone.y) * edge;
            stone.vy *= -0.35;
          }
        }
      }
      this.ticks++;
      if (wasMoving && !this.moving()) this.restingSince = this.ticks * DT;
    }
    return this.snapshot();
  }

  destroy() {
    // The simulation owns only plain values, with no browser resources.
  }
}
