import Matter from 'matter-js';
import { seededRandom, shuffled } from './random.ts';
import {
  RADIUS,
  FINISH_Y,
  HEIGHT,
  WALL_X,
  PEGS,
  ROTORS,
  SLOPES,
  RAILS,
  startX,
} from './track.ts';
const { Engine, Bodies, Body, Composite } = Matter;
export const STEP_MS = 1000 / 60;
export const FLUSH_SECONDS = 32;
export const MAX_SECONDS = 40;
export type DuckState = { slot: number; x: number; y: number; angle: number };
export type Finish = {
  slot: number;
  time: number;
  reason: 'finish' | 'distance';
};
export type Frame = {
  elapsed: number;
  ducks: DuckState[];
  rotorAngles: number[];
  flushing: boolean;
  result: Finish | null;
};
export function firstCrossing(
  before: DuckState[],
  after: DuckState[],
  line: number,
  tieRanks: number[],
): number | null {
  const crossings = after.flatMap((duck, i) => {
    const prior = before[i];
    if (prior.y >= line || duck.y < line || duck.y <= prior.y) return [];
    return [
      { slot: duck.slot, fraction: (line - prior.y) / (duck.y - prior.y) },
    ];
  });
  crossings.sort(
    (a, b) => a.fraction - b.fraction || tieRanks[a.slot] - tieRanks[b.slot],
  );
  return crossings[0]?.slot ?? null;
}
function railBody(rail: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): Matter.Body {
  const dx = rail.x2 - rail.x1,
    dy = rail.y2 - rail.y1;
  return Bodies.rectangle(
    (rail.x1 + rail.x2) / 2,
    (rail.y1 + rail.y2) / 2,
    Math.hypot(dx, dy) + 18,
    23,
    {
      isStatic: true,
      angle: Math.atan2(dy, dx),
      friction: 0.008,
      restitution: 0.38,
      chamfer: { radius: 10 },
    },
  );
}
export class RaceSimulation {
  private engine: Matter.Engine;
  private bodies: Matter.Body[];
  private rotors: Matter.Body[][];
  private phases: number[];
  private speeds: number[];
  private removable: Matter.Body[];
  private tieRanks: number[];
  private ticks = 0;
  private result: Finish | null = null;
  private flushing = false;
  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Race needs 1–8 ducks');
    const random = seededRandom(seed);
    this.engine = Engine.create({
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 8,
    });
    this.engine.gravity.y = 0.72;
    const walls = [
      Bodies.rectangle(WALL_X[0], HEIGHT / 2, 26, HEIGHT + 200, {
        isStatic: true,
      }),
      Bodies.rectangle(WALL_X[1], HEIGHT / 2, 26, HEIGHT + 200, {
        isStatic: true,
      }),
      Bodies.rectangle(480, -40, 860, 30, { isStatic: true }),
    ];
    const pegs = PEGS.map((p) =>
      Bodies.circle(p.x, p.y, p.radius, {
        isStatic: true,
        restitution: 0.86,
        friction: 0.01,
      }),
    );
    const slopes = SLOPES.map(railBody);
    const rails = RAILS.map(railBody);
    this.phases = ROTORS.map(() => random() * Math.PI * 2);
    this.speeds = ROTORS.map((r) => r.direction * (0.9 + random() * 0.6));
    this.rotors = ROTORS.map((r, i) =>
      [0, Math.PI / 2].map((offset) =>
        Bodies.rectangle(r.x, r.y, r.length, r.thickness, {
          isStatic: true,
          angle: this.phases[i] + offset,
          friction: 0.12,
          restitution: 0.7,
          chamfer: { radius: 8 },
        }),
      ),
    );
    this.removable = [...pegs, ...slopes, ...this.rotors.flat()];
    // Body creation and force calculation never receive names, IDs, or roster positions.
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const body = Bodies.circle(
        startX(slot, count) + (random() - 0.5) * 15,
        94 + (random() - 0.5) * 16,
        RADIUS,
        {
          restitution: 0.58,
          friction: 0.008,
          frictionStatic: 0.015,
          frictionAir: 0.006,
          density: 0.001,
        },
      );
      Body.setVelocity(body, { x: (random() - 0.5) * 2.7, y: random() * 0.5 });
      Body.setAngularVelocity(body, (random() - 0.5) * 0.04);
      return body;
    });
    this.tieRanks = shuffled(
      Array.from({ length: count }, (_, i) => i),
      () => Math.floor(random() * 4294967296),
    );
    Composite.add(this.engine.world, [
      ...walls,
      ...rails,
      ...this.removable,
      ...this.bodies,
    ]);
  }
  snapshot(): Frame {
    return {
      elapsed: this.ticks / 60,
      ducks: this.bodies.map((body, slot) => ({
        slot,
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
      })),
      rotorAngles: this.rotors.map((parts) => parts[0].angle),
      flushing: this.flushing,
      result: this.result,
    };
  }
  step(): Frame {
    if (this.result) return this.snapshot();
    const before = this.snapshot().ducks;
    this.ticks++;
    if (this.ticks >= FLUSH_SECONDS * 60 && !this.flushing) {
      this.flushing = true;
      Composite.remove(this.engine.world, this.removable);
      this.engine.gravity.y = 1.6;
    }
    if (!this.flushing)
      this.rotors.forEach((parts, i) =>
        parts.forEach((body, j) => {
          Body.setAngle(
            body,
            this.phases[i] +
              this.speeds[i] * (this.ticks / 60) +
              (j * Math.PI) / 2,
          );
          Body.setAngularVelocity(body, this.speeds[i] / 60);
        }),
      );
    // A common sideways current frees near-static contacts without assisting any named player.
    this.bodies.forEach((body) => {
      const wind = Math.sin((this.ticks / 60) * 1.8) * 0.000009;
      Body.applyForce(body, body.position, { x: wind * body.mass, y: 0 });
      if (this.flushing) body.frictionAir = 0.012;
      if (body.speed > 19) Body.setSpeed(body, 19);
    });
    Engine.update(this.engine, STEP_MS);
    const after = this.snapshot().ducks;
    const slot = firstCrossing(before, after, FINISH_Y, this.tieRanks);
    if (slot !== null) {
      const fraction =
        (FINISH_Y - before[slot].y) / (after[slot].y - before[slot].y);
      this.result = {
        slot,
        time: (this.ticks - 1 + fraction) / 60,
        reason: 'finish',
      };
    } else if (this.ticks >= MAX_SECONDS * 60) {
      const leader = [...after].sort(
        (a, b) => b.y - a.y || this.tieRanks[a.slot] - this.tieRanks[b.slot],
      )[0];
      this.result = {
        slot: leader.slot,
        time: MAX_SECONDS,
        reason: 'distance',
      };
    }
    return this.snapshot();
  }
  destroy(): void {
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
