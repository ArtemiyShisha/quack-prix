import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { PINBALL, initPinballPhysics } from '../lib/pinball.ts';
import {
  PINBALL_MAPS,
  DEFAULT_PINBALL_MAP,
  createPinballArena,
  isPinballMap,
  type PinballMapId,
  type ArenaArm,
  type ArenaMotor,
} from '../lib/pinball-maps.ts';
import {
  PinballArenaSimulation,
  arenaFinishFraction,
  arenaMotorAngle,
  arenaRailSurface,
  arenaSpringReady,
  platformPose,
} from '../lib/pinball-arenas.ts';

await initPinballPhysics();
type Internals = {
  bodies: RAPIER.RigidBody[];
  blocks: { body: RAPIER.RigidBody; start: Vector3 }[];
  arms: {
    body: RAPIER.RigidBody;
    config: ArenaArm;
    pivot: Vector3;
    axis: Vector3;
  }[];
  motors: { body: RAPIER.RigidBody; config: ArenaMotor }[];
  platforms: { body: RAPIER.RigidBody }[];
  phase: number;
  ticks: number;
  stages: number[];
  world: RAPIER.World;
};
const inside = (game: PinballArenaSimulation) => game as unknown as Internals;
const vec = (p: { x: number; y: number; z: number }) =>
  new Vector3(p.x, p.y, p.z);
const chute = (map: ReturnType<typeof createPinballArena>) =>
  map.height(0, map.exitZ) -
  (map.exitDrop ?? 0) -
  (map.finishZ - map.exitZ) * 0.4;

