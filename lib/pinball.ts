import type {
  Collider,
  ColliderDesc,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { seededRandom, shuffled } from './random.ts';
import type { Frame, Finish } from './race.ts';

let RAPIER: typeof import('@dimforge/rapier3d-compat').default;
const ballFriction = 0.08;

export const PINBALL = {
  radius: 0.34,
  width: 12.4,
  length: 24,
  slope: 0.11,
  gravity: 9.81,
  physicsHz: 240,
  startZ: -10.9,
  finishZ: 12.65,
  finishHalfWidth: 0.74,
  maxSeconds: 90,
} as const;
const halfWidth = PINBALL.width / 2;
const halfLength = PINBALL.length / 2;
export const runoutHeight = (z: number) =>
  boardHeight(halfLength) - (z - halfLength) * 0.6;
export const boardHeight = (z: number) => -z * PINBALL.slope;
export type Point3 = { x: number; y: number; z: number };
export type Rail = { a: Point3; b: Point3; width: number; height: number };
export const BUMPERS = [
  { x: -1.9, z: -7.25, radius: 0.52 },
  { x: 1.65, z: -7.8, radius: 0.52 },
  { x: 0.45, z: -5.9, radius: 0.58 },
  { x: -4.65, z: 8.5, radius: 0.72 },
  { x: 4.65, z: 8.5, radius: 0.72 },
] as const;
export const KICKERS = [
  ...[-1, 1].map((side) => ({ x: side * 2.65, z: -3.9, radius: 1.25 })),
  { x: 0, z: -1.3, radius: 0.75 },
];
export const FLIPPERS = [-1, 1].map((side) => ({
  x: side * 2.7,
  z: 9.9,
  side,
  // Keep a full ball-width opening throughout both sweeps. Overlapping tips
  // otherwise squeeze the sphere between two moving paddles.
  length: 2.2,
  width: 0.38,
  height: 0.75,
}));
// Ball mass is 1. The light paddle and a bounded drive can yield under load.
export const FLIPPER_DRIVE = {
  mass: 0.65,
  stiffness: 180,
  damping: 12,
  torque: 45,
};
export const ROTOR = {
  x: -3.3,
  z: -5.8,
  length: 1.8,
  width: 0.32,
  height: 0.65,
};
const point = (x: number, z: number, lift = 0): Point3 => ({
  x,
  y: boardHeight(z) + lift,
  z,
});
const rail = (
  ax: number,
  az: number,
  bx: number,
  bz: number,
  height = 1.1,
): Rail => ({
  a: point(ax, az),
  b: point(bx, bz),
  width: 0.24,
  height,
});
// Rounded back corners turn fast perimeter shots into an orbit instead of
// reflecting them out of a square pocket.
export const RAILS: Rail[] = [
  rail(-3.8, -halfLength, 3.8, -halfLength),
  ...[-1, 1].flatMap((side) => [
    ...Array.from({ length: 12 }, (_, i) => {
      const a = ((Math.PI / 2) * i) / 12,
        b = ((Math.PI / 2) * (i + 1)) / 12;
      return rail(
        side * (3.8 + 2.4 * Math.sin(a)),
        -9.6 - 2.4 * Math.cos(a),
        side * (3.8 + 2.4 * Math.sin(b)),
        -9.6 - 2.4 * Math.cos(b),
      );
    }),
    rail(side * halfWidth, -9.6, side * halfWidth, 9.4),
    rail(side * halfWidth, 9.4, side * 0.92, halfLength),
    rail(side * 0.92, halfLength, side * 0.92, halfLength + 2),
  ]),
];
// Alternating downhill gates close the direct route to the drain. Their ends
// leave wide, opposite-side exits; elevated ramps pass above both guides.
export const GUIDES: Rail[] = [
  rail(-halfWidth, -0.8, 2.0, 3.4, 0.7),
  rail(halfWidth, 4.8, -2.0, 7.8, 0.7),
];
export type Surface = {
  positions: number[];
  indices: number[];
  edges: Point3[][];
  centre?: Point3[];
};
function flatSurface(
  left: number,
  right: number,
  top: number,
  bottom: number,
  height = boardHeight,
): Surface {
  return {
    positions: [
      left,
      height(top),
      top,
      right,
      height(top),
      top,
      left,
      height(bottom),
      bottom,
      right,
      height(bottom),
      bottom,
    ],
    indices: [0, 2, 1, 1, 2, 3],
    edges: [],
  };
}
export const DECK = flatSurface(-halfWidth, halfWidth, -halfLength, halfLength);
export const RUNOUT = flatSurface(
  -0.92,
  0.92,
  halfLength,
  halfLength + 2,
  runoutHeight,
);
function channel(
  centre: Point3[],
  halfWidth: number | ((index: number) => number) = 0.66,
): Surface {
  const positions: number[] = [],
    indices: number[] = [],
    edges: Point3[][] = [[], []];
  centre.forEach((p, i) => {
    const prior = centre[Math.max(0, i - 1)],
      next = centre[Math.min(centre.length - 1, i + 1)];
    const dx = next.x - prior.x,
      dz = next.z - prior.z,
      distance = Math.hypot(dx, dz);
    const nx = dz / distance,
      nz = -dx / distance;
    const width = typeof halfWidth === 'number' ? halfWidth : halfWidth(i);
    for (const [col, offset] of [-width, -width, width, width].entries()) {
      const v = {
        x: p.x + nx * offset,
        y:
          p.y -
          PINBALL.slope * nz * offset +
          (col === 0 || col === 3 ? 0.6 : 0),
        z: p.z + nz * offset,
      };
      positions.push(v.x, v.y, v.z);
      if (col === 0) edges[0].push(v);
      if (col === 3) edges[1].push(v);
      if (i < centre.length - 1 && col < 3) {
        const a = i * 4 + col;
        indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
      }
    }
  });
  return { positions, indices, edges, centre };
}
const smooth = (t: number) => t * t * (3 - 2 * t);
function ramp(side: number): Surface {
  const centre: Point3[] = [];
  // Race traffic arrives from the top: the wide mouth faces the starting field.
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    centre.push(point(side * 2.65, -4.4 + 1.2 * t));
  }
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    centre.push(point(side * 2.65, -3.2 + 4.0 * t, 2.6 * smooth(t)));
  }
  // A flowing S bend carries the elevated lane out to the perimeter.
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    centre.push(point(side * (2.65 + 2.2 * smooth(t)), 0.8 + 4.0 * t, 2.6));
  }
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    centre.push(point(side * 4.85, 4.8 + 1.5 * t, 2.6 - 0.45 * smooth(t)));
  }
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    centre.push(
      point(
        side * (3.4 + 1.45 * Math.cos((Math.PI * t) / 2)),
        6.3 + 1.45 * Math.sin((Math.PI * t) / 2),
        2.15 - 0.8 * smooth(t),
      ),
    );
  }
  return channel(centre, (i) => (i < 16 ? 1.35 - (0.57 * i) / 16 : 0.78));
}
export const RAMPS = [-1, 1].map(ramp);
function jump(): Surface {
  const centre: Point3[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    centre.push(point(0.6 * t, -1.6 + 3.4 * t, 1.4 * t * t));
  }
  return channel(centre, 0.8);
}
// An open launch lip, followed by a real free flight onto the main deck.
export const JUMP = jump();
export function mechanismOrientation(angle: number) {
  const tilt = new Quaternion();
  tilt.setFromAxisAngle(new Vector3(1, 0, 0), Math.atan(PINBALL.slope));
  const turn = new Quaternion();
  turn.setFromAxisAngle(new Vector3(0, 1, 0), angle);
  return tilt.multiply(turn);
}
// Each side has its own clock. Seeded pauses and missed strokes keep the
// pattern reproducible without turning the pair into mirrored oscillators.
export function flipperStroke(index: number, time: number, phase: number) {
  const period = index === 0 ? 2.7 : 3.5;
  const clock = time + (phase / (Math.PI * 2) + index * 0.37) * period;
  const cycle = Math.floor(clock / period);
  const local = clock - cycle * period;
  const random = seededRandom(
    (Math.floor(phase * 1e6) ^
      Math.imul(cycle + 1, 0x45d9f3b) ^
      Math.imul(index + 1, 0x119de1f3)) >>>
      0,
  );
  const skip = random() < 0.18;
  const pause = 0.2 + random() * 0.35;
  const strike = 0.18 + random() * 0.06;
  const hold = 0.08 + random() * 0.08;
  const release = 0.85 + random() * 0.3;
  const amplitude = 0.62 + random() * 0.12;
  // Quintic easing gives zero velocity and acceleration at the joints,
  // including the transition between cycles and a skipped stroke.
  const ease = (t: number) => {
    const u = Math.max(0, Math.min(1, t));
    return u * u * u * (u * (u * 6 - 15) + 10);
  };
  if (skip || local < pause) return 0.24;
  const elapsed = local - pause;
  const stroke =
    elapsed < strike + hold
      ? ease(elapsed / strike)
      : 1 - ease((elapsed - strike - hold) / release);
  return 0.24 - amplitude * stroke;
}
export function flipperPose(
  index: number,
  time: number,
  phase: number,
  parked = false,
) {
  const f = FLIPPERS[index];
  const regular = flipperStroke(index, time, phase);
  const blend = parked ? 1 : smooth(Math.max(0, Math.min(1, time - 64)));
  const theta = regular * (1 - blend) - 1.15 * blend;
  const angle = f.side === -1 ? theta : Math.PI - theta;
  const tilt = Math.atan(PINBALL.slope);
  const floorZ = f.z + (Math.sin(angle) * Math.cos(tilt) * f.length) / 2;
  return {
    x: f.x + (Math.cos(angle) * f.length) / 2,
    y: boardHeight(floorZ) + (Math.cos(tilt) * f.height) / 2,
    z: floorZ + (Math.sin(tilt) * f.height) / 2,
    angle: -angle,
  };
}
export type PinballBall = Point3 & {
  slot: number;
  vx: number;
  vy: number;
  vz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  hits: number;
  loops: number;
  lastHitAt: number;
  lastLoopAt: number;
};
export type PinballFrame = Frame & {
  seed: number;
  balls: PinballBall[];
  flippers: ReturnType<typeof flipperPose>[];
  rotorAngle: number;
  bumperHits: number[];
  kickerHits: number[];
  contacts: number;
  returns: number;
  jumps: number;
  recoveries: number;
  rescue: boolean;
};

