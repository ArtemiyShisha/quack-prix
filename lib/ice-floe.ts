import {
  Body,
  ContactMaterial,
  Material,
  Plane,
  SAPBroadphase,
  Sphere,
  Vec3,
  World,
} from 'cannon-es';
import { seededRandom, shuffled } from './random.ts';
import type { Frame } from './race.ts';

export const ICE = {
  radius: 4.2,
  duckRadius: 0.55,
  meltStarts: 2,
  meltsAt: 15,
  waterLevel: -0.85,
} as const;
const DT = 1 / 120;

export function iceRadiusAt(time: number) {
  return (
    ICE.radius *
    Math.max(
      0,
      1 - Math.max(0, time - ICE.meltStarts) / (ICE.meltsAt - ICE.meltStarts),
    )
  );
}

export type IceDuck = {
  slot: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  angle: number;
  alive: boolean;
  eliminatedAt: number | null;
  exitX: number;
  exitZ: number;
  exitVx: number;
  exitVz: number;
};
export type IceFrame = Frame & {
  seed: number;
  iceRadius: number;
  iceDucks: IceDuck[];
  remaining: number;
  wind: { x: number; z: number };
  contacts: number;
};

/** First intersection with a circle whose radius changes linearly during a substep. */
export function iceExitFraction(
  before: { x: number; z: number },
  after: { x: number; z: number },
  oldRadius: number,
  newRadius: number,
) {
  const dx = after.x - before.x,
    dz = after.z - before.z;
  const dr = newRadius - oldRadius;
  const a = dx * dx + dz * dz - dr * dr;
  const b = 2 * (before.x * dx + before.z * dz - oldRadius * dr);
  const c = before.x ** 2 + before.z ** 2 - oldRadius ** 2;
  if (c >= 0) return 0;
  const roots =
    Math.abs(a) < 1e-12
      ? Math.abs(b) < 1e-12
        ? []
        : [-c / b]
      : [
          (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a),
          (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a),
        ];
  return (
    roots
      .filter((t) => t >= 0 && t <= 1)
      .sort((first, second) => first - second)[0] ?? 1
  );
}

