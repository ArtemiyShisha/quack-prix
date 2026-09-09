import {
  World,
  Body,
  Sphere,
  Box,
  Cylinder,
  Vec3,
  Trimesh,
  SAPBroadphase,
  GSSolver,
  Material,
  ContactMaterial,
} from 'cannon-es';
import { seededRandom, shuffled } from './random.ts';
import { FINISH_DISTANCE } from './track.ts';
import type { Frame, Finish } from './race.ts';
import {
  TRACK_MESHES,
  MARBLE_RADIUS,
  MARBLE_FINISH_Z,
  MARBLE_MAX_SECONDS,
  FUNNEL,
  PADDLE_SPEED,
  BUMPERS,
  ISLAND_3D,
  PADDLE_3D,
  marbleStart,
} from './marble-track.ts';
export type MarbleState = {
  slot: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  speed: number;
  stage: number;
  progress: number;
};
export type MarbleFrame = Frame & {
  marbles: MarbleState[];
  paddleAngle: number;
  bumperX: number[];
};
export class MarbleSimulation {
  private world: World;
  private bodies: Body[];
  private paddle: Body;
  private phase: number;
  private bumpers: Body[];
  private ranks: number[];
  private stages: number[];
  private ticks = 0;
  private result: Finish | null = null;
  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Race needs 1–8 marbles');
    const random = seededRandom(seed);
    this.world = new World({
      gravity: new Vec3(0, -16, 0),
      allowSleep: false,
    });
    this.world.broadphase = new SAPBroadphase(this.world);
    (this.world.solver as GSSolver).iterations = 16;
    const surface = new Material('track'),
      marble = new Material('marble');
    this.world.addContactMaterial(
      new ContactMaterial(surface, marble, {
        friction: 0.045,
        restitution: 0.18,
        contactEquationStiffness: 1e8,
      }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(marble, marble, { friction: 0.06, restitution: 0.6 }),
    );
    for (const mesh of TRACK_MESHES)
      this.world.addBody(
        new Body({
          mass: 0,
          material: surface,
          shape: new Trimesh(mesh.positions, mesh.indices),
        }),
      );
    const add = (shape: Box | Cylinder, x: number, y: number, z: number) => {
      const body = new Body({
        mass: 0,
        material: surface,
        shape,
        position: new Vec3(x, y, z),
      });
      this.world.addBody(body);
      return body;
    };
    add(new Box(new Vec3(4, 2, 0.15)), 0, 33.4, -5);
    add(new Box(new Vec3(3.5, 0.6, 0.15)), FUNNEL.x, 2.1, 76);
    this.phase = random() * Math.PI * 2;
    this.bumpers = BUMPERS.map((b, i) => {
      const body = add(
        new Cylinder(b.radius, b.radius, 1.8, 20),
        b.x + 0.8 * Math.sin(this.phase + i * 1.7),
        b.y,
        b.z,
      );
      body.type = Body.KINEMATIC;
      return body;
    });
    const p = ISLAND_3D;
    add(
      new Box(new Vec3(p.radius, p.height / 2, p.halfLength)),
      p.x,
      p.y + p.height / 2,
      p.z,
    );
    for (const direction of [-1, 1])
      add(
        new Cylinder(p.radius, p.radius, p.height, 24),
        p.x,
        p.y + p.height / 2,
        p.z + p.halfLength * direction,
      );
    const gate = PADDLE_3D;
    this.paddle = new Body({
      type: Body.KINEMATIC,
      material: surface,
      shape: new Box(
        new Vec3(gate.length / 2, gate.height / 2, gate.width / 2),
      ),
      position: new Vec3(gate.x, gate.y + gate.height / 2, gate.z),
    });
    this.paddle.quaternion.setFromAxisAngle(Vec3.UNIT_Y, this.phase);
    this.paddle.angularVelocity.set(0, PADDLE_SPEED, 0);
    this.world.addBody(this.paddle);
    this.stages = Array(count).fill(0);
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const p = marbleStart(slot, count),
        body = new Body({
          mass: 1,
          material: marble,
          shape: new Sphere(MARBLE_RADIUS),
          position: new Vec3(
            p.x + (random() - 0.5) * 0.08,
            p.y,
            p.z + (random() - 0.5) * 0.08,
          ),
          linearDamping: 0.045,
          angularDamping: 0.06,
        });
      body.velocity.set(
        (random() - 0.5) * 0.45,
        0,
        1.8 + (random() - 0.5) * 0.3,
      );
      body.angularVelocity.set(
        body.velocity.z / MARBLE_RADIUS,
        0,
        -body.velocity.x / MARBLE_RADIUS,
      );
      this.world.addBody(body);
      return body;
    });
    this.ranks = shuffled(
      Array.from({ length: count }, (_, i) => i),
      () => Math.floor(random() * 4294967296),
    );
  }
  private progress(slot: number) {
    const p = this.bodies[slot].position,
      stage = this.stages[slot];
    if (stage === 2)
      return (
        3400 +
        600 *
          Math.max(
            0,
            Math.min(1, (p.z - FUNNEL.z) / (MARBLE_FINISH_Z - FUNNEL.z)),
          )
      );
    if (stage === 1)
      return (
        2600 +
        799 *
          Math.max(
            0,
            Math.min(
              1,
              1 - Math.hypot(p.x - FUNNEL.x, p.z - FUNNEL.z) / FUNNEL.radius,
            ),
          )
      );
    return Math.max(0, Math.min(2599, ((p.z + 3) / 83) * 2600));
  }
  snapshot(): MarbleFrame {
    const marbles = this.bodies.map((b, slot) => ({
      slot,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      qx: b.quaternion.x,
      qy: b.quaternion.y,
      qz: b.quaternion.z,
      qw: b.quaternion.w,
      speed: b.velocity.length(),
      stage: this.stages[slot],
      progress: this.progress(slot),
    }));
    return {
      elapsed: this.ticks / 120,
      marbles,
      paddleAngle:
        2 * Math.atan2(this.paddle.quaternion.y, this.paddle.quaternion.w),
      bumperX: this.bumpers.map((b) => b.position.x),
      ducks: marbles.map((m) => ({
        slot: m.slot,
        x: m.x,
        y: m.z,
        angle: 0,
        vx: this.bodies[m.slot].velocity.x,
        vy: this.bodies[m.slot].velocity.z,
        progress: m.progress,
        stage: m.stage,
        inTube: false,
        hiddenInDrain: false,
      })),
      paddles: [],
      flushing: false,
      result: this.result,
    };
  }
  step(): MarbleFrame {
    if (this.result) return this.snapshot();
    // Two actual rigid-body substeps per UI tick; no position rail or ranked force.
    for (let step = 0; step < 2 && !this.result; step++) {
      const before = this.bodies.map((b) => ({
        x: b.position.x,
        y: b.position.y,
        z: b.position.z,
      }));
      // The softer funnel surface dissipates rolling energy uniformly for every marble.
      for (let slot = 0; slot < this.bodies.length; slot++) {
        this.bodies[slot].linearDamping =
          this.stages[slot] === 1 ? 0.28 : 0.045;
        this.bodies[slot].angularDamping =
          this.stages[slot] === 1 ? 0.22 : 0.06;
      }
      this.bumpers.forEach((body, i) => {
        const angle = ((this.ticks + 1) / 120) * 0.95 + this.phase + i * 1.7;
        const nextX = BUMPERS[i].x + 0.8 * Math.sin(angle);
        body.velocity.set((nextX - body.position.x) * 120, 0, 0);
      });
      this.world.step(1 / 120);
      this.ticks++;
      const crossings: { slot: number; fraction: number }[] = [];
      this.bodies.forEach((b, slot) => {
        const p = b.position,
          r = Math.hypot(p.x - FUNNEL.x, p.z - FUNNEL.z);
        if (
          this.stages[slot] === 0 &&
          p.z > 76 &&
          p.y < 7.1 &&
          r < FUNNEL.radius
        )
          this.stages[slot] = 1;
        if (
          this.stages[slot] === 1 &&
          p.y < FUNNEL.bottom - MARBLE_RADIUS &&
          r < FUNNEL.hole + MARBLE_RADIUS
        )
          this.stages[slot] = 2;
        if (
          this.stages[slot] === 2 &&
          before[slot].z < MARBLE_FINISH_Z &&
          p.z >= MARBLE_FINISH_Z
        ) {
          const prior = before[slot],
            fraction = (MARBLE_FINISH_Z - prior.z) / (p.z - prior.z);
          const x = prior.x + (p.x - prior.x) * fraction,
            y = prior.y + (p.y - prior.y) * fraction;
          // Only the marked finish opening counts; a falling body beside the chute cannot win.
          if (
            Math.abs(x - FUNNEL.x) <= 2.2 + MARBLE_RADIUS &&
            y >= -0.5 &&
            y <= 3.5
          )
            crossings.push({ slot, fraction });
        }
      });
      crossings.sort(
        (a, b) =>
          a.fraction - b.fraction || this.ranks[a.slot] - this.ranks[b.slot],
      );
      if (crossings.length)
        this.result = {
          slot: crossings[0].slot,
          time: (this.ticks - 1 + crossings[0].fraction) / 120,
          reason: 'finish',
        };
      else if (this.ticks >= MARBLE_MAX_SECONDS * 120) {
        const order = this.bodies
          .map((_, slot) => slot)
          .sort(
            (a, b) =>
              this.progress(b) - this.progress(a) ||
              this.ranks[a] - this.ranks[b],
          );
        this.result = {
          slot: order[0],
          time: MARBLE_MAX_SECONDS,
          reason: 'distance',
        };
      }
    }
    return this.snapshot();
  }
  destroy() {
    for (const body of [...this.world.bodies]) this.world.removeBody(body);
  }
}