export function finishFraction(before: Point3, after: Point3) {
  if (
    before.z >= PINBALL.finishZ ||
    after.z < PINBALL.finishZ ||
    after.z <= before.z
  )
    return null;
  const fraction = (PINBALL.finishZ - before.z) / (after.z - before.z);
  const x = before.x + (after.x - before.x) * fraction;
  const y = before.y + (after.y - before.y) * fraction;
  // Crossing over the chute in the air does not count as reaching its outlet.
  return Math.abs(x) < PINBALL.finishHalfWidth &&
    y < boardHeight(PINBALL.finishZ) + 0.45
    ? fraction
    : null;
}

// Initialize WASM once, before the scene enables the start button. Node callers
// await this same entry point; constructors and the fixed-step loop stay synchronous.
let physicsReady = false;
let physicsLoading: Promise<void> | null = null;
export function initPinballPhysics(): Promise<void> {
  return (physicsLoading ??= import('@dimforge/rapier3d-compat')
    .then(async ({ default: engine }) => {
      await engine.init();
      RAPIER = engine;
      physicsReady = true;
    })
    .catch((error: unknown) => {
      physicsLoading = null;
      throw error;
    }));
}
export function pinballPhysics() {
  if (!physicsReady) throw new Error('Сначала загрузите физику пинбола.');
  return RAPIER;
}
const vector = (p: Point3) => new Vector3(p.x, p.y, p.z);
type BallContact = { other: Collider; normal: Vector3 };