// Keep regression coverage for the earlier mechanism layouts as well.
const ARENA_FIXTURES = [
  'reactor',
  'descent',
  'cascade',
  'crossroads',
  'seesaw',
  'fortress',
] as const;
for (const map of ARENA_FIXTURES) {
  test(`${map}: teams finish physically without an emergency re-serve`, () => {
    for (const count of map === 'reactor' || map === 'descent'
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : [1, 2, 4, 8])
      for (const seed of [42, 1000, 1001]) {
        const game = new PinballArenaSimulation(count, seed, map);
        try {
          let f = game.snapshot();
          while (
            !f.result &&
            f.elapsed <= (game.map.maxSeconds ?? PINBALL.maxSeconds) + 0.1
          )
            f = game.step();
          assert.equal(
            f.result?.reason,
            'finish',
            `${map} count=${count} seed=${seed}`,
          );
          assert.equal(f.recoveries, 0, `${map} count=${count} seed=${seed}`);
          assert.ok(f.contacts > 0);
          assert.ok(
            f.result!.time > 2,
            'no instant route from the start to the drain',
          );
        } finally {
          game.destroy();
        }
      }
  });
  test(`${map}: equal balls, repeatable seeds, isolated snapshots and cleanup`, () => {
    const a = new PinballArenaSimulation(8, 42, map),
      b = new PinballArenaSimulation(8, 42, map),
      c = new PinballArenaSimulation(8, 43, map);
    try {
      assert.notDeepEqual(a.snapshot(), c.snapshot());
      for (const body of inside(a).bodies) {
        assert.ok(Math.abs(body.mass() - 1) < 1e-6);
        assert.ok(Math.abs(body.collider(0).radius() - PINBALL.radius) < 1e-6);
        assert.ok(body.isCcdEnabled());
      }
      for (let i = 0; i < 120; i++) assert.deepEqual(a.step(), b.step());
      const snapshot = a.snapshot();
      snapshot.balls[0].x = 999;
      snapshot.objects[0].x = 999;
      snapshot.stages[0] = 999;
      assert.notEqual(a.snapshot().balls[0].x, 999);
      assert.notEqual(a.snapshot().objects[0].x, 999);
      assert.notEqual(a.snapshot().stages[0], 999);
    } finally {
      a.destroy();
      b.destroy();
      c.destroy();
    }
    assert.throws(() => a.snapshot(), /освобождена/);
    assert.doesNotThrow(() => a.destroy());
  });
  test(`${map}: finish needs an actual crossing inside the physical opening`, () => {
    const mapData = createPinballArena(map),
      y = chute(mapData) + PINBALL.radius;
    if (mapData.goal) {
      const goal = mapData.goal;
      const before = { x: goal.x, y: goal.y + 0.2, z: goal.z };
      const after = { ...before, y: goal.y - 0.2 };
      assert.ok(
        Math.abs(arenaFinishFraction(mapData, before, after)! - 0.5) < 1e-12,
      );
      assert.equal(arenaFinishFraction(mapData, after, before), null);
      for (const offset of [
        { x: 2, z: 0 },
        { x: 0, z: 2 },
      ])
        assert.equal(
          arenaFinishFraction(
            mapData,
            { ...before, x: before.x + offset.x, z: before.z + offset.z },
            { ...after, x: after.x + offset.x, z: after.z + offset.z },
          ),
          null,
        );
      assert.equal(
        arenaFinishFraction(mapData, { ...before, y: 2 }, { ...after, y: 1 }),
        null,
        'flying over the hole cannot win',
      );
      const g = new PinballArenaSimulation(2, 42, map);
      try {
        if (g.map.levels)
          inside(g).stages = [g.map.levels.length - 1, g.map.levels.length - 1];
        inside(g).bodies.forEach((body, i) => {
          body.setTranslation(
            {
              x: goal.x + (i ? 0.36 : -0.36),
              y: goal.y + (i ? 0.02 : 0.04),
              z: goal.z,
            },
            true,
          );
          body.setLinvel({ x: 0, y: -8, z: 0 }, true);
        });
        const f = g.step();
        assert.equal(f.result?.slot, 1);
        assert.ok(f.result!.time < 1 / 120);
        assert.deepEqual(g.step(), f);
      } finally {
        g.destroy();
      }
      return;
    }
    assert.ok(
      Math.abs(
        arenaFinishFraction(
          mapData,
          { x: 0, y, z: mapData.finishZ - 0.2 },
          { x: 0, y, z: mapData.finishZ + 0.2 },
        )! - 0.5,
      ) < 1e-12,
    );
    for (const p of [
      { x: 2, y },
      { x: 0, y: y + 2 },
      { x: 0, y: y - 2 },
    ])
      assert.equal(
        arenaFinishFraction(
          mapData,
          { ...p, z: mapData.finishZ - 0.2 },
          { ...p, z: mapData.finishZ + 0.2 },
        ),
        null,
      );
    const g = new PinballArenaSimulation(2, 42, map);
    try {
      inside(g).bodies.forEach((body, i) => {
        body.setTranslation(
          { x: i ? 0.42 : -0.42, y, z: mapData.finishZ - (i ? 0.02 : 0.04) },
          true,
        );
        body.setLinvel({ x: 0, y: 0, z: 8 }, true);
      });
      const f = g.step();
      assert.equal(f.result?.slot, 1);
      assert.ok(f.result!.time < 1 / 120);
      assert.deepEqual(g.step(), f);
    } finally {
      g.destroy();
    }
  });
}

test('only descent is available, with upward faces and upright rails in all retained layouts', () => {
  assert.deepEqual(
    PINBALL_MAPS.map((m) => m.id),
    ['descent'],
  );
  assert.equal(DEFAULT_PINBALL_MAP, 'descent');
  assert.equal(isPinballMap('bogus'), false);
  for (const id of ARENA_FIXTURES) {
    assert.equal(isPinballMap(id), id === 'descent');
    const map = createPinballArena(id);
    for (const floor of map.floor)
      for (let i = 0; i < floor.indices.length; i += 3) {
        const points = floor.indices
          .slice(i, i + 3)
          .map((n) => new Vector3().fromArray(floor.positions, n * 3));
        const normal = points[1]
          .clone()
          .sub(points[0])
          .cross(points[2].clone().sub(points[0]));
        assert.ok(normal.y > 0, `${id}: upward triangles`);
      }
    for (const rail of map.rails) {
      const shape = arenaRailSurface(rail);
      for (let i = 0; i < 4; i++) {
        assert.ok(
          Math.abs(
            shape.positions[(i + 4) * 3 + 1] -
              shape.positions[i * 3 + 1] -
              rail.height,
          ) < 1e-6,
        );
        assert.equal(shape.positions[(i + 4) * 3], shape.positions[i * 3]);
        assert.equal(
          shape.positions[(i + 4) * 3 + 2],
          shape.positions[i * 3 + 2],
        );
      }
    }
  }
});

