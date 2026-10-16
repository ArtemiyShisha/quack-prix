import type {
  Collider,
  ColliderDesc,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import {
  PINBALL,
  pinballPhysics,
  flipperStroke,
  type PinballFrame,
  type Point3,
} from './pinball.ts';
import {
  createPinballArena,
  arenaStartGatePosition,
  DEFAULT_PINBALL_MAP,
  type PinballArena,
  type PinballMapId,
  type ArenaMotor,
  type ArenaArm,
  type ArenaPlatform,
  type ArenaBlock,
  type ArenaRail,
  type ArenaSpring,
  type ArenaGoal,
} from './pinball-maps.ts';
import { seededRandom, shuffled } from './random.ts';
import type { Finish } from './race.ts';

export type ArenaPose = {
  id: string;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
};
export type ArenaFrame = Omit<PinballFrame, 'balls'> & {
  balls: (PinballFrame['balls'][number] & {
    lastImpactAt: number;
    impactSpeed: number;
  })[];
  mapId: PinballMapId;
  objects: ArenaPose[];
  displaced: number;
  gateOpen: boolean;
  startGateOpen: boolean;
  stages: number[];
  springReady: boolean[];
  ballContacts: number;
  goalReturns: number;
  inBowl: number;
  motorHits: number[];
};
const v = (p: Point3) => new Vector3(p.x, p.y, p.z);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export function arenaMotorAngle(
  config: ArenaMotor,
  time: number,
  phase: number,
) {
  if (config.arc)
    return config.angle + Math.max(0, time - config.arc.hold) * config.speed;
  return (
    config.angle +
    (config.swing === undefined
      ? phase + time * config.speed
      : config.swing * Math.sin(phase + time * config.speed))
  );
}
export function arenaSpringReady(
  spring: ArenaSpring,
  time: number,
  phase: number,
  index: number,
  releaseAt = 65,
) {
  return (
    time < releaseAt &&
    (!spring.period ||
      (time + phase + index * 2.3) % spring.period <
        (spring.activeFor ?? spring.period))
  );
}
export function arenaOrientation(map: PinballArena, x: number, z: number) {
  const e = 0.01,
    dx = (map.height(x + e, z) - map.height(x - e, z)) / (2 * e),
    dz = (map.height(x, z + e) - map.height(x, z - e)) / (2 * e);
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(-dx, 1, -dz).normalize(),
  );
}
export function arenaRailSurface(rail: ArenaRail, lowered = 0) {
  const direction = v(rail.b).sub(v(rail.a));
  const side = new Vector3(-direction.z, 0, direction.x)
    .normalize()
    .multiplyScalar(rail.width / 2);
  // Vertical extrusion seals the deck even on the steep lips between bowls.
  const positions: number[] = [];
  for (const height of [-lowered, rail.height])
    for (const [point, sign] of [
      [rail.a, -1],
      [rail.b, -1],
      [rail.b, 1],
      [rail.a, 1],
    ] as const) {
      positions.push(
        point.x + side.x * sign,
        point.y + height,
        point.z + side.z * sign,
      );
    }
  return {
    positions,
    indices: [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
      3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ],
  };
}
export function arenaArcSurface(map: PinballArena, motor: ArenaMotor) {
  const arc = motor.arc;
  if (!arc) throw new Error('У механизма нет дуговой стенки.');
  const positions: number[] = [],
    indices: number[] = [],
    groups: { start: number; count: number; materialIndex: number }[] = [],
    steps = 96;
  for (let i = 0; i <= steps; i++) {
    const angle = arc.from + (i / steps) * arc.sweep;
    for (const side of [-1, 1])
      for (const top of [-1, 1]) {
        const radius = arc.radius + (side * motor.width) / 2,
          x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius,
          lift =
            map.height(motor.x + x, motor.z + z) - map.height(motor.x, motor.z);
        positions.push(x, lift + (top * motor.height) / 2, z);
      }
    if (i === steps) break;
    const a = i * 4,
      b = a + 4,
      start = indices.length;
    indices.push(
      a,
      b,
      a + 1,
      b,
      b + 1,
      a + 1,
      a + 2,
      a + 3,
      b + 2,
      b + 2,
      a + 3,
      b + 3,
      a + 1,
      b + 1,
      a + 3,
      b + 1,
      b + 3,
      a + 3,
      a,
      a + 2,
      b,
      b,
      a + 2,
      b + 2,
    );
    groups.push({
      start,
      count: indices.length - start,
      materialIndex: Math.floor(i / 6) % 2,
    });
  }
  const end = steps * 4;
  groups.push({ start: indices.length, count: 12, materialIndex: 0 });
  indices.push(
    0,
    1,
    2,
    1,
    3,
    2,
    end,
    end + 2,
    end + 1,
    end + 1,
    end + 2,
    end + 3,
  );
  return { positions, indices, groups };
}
export function platformPose(
  platform: ArenaPlatform,
  time: number,
  phase: number,
) {
  const roll = 0.18 * Math.sin(time * 0.9 + platform.phase + phase);
  const q = new Quaternion()
    .setFromAxisAngle(new Vector3(1, 0, 0), Math.atan(0.18))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
  return {
    position: new Vector3(platform.x, platform.y, platform.z),
    rotation: q,
  };
}
export function arenaGoalFraction(
  goal: ArenaGoal,
  before: Point3,
  after: Point3,
) {
  if (before.y <= goal.y || after.y > goal.y || after.y >= before.y)
    return null;
  const t = (goal.y - before.y) / (after.y - before.y),
    x = before.x + (after.x - before.x) * t,
    z = before.z + (after.z - before.z) * t;
  return Math.hypot(x - goal.x, z - goal.z) < goal.radius ? t : null;
}
export function arenaFinishFraction(
  map: PinballArena,
  before: Point3,
  after: Point3,
) {
  if (map.goal) {
    // A complete ball has to fall through the real opening. Flying over it,
    // touching its rim or leaving the board elsewhere cannot finish a round.
    return arenaGoalFraction(map.goal, before, after);
  }
  if (before.z >= map.finishZ || after.z < map.finishZ || after.z <= before.z)
    return null;
  const t = (map.finishZ - before.z) / (after.z - before.z),
    x = before.x + (after.x - before.x) * t,
    y = before.y + (after.y - before.y) * t;
  const floor =
    map.height(0, map.exitZ) -
    (map.exitDrop ?? 0) -
    (map.finishZ - map.exitZ) * 0.4;
  return Math.abs(x) < map.finishHalfWidth &&
    y < floor + 0.58 &&
    y > floor - 0.4
    ? t
    : null;
}
type Motor = {
  config: ArenaMotor;
  body: RigidBody;
  base: Quaternion;
  y: number;
  lastHit: number;
  lastBallHit: number[];
};
type Arm = {
  config: ArenaArm;
  body: RigidBody;
  base: Quaternion;
  pivot: Vector3;
  axis: Vector3;
};
export class PinballArenaSimulation {
  readonly seed: number;
  readonly map: PinballArena;
  private engine: ReturnType<typeof pinballPhysics>;
  private world: World;
  private bodies: RigidBody[] = [];
  private motors: Motor[] = [];
  private arms: Arm[] = [];
  private platforms: { config: ArenaPlatform; body: RigidBody }[] = [];
  private blocks: { config: ArenaBlock; body: RigidBody; start: Vector3 }[] =
    [];
  private objects = new Map<string, RigidBody>();
  private startGate: RigidBody | null = null;
  private floors = new Set<number>();
  private bumpers = new Map<number, number>();
  private ballSlots = new Map<number, number>();
  private reboundWalls = new Map<number, Motor>();
  private phase: number;
  private ticks = 0;
  private result: Finish | null = null;
  private ranks: number[];
  private hits: number[];
  private loops: number[];
  private lastHit: number[];
  private lastImpact: number[];
  private impactSpeed: number[];
  private lastLoop: number[];
  private lastSpring: number[][];
  private springHits: number[];
  private bumperHits: number[];
  private airborne: boolean[];
  private wasSupported: boolean[];
  private below: boolean[];
  private outerSide: number[];
  private stages: number[];
  private contacts = 0;
  private ballImpacts = 0;
  private goalReturns = 0;
  private nearGoal: boolean[] = [];
  private returns = 0;
  private jumps = 0;
  private recoveries = 0;
  private active = new Set<string>();
  private destroyed = false;
  private dt = 1 / PINBALL.physicsHz;
  private recoveryZ: number;
  private recoveryY = -7;
  private releaseAt = 65;
  private maxSeconds: number = PINBALL.maxSeconds;
  constructor(
    count: number,
    seed: number,
    mapId: PinballMapId = DEFAULT_PINBALL_MAP,
  ) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Пинбол рассчитан на 1–8 участников.');
    this.seed = seed;
    this.map = createPinballArena(mapId);
    this.releaseAt = this.map.releaseAt ?? 65;
    this.maxSeconds = this.map.maxSeconds ?? PINBALL.maxSeconds;
    if (this.map.levels) {
      let lowest = Infinity;
      for (const floor of this.map.floor)
        for (let i = 1; i < floor.positions.length; i += 3)
          lowest = Math.min(lowest, floor.positions[i]);
      this.recoveryY = lowest - 6;
    }
    this.recoveryZ =
      Math.max(this.map.finishZ, ...this.map.boundary.map((p) => p.z)) + 4;
    this.engine = pinballPhysics();
    const R = this.engine,
      random = seededRandom(seed);
    this.phase = random() * Math.PI * 2;
    this.world = new R.World({ x: 0, y: -PINBALL.gravity, z: 0 });
    this.world.timestep = this.dt;
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 4;
    for (const floor of this.map.floor) {
      const collider = this.fixed(
        R.ColliderDesc.trimesh(
          new Float32Array(floor.positions),
          new Uint32Array(floor.indices),
          R.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED,
        ),
        mapId === 'fortress' ? 0.3 : 0.5,
        0.025,
      );
      this.floors.add(collider.handle);
    }
    for (const rail of this.map.rails) {
      const shape = arenaRailSurface(rail, mapId === 'seesaw' ? 1.65 : 0);
      this.fixed(
        R.ColliderDesc.convexHull(new Float32Array(shape.positions))!,
        0.06,
        0.5,
      );
    }
    for (const goal of this.map.levels?.map((level) => level.goal) ??
      (this.map.goal ? [this.map.goal] : [])) {
      const top = this.map.height(goal.x + goal.radius, goal.z);
      for (let i = 0; i < 64; i++) {
        const angle = ((i + 0.5) / 64) * Math.PI * 2;
        const radius = goal.radius + 0.05;
        this.fixed(
          R.ColliderDesc.cuboid((Math.PI * radius) / 64 + 0.004, 0.9, 0.05)
            .setTranslation(
              goal.x + Math.cos(angle) * radius,
              top - 0.9,
              goal.z + Math.sin(angle) * radius,
            )
            .setRotation(
              new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                Math.PI / 2 - angle,
              ),
            ),
          0.04,
          0.08,
        );
      }
    }
    this.map.bumpers.forEach((b, index) => {
      const collider = this.fixed(
        R.ColliderDesc.cylinder(0.6, b.radius).setTranslation(
          b.x,
          this.map.height(b.x, b.z) + 0.6,
          b.z,
        ),
        0.06,
        0.16,
      );
      this.bumpers.set(collider.handle, index);
    });
    this.motors = this.map.motors.map((config) => {
      const base = arenaOrientation(this.map, config.x, config.z),
        y =
          this.map.height(config.x, config.z) +
          config.height / 2 +
          (config.elevation ?? 0);
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(config.x, y, config.z)
          .setRotation(
            base
              .clone()
              .multiply(
                new Quaternion().setFromAxisAngle(
                  new Vector3(0, 1, 0),
                  arenaMotorAngle(config, 0, this.phase),
                ),
              ),
          ),
      );
      if (config.arc) {
        const shape = arenaArcSurface(this.map, config);
        this.world.createCollider(
          this.material(
            R.ColliderDesc.trimesh(
              new Float32Array(shape.positions),
              new Uint32Array(shape.indices),
              R.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED,
            ),
            0.02,
            config.rebound?.restitution ?? 0.28,
          ).setRestitutionCombineRule(
            config.rebound
              ? R.CoefficientCombineRule.Max
              : R.CoefficientCombineRule.Min,
          ),
          body,
        );
      } else
        for (const angle of config.cross ? [0, Math.PI / 2] : [0])
          this.world.createCollider(
            this.material(
              R.ColliderDesc.cuboid(
                config.length / 2,
                config.height / 2,
                config.width / 2,
              ).setRotation(
                new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
              ),
              0.08,
              0.26,
            ),
            body,
          );
      this.objects.set(config.id, body);
      const motor = {
        config,
        body,
        base,
        y,
        lastHit: -10,
        lastBallHit: Array(count).fill(-10),
      };
      if (config.rebound)
        for (let i = 0; i < body.numColliders(); i++)
          this.reboundWalls.set(body.collider(i).handle, motor);
      return motor;
    });
    this.arms = this.map.arms.map((config, index) => {
      const base = arenaOrientation(this.map, config.x, config.z),
        axis = new Vector3(0, 1, 0).applyQuaternion(base),
        pivot = new Vector3(
          config.x,
          this.map.height(config.x, config.z),
          config.z,
        ).addScaledVector(axis, 0.36);
      const q = base
          .clone()
          .multiply(
            new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              config.angle,
            ),
          ),
        centre = new Vector3(config.length / 2, 0, 0)
          .applyQuaternion(q)
          .add(pivot);
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(centre.x, centre.y, centre.z)
          .setRotation(q)
          .setCcdEnabled(true)
          .setCanSleep(false)
          .setAdditionalSolverIterations(4),
      );
      this.world.createCollider(
        this.material(
          R.ColliderDesc.cuboid(config.length / 2, 0.36, 0.17).setMass(
            config.passive ? 0.5 : 0.65,
          ),
          0.08,
          0.08,
        ),
        body,
      );
      const mount = this.world.createRigidBody(
        R.RigidBodyDesc.fixed()
          .setTranslation(pivot.x, pivot.y, pivot.z)
          .setRotation(base),
      );
      const joint = this.world.createImpulseJoint(
        R.JointData.revolute(
          { x: 0, y: 0, z: 0 },
          { x: -config.length / 2, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ),
        mount,
        body,
        true,
      );
      joint.setContactsEnabled(false);
      this.objects.set(config.id, body);
      return { config, body, base, pivot, axis };
    });
    this.platforms = this.map.platforms.map((config) => {
      const pose = platformPose(config, 0, this.phase),
        body = this.world.createRigidBody(
          R.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pose.position.x, pose.position.y, pose.position.z)
            .setRotation(pose.rotation),
        );
      const floor = this.world.createCollider(
        this.material(
          R.ColliderDesc.cuboid(
            config.width / 2,
            0.14,
            config.length / 2,
          ).setTranslation(0, -0.14, 0),
          0.18,
          0.025,
        ),
        body,
      );
      this.floors.add(floor.handle);
      // Side rails ride on the platform; they cannot leave a gap underneath.
      for (const side of [-1, 1])
        this.world.createCollider(
          this.material(
            R.ColliderDesc.cuboid(0.1, 0.5, config.length / 2).setTranslation(
              (side * config.width) / 2,
              0.5,
              0,
            ),
            0.08,
            0.4,
          ),
          body,
        );
      if (config.deflector) {
        const d = config.deflector;
        this.world.createCollider(
          this.material(
            R.ColliderDesc.cuboid(d.length / 2, 0.38, 0.12)
              .setTranslation(d.x, 0.38, d.z)
              .setRotation(
                new Quaternion().setFromAxisAngle(
                  new Vector3(0, 1, 0),
                  d.angle,
                ),
              ),
            0.06,
            0.32,
          ),
          body,
        );
      }
      this.objects.set(config.id, body);
      return { config, body };
    });
    this.blocks = this.map.blocks.map((config) => {
      const orientation = arenaOrientation(this.map, config.x, config.z),
        start = new Vector3(
          config.x,
          this.map.height(config.x, config.z),
          config.z,
        ).add(
          new Vector3(0, config.height / 2 + 0.015, 0).applyQuaternion(
            orientation,
          ),
        );
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(start.x, start.y, start.z)
          .setRotation(orientation)
          .setCanSleep(true)
          .setCcdEnabled(true)
          .setLinearDamping(0.08)
          .setAngularDamping(0.12),
      );
      this.world.createCollider(
        this.material(
          R.ColliderDesc.cuboid(
            config.width / 2,
            config.height / 2,
            config.depth / 2,
          ).setMass(0.24),
          0.1,
          0.12,
        ),
        body,
      );
      this.objects.set(config.id, body);
      return { config, body, start };
    });
    const startGate = this.map.start.gate;
    if (startGate) {
      const position = arenaStartGatePosition(startGate, this.map.height, 0);
      this.startGate = this.world.createRigidBody(
        R.RigidBodyDesc.kinematicPositionBased().setTranslation(
          position.x,
          position.y,
          position.z,
        ),
      );
      this.world.createCollider(
        this.material(
          R.ColliderDesc.cuboid(
            startGate.width / 2,
            startGate.height / 2,
            startGate.depth / 2,
          ),
          0,
          0,
        ),
        this.startGate,
      );
      this.objects.set('start-gate', this.startGate);
    }
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const x = (slot - (count - 1) / 2) * 0.74,
        z = this.map.start.z + (startGate ? 0 : (random() - 0.5) * 0.15);
      const speed = startGate ? 0 : 2.8 + random() * 0.8,
        velocity = startGate
          ? new Vector3()
          : new Vector3((random() - 0.5) * 1.7, 0, speed),
        q = arenaOrientation(this.map, x, z);
      velocity.addScaledVector(
        new Vector3(0, 1, 0).applyQuaternion(q),
        -velocity.dot(new Vector3(0, 1, 0).applyQuaternion(q)),
      );
      let y =
        this.map.height(x, z) +
        (startGate
          ? PINBALL.radius / new Vector3(0, 1, 0).applyQuaternion(q).y + 0.004
          : PINBALL.radius + 0.015);
      if (mapId === 'seesaw') {
        const platform = this.map.platforms[0],
          pose = platformPose(platform, 0, this.phase),
          normal = new Vector3(0, 1, 0).applyQuaternion(pose.rotation);
        y =
          pose.position.y -
          (normal.x * (x - pose.position.x) +
            normal.z * (z - pose.position.z)) /
            normal.y +
          PINBALL.radius / normal.y +
          0.02;
      }
      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(x, y, z)
          .setLinvel(velocity.x, velocity.y, velocity.z)
          .setAngvel(
            new Vector3(0, 1, 0)
              .applyQuaternion(q)
              .cross(velocity)
              .multiplyScalar(1 / PINBALL.radius),
          )
          .setLinearDamping(0.008)
          .setAngularDamping(
            mapId === 'reactor' || mapId === 'descent' ? 0.32 : 0.012,
          )
          .setCcdEnabled(true)
          .setCanSleep(false),
      );
      const collider = this.world.createCollider(
        R.ColliderDesc.ball(PINBALL.radius)
          .setMass(1)
          .setFriction(0.08)
          .setRestitution(0.65)
          .setFrictionCombineRule(R.CoefficientCombineRule.Min)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Min),
        body,
      );
      this.ballSlots.set(collider.handle, slot);
      return body;
    });
    this.ranks = shuffled(
      this.bodies.map((_, i) => i),
      () => Math.floor(random() * 2 ** 32),
    );
    this.hits = this.bodies.map(() => 0);
    this.loops = [...this.hits];
    this.lastHit = this.bodies.map(() => -10);
    this.lastImpact = [...this.lastHit];
    this.impactSpeed = [...this.hits];
    this.lastLoop = [...this.lastHit];
    this.lastSpring = this.bodies.map(() => this.map.springs.map(() => -10));
    this.springHits = this.map.springs.map(() => -10);
    this.bumperHits = this.map.bumpers.map(() => -10);
    this.airborne = this.bodies.map(() => false);
    this.wasSupported = this.bodies.map(() => false);
    this.below = this.bodies.map(() => false);
    this.outerSide = this.bodies.map(() => 0);
    this.stages = this.bodies.map(() => 0);
    this.nearGoal = this.bodies.map(() => false);
  }
  private material(desc: ColliderDesc, friction: number, restitution: number) {
    return desc
      .setFriction(friction)
      .setRestitution(restitution)
      .setFrictionCombineRule(this.engine.CoefficientCombineRule.Average)
      .setRestitutionCombineRule(this.engine.CoefficientCombineRule.Min);
  }
  private fixed(desc: ColliderDesc, friction: number, restitution: number) {
    return this.world.createCollider(
      this.material(desc, friction, restitution),
    );
  }
  private ballContacts(body: RigidBody) {
    const contacts: { other: Collider; normal: Vector3 }[] = [];
    this.world.contactPairsWith(body.collider(0), (other) => {
      if (this.reboundWalls.has(other.handle)) {
        // CCD may resolve a bounce before the cached triangle manifold is
        // refreshed. Query the current two shapes, including the contact skin,
        // rather than mistaking that stale manifold for a missed collision.
        const contact = body.collider(0).contactCollider(other, 0.002);
        if (contact && contact.distance <= 0.002)
          contacts.push({ other, normal: v(contact.normal2) });
        return;
      }
      this.world.contactPair(body.collider(0), other, (m, flipped) => {
        let touching = false;
        for (let i = 0; i < m.numContacts(); i++)
          if (m.contactDist(i) <= 0.002 || m.contactImpulse(i) > 0)
            touching = true;
        if (touching)
          contacts.push({
            other,
            normal: v(m.normal()).multiplyScalar(flipped ? 1 : -1),
          });
      });
    });
    return contacts;
  }
  snapshot(): ArenaFrame {
    if (this.destroyed) throw new Error('Симуляция уже освобождена.');
    const elapsed = this.ticks * this.dt;
    const balls = this.bodies.map((body, slot) => {
      const p = body.translation(),
        q = body.rotation(),
        vel = body.linvel();
      return {
        slot,
        ...p,
        vx: vel.x,
        vy: vel.y,
        vz: vel.z,
        qx: q.x,
        qy: q.y,
        qz: q.z,
        qw: q.w,
        hits: this.hits[slot],
        loops: this.loops[slot],
        lastHitAt: this.lastHit[slot],
        lastImpactAt: this.lastImpact[slot],
        impactSpeed: this.impactSpeed[slot],
        lastLoopAt: this.lastLoop[slot],
      };
    });
    return {
      mapId: this.map.id,
      seed: this.seed,
      elapsed,
      balls,
      flippers: [],
      rotorAngle: 0,
      bumperHits: [...this.bumperHits],
      kickerHits: [...this.springHits],
      contacts: this.contacts,
      ballContacts: this.ballImpacts,
      goalReturns: this.goalReturns,
      inBowl: this.map.goal ? balls.filter((b) => b.z > -1.4).length : 0,
      motorHits: this.motors.map((m) => m.lastHit),
      returns: this.returns,
      jumps: this.jumps,
      recoveries: this.recoveries,
      rescue: elapsed >= this.releaseAt,
      displaced: this.blocks.filter(
        (b) =>
          v(b.body.translation()).distanceTo(b.start) > 0.6 ||
          Math.abs(b.body.rotation().w) < 0.95,
      ).length,
      gateOpen: elapsed >= this.releaseAt,
      startGateOpen:
        !this.map.start.gate ||
        elapsed >=
          this.map.start.gate.opensAt + this.map.start.gate.openingDuration,
      stages: [...this.stages],
      springReady: this.map.springs.map((spring, i) =>
        arenaSpringReady(spring, elapsed, this.phase, i, this.releaseAt),
      ),
      objects: [...this.objects].map(([id, body]) => {
        const p = body.translation(),
          q = body.rotation();
        return { id, ...p, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
      }),
      ducks: balls.map((b) => ({
        slot: b.slot,
        x: b.x,
        y: b.z,
        vx: b.vx,
        vy: b.vz,
        angle: 0,
        progress:
          ((b.z - this.map.start.z) / (this.map.finishZ - this.map.start.z)) *
          4000,
        stage: this.stages[b.slot],
        inTube: false,
        hiddenInDrain: false,
      })),
      paddles: [],
      flushing: false,
      result: this.result && { ...this.result },
    };
  }
  step(): ArenaFrame {
    if (this.destroyed) throw new Error('Симуляция уже освобождена.');
    if (this.result) return this.snapshot();
    for (let substep = 0; substep < 4 && !this.result; substep++) {
      const time = this.ticks * this.dt,
        before = this.bodies.map((b) => ({ ...b.translation() }));
      if (this.startGate && this.map.start.gate)
        this.startGate.setNextKinematicTranslation(
          arenaStartGatePosition(
            this.map.start.gate,
            this.map.height,
            time + this.dt,
          ),
        );
      for (const motor of this.motors) {
        const { config, body, base, y } = motor,
          clock = Math.min(time + this.dt, this.releaseAt);
        const q = base
          .clone()
          .multiply(
            new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              arenaMotorAngle(config, clock, this.phase),
            ),
          );
        body.setNextKinematicRotation(q);
        body.setNextKinematicTranslation({
          x: config.x,
          y:
            y +
            (config.gate || this.map.levels
              ? 2.5 * smooth(time - this.releaseAt)
              : 0),
          z: config.z,
        });
      }
      this.arms.forEach((arm, index) => {
        const { body, config, base, axis } = arm,
          q = base
            .clone()
            .invert()
            .multiply(new Quaternion().copy(body.rotation()));
        const angle = 2 * Math.atan2(q.y, q.w),
          parked = time >= this.releaseAt;
        const swing = config.passive
          ? 0
          : flipperStroke(index % 2, time, this.phase) - 0.24;
        const target =
          config.angle +
          (config.passive ? 0 : index % 2 ? -swing : swing) +
          (parked && !config.passive ? (index % 2 ? -1 : 1) * 1.15 : 0);
        const error = Math.atan2(
            Math.sin(target - angle),
            Math.cos(target - angle),
          ),
          speed = v(body.angvel()).dot(axis);
        body.resetTorques(true);
        body.addTorque(
          axis
            .clone()
            .multiplyScalar(
              clamp(
                error * (config.passive ? 0.2 : 180) -
                  speed * (config.passive ? 0.65 : 12),
                config.passive ? -2 : -45,
                config.passive ? 2 : 45,
              ),
            ),
          true,
        );
      });
      for (const { config, body } of this.platforms) {
        const pose = platformPose(config, time + this.dt, this.phase);
        body.setNextKinematicRotation(pose.rotation);
        body.setNextKinematicTranslation(pose.position);
      }
      this.bodies.forEach((body, slot) => {
        body.resetForces(true);
        const p = body.translation(),
          contacts = this.ballContacts(body),
          support = contacts.find(
            (c) => this.floors.has(c.other.handle) && c.normal.y > 0.15,
          );
        if (
          support &&
          this.map.flow === 'eight' &&
          p.z < 3.5 &&
          time < this.releaseAt
        ) {
          const side = p.x < 0 ? -1 : 1,
            offset = new Vector3(p.x - side * 3, 0, p.z),
            tangent = new Vector3(-offset.z, 0, offset.x).normalize();
          tangent
            .addScaledVector(support.normal, -tangent.dot(support.normal))
            .normalize();
          const speed = v(body.linvel()).dot(tangent);
          body.addForce(
            tangent.multiplyScalar(clamp((4.4 - speed) * 1.8, 0, 3)),
            true,
          );
        }
        this.map.springs.forEach((spring, i) => {
          if (
            !support ||
            !arenaSpringReady(spring, time, this.phase, i, this.releaseAt) ||
            time - this.lastSpring[slot][i] < 2 ||
            Math.hypot(p.x - spring.x, p.z - spring.z) > spring.radius ||
            Math.abs(p.y - this.map.height(p.x, p.z) - PINBALL.radius) > 0.38
          )
            return;
          const direction = v(spring.direction).normalize(),
            speed = v(body.linvel()).dot(direction),
            impulse = clamp(spring.speed - speed, 0, spring.speed);
          if (impulse < 0.1) return;
          body.applyImpulse(direction.multiplyScalar(impulse), true);
          this.lastSpring[slot][i] = time;
          this.springHits[i] = time;
        });
        if (
          p.y < this.recoveryY ||
          Math.abs(p.x) > 12 ||
          p.z < this.map.start.z - 7 ||
          p.z > this.recoveryZ
        ) {
          // Explicit emergency recovery only. Normal progress is always physical.
          this.recoveries++;
          this.stages[slot] = 0;
          this.nearGoal[slot] = false;
          const z = this.map.start.z;
          body.setTranslation(
            { x: 0, y: this.map.height(0, z) + PINBALL.radius + 0.5, z },
            true,
          );
          body.setLinvel({ x: 0, y: 0, z: 3 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          before[slot] = { ...body.translation() };
        }
      });
      const incoming = this.bodies.map((b) => v(b.linvel()));
      this.world.step();
      const active = new Set<string>();
      this.bodies.forEach((body, slot) => {
        const p = body.translation(),
          contacts = this.ballContacts(body),
          support = contacts.some(
            (c) => this.floors.has(c.other.handle) && c.normal.y > 0.15,
          );
        if (
          this.wasSupported[slot] &&
          !support &&
          body.linvel().y > 0.6 &&
          !this.airborne[slot]
        ) {
          this.airborne[slot] = true;
          this.jumps++;
        }
        if (support) this.airborne[slot] = false;
        this.wasSupported[slot] = support;
        let returned = false;
        const level = this.map.levels?.[this.stages[slot]];
        if (
          level &&
          this.stages[slot] < this.map.levels!.length - 1 &&
          arenaGoalFraction(level.goal, before[slot], p) !== null
        )
          this.stages[slot]++;
        if (this.map.goal) {
          const distance = Math.hypot(
            p.x - this.map.goal.x,
            p.z - this.map.goal.z,
          );
          if (distance < 1.65) this.nearGoal[slot] = true;
          if (this.nearGoal[slot] && distance > 3.0) {
            returned = true;
            this.goalReturns++;
            this.nearGoal[slot] = false;
          }
          if (!this.map.levels) this.stages[slot] = p.z > -1.4 ? 1 : 0;
        } else if (this.map.id === 'cascade') {
          const stage = p.z < -3 ? 0 : p.z < 3 ? 1 : 2;
          returned = stage < this.stages[slot];
          this.stages[slot] = stage;
        } else if (this.map.flow === 'eight') {
          if (Math.abs(p.x) > 4) this.outerSide[slot] = p.x < 0 ? -1 : 1;
          if (Math.abs(p.x) < 0.65 && this.outerSide[slot]) {
            returned = true;
            this.outerSide[slot] = 0;
          }
        } else {
          if (p.z > 2) this.below[slot] = true;
          if (this.below[slot] && p.z < 0) {
            returned = true;
            this.below[slot] = false;
          }
        }
        if (returned && time - this.lastLoop[slot] > 1.5) {
          this.returns++;
          this.loops[slot]++;
          this.lastLoop[slot] = time;
        }
        for (const c of contacts) {
          if (this.floors.has(c.other.handle)) continue;
          const handle = body.collider(0).handle,
            key = `${Math.min(handle, c.other.handle)}:${Math.max(handle, c.other.handle)}`;
          if (active.has(key)) continue;
          active.add(key);
          const otherSlot = this.ballSlots.get(c.other.handle),
            otherVelocity =
              otherSlot === undefined
                ? v(
                    c.other
                      .parent()
                      ?.velocityAtPoint(
                        v(p).addScaledVector(c.normal, -PINBALL.radius),
                      ) ?? { x: 0, y: 0, z: 0 },
                  )
                : incoming[otherSlot];
          const impact = Math.max(
            0,
            -incoming[slot].clone().sub(otherVelocity).dot(c.normal),
          );
          const wall = this.reboundWalls.get(c.other.handle),
            rebound = wall?.config.rebound;
          const outside =
            !rebound?.outsideOnly ||
            (wall &&
              c.normal.dot(
                new Vector3(
                  p.x - wall.config.x,
                  0,
                  p.z - wall.config.z,
                ).normalize(),
              ) > 0.2);
          if (
            wall &&
            rebound &&
            outside &&
            time < this.releaseAt &&
            Math.abs(c.normal.y) < 0.5
          ) {
            // Treat the entire wall as one contact episode, including its
            // adjoining triangles. A powered rubber face fires once per hit.
            const wallKey = `rebound:${slot}:${wall.body.handle}`;
            const firstContact =
              !this.active.has(wallKey) && !active.has(wallKey);
            active.add(wallKey);
            if (
              firstContact &&
              time - wall.lastBallHit[slot] >= rebound.cooldown
            ) {
              const surface = new Vector3(0, 1, 0).applyQuaternion(
                arenaOrientation(this.map, p.x, p.z),
              );
              const normal = c.normal
                .clone()
                .addScaledVector(surface, -c.normal.dot(surface))
                .normalize();
              const outgoing = v(body.linvel()).sub(otherVelocity).dot(normal),
                impulse = clamp(
                  rebound.speed - outgoing,
                  0,
                  rebound.speed * 1.25,
                );
              if (impulse > 0)
                body.applyImpulse(normal.multiplyScalar(impulse), true);
              wall.lastBallHit[slot] = time;
              wall.lastHit = time;
              this.lastImpact[slot] = time;
              this.impactSpeed[slot] = Math.max(impact, rebound.speed);
            }
          }
          if (!this.active.has(key) && impact > 0.6) {
            this.contacts++;
            this.lastImpact[slot] = time;
            this.impactSpeed[slot] = impact;
            if (otherSlot !== undefined) {
              this.lastImpact[otherSlot] = time;
              this.impactSpeed[otherSlot] = impact;
            }
            if (otherSlot !== undefined) this.ballImpacts++;
          }
          const index = this.bumpers.get(c.other.handle);
          if (
            index === undefined ||
            this.active.has(key) ||
            time - this.lastHit[slot] < 0.09 ||
            impact < 0.15
          )
            continue;
          const bumper = this.map.bumpers[index],
            normal = new Vector3(p.x - bumper.x, 0, p.z - bumper.z).normalize(),
            surface = new Vector3(0, 1, 0).applyQuaternion(
              arenaOrientation(this.map, p.x, p.z),
            );
          normal.addScaledVector(surface, -normal.dot(surface)).normalize();
          const impulse = clamp(
            bumper.strength - v(body.linvel()).dot(normal),
            0,
            5.5,
          );
          body.applyImpulse(normal.multiplyScalar(impulse), true);
          this.hits[slot]++;
          this.lastHit[slot] = time;
          this.bumperHits[index] = time;
        }
      });
      this.active = active;
      this.ticks++;
      const crossings = this.bodies
        .flatMap((body, slot) => {
          if (
            this.map.levels &&
            this.stages[slot] !== this.map.levels.length - 1
          )
            return [];
          const fraction = arenaFinishFraction(
            this.map,
            before[slot],
            body.translation(),
          );
          return fraction === null ? [] : [{ slot, fraction }];
        })
        .sort(
          (a, b) =>
            a.fraction - b.fraction || this.ranks[a.slot] - this.ranks[b.slot],
        );
      if (crossings[0])
        this.result = {
          slot: crossings[0].slot,
          time: time + crossings[0].fraction * this.dt,
          reason: 'finish',
        };
      if (!this.result && time >= this.maxSeconds) {
        const sorted = this.bodies
          .map((b, slot) => ({
            slot,
            stage: this.map.levels ? this.stages[slot] : 0,
            distance: Math.hypot(
              b.translation().x - (this.map.goal?.x ?? 0),
              b.translation().z - (this.map.goal?.z ?? this.map.finishZ),
            ),
          }))
          .sort(
            (a, b) =>
              b.stage - a.stage ||
              a.distance - b.distance ||
              this.ranks[a.slot] - this.ranks[b.slot],
          );
        this.result = { slot: sorted[0].slot, time, reason: 'distance' };
      }
    }
    return this.snapshot();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.world.free();
  }
}