export class PinballSimulation {
  readonly seed: number;
  private world: World;
  private bodies: RigidBody[];
  private flippers: RigidBody[];
  private rotor: RigidBody;
  private phase: number;
  private ticks = 0;
  private result: Finish | null = null;
  private ranks: number[];
  private hits: number[];
  private loops: number[];
  private lastHits: number[];
  private lastLoops: number[];
  private ramping: boolean[];
  private bumperHits = BUMPERS.map(() => -10);
  private kickerHits = KICKERS.map(() => -10);
  private activeContacts = new Set<string>();
  private contacts = 0;
  private returns = 0;
  private jumps = 0;
  private jumpArmed: boolean[];
  private recoveries = 0;
  private dt = 1 / PINBALL.physicsHz;
  private destroyed = false;
  private laneBodies = new Map<Surface, Collider>();
  private deckBodies = new Set<number>();
  private bumperBodies = new Map<number, number>();
  private ballSlots = new Map<number, number>();
  private lastLaunches: number[][] = [];
  private laneSegments = [RAMPS[0], RAMPS[1], JUMP].map((lane) =>
    lane.centre!.slice(0, -1).map((p, i) => {
      const a = vector(p).add(new Vector3(0, PINBALL.radius, 0));
      const direction = vector(lane.centre![i + 1])
        .add(new Vector3(0, PINBALL.radius, 0))
        .sub(a);
      return {
        a,
        direction,
        tangent: direction.clone().normalize(),
        lengthSquared: direction.lengthSq(),
      };
    }),
  );

