import Matter from 'matter-js';
import { seededRandom, shuffled } from './random.ts';
import {
  STAGES,
  PIPES,
  PADDLES,
  ISLANDS,
  RAILS,
  paddlePose,
  FINISH_DISTANCE,
  RADIUS,
  pipePoint,
  startPosition,
} from './track.ts';
import { stageWalls, railBody, containBody } from './stage-physics.ts';
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
  paddles: { x: number; y: number; angle: number }[];
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
  private phases: number[];
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
    const walls = STAGES.flatMap(stageWalls);
    this.phases = PADDLES.map(() => random() * Math.PI * 2);
    this.rotors = PADDLES.map((p, i) => {
      const pose = paddlePose(p, 0, this.phases[i]);
      return Bodies.rectangle(pose.x, pose.y, p.length, p.width, {
        isStatic: true,
        angle: pose.angle,
        chamfer: { radius: 6 },
        restitution: 0.3,
        friction: 0.001,
      });
    });
    const islands = ISLANDS.map((p) =>
      Bodies.rectangle(p.x, p.y, p.length, p.width, {
        isStatic: true,
        angle: p.angle,
        chamfer: { radius: p.width / 2 - 1 },
        restitution: 0.45,
        friction: 0.001,
      }),
    );
    this.removable = [
      ...this.rotors,
      ...islands,
      ...RAILS.map((r) => railBody(r.a, r.b, r.width)),
    ];
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
    if (stage >= STAGES.length) return FINISH_DISTANCE;
    const transit = this.transits[slot];
    if (transit)
      return (
        stage * 1000 +
        700 +
        (300 * Math.max(0, transit.distance)) / PIPES[stage].at(-1)!.s
      );
    const stageData = STAGES[stage],
      p = this.bodies[slot].position;
    const fraction =
      stageData.kind === 'bowl'
        ? (stageData.radius -
            Math.hypot(p.x - stageData.x, p.y - stageData.y)) /
          (stageData.radius - stageData.drain + RADIUS)
        : (p.y - stageData.top) / (stageData.exit.y - stageData.top);
    return stage * 1000 + Math.max(0, Math.min(699, 700 * fraction));
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
      paddles: this.rotors.map((r) => ({
        x: r.position.x,
        y: r.position.y,
        angle: r.angle,
      })),
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
        const pose = paddlePose(PADDLES[i], this.ticks / 60, this.phases[i]);
        const velocity = { x: pose.x - r.position.x, y: pose.y - r.position.y },
          angularVelocity = pose.angle - r.angle;
        Body.setPosition(r, pose);
        Body.setAngle(r, pose.angle);
        Body.setVelocity(r, velocity);
        Body.setAngularVelocity(r, angularVelocity);
      });
    this.bodies.forEach((body, slot) => {
      if (
        body.isStatic ||
        this.transits[slot] ||
        this.stages[slot] >= STAGES.length
      )
        return;
      const stage = STAGES[this.stages[slot]],
        rescue = this.flushing ? 2 : 1;
      body.frictionAir = this.flushing ? 0.05 : stage.friction;
      // Bowl slope is radial; chutes slope downhill. Neither depends on rank or race time.
      Body.applyForce(
        body,
        body.position,
        stage.kind === 'bowl'
          ? {
              x:
                (stage.x - body.position.x) *
                stage.strength *
                rescue *
                body.mass,
              y:
                (stage.y - body.position.y) *
                stage.strength *
                rescue *
                body.mass,
            }
          : { x: 0, y: stage.gravity * rescue * body.mass },
      );
    });
    Engine.update(this.engine, STEP_MS);
    this.bodies.forEach((body, slot) => {
      if (
        this.transits[slot] ||
        this.stages[slot] >= STAGES.length ||
        body.isStatic
      )
        return;
      const b = STAGES[this.stages[slot]];
      containBody(body, b);
      const entry = drainCrossing(
        before[slot],
        body.position,
        b.exit,
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
        Body.setPosition(body, b.exit);
      }
    });
    // The enclosed connecting tubes constrain movement along a rail. Preserve order and spacing.
    for (let stage = 0; stage < STAGES.length; stage++) {
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
          if (this.stages[slot] < STAGES.length) {
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