export class IceSimulation {
  private world: World;
  private bodies: Body[];
  private ducks: IceDuck[];
  private ranks: number[];
  private ticks = 0;
  private result: Frame['result'] = null;
  private phase: number;
  private contactCount = 0;
  readonly seed: number;

  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('На льдине может быть от одной до восьми уток.');
    this.seed = seed;
    const random = seededRandom(seed);
    this.phase = random() * Math.PI * 2;
    this.world = new World({ gravity: new Vec3(0, -18, 0), allowSleep: false });
    this.world.broadphase = new SAPBroadphase(this.world);
    const duckMaterial = new Material('duck'),
      iceMaterial = new Material('ice');
    this.world.addContactMaterial(
      new ContactMaterial(duckMaterial, iceMaterial, {
        friction: 0.015,
        restitution: 0,
      }),
    );
    this.world.addContactMaterial(
      new ContactMaterial(duckMaterial, duckMaterial, {
        friction: 0.02,
        restitution: 0.82,
      }),
    );
    const floor = new Body({
      mass: 0,
      shape: new Plane(),
      material: iceMaterial,
      collisionFilterGroup: 1,
      collisionFilterMask: 2,
    });
    floor.quaternion.setFromAxisAngle(Vec3.UNIT_X, -Math.PI / 2);
    this.world.addBody(floor);
    const angleOffset = random() * Math.PI * 2;
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const angle = angleOffset + (slot * Math.PI * 2) / count;
      const radius = count === 1 ? 0.2 : 1.95 + random() * 0.12;
      const speed = count === 1 ? 0.15 : 3.25 + random() * 0.6;
      const tangent = (random() - 0.5) * 0.9;
      const body = new Body({
        mass: 1,
        shape: new Sphere(ICE.duckRadius),
        material: duckMaterial,
        position: new Vec3(
          Math.cos(angle) * radius,
          ICE.duckRadius + 0.02,
          Math.sin(angle) * radius,
        ),
        linearDamping: 0.28,
        angularDamping: 0.65,
        collisionFilterGroup: 2,
        collisionFilterMask: 3,
      });
      body.velocity.set(
        -Math.cos(angle) * speed - Math.sin(angle) * tangent,
        0,
        -Math.sin(angle) * speed + Math.cos(angle) * tangent,
      );
      this.world.addBody(body);
      return body;
    });
    this.ducks = this.bodies.map((body, slot) => ({
      slot,
      x: body.position.x,
      y: body.position.y,
      z: body.position.z,
      vx: body.velocity.x,
      vz: body.velocity.z,
      angle: Math.atan2(body.velocity.x, body.velocity.z),
      alive: true,
      eliminatedAt: null,
      exitX: 0,
      exitZ: 0,
      exitVx: 0,
      exitVz: 0,
    }));
    this.ranks = shuffled(
      this.ducks.map((d) => d.slot),
      () => Math.floor(random() * 2 ** 32),
    );
  }

  private windAt(time: number) {
    const angle = this.phase + time * 0.85;
    const strength = 1.2 + 0.8 * Math.sin(time * 2.1 + this.phase) ** 2;
    return { x: Math.cos(angle) * strength, z: Math.sin(angle) * strength };
  }

  snapshot(): IceFrame {
    const elapsed = this.ticks * DT;
    return {
      elapsed,
      seed: this.seed,
      iceRadius: iceRadiusAt(elapsed),
      iceDucks: this.ducks.map((duck) => ({ ...duck })),
      remaining: this.ducks.filter((duck) => duck.alive).length,
      wind: this.windAt(elapsed),
      contacts: this.contactCount,
      ducks: this.ducks.map((duck) => ({
        slot: duck.slot,
        x: duck.x,
        y: duck.z,
        vx: duck.vx,
        vy: duck.vz,
        angle: duck.angle,
        progress: duck.alive ? 4000 : (duck.eliminatedAt ?? 0) * 100,
        stage: 0,
        inTube: false,
        hiddenInDrain: !duck.alive,
      })),
      paddles: [],
      flushing: false,
      result: this.result && { ...this.result },
    };
  }

  step(): IceFrame {
    if (this.result) return this.snapshot();
    for (let substep = 0; substep < 2 && !this.result; substep++) {
      const oldTime = this.ticks * DT,
        nextTime = (this.ticks + 1) * DT;
      const oldRadius = iceRadiusAt(oldTime),
        newRadius = iceRadiusAt(nextTime);
      const before = this.bodies.map((body) => ({
        x: body.position.x,
        z: body.position.z,
      }));
      const wind = this.windAt(nextTime);
      for (const duck of this.ducks) {
        if (duck.alive)
          this.bodies[duck.slot].applyForce(new Vec3(wind.x, 0, wind.z));
      }
      this.world.step(DT);
      this.ticks++;
      for (const contact of this.world.contacts) {
        if (
          contact.bi.mass > 0 &&
          contact.bj.mass > 0 &&
          contact.bi.velocity.vsub(contact.bj.velocity).length() > 0.5
        )
          this.contactCount++;
      }
      const exits: { slot: number; fraction: number }[] = [];
      for (const duck of this.ducks) {
        if (!duck.alive) continue;
        const body = this.bodies[duck.slot];
        duck.x = body.position.x;
        duck.y = body.position.y;
        duck.z = body.position.z;
        duck.vx = body.velocity.x;
        duck.vz = body.velocity.z;
        if (Math.hypot(duck.vx, duck.vz) > 0.12)
          duck.angle = Math.atan2(duck.vx, duck.vz);
        if (Math.hypot(duck.x, duck.z) >= newRadius || newRadius === 0) {
          exits.push({
            slot: duck.slot,
            fraction: iceExitFraction(
              before[duck.slot],
              body.position,
              oldRadius,
              newRadius,
            ),
          });
        }
      }
      exits.sort(
        (a, b) =>
          a.fraction - b.fraction || this.ranks[a.slot] - this.ranks[b.slot],
      );
      for (const exit of exits) {
        const duck = this.ducks[exit.slot];
        duck.alive = false;
        duck.eliminatedAt = oldTime + exit.fraction * DT;
        duck.exitX =
          before[exit.slot].x + (duck.x - before[exit.slot].x) * exit.fraction;
        duck.exitZ =
          before[exit.slot].z + (duck.z - before[exit.slot].z) * exit.fraction;
        duck.exitVx = duck.vx;
        duck.exitVz = duck.vz;
        this.world.removeBody(this.bodies[exit.slot]);
      }
      const survivors = this.ducks.filter((duck) => duck.alive);
      if (this.ducks.length === 1 && nextTime >= 1.2) {
        this.result = { slot: 0, time: nextTime, reason: 'survivor' };
      } else if (this.ducks.length > 1 && survivors.length <= 1) {
        const lastExit = exits.at(-1)!;
        this.result = {
          slot: survivors[0]?.slot ?? lastExit.slot,
          time: oldTime + lastExit.fraction * DT,
          reason: 'survivor',
        };
      }
    }
    return this.snapshot();
  }

  destroy() {
    for (const body of this.world.bodies.slice()) this.world.removeBody(body);
  }
}
