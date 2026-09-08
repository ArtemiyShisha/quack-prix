import Matter from 'matter-js';
import { seededRandom, shuffled } from './random.ts';
import {
  BOWLS,
  PIPES,
  PADDLES,
  PEGS,
  FINISH_DISTANCE,
  RADIUS,
  pipePoint,
  startPosition,
} from './track.ts';
const { Engine, Bodies, Body, Composite } = Matter;
export const STEP_MS = 1000 / 60,
  COUNTDOWN_SECONDS = 3,
  FLUSH_SECONDS = 50,
  MAX_SECONDS = 60;
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
  rotorAngles: number[];
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
function drainCrossing(
  before: { x: number; y: number },
  after: { x: number; y: number },
  centre: { x: number; y: number },
  radius: number,
): number | null {
  const x = before.x - centre.x,
    y = before.y - centre.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const dx = after.x - before.x,
    dy = after.y - before.y;
  const a = dx * dx + dy * dy,
    b = 2 * (x * dx + y * dy),
    discriminant = b * b - 4 * a * c;
  if (a === 0 || discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
type Transit = { distance: number; entrySpeed: number; enteredAt: number };
export class RaceSimulation {
  private engine: Matter.Engine;
  private bodies: Matter.Body[];
  private rotors: Matter.Body[];
  private speeds: number[];
  private removable: Matter.Body[];
  private tieRanks: number[];
  private stages: number[];
  private transits: (Transit | null)[];
  private ticks = 0;
  private flushing = false;
  private result: Finish | null = null;
  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Race needs 1–8 ducks');
    const random = seededRandom(seed);
    this.engine = Engine.create({
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 8,
    });
    this.engine.gravity.y = 0;
    const walls = BOWLS.flatMap((b) =>
      Array.from({ length: 64 }, (_, i) => {
        const a = (i * Math.PI * 2) / 64,
          next = ((i + 1) * Math.PI * 2) / 64,
          mid = (a + next) / 2;
        return Bodies.rectangle(
          b.x + Math.cos(mid) * b.radius,
          b.y + Math.sin(mid) * b.radius,
          2 * b.radius * Math.sin(Math.PI / 64) + 3,
          14,
          {
            isStatic: true,
            angle: mid + Math.PI / 2,
            restitution: 0.45,
            friction: 0.001,
          },
        );
      }),
    );
    this.speeds = PADDLES.map((p) => p.direction * (0.4 + random() * 0.25));
    this.rotors = PADDLES.map((p) =>
      Bodies.rectangle(p.x, p.y, p.length, p.width, {
        isStatic: true,
        angle: random() * Math.PI * 2,
        chamfer: { radius: 6 },
        restitution: 0.3,
        friction: 0.001,
      }),
    );
    const pegs = PEGS.map((p) =>
      Bodies.circle(p.x, p.y, p.radius, {
        isStatic: true,
        restitution: 0.45,
        friction: 0.001,
      }),
    );
    this.removable = [...this.rotors, ...pegs];
    this.stages = Array(count).fill(0);
    this.transits = Array(count).fill(null);
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const p = startPosition(slot, count),
        speed = 7.8 + (random() - 0.5) * 0.5;
      const body = Bodies.circle(
        p.x + (random() - 0.5) * 3,
        p.y + (random() - 0.5) * 3,
        RADIUS,
        {
          restitution: 0.72,
          friction: 0.001,
          frictionStatic: 0.001,
          frictionAir: 0.007,
          density: 0.001,
        },
      );
      Body.setVelocity(body, {
        x: -Math.sin(p.angle) * speed,
        y: Math.cos(p.angle) * speed,
      });
      return body;
    });
    this.tieRanks = shuffled(
      Array.from({ length: count }, (_, i) => i),
      () => Math.floor(random() * 4294967296),
    );
    Composite.add(this.engine.world, [
      ...walls,
      ...this.removable,
      ...this.bodies,
    ]);
  }
  private progress(slot: number) {
    const stage = this.stages[slot];
    if (stage >= BOWLS.length) return FINISH_DISTANCE;
    const transit = this.transits[slot];
    if (transit)
      return (
        stage * 1000 +
        700 +
        (300 * Math.max(0, transit.distance)) / PIPES[stage].at(-1)!.s
      );
    const b = BOWLS[stage],
      p = this.bodies[slot].position,
      r = Math.hypot(p.x - b.x, p.y - b.y);
    return (
      stage * 1000 +
      Math.max(
        0,
        Math.min(699, (700 * (b.radius - r)) / (b.radius - b.drain + RADIUS)),
      )
    );
  }
  snapshot(): Frame {
    return {
      elapsed: this.ticks / 60,
      ducks: this.bodies.map((b, slot) => ({
        slot,
        x: b.position.x,
        y: b.position.y,
        angle: b.angle,
        vx: b.velocity.x,
        vy: b.velocity.y,
        progress: this.progress(slot),
        stage: this.stages[slot],
        inTube: this.transits[slot] !== null,
        hiddenInDrain: (this.transits[slot]?.distance ?? 0) < 0,
      })),
      rotorAngles: this.rotors.map((r) => r.angle),
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
    }
    if (!this.flushing)
      this.rotors.forEach((r, i) => {
        Body.setAngle(r, r.angle + this.speeds[i] / 60);
        Body.setAngularVelocity(r, this.speeds[i] / 60);
      });
    this.bodies.forEach((body, slot) => {
      if (
        body.isStatic ||
        this.transits[slot] ||
        this.stages[slot] >= BOWLS.length
      )
        return;
      const b = BOWLS[this.stages[slot]],
        k = b.strength * (this.flushing ? 2 : 1);
      body.frictionAir = this.flushing ? 0.05 : b.friction;
      // Gravity on a concave bowl: a smooth inward slope. Momentum supplies the orbit.
      Body.applyForce(body, body.position, {
        x: (b.x - body.position.x) * k * body.mass,
        y: (b.y - body.position.y) * k * body.mass,
      });
    });
    Engine.update(this.engine, STEP_MS);
    this.bodies.forEach((body, slot) => {
      if (
        this.transits[slot] ||
        this.stages[slot] >= BOWLS.length ||
        body.isStatic
      )
        return;
      const b = BOWLS[this.stages[slot]],
        dx = body.position.x - b.x,
        dy = body.position.y - b.y,
        r = Math.hypot(dx, dy);
      if (r > b.radius - 7 - RADIUS + 1) {
        const nx = dx / r,
          ny = dy / r,
          normal = body.velocity.x * nx + body.velocity.y * ny,
          vx = body.velocity.x,
          vy = body.velocity.y;
        Body.setPosition(body, {
          x: b.x + nx * (b.radius - 7 - RADIUS),
          y: b.y + ny * (b.radius - 7 - RADIUS),
        });
        if (normal > 0)
          Body.setVelocity(body, {
            x: vx - normal * nx * 1.45,
            y: vy - normal * ny * 1.45,
          });
      }
      const entry = drainCrossing(
        before[slot],
        body.position,
        b,
        b.drain - RADIUS,
      );
      if (entry !== null) {
        this.transits[slot] = {
          distance: -10 * entry,
          entrySpeed: Math.sqrt(body.speed * body.speed + 58),
          enteredAt: this.ticks - 1 + entry,
        };
        Body.setStatic(body, true);
        body.collisionFilter.mask = 0;
        Body.setPosition(body, { x: b.x, y: b.y });
      }
    });
    // The enclosed connecting tubes constrain movement along a rail. Preserve order and spacing.
    for (let stage = 0; stage < BOWLS.length; stage++) {
      const slots = this.transits
        .map((t, slot) => ({ t, slot }))
        .filter((v) => v.t && this.stages[v.slot] === stage)
        .sort(
          (a, b) =>
            a.t!.enteredAt - b.t!.enteredAt ||
            this.tieRanks[a.slot] - this.tieRanks[b.slot],
        );
      let ahead = Infinity;
      for (const { t, slot } of slots) {
        const body = this.bodies[slot],
          length = PIPES[stage].at(-1)!.s;
        // Negative distance is the vertical drop below the drain, before the visible pipe.
        t!.distance = Math.min(
          length,
          t!.distance + 10,
          ahead - 2 * RADIUS - 6,
        );
        ahead = t!.distance;
        const p = pipePoint(stage, t!.distance);
        Body.setPosition(body, p);
        if (t!.distance >= length) {
          this.stages[slot]++;
          this.transits[slot] = null;
          if (this.stages[slot] < BOWLS.length) {
            Body.setStatic(body, false);
            body.collisionFilter.mask = 0xffffffff;
            Body.setVelocity(body, {
              x: p.tx * t!.entrySpeed,
              y: p.ty * t!.entrySpeed,
            });
          }
        }
      }
    }
    const after = this.snapshot().ducks,
      slot = firstCrossing(
        before.map((d) => ({ slot: d.slot, y: d.progress })),
        after.map((d) => ({ slot: d.slot, y: d.progress })),
        FINISH_DISTANCE,
        this.tieRanks,
      );
    if (slot !== null) {
      const fraction =
        (FINISH_DISTANCE - before[slot].progress) /
        (after[slot].progress - before[slot].progress);
      this.result = {
        slot,
        time: (this.ticks - 1 + fraction) / 60,
        reason: 'finish',
      };
    } else if (this.ticks >= MAX_SECONDS * 60) {
      const leader = [...after].sort(
        (a, b) =>
          b.progress - a.progress ||
          this.tieRanks[a.slot] - this.tieRanks[b.slot],
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
