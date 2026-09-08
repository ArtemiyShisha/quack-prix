import Matter from 'matter-js';
import { seededRandom, shuffled } from './random.ts';
import { wavePoolState, type PoolState } from './wave-pool.ts';
import { ChaosClock, type ChaosState, type Kick } from './chaos.ts';
import {
  RADIUS,
  FINISH_Y,
  HEIGHT,
  WALL_X,
  WALL_THICKNESS,
  PEGS,
  ROTORS,
  SLOPES,
  RAILS,
  BUMPERS,
  BOOSTS,
  GATE,
  POOL,
  startX,
} from './track.ts';
const { Engine, Bodies, Body, Composite } = Matter;
export const STEP_MS = 1000 / 60;
export const COUNTDOWN_SECONDS = 3;
export const FLUSH_SECONDS = 50;
export const MAX_SECONDS = 60;
export type DuckState = {
  slot: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  boosted: boolean;
  kick: Kick | null;
};
export type Finish = {
  slot: number;
  time: number;
  reason: 'finish' | 'distance';
};
export type Frame = {
  elapsed: number;
  ducks: DuckState[];
  rotorAngles: number[];
  bumpers: { x: number; y: number; hitAt: number }[];
  gates: number[];
  boostActive: boolean[];
  pool: PoolState;
  chaos: ChaosState;
  flushing: boolean;
  result: Finish | null;
};
export function firstCrossing(
  before: Pick<DuckState, 'slot' | 'y'>[],
  after: Pick<DuckState, 'slot' | 'y'>[],
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
function moveStatic(body: Matter.Body, x: number, y: number) {
  const velocity = { x: x - body.position.x, y: y - body.position.y };
  Body.setPosition(body, { x, y });
  Body.setVelocity(body, velocity);
}
export class RaceSimulation {
  private engine: Matter.Engine;
  private bodies: Matter.Body[];
  private rotors: Matter.Body[][];
  private phases: number[];
  private speeds: number[];
  private bumpers: Matter.Body[];
  private bumperPhases: number[];
  private bumperHits: number[];
  private bumperCooldowns: number[][];
  private gates: Matter.Body[];
  private gatePhase: number;
  private chaos: ChaosClock;
  private kicks: (Kick | null)[];
  private boostPhases: number[];
  private boostedUntil: number[];
  private removable: Matter.Body[];
  private tieRanks: number[];
  private ticks = 0;
  private result: Finish | null = null;
  private flushing = false;
  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Race needs 1–8 ducks');
    const random = seededRandom(seed);
    this.chaos = new ChaosClock(seed, count);
    this.kicks = Array(count).fill(null);
    this.engine = Engine.create({
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 8,
    });
    this.engine.gravity.y = 0.65;
    const walls = [
      ...WALL_X.map((x) =>
        Bodies.rectangle(x, HEIGHT / 2, WALL_THICKNESS, HEIGHT + 200, {
          isStatic: true,
        }),
      ),
      Bodies.rectangle(480, -40, 860, 30, { isStatic: true }),
    ];
    const pegs = PEGS.map((p) =>
      Bodies.circle(p.x, p.y, p.radius, {
        isStatic: true,
        restitution: 0.86,
        friction: 0.01,
      }),
    );
    const slopes = SLOPES.map(railBody),
      rails = RAILS.map(railBody);
    this.phases = ROTORS.map(() => random() * Math.PI * 2);
    this.speeds = ROTORS.map((r) => r.direction * (1.05 + random() * 0.65));
    this.rotors = ROTORS.map((r, i) =>
      Array.from({ length: r.blades }, (_, j) =>
        Bodies.rectangle(r.x, r.y, r.length, r.thickness, {
          isStatic: true,
          angle: this.phases[i] + (j * Math.PI) / r.blades,
          friction: 0.12,
          restitution: 0.75,
          chamfer: { radius: 8 },
        }),
      ),
    );
    this.bumperPhases = BUMPERS.map(() => random() * Math.PI * 2);
    this.bumpers = BUMPERS.map((b, i) =>
      Bodies.circle(
        b.x + Math.sin(this.bumperPhases[i]) * b.travel,
        b.y,
        b.radius,
        { isStatic: true, restitution: 0.95, friction: 0.01 },
      ),
    );
    this.bumperHits = BUMPERS.map(() => -10);
    this.bumperCooldowns = Array.from({ length: count }, () =>
      BUMPERS.map(() => -100),
    );
    this.gatePhase = random() * Math.PI * 2;
    const initialPool = this.poolState();
    this.gates = GATE.centres.map((x, i) =>
      Bodies.rectangle(
        x + initialPool.openings[i] * GATE.travel * (i === 0 ? -1 : 1),
        GATE.y,
        GATE.width,
        GATE.thickness,
        {
          isStatic: true,
          angle: GATE.angles[i],
          friction: 0.008,
          restitution: 0.6,
          chamfer: { radius: 10 },
        },
      ),
    );
    this.boostPhases = BOOSTS.map(() => random() * Math.PI * 2);
    this.boostedUntil = Array(count).fill(-1);
    this.removable = [
      ...pegs,
      ...slopes,
      ...this.rotors.flat(),
      ...this.bumpers,
      ...this.gates,
    ];
    // Physical slots do not know names, identities, colours, or roster order.
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
  private jetActive(index: number) {
    return (
      !this.flushing &&
      Math.sin((this.ticks / 60) * 3 + this.boostPhases[index]) > -0.2
    );
  }
  private poolState(): PoolState {
    return wavePoolState(this.ticks / 60, this.gatePhase);
  }
  snapshot(): Frame {
    return {
      elapsed: this.ticks / 60,
      ducks: this.bodies.map((body, slot) => ({
        slot,
        x: body.position.x,
        y: body.position.y,
        angle: body.angle,
        vx: body.velocity.x,
        vy: body.velocity.y,
        boosted: this.boostedUntil[slot] > this.ticks,
        kick: this.kicks[slot],
      })),
      rotorAngles: this.rotors.map((parts) => parts[0].angle),
      bumpers: this.bumpers.map((b, i) => ({
        x: b.position.x,
        y: b.position.y,
        hitAt: this.bumperHits[i],
      })),
      gates: this.gates.map((g) => g.position.x),
      boostActive: BOOSTS.map((_, i) => this.jetActive(i)),
      pool: this.poolState(),
      chaos: this.chaos.snapshot(),
      flushing: this.flushing,
      result: this.result,
    };
  }
  step(): Frame {
    if (this.result) return this.snapshot();
    const before = this.snapshot().ducks;
    this.ticks++;
    const pool = this.poolState();
    if (this.ticks >= FLUSH_SECONDS * 60 && !this.flushing) {
      this.flushing = true;
      Composite.remove(this.engine.world, this.removable);
      this.engine.gravity.y = 1.8;
    }
    if (!this.flushing) {
      const event = this.chaos.step(this.ticks);
      if (event) {
        this.speeds = ROTORS.map((_, i) => event.spin * (i % 2 ? -1 : 1));
        this.bodies.forEach((body, slot) => {
          const kick = event.kicks[slot];
          Body.setVelocity(body, {
            x: body.velocity.x * 0.25 + kick.vx,
            y: kick.vy,
          });
          Body.setAngularVelocity(body, kick.vx * 0.013);
          this.kicks[slot] = kick;
          if (kick.vy > 0) this.boostedUntil[slot] = this.ticks + 25;
        });
      }
      this.rotors.forEach((parts, i) =>
        parts.forEach((body) => {
          Body.setAngle(body, body.angle + this.speeds[i] / 60);
          Body.setAngularVelocity(body, this.speeds[i] / 60);
        }),
      );
      this.bumpers.forEach((body, i) => {
        const b = BUMPERS[i];
        moveStatic(
          body,
          b.x +
            Math.sin(
              this.bumperPhases[i] +
                ((this.ticks / 60) * 2 * Math.PI) / b.period,
            ) *
              b.travel,
          b.y,
        );
      });
      this.gates.forEach((body, i) =>
        moveStatic(
          body,
          GATE.centres[i] + pool.openings[i] * GATE.travel * (i === 0 ? -1 : 1),
          GATE.y,
        ),
      );
    }
    this.bodies.forEach((body, slot) => {
      const wind = Math.sin((this.ticks / 60) * 1.8) * 0.000009;
      Body.applyForce(body, body.position, { x: wind * body.mass, y: 0 });
      if (
        !this.flushing &&
        body.position.y > POOL.top &&
        body.position.y < POOL.bottom
      ) {
        const dx = body.position.x - POOL.x,
          dy = body.position.y - POOL.y;
        const radius = Math.max(100, Math.hypot(dx, dy));
        const force = {
          x: (-dy / radius) * pool.swirl * 0.0012,
          y: (dx / radius) * pool.swirl * 0.0012 + 0.0001,
        };
        Body.applyForce(body, body.position, {
          x: force.x * body.mass,
          y: force.y * body.mass,
        });
      }
      if (!this.flushing)
        BOOSTS.forEach((boost, i) => {
          if (!this.jetActive(i)) return;
          const dx = body.position.x - boost.x,
            dy = body.position.y - boost.y,
            c = Math.cos(boost.angle),
            s = Math.sin(boost.angle);
          const along = dx * c + dy * s,
            across = -dx * s + dy * c;
          if (
            Math.abs(along) < boost.length / 2 &&
            Math.abs(across) < boost.width / 2
          ) {
            Body.applyForce(body, body.position, {
              x: c * boost.force * body.mass,
              y: s * boost.force * body.mass,
            });
            this.boostedUntil[slot] = this.ticks + 20;
          }
        });
      body.frictionAir = this.flushing ? 0.012 : 0.006;
      if (body.speed > 20) Body.setSpeed(body, 20);
    });
    Engine.update(this.engine, STEP_MS);
    // A ramp and wall can squeeze a strongly launched duck in opposite directions.
    // Resolve any remaining wall penetration as a bounce, preserving vertical motion.
    const left = WALL_X[0] + WALL_THICKNESS / 2 + RADIUS;
    const right = WALL_X[1] - WALL_THICKNESS / 2 - RADIUS;
    this.bodies.forEach((body) => {
      if (body.position.x < left || body.position.x > right) {
        const side = body.position.x < left ? 1 : -1;
        const vx = body.velocity.x;
        Body.setPosition(body, {
          x: side === 1 ? left : right,
          y: body.position.y,
        });
        Body.setVelocity(body, {
          x: vx * side < 0 ? -vx * body.restitution : vx,
          y: body.velocity.y,
        });
      }
    });
    if (!this.flushing)
      this.bodies.forEach((body, slot) =>
        this.bumpers.forEach((bumper, i) => {
          const dx = body.position.x - bumper.position.x,
            dy = body.position.y - bumper.position.y,
            distance = Math.hypot(dx, dy);
          if (
            distance < RADIUS + BUMPERS[i].radius + 3 &&
            distance > 0 &&
            this.ticks - this.bumperCooldowns[slot][i] > 14
          ) {
            Body.setVelocity(body, {
              x: body.velocity.x + (dx / distance) * 2.6,
              y: body.velocity.y + (dy / distance) * 2.6,
            });
            this.bumperCooldowns[slot][i] = this.ticks;
            this.bumperHits[i] = this.ticks / 60;
          }
        }),
      );
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
  destroy() {
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
  }
}