  constructor(count: number, seed: number) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new Error('Пинбол рассчитан на 1–8 участников.');
    if (!physicsReady)
      throw new Error('Сначала загрузите физику: await initPinballPhysics().');
    this.seed = seed;
    const random = seededRandom(seed);
    this.phase = random() * Math.PI * 2;
    this.world = new RAPIER.World({ x: 0, y: -PINBALL.gravity, z: 0 });
    this.world.timestep = this.dt;
    // Rapier's solver includes internal iterations; tune these for the small,
    // fast spheres rather than copying Cannon's iteration count.
    this.world.numSolverIterations = 8;
    this.world.maxCcdSubsteps = 4;
    const angle = Math.atan(PINBALL.slope);
    const normal = new Vector3(0, Math.cos(angle), Math.sin(angle));
    const deck = this.staticCollider(
      RAPIER.ColliderDesc.cuboid(halfWidth, 0.15, halfLength / Math.cos(angle))
        .setTranslation(...normal.clone().multiplyScalar(-0.15).toArray())
        .setRotation(
          new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle),
        ),
      0.18,
      0.03,
    );
    this.deckBodies.add(deck.handle);
    // Open channels have two sides. Constrain internal-edge normals from both
    // sides so balls outside a lane cannot get wedged by adjacent back faces.
    // The 0.01 lift matches rendering and avoids duplicate deck support.
    for (const mesh of [RUNOUT, JUMP, ...RAMPS]) {
      const collider = this.staticCollider(
        RAPIER.ColliderDesc.trimesh(
          new Float32Array(
            mesh.positions.map((v, i) =>
              i % 3 === 1 && mesh.centre ? v + 0.01 : v,
            ),
          ),
          new Uint32Array(mesh.indices),
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED,
        ),
        0.18,
        0.03,
      );
      this.deckBodies.add(collider.handle);
      if (mesh.centre) this.laneBodies.set(mesh, collider);
    }
    for (const rail of [...RAILS, ...GUIDES]) {
      const a = vector(rail.a),
        b = vector(rail.b),
        direction = b.clone().sub(a);
      const centre = a
        .add(b)
        .multiplyScalar(0.5)
        .add(new Vector3(0, rail.height / 2, 0));
      const guide = rail.a.z >= 9.4;
      this.staticCollider(
        RAPIER.ColliderDesc.cuboid(
          direction.length() / 2,
          rail.height / 2,
          rail.width / 2,
        )
          .setTranslation(centre.x, centre.y, centre.z)
          .setRotation(
            new Quaternion().setFromUnitVectors(
              new Vector3(1, 0, 0),
              direction.normalize(),
            ),
          ),
        guide ? 0.02 : 0.08,
        guide ? 0.25 : 0.52,
      );
    }
    BUMPERS.forEach((b, index) => {
      const collider = this.staticCollider(
        RAPIER.ColliderDesc.cylinder(0.625, b.radius).setTranslation(
          b.x,
          boardHeight(b.z) + 0.625,
          b.z,
        ),
        0.05,
        0.2,
      );
      this.bumperBodies.set(collider.handle, index);
    });
    this.flippers = FLIPPERS.map((f, index) => {
      const pose = flipperPose(index, 0, this.phase);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(pose.x, pose.y, pose.z)
          .setRotation(mechanismOrientation(pose.angle))
          .setCanSleep(false)
          .setCcdEnabled(true)
          .setAdditionalSolverIterations(4),
      );
      this.world.createCollider(
        this.material(
          RAPIER.ColliderDesc.cuboid(
            f.length / 2,
            f.height / 2,
            f.width / 2,
          ).setMass(FLIPPER_DRIVE.mass),
          0.1,
          0.08,
        ),
        body,
      );
      const pivot = vector({ x: f.x, y: boardHeight(f.z), z: f.z }).add(
        new Vector3(0, f.height / 2, 0).applyQuaternion(
          mechanismOrientation(0),
        ),
      );
      const mount = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(pivot.x, pivot.y, pivot.z)
          .setRotation(mechanismOrientation(0)),
      );
      this.world.createImpulseJoint(
        RAPIER.JointData.revolute(
          { x: 0, y: 0, z: 0 },
          { x: -f.length / 2, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ),
        mount,
        body,
        true,
      );
      return body;
    });
    this.rotor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(
          ROTOR.x,
          boardHeight(ROTOR.z) + ROTOR.height / 2,
          ROTOR.z,
        )
        .setRotation(mechanismOrientation(this.phase)),
    );
    for (const angle of [0, Math.PI / 2])
      this.world.createCollider(
        this.material(
          RAPIER.ColliderDesc.cuboid(
            ROTOR.length / 2,
            ROTOR.height / 2,
            ROTOR.width / 2,
          ).setRotation(
            new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
          ),
          0.1,
          0.4,
        ),
        this.rotor,
      );
    this.bodies = Array.from({ length: count }, (_, slot) => {
      const x = (slot - (count - 1) / 2) * 0.86;
      const z = PINBALL.startZ + (random() - 0.5) * 0.25;
      const vx = (random() - 0.5) * 1.4,
        vz = 4.8 + random() * 0.8;
      const velocity = new Vector3(vx, -PINBALL.slope * vz, vz);
      const rolling = normal
        .clone()
        .cross(velocity)
        .multiplyScalar(1 / PINBALL.radius);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(x, boardHeight(z) + PINBALL.radius + 0.01, z)
          .setLinvel(velocity.x, velocity.y, velocity.z)
          .setAngvel(rolling)
          .setLinearDamping(0.008)
          .setAngularDamping(0.012)
          .setCanSleep(false)
          .setCcdEnabled(true),
      );
      // Rapier derives the solid sphere inertia directly from this ball collider.
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.ball(PINBALL.radius)
          .setMass(1)
          .setFriction(ballFriction)
          .setRestitution(0.8)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min),
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
    this.lastHits = this.bodies.map(() => -10);
    this.lastLoops = [...this.lastHits];
    this.ramping = this.bodies.map(() => false);
    this.jumpArmed = this.bodies.map(() => false);
    this.lastLaunches = this.bodies.map(() => KICKERS.map(() => -10));
  }

  private material(desc: ColliderDesc, friction: number, restitution: number) {
    // Multiply takes priority over the balls' Min rule. Scale the surface
    // coefficient so ball/surface pairs get exactly the requested friction;
    // ball/ball pairs retain their common 0.08 coefficient.
    return desc
      .setFriction(friction / ballFriction)
      .setRestitution(restitution)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min);
  }
  private staticCollider(
    desc: ColliderDesc,
    friction: number,
    restitution: number,
  ) {
    return this.world.createCollider(
      this.material(desc, friction, restitution),
    );
  }
  private ballContacts(body: RigidBody): BallContact[] {
    const collider = body.collider(0),
      contacts: BallContact[] = [];
    this.world.contactPairsWith(collider, (other) => {
      this.world.contactPair(collider, other, (manifold, flipped) => {
        // Ignore broad-phase candidates without touching geometry or a solved impulse.
        // Mesh contacts need not retain solver contacts after Rapier reduces manifolds.
        let touching = false;
        for (let i = 0; i < manifold.numContacts(); i++)
          if (
            manifold.contactDist(i) <= 0.002 ||
            manifold.contactImpulse(i) > 0
          )
            touching = true;
        if (!touching) return;
        // Normal points from the supporting surface towards this ball.
        contacts.push({
          other,
          normal: vector(manifold.normal()).multiplyScalar(flipped ? 1 : -1),
        });
      });
    });
    return contacts;
  }

  snapshot(): PinballFrame {
    if (this.destroyed) throw new Error('Симуляция уже освобождена.');
    const elapsed = this.ticks * this.dt;
    const balls = this.bodies.map((b, slot): PinballBall => {
      const p = b.translation(),
        v = b.linvel(),
        q = b.rotation();
      return {
        slot,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: v.x,
        vy: v.y,
        vz: v.z,
        qx: q.x,
        qy: q.y,
        qz: q.z,
        qw: q.w,
        hits: this.hits[slot],
        loops: this.loops[slot],
        lastHitAt: this.lastHits[slot],
        lastLoopAt: this.lastLoops[slot],
      };
    });
    return {
      seed: this.seed,
      elapsed,
      balls,
      flippers: this.flippers.map((b) => {
        const p = b.translation(),
          q = b.rotation();
        return { x: p.x, y: p.y, z: p.z, angle: 2 * Math.atan2(q.y, q.w) };
      }),
      rotorAngle: this.phase + elapsed * 1.3,
      bumperHits: [...this.bumperHits],
      kickerHits: [...this.kickerHits],
      contacts: this.contacts,
      returns: this.returns,
      jumps: this.jumps,
      recoveries: this.recoveries,
      rescue: elapsed >= 65,
      ducks: balls.map((b) => ({
        slot: b.slot,
        x: b.x,
        y: b.z,
        vx: b.vx,
        vy: b.vz,
        angle: 0,
        progress: ((b.z + halfLength) / (PINBALL.finishZ + halfLength)) * 4000,
        stage: 0,
        inTube: false,
        hiddenInDrain: false,
      })),
      paddles: [],
      flushing: false,
      result: this.result && { ...this.result },
    };
  }

  step(): PinballFrame {
    if (this.result) return this.snapshot();
    for (let substep = 0; substep < 4 && !this.result; substep++) {
      const time = this.ticks * this.dt;
      const before = this.bodies.map((b) => ({ ...b.translation() }));
      this.flippers.forEach((body, index) => {
        const next = flipperPose(index, time + this.dt, this.phase);
        const q = body.rotation();
        const current = 2 * Math.atan2(q.y, q.w);
        // A real hinge transfers momentum both ways. Never impose the paddle's
        // next pose: the bounded motor must accelerate its finite inertia.
        const error = Math.atan2(
          Math.sin(next.angle - current),
          Math.cos(next.angle - current),
        );
        const axis = new Vector3(0, 1, PINBALL.slope).normalize();
        const speed = vector(body.angvel()).dot(axis);
        const torque = Math.max(
          -FLIPPER_DRIVE.torque,
          Math.min(
            FLIPPER_DRIVE.torque,
            FLIPPER_DRIVE.stiffness * error - FLIPPER_DRIVE.damping * speed,
          ),
        );
        body.resetTorques(true);
        body.addTorque(axis.multiplyScalar(torque), true);
      });
      this.rotor.setNextKinematicRotation(
        mechanismOrientation(this.phase + (time + this.dt) * 1.3),
      );
      this.bodies.forEach((body, slot) => {
        // Rapier retains user forces: reset once per fixed step before adding this step's belts.
        body.resetForces(true);
        const position = vector(body.translation());
        const contacts = this.ballContacts(body);
        [RAMPS[0], RAMPS[1], JUMP].forEach((lane, index) => {
          const support = this.laneBodies.get(lane)!;
          const contact = contacts.find(
            (c) => c.other.handle === support.handle && c.normal.y > 0.1,
          );
          if (!contact) return;
          let nearest: {
            distance: number;
            tangent: Vector3;
            progress: number;
          } | null = null;
          this.laneSegments[index].forEach((segment, i) => {
            const t = Math.max(
              0,
              Math.min(
                1,
                position.clone().sub(segment.a).dot(segment.direction) /
                  segment.lengthSquared,
              ),
            );
            const distance = position.distanceTo(
              segment.a.clone().addScaledVector(segment.direction, t),
            );
            if (!nearest || distance < nearest.distance)
              nearest = { distance, tangent: segment.tangent, progress: i + t };
          });
          const current = nearest as {
            distance: number;
            tangent: Vector3;
            progress: number;
          } | null;
          if (!current || current.distance > (index === 2 ? 0.88 : 1.2)) return;
          if (index < 2 && current.progress < lane.centre!.length - 15)
            this.ramping[slot] = true;
          if (index === 2 && current.progress > lane.centre!.length - 4)
            this.jumpArmed[slot] = true;
          const tangent = current.tangent
            .clone()
            .addScaledVector(
              contact.normal,
              -current.tangent.dot(contact.normal),
            )
            .normalize();
          const speed = vector(body.linvel()).dot(tangent);
          const force = Math.max(
            0,
            Math.min(16, PINBALL.gravity * tangent.y + (4.8 - speed) * 5),
          );
          body.addForce(tangent.multiplyScalar(force), true);
          if (
            index < 2 &&
            this.ramping[slot] &&
            current.progress > lane.centre!.length - 2.5 &&
            speed > 0
          ) {
            this.ramping[slot] = false;
            this.loops[slot]++;
            this.returns++;
          }
        });
        KICKERS.forEach((kicker, index) => {
          if (time - this.lastLaunches[slot][index] < 1.5) return;
          if (
            Math.hypot(position.x - kicker.x, position.z - kicker.z) >
            kicker.radius
          )
            return;
          if (
            Math.abs(position.y - boardHeight(position.z) - PINBALL.radius) >
            0.16
          )
            return;
          if (
            !contacts.some(
              (c) => this.deckBodies.has(c.other.handle) && c.normal.y > 0.1,
            )
          )
            return;
          const direction = this.laneSegments[index][0].tangent;
          const speed = vector(body.linvel()).dot(direction);
          const impulse = Math.max(0, Math.min(8, 6 - speed));
          body.applyImpulse(direction.clone().multiplyScalar(impulse), true);
          this.lastLaunches[slot][index] = time;
          this.lastLoops[slot] = time;
          if (index < 2) this.ramping[slot] = true;
          this.kickerHits[index] = time;
        });
        if (
          position.y < -4 ||
          Math.abs(position.x) > 10.5 ||
          position.z < -14 ||
          position.z > 16
        ) {
          this.recoveries++;
          body.setTranslation(
            {
              x: 0,
              y: boardHeight(PINBALL.startZ) + PINBALL.radius,
              z: PINBALL.startZ,
            },
            true,
          );
          body.setLinvel({ x: 0, y: 0, z: 5 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          this.ramping[slot] = false;
          this.jumpArmed[slot] = false;
          before[slot] = { ...body.translation() };
        }
      });
      const incoming = this.bodies.map((b) => vector(b.linvel()));
      this.world.step();
      const contacts = new Set<string>();
      this.bodies.forEach((body, slot) => {
        const ballContacts = this.ballContacts(body);
        const p = body.translation();
        if (
          this.jumpArmed[slot] &&
          p.z > JUMP.centre!.at(-1)!.z - 0.2 &&
          !ballContacts.some(
            (c) =>
              c.other.handle === this.laneBodies.get(JUMP)!.handle &&
              c.normal.y > 0.1,
          )
        ) {
          this.jumps++;
          this.jumpArmed[slot] = false;
        }
        for (const c of ballContacts) {
          if (this.deckBodies.has(c.other.handle)) continue;
          const collider = body.collider(0);
          const key = `${Math.min(collider.handle, c.other.handle)}:${Math.max(collider.handle, c.other.handle)}`;
          if (contacts.has(key)) continue;
          contacts.add(key);
          const otherSlot = this.ballSlots.get(c.other.handle);
          const otherVelocity =
            otherSlot === undefined
              ? vector(
                  c.other
                    .parent()
                    ?.velocityAtPoint(
                      vector(body.translation()).addScaledVector(
                        c.normal,
                        -PINBALL.radius,
                      ),
                    ) ?? { x: 0, y: 0, z: 0 },
                )
              : incoming[otherSlot];
          const impact = Math.max(
            0,
            -incoming[slot].clone().sub(otherVelocity).dot(c.normal),
          );
          if (!this.activeContacts.has(key) && impact > 0.6) this.contacts++;
          const index = this.bumperBodies.get(c.other.handle);
          if (
            index === undefined ||
            this.activeContacts.has(key) ||
            time - this.lastHits[slot] < 0.09
          )
            continue;
          const bumper = BUMPERS[index],
            p = body.translation();
          const direction = new Vector3(
            p.x - bumper.x,
            -PINBALL.slope * (p.z - bumper.z),
            p.z - bumper.z,
          ).normalize();
          const speedIn = Math.max(0, -incoming[slot].dot(direction));
          if (speedIn < 0.15) continue;
          const speed =
            index < 3
              ? Math.min(1.65, 1.1 + speedIn * 0.08)
              : Math.min(4.2, 2.5 + speedIn * 0.25);
          const impulse = Math.max(
            0,
            speed - vector(body.linvel()).dot(direction),
          );
          body.applyImpulse(direction.multiplyScalar(impulse), true);
          this.hits[slot]++;
          this.lastHits[slot] = time;
          this.bumperHits[index] = time;
        }
      });
      this.activeContacts = contacts;
      this.ticks++;
      const crossings = this.bodies
        .flatMap((body, slot) => {
          const fraction = finishFraction(before[slot], body.translation());
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
      if (!this.result && time >= PINBALL.maxSeconds) {
        const sorted = this.bodies
          .map((b, slot) => {
            const p = b.translation();
            return { slot, distance: Math.hypot(p.x, p.z - PINBALL.finishZ) };
          })
          .sort(
            (a, b) =>
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