test('cascade spring launches a supported ball back to the upper bowl', () => {
  const g = new PinballArenaSimulation(1, 42, 'cascade');
  inside(g).phase = 0;
  try {
    const s = g.map.springs[0],
      b = inside(g).bodies[0];
    b.setTranslation(
      { x: s.x, y: g.map.height(s.x, s.z) + PINBALL.radius + 0.01, z: s.z },
      true,
    );
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    let fired = false,
      upper = false;
    for (let i = 0; i < 240; i++) {
      const f = g.step(),
        ball = f.balls[0];
      fired ||= f.kickerHits[0] >= 0;
      upper ||= ball.z < -3.4 && ball.y > g.map.height(ball.x, ball.z) - 0.05;
      assert.equal(f.recoveries, 0);
    }
    assert.ok(fired);
    assert.ok(
      upper,
      'the ball clears the actual upper floor, not just the Z boundary',
    );
    assert.equal(arenaSpringReady(s, 3, 0, 0), false);
    assert.equal(arenaSpringReady(s, 66, 0, 0), false);
  } finally {
    g.destroy();
  }
});

test('contact belts and springs cannot steer a ball in mid-air or clamp its speed', () => {
  for (const map of ['crossroads', 'cascade', 'reactor'] as PinballMapId[]) {
    const g = new PinballArenaSimulation(1, 42, map),
      b = inside(g).bodies[0];
    try {
      b.setTranslation({ x: 0, y: 20, z: 0 }, true);
      b.setLinvel({ x: 0, y: 0, z: 100 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const f = g.step();
      assert.ok(f.balls[0].vz > 99.9);
      assert.ok(Math.abs(f.balls[0].vx) < 1e-6);
      assert.ok(Math.abs(f.balls[0].vy + PINBALL.gravity / 60) < 0.001);
      assert.equal(f.result, null);
    } finally {
      g.destroy();
    }
  }
});

test('seesaw platforms tilt in opposite directions and the ball follows physical motion', () => {
  const g = new PinballArenaSimulation(1, 42, 'seesaw'),
    data = inside(g);
  try {
    const start = g.snapshot().objects.filter((o) => o.id.startsWith('tilt-'));
    const initial = g.snapshot().balls[0];
    for (let i = 0; i < 90; i++) g.step();
    const f = g.snapshot();
    for (const [i, platform] of g.map.platforms.entries()) {
      const pose = platformPose(platform, f.elapsed, data.phase),
        actual = f.objects.find((o) => o.id === platform.id)!;
      assert.ok(Math.abs(actual.qz - start[i].qz) > 0.01);
      assert.ok(Math.abs(actual.qz - pose.rotation.z) < 1e-5);
      assert.ok(
        platform.deflector,
        'the start cannot be a straight empty slope',
      );
      assert.equal(
        data.platforms[i].body.bodyType(),
        RAPIER.RigidBodyType.KinematicPositionBased,
      );
    }
    const normal = g.map.platforms.map((p) =>
      new Vector3(0, 1, 0).applyQuaternion(
        platformPose(p, f.elapsed, data.phase).rotation,
      ),
    );
    assert.ok(normal[0].x * normal[1].x < 0);
    assert.ok(Math.abs(f.balls[0].x - initial.x) > 0.05);
    assert.equal(f.recoveries, 0);
  } finally {
    g.destroy();
  }
});

test('fortress blocks remain on the deck and an impact moves them', () => {
  const g = new PinballArenaSimulation(1, 42, 'fortress'),
    data = inside(g);
  try {
    assert.equal(data.blocks.length, 18);
    for (const { body } of data.blocks)
      assert.equal(body.bodyType(), RAPIER.RigidBodyType.Dynamic);
    // Keep a distant block clear of the ball and every motor while it settles.
    const idle = data.blocks[5],
      initial = vec(idle.body.translation());
    const target = data.blocks[14],
      ball = data.bodies[0],
      p = target.body.translation();
    ball.setTranslation(
      {
        x: p.x,
        y: g.map.height(p.x, p.z - 0.75) + PINBALL.radius + 0.01,
        z: p.z - 0.75,
      },
      true,
    );
    ball.setLinvel({ x: 0, y: -0.6, z: 4 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 90; i++) g.step();
    assert.ok(
      vec(target.body.translation()).distanceTo(target.start) > 0.4,
      'a ball really displaces a block',
    );
    assert.ok(
      vec(idle.body.translation()).distanceTo(initial) < 0.1,
      'untouched blocks do not slide into a dam',
    );
  } finally {
    g.destroy();
  }
});

test('hinged doors have finite inertia and yield to a ball impact', () => {
  const g = new PinballArenaSimulation(1, 42, 'fortress'),
    data = inside(g),
    arm = data.arms[0],
    ball = data.bodies[0];
  try {
    assert.equal(arm.body.bodyType(), RAPIER.RigidBodyType.Dynamic);
    assert.ok(arm.body.mass() < 1);
    data.world.gravity = { x: 0, y: 0, z: 0 };
    data.world.colliders.forEach((c) => {
      if (
        c.handle !== arm.body.collider(0).handle &&
        c.handle !== ball.collider(0).handle
      )
        c.setCollisionGroups(0);
    });
    const q = new Quaternion().copy(arm.body.rotation());
    ball.setTranslation(
      new Vector3(arm.config.length * 0.65, 0, -(0.17 + PINBALL.radius + 0.02))
        .applyQuaternion(q)
        .add(arm.pivot),
      true,
    );
    ball.setLinvel(new Vector3(0, 0, 3).applyQuaternion(q), true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 50; i++) data.world.step();
    assert.ok(
      vec(arm.body.angvel()).length() > 0.1,
      'the door turns under impact',
    );
    assert.ok(vec(ball.linvel()).length() < 2.9, 'the door absorbs momentum');
    const hinge = new Vector3(-arm.config.length / 2, 0, 0)
      .applyQuaternion(new Quaternion().copy(arm.body.rotation()))
      .add(vec(arm.body.translation()));
    assert.ok(hinge.distanceTo(arm.pivot) < 0.005);
  } finally {
    g.destroy();
  }
});

test('late opening stops active launch mechanisms and lifts the exit gates', () => {
  const g = new PinballArenaSimulation(1, 42, 'reactor'),
    data = inside(g);
  try {
    data.bodies[0].setTranslation({ x: 0, y: 20, z: 0 }, true);
    data.bodies[0].setGravityScale(0, true);
    data.ticks = 66 * PINBALL.physicsHz;
    for (let i = 0; i < 60; i++) g.step();
    const f = g.snapshot(),
      gate = f.objects.find((o) => o.id === 'exit-gate')!;
    assert.equal(f.gateOpen, true);
    const config = g.map.motors.find((m) => m.id === 'exit-gate')!;
    assert.ok(gate.y > g.map.height(config.x, config.z) + 2);
    assert.ok(f.springReady.every((ready) => !ready));
    assert.ok(data.motors.every((m) => vec(m.body.angvel()).length() < 0.001));
  } finally {
    g.destroy();
  }
});

test('reactor: the finish is a real open hole, with chronological crossing order', () => {
  const g = new PinballArenaSimulation(1, 42, 'reactor');
  try {
    const data = inside(g),
      goal = g.map.goal!;
    for (const { body } of data.motors)
      for (let i = 0; i < body.numColliders(); i++)
        body.collider(i).setCollisionGroups(0);
    const ball = data.bodies[0];
    ball.setTranslation({ x: goal.x, y: 1.2, z: goal.z }, true);
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    let frame = g.snapshot();
    while (!frame.result && frame.elapsed < 2) frame = g.step();
    assert.equal(
      frame.result?.reason,
      'finish',
      'a sphere actually falls through the deck',
    );
    assert.ok(frame.result!.time > 0.4 && frame.result!.time < 0.8);
    assert.equal(frame.recoveries, 0);
    assert.ok(frame.balls[0].y <= goal.y);
  } finally {
    g.destroy();
  }
});

test('reactor: the rotating horseshoe releases a ball resting outside the goal', () => {
  const g = new PinballArenaSimulation(1, 42, 'reactor');
  try {
    const data = inside(g),
      goal = g.map.goal!,
      z = goal.z - 3.32;
    const ball = data.bodies[0];
    ball.setTranslation(
      { x: 0, y: g.map.height(0, z) + PINBALL.radius + 0.01, z },
      true,
    );
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    let released = false,
      frame = g.snapshot();
    while (!frame.result && frame.elapsed < 22) {
      frame = g.step();
      const b = frame.balls[0];
      released ||= Math.hypot(b.x - goal.x, b.z - goal.z) < 2.35;
    }
    assert.ok(
      released,
      'a stationary sphere is not trapped permanently against a circular wall',
    );
    assert.equal(frame.recoveries, 0);
  } finally {
    g.destroy();
  }
});

function crownImpactFixture(time = 0) {
  const game = new PinballArenaSimulation(1, 42, 'reactor'),
    data = inside(game),
    index = game.map.motors.findIndex((m) => m.id === 'goal-crown'),
    wall = data.motors[index],
    ball = data.bodies[0],
    arc = wall.config.arc!;
  data.world.gravity = { x: 0, y: 0, z: 0 };
  data.world.colliders.forEach((collider) => {
    if (
      collider.parent()?.handle !== wall.body.handle &&
      collider.handle !== ball.collider(0).handle
    )
      collider.setCollisionGroups(0);
  });
  data.ticks = Math.round(time * PINBALL.physicsHz);
  const rotation = arenaMotorAngle(wall.config, time, data.phase);
  wall.body.setRotation(
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotation),
    true,
  );
  const angle = arc.from + arc.sweep * 0.5 - rotation,
    radial = new Vector3(Math.cos(angle), 0, Math.sin(angle));
  function launch(side: 1 | -1, speed: number, gap = 0.015) {
    const radius =
        arc.radius + side * (wall.config.width / 2 + PINBALL.radius + gap),
      point = radial.clone().multiplyScalar(radius);
    point.x += wall.config.x;
    point.z += wall.config.z;
    // The centre of the vertical face, clear of the upper and lower rims.
    point.y =
      game.map.height(wall.config.x + arc.radius, wall.config.z) +
      wall.config.height / 2;
    ball.setTranslation(point, true);
    ball.setLinvel(radial.clone().multiplyScalar(-side * speed), true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  return { game, index, ball, wall, radial, launch };
}

test('reactor: a slow exterior hit rebounds once, including at a rotating mesh seam', () => {
  for (const time of [0, 6]) {
    const { game, index, ball, wall, radial, launch } =
      crownImpactFixture(time);
    try {
      launch(1, 0.3);
      let frame = game.snapshot();
      while (frame.motorHits[index] < 0 && frame.elapsed < time + 0.3)
        frame = game.step();
      assert.ok(
        frame.motorHits[index] >= time,
        'an actual side contact fires the wall',
      );
      assert.ok(
        vec(ball.linvel()).dot(radial) > 4.2,
        'the ball separates from the exterior face',
      );
      assert.ok(
        vec(ball.linvel()).length() < 6.0,
        'adjacent triangles do not stack launch impulses',
      );
      const hit = frame.motorHits[index];
      for (let i = 0; i < 12; i++) frame = game.step();
      assert.equal(frame.motorHits[index], hit, 'one collision is one rebound');
      const p = ball.translation();
      assert.ok(Math.hypot(p.x - wall.config.x, p.z - wall.config.z) > 4.1);
      assert.equal(frame.recoveries, 0);
    } finally {
      game.destroy();
    }
  }
});

test('reactor: a fast impact retains its physical rebound without a speed clamp', () => {
  const { game, index, ball, radial, launch } = crownImpactFixture();
  try {
    launch(1, 8);
    let frame = game.snapshot();
    while (frame.motorHits[index] < 0 && frame.elapsed < 0.1)
      frame = game.step();
    assert.ok(frame.motorHits[index] >= 0);
    const outgoing = vec(ball.linvel()).dot(radial);
    assert.ok(
      outgoing > 6.5 && outgoing < 8.1,
      `actual outgoing speed ${outgoing}`,
    );
  } finally {
    game.destroy();
  }
});

test('reactor: the inner face reflects naturally and does not launch a ball at the hole', () => {
  const { game, index, ball, radial, launch } = crownImpactFixture();
  try {
    launch(-1, 0.4);
    for (let i = 0; i < 12; i++) game.step();
    assert.ok(
      vec(ball.linvel()).dot(radial) < -0.2,
      'the inner face still bounces',
    );
    assert.ok(
      vec(ball.linvel()).length() < 0.5,
      'no powered shot towards the goal',
    );
    assert.equal(game.snapshot().motorHits[index], -10);
  } finally {
    game.destroy();
  }
});

test('reactor: a nearby sphere receives no rebound before physical contact', () => {
  const { game, index, ball, radial, launch } = crownImpactFixture();
  try {
    launch(1, 0, 0.35);
    const before = vec(ball.translation());
    for (let i = 0; i < 30; i++) game.step();
    assert.equal(game.snapshot().motorHits[index], -10);
    assert.ok(vec(ball.translation()).distanceTo(before) < 1e-5);
    assert.ok(Math.abs(vec(ball.linvel()).dot(radial)) < 1e-5);
  } finally {
    game.destroy();
  }
});

test('reactor: the lower bowl stays in play beyond the goal Z coordinate', () => {
  const g = new PinballArenaSimulation(1, 42, 'reactor');
  try {
    const z = 9.4;
    inside(g).bodies[0].setTranslation(
      { x: 0, y: g.map.height(0, z) + PINBALL.radius + 0.01, z },
      true,
    );
    inside(g).bodies[0].setLinvel({ x: 0, y: 0, z: 0 }, true);
    const frame = g.step();
    assert.equal(frame.recoveries, 0);
    assert.ok(frame.balls[0].z > 9);
    assert.equal(frame.result, null);
  } finally {
    g.destroy();
  }
});

test('reactor: entering the final bowl first does not decide the winner', () => {
  let firstBowlLost = 0,
    firstNearGoalLost = 0;
  for (let seed = 1000; seed < 1008; seed++) {
    const g = new PinballArenaSimulation(8, seed, 'reactor');
    try {
      let firstBowl: number | null = null,
        firstNearGoal: number | null = null;
      let frame = g.snapshot();
      const goal = g.map.goal!;
      while (!frame.result && frame.elapsed < PINBALL.maxSeconds + 0.1) {
        frame = g.step();
        for (const b of frame.balls) {
          if (firstBowl === null && b.z > -1.4) firstBowl = b.slot;
          if (
            firstNearGoal === null &&
            Math.hypot(b.x - goal.x, b.z - goal.z) < 1.65
          )
            firstNearGoal = b.slot;
        }
      }
      assert.equal(frame.result?.reason, 'finish', `seed ${seed}`);
      assert.equal(frame.recoveries, 0);
      assert.ok(frame.ballContacts > 8, 'the participants actually collide');
      if (firstBowl !== frame.result!.slot) firstBowlLost++;
      if (firstNearGoal !== frame.result!.slot) firstNearGoalLost++;
    } finally {
      g.destroy();
    }
  }
  assert.ok(firstBowlLost >= 4);
  assert.ok(firstNearGoalLost >= 2);
});
