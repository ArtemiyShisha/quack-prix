import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import {
  BUMPERS,
  JUMP,
  KICKERS,
  FLIPPERS,
  FLIPPER_DRIVE,
  PINBALL,
  RAMPS,
  ROTOR,
  GUIDES,
  mechanismOrientation,
  PinballSimulation,
  initPinballPhysics,
  boardHeight,
  finishFraction,
  flipperPose,
} from '../lib/pinball.ts';

await initPinballPhysics();
const position = (b: RAPIER.RigidBody) => new Vector3().copy(b.translation());
const velocity = (b: RAPIER.RigidBody) => new Vector3().copy(b.linvel());
const spin = (b: RAPIER.RigidBody) => new Vector3().copy(b.angvel());
const rotation = (b: RAPIER.RigidBody) => new Quaternion().copy(b.rotation());

type Internals = {
  bodies: RAPIER.RigidBody[];
  world: RAPIER.World;
  ranks: number[];
  ticks: number;
  flippers: RAPIER.RigidBody[];
  rotor: RAPIER.RigidBody;
  phase: number;
  ballContacts(body: RAPIER.RigidBody): { other: RAPIER.Collider }[];
};
const internals = (game: PinballSimulation) => game as unknown as Internals;
function complete(count: number, seed: number) {
  const game = new PinballSimulation(count, seed);
  let frame = game.snapshot();
  while (!frame.result && frame.elapsed <= PINBALL.maxSeconds + 0.1)
    frame = game.step();
  assert.ok(frame.result, `count=${count} seed=${seed}`);
  game.destroy();
  return frame;
}

test('pinball has 1–8 equal physical balls, all active from the beginning', () => {
  for (let n = 1; n <= 8; n++) {
    const game = new PinballSimulation(n, 42),
      bodies = internals(game).bodies;
    assert.equal(game.snapshot().balls.length, n);
    assert.ok(
      bodies.every(
        (b) =>
          Math.abs(b.mass() - 1) < 1e-6 &&
          Math.abs(b.collider(0).radius() - PINBALL.radius) < 1e-6 &&
          b.isCcdEnabled(),
      ),
    );
    assert.ok(game.snapshot().balls.every((b) => b.vz > 0 && b.hits === 0));
    game.destroy();
  }
  for (const n of [0, 9, NaN, 1.5])
    assert.throws(() => new PinballSimulation(n, 42));
});

test('seed reproduces the complete round, independently of other simulations', () => {
  const a = complete(8, 100);
  complete(4, 904);
  assert.deepEqual(complete(8, 100), a);
  assert.notDeepEqual(complete(8, 101).balls, a.balls);
});

test('every roster size reaches the physical finish in representative rounds', () => {
  for (let n = 1; n <= 8; n++)
    for (const seed of [1, 42, 100, 904, 1000, 1003]) {
      const f = complete(n, seed);
      assert.equal(f.result!.reason, 'finish', `count=${n} seed=${seed}`);
      assert.ok(f.result!.slot >= 0 && f.result!.slot < n);
      assert.ok(f.contacts > 0);
      assert.equal(
        f.recoveries,
        0,
        `count=${n} seed=${seed}: no emergency teleport`,
      );
      assert.ok(
        f.balls.every((b) =>
          [b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite),
        ),
      );
    }
});

test('every ball clears the starting bumper field in previously blocked rounds', () => {
  for (const seed of [1, 42, 100, 904, 1000, 1003]) {
    const game = new PinballSimulation(8, seed);
    const exited = new Set<number>();
    let frame = game.snapshot();
    while (!frame.result && frame.elapsed < 8 && exited.size < 8) {
      frame = game.step();
      for (const ball of frame.balls) if (ball.z > -5.5) exited.add(ball.slot);
    }
    assert.equal(exited.size, 8, `seed=${seed}: all balls leave within 8 s`);
    assert.equal(frame.recoveries, 0);
    game.destroy();
  }
});

test('downhill shots across the deck meet a guide or complete an elevated route before finishing', () => {
  for (const x of [-5.2, -4, -2.8, -1.4, 0, 1.4, 2.8, 4, 5.2]) {
    const game = new PinballSimulation(1, 42),
      internal = internals(game),
      ball = internal.bodies[0];
    const guides = new Set<number>(),
      touched = new Set<number>();
    internal.world.colliders.forEach((collider) => {
      const p = collider.translation();
      if (
        GUIDES.some(
          (r) =>
            Math.hypot(p.x - (r.a.x + r.b.x) / 2, p.z - (r.a.z + r.b.z) / 2) <
            0.01,
        )
      )
        guides.add(collider.handle);
    });
    assert.equal(guides.size, 2);
    // Serve from the main deck with no lateral speed, including the old centre shortcut.
    ball.setTranslation(
      { x, y: boardHeight(-2.5) + PINBALL.radius, z: -2.5 },
      true,
    );
    ball.setLinvel({ x: 0, y: -PINBALL.slope * 4, z: 4 }, true);
    ball.setAngvel({ x: 4 / PINBALL.radius, y: 0, z: 0 }, true);
    let frame = game.snapshot();
    while (!frame.result) {
      frame = game.step();
      for (const c of internal.ballContacts(ball))
        if (guides.has(c.other.handle)) touched.add(c.other.handle);
    }
    assert.equal(
      frame.result.reason,
      'finish',
      `shot x=${x} must not get stuck`,
    );
    assert.equal(frame.recoveries, 0);
    assert.ok(
      touched.size > 0 || frame.returns > 0,
      `shot x=${x} must not drain through an empty corridor`,
    );
    game.destroy();
  }
});

test('opposing flippers cannot squeeze balls into an explosive launch', () => {
  for (const [count, seed] of [
    [4, 1003],
    [8, 1004],
    [6, 100],
  ]) {
    const game = new PinballSimulation(count, seed);
    let frame = game.snapshot();
    while (!frame.result) {
      frame = game.step();
      for (const ball of frame.balls)
        assert.ok(
          Math.hypot(ball.vx, ball.vy, ball.vz) < 16,
          `count=${count} seed=${seed} slot=${ball.slot}: solver launch`,
        );
    }
    assert.equal(frame.recoveries, 0);
    assert.equal(frame.result.reason, 'finish');
    game.destroy();
  }
});

test('spring bumper reverses a ball at actual contact; an empty lane cannot trigger it', () => {
  const game = new PinballSimulation(1, 42),
    ghost = new PinballSimulation(1, 42);
  const bumper = BUMPERS[0];
  for (const simulation of [game, ghost]) {
    const ball = internals(simulation).bodies[0];
    ball.setTranslation(
      new Vector3(
        bumper.x,
        boardHeight(bumper.z - bumper.radius - PINBALL.radius - 0.03) +
          PINBALL.radius * Math.sqrt(1 + PINBALL.slope ** 2),
        bumper.z - bumper.radius - PINBALL.radius - 0.03,
      ),
      true,
    );
    ball.setLinvel(new Vector3(0, -PINBALL.slope * 3, 3), true);
    ball.setAngvel(
      new Vector3(
        (3 * Math.sqrt(1 + PINBALL.slope ** 2)) / PINBALL.radius,
        0,
        0,
      ),
      true,
    );
  }
  internals(ghost).bodies[0].collider(0).setCollisionGroups(0);
  let frame = game.snapshot();
  for (let i = 0; i < 10 && frame.balls[0].hits === 0; i++) {
    frame = game.step();
    ghost.step();
  }
  assert.equal(frame.balls[0].hits, 1);
  assert.ok(frame.balls[0].vz < -0.5);
  assert.ok(
    frame.balls[0].vz > -2,
    'the starter bumper does not fire the ball back at launch speed',
  );
  assert.equal(ghost.snapshot().balls[0].hits, 0);
  game.destroy();
  ghost.destroy();
});

test('simultaneous balls physically collide instead of passing through each other', () => {
  const game = new PinballSimulation(2, 42);
  internals(game).bodies.forEach((b, i) => {
    b.setTranslation(
      new Vector3(i ? 0.4 : -0.4, boardHeight(-10) + PINBALL.radius, -10),
      true,
    );
    b.setLinvel(new Vector3(i ? -2 : 2, 0, 0), true);
  });
  for (let i = 0; i < 8; i++) game.step();
  const frame = game.snapshot();
  assert.ok(frame.balls[0].vx < 0 && frame.balls[1].vx > 0);
  assert.ok(frame.contacts >= 1);
  game.destroy();
});

test('a launched ball climbs either side ramp, completes its turn and returns to the deck', () => {
  for (const side of [-1, 1]) {
    const game = new PinballSimulation(1, 42),
      ball = internals(game).bodies[0];
    const kicker = KICKERS[side === -1 ? 0 : 1];
    ball.setTranslation(
      new Vector3(kicker.x, boardHeight(kicker.z) + PINBALL.radius, kicker.z),
      true,
    );
    ball.setLinvel(new Vector3(0, 0, 2), true);
    let high = false,
      frame = game.snapshot();
    for (let i = 0; i < 600 && frame.returns === 0; i++) {
      frame = game.step();
      high ||= frame.balls[0].y - boardHeight(frame.balls[0].z) > 1.5;
    }
    assert.equal(frame.returns, 1);
    assert.equal(frame.balls[0].loops, 1);
    assert.ok(high, 'the ball must physically rise above the deck');
    assert.ok(
      Math.abs(frame.balls[0].x) < 4 &&
        frame.balls[0].z > 7 &&
        frame.balls[0].z < 8.5,
    );
    assert.ok(
      frame.balls[0].vx * side < -0.5,
      'outlet aims back towards the centre',
    );
    let landed = false;
    for (let i = 0; i < 150 && !landed; i++) {
      frame = game.step();
      landed =
        frame.balls[0].y < boardHeight(frame.balls[0].z) + 0.5 &&
        frame.balls[0].z > 4;
    }
    assert.ok(
      landed,
      'fall under gravity onto the playing field after completing the turn',
    );
    game.destroy();
  }
});

test('both wide ramp mouths accept off-centre balls from the main playing field', () => {
  for (const side of [-1, 1])
    for (const offset of [-0.5, 0.5]) {
      const game = new PinballSimulation(1, 42);
      const ball = internals(game).bodies[0];
      const kicker = KICKERS[side === -1 ? 0 : 1];
      ball.setTranslation(
        new Vector3(
          kicker.x + offset,
          boardHeight(-4.9) + PINBALL.radius,
          -4.9,
        ),
        true,
      );
      ball.setLinvel(new Vector3(0, -PINBALL.slope * 3, 3), true);
      let frame = game.snapshot();
      while (!frame.result && frame.elapsed < 12 && frame.returns === 0)
        frame = game.step();
      assert.equal(frame.returns, 1, `side=${side} offset=${offset}`);
      assert.equal(frame.recoveries, 0);
      assert.ok(frame.balls[0].vx * side < -0.5);
      game.destroy();
    }
});

test('ordinary full-team rounds use both return lanes before the physical finish', () => {
  const sides = [0, 0];
  let rounds = 0,
    jumps = 0;
  for (const seed of [1000, 1001, 1002, 1003, 1004, 1005]) {
    const game = new PinballSimulation(8, seed);
    let frame = game.snapshot();
    while (!frame.result) {
      const prior = frame;
      frame = game.step();
      for (const ball of frame.balls)
        sides[ball.x < 0 ? 0 : 1] += ball.loops - prior.balls[ball.slot].loops;
    }
    if (frame.returns > 0) rounds++;
    jumps += frame.jumps;
    assert.equal(frame.result.reason, 'finish', `seed=${seed}`);
    assert.equal(frame.recoveries, 0);
    game.destroy();
  }
  assert.ok(jumps > 0, 'ordinary rounds use the central jump');
  assert.ok(rounds >= 4, `${rounds} of 6 rounds used the loops`);
  assert.ok(sides[0] > 0 && sides[1] > 0, `left=${sides[0]} right=${sides[1]}`);
});

test('flippers physically impart an upward return rather than only animating', () => {
  const game = new PinballSimulation(1, 42),
    body = internals(game).bodies[0];
  // Place the ball in the left flipper sweep at the same height as the deck.
  body.setTranslation(
    new Vector3(
      -1.6,
      boardHeight(FLIPPERS[0].z - 0.1) + PINBALL.radius,
      FLIPPERS[0].z - 0.1,
    ),
    true,
  );
  body.setLinvel(new Vector3(0, 0, 1), true);
  let returned = false;
  for (let i = 0; i < 180; i++) {
    const f = game.step();
    returned ||= f.balls[0].vz < -2;
  }
  assert.ok(returned);
  game.destroy();
});

test('the shared ramp mesh has upward deck triangles and continuous side channels', () => {
  for (const ramp of [...RAMPS, JUMP]) {
    assert.equal(ramp.edges[0].length, ramp.centre!.length);
    for (let row = 0; row < ramp.centre!.length - 1; row++) {
      const offset = row * 18 + 6;
      const [a, b, c] = ramp.indices.slice(offset, offset + 3).map((i) => ({
        x: ramp.positions[i * 3],
        z: ramp.positions[i * 3 + 2],
      }));
      const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      assert.ok(normalY > 0);
    }
  }
  for (let i = 0; i < 2; i++) {
    const a = flipperPose(i, 0, 1),
      b = flipperPose(i, 0.01, 1);
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 0.2);
  }
});

test('independent flipper strokes remain continuous and leave a ball-width passage', () => {
  const dt = 1 / PINBALL.physicsHz;
  for (const phase of [0, 1, 3, 6]) {
    let independent = 0;
    const restSamples = [0, 0],
      movingSamples = [0, 0];
    for (let tick = 0; tick < 65 * PINBALL.physicsHz; tick++) {
      const poses = [0, 1].map((side) => flipperPose(side, tick * dt, phase));
      const speeds = poses.map((pose, side) => {
        const next = flipperPose(side, (tick + 1) * dt, phase);
        const speed = Math.abs(next.angle - pose.angle) / dt;
        assert.ok(speed < 10, `no pose jumps: side=${side}, t=${tick * dt}`);
        if (speed < 1e-6) restSamples[side]++;
        else movingSamples[side]++;
        return speed;
      });
      if (speeds[0] < 1e-6 !== speeds[1] < 1e-6) independent++;
      const inner = poses.map((pose, side) => {
        const f = FLIPPERS[side];
        const extent =
          (Math.abs(Math.cos(pose.angle)) * f.length) / 2 +
          (Math.abs(Math.sin(pose.angle)) * f.width) / 2;
        return side === 0 ? pose.x + extent : pose.x - extent;
      });
      assert.ok(inner[1] - inner[0] > PINBALL.radius * 2);
    }
    assert.ok(independent > 1000, 'one rests while the other moves');
    assert.ok(restSamples.every((n) => n > 1000));
    assert.ok(movingSamples.every((n) => n > 1000));
  }
});

test('finish accepts only an actual chute crossing and resolves time within the step', () => {
  assert.ok(
    Math.abs(
      finishFraction(
        { x: 0, y: -1.2, z: PINBALL.finishZ - 0.15 },
        { x: 0, y: -1.2, z: PINBALL.finishZ + 0.15 },
      )! - 0.5,
    ) < 1e-10,
  );
  assert.equal(
    finishFraction(
      { x: 2, y: -1.2, z: PINBALL.finishZ - 0.15 },
      { x: 2, y: -1.2, z: PINBALL.finishZ + 0.15 },
    ),
    null,
  );
  assert.equal(
    finishFraction(
      { x: 0, y: 2, z: PINBALL.finishZ - 0.15 },
      { x: 0, y: 2, z: PINBALL.finishZ + 0.15 },
    ),
    null,
  );
  const game = new PinballSimulation(2, 1),
    bodies = internals(game).bodies;
  bodies.forEach((b, i) => {
    b.setTranslation(
      new Vector3(
        i ? 0.42 : -0.42,
        boardHeight(PINBALL.finishZ) + PINBALL.radius,
        PINBALL.finishZ - (i ? 0.02 : 0.04),
      ),
      true,
    );
    b.setLinvel(new Vector3(0, 0, 8), true);
  });
  const f = game.step();
  assert.equal(f.result?.slot, 1);
  assert.ok(f.result!.time < 1 / 120);
  assert.deepEqual(game.step(), f, 'freeze the first result');
  game.destroy();
});

test('escaping the table re-serves the ball and cannot bypass the finish', () => {
  const game = new PinballSimulation(1, 42),
    body = internals(game).bodies[0];
  body.setTranslation(new Vector3(9, -5, 9), true);
  body.setLinvel(new Vector3(0, 0, 10), true);
  const f = game.step();
  assert.equal(f.result, null);
  assert.ok(f.balls[0].z < -6);
  game.destroy();
});

test('full-team rounds contain repeated collisions after the initial launch', () => {
  const game = new PinballSimulation(8, 42);
  for (let i = 0; i < 120; i++) game.step();
  const first = game.snapshot().contacts;
  for (let i = 0; i < 300; i++) game.step();
  assert.ok(game.snapshot().contacts > first + 10);
  game.destroy();
});

test('snapshots are isolated and cleanup removes all physics bodies', () => {
  const game = new PinballSimulation(8, 42),
    f = game.snapshot();
  f.balls[0].x = 999;
  f.bumperHits[0] = 999;
  assert.notEqual(game.snapshot().balls[0].x, 999);
  assert.notEqual(game.snapshot().bumperHits[0], 999);
  game.destroy();
  assert.throws(() => game.snapshot(), /освобождена/);
  assert.doesNotThrow(() => game.destroy(), 'cleanup is idempotent');
});

test('equal crossing times use seeded tie ranks, independent of array order', () => {
  const winners = new Set<number>();
  for (let seed = 1; seed <= 8; seed++) {
    const game = new PinballSimulation(2, seed),
      internal = internals(game);
    internal.bodies.forEach((body, i) => {
      body.setTranslation(
        new Vector3(
          i ? 0.42 : -0.42,
          boardHeight(PINBALL.finishZ) + PINBALL.radius,
          PINBALL.finishZ - 0.03,
        ),
        true,
      );
      body.setLinvel(new Vector3(0, 0, 8), true);
      // Isolate an exact tie: floor contacts can produce distinct crossing times.
      body.collider(0).setCollisionGroups(0);
    });
    const frame = game.step();
    assert.equal(frame.result?.slot, internal.ranks.indexOf(0));
    winners.add(frame.result!.slot);
    game.destroy();
  }
  assert.equal(winners.size, 2);
});

test('late rescue parks flippers away from the chute, with an explicit bounded fallback', () => {
  const game = new PinballSimulation(2, 42),
    internal = internals(game);
  internal.ticks = 64 * PINBALL.physicsHz;
  // Advance through the real motor's parking transition, allowing it to settle.
  internal.bodies.forEach((body) => body.collider(0).setCollisionGroups(0));
  for (let i = 0; i < 180; i++) game.step();
  const frame = game.step();
  assert.equal(frame.rescue, true);
  assert.ok(frame.flippers[0].x < -1.8 && frame.flippers[1].x > 1.8);
  assert.ok(
    internal.flippers.every(
      (b) => velocity(b).length() < 0.005 && spin(b).length() < 0.005,
    ),
  );
  internal.ticks = PINBALL.maxSeconds * PINBALL.physicsHz;
  internal.bodies.forEach((body) =>
    body.collider(0).setCollisionGroups(0xffffffff),
  );
  internal.bodies[0].setTranslation(
    new Vector3(0, boardHeight(7) + PINBALL.radius, 7),
    true,
  );
  internal.bodies[1].setTranslation(
    new Vector3(0, boardHeight(-7) + PINBALL.radius, -7),
    true,
  );
  const final = game.step();
  assert.equal(final.result?.reason, 'distance');
  assert.equal(final.result?.slot, 0);
  game.destroy();
});

test('the expanded start stays on the deck and cannot enter a side lane immediately', () => {
  for (const count of [1, 4, 8])
    for (const seed of [1, 42, 1002]) {
      const game = new PinballSimulation(count, seed);
      for (let tick = 0; tick < 90; tick++) {
        const frame = game.step();
        assert.equal(frame.recoveries, 0);
        for (const ball of frame.balls) {
          assert.ok(Math.abs(ball.x) < PINBALL.width / 2);
          assert.ok(ball.y > boardHeight(ball.z) - 0.05);
          assert.equal(ball.loops, 0);
        }
      }
      game.destroy();
    }
});

test('continuous side rails physically return a ball before it can escape', () => {
  for (const side of [-1, 1])
    // Stay clear of the new inlet guide at Z=5 when serving against the perimeter.
    for (const z of [-5, 0, 6]) {
      const game = new PinballSimulation(1, 42),
        ball = internals(game).bodies[0];
      ball.setTranslation(
        new Vector3(
          side * (PINBALL.width / 2 - 0.6),
          boardHeight(z) + PINBALL.radius,
          z,
        ),
        true,
      );
      ball.setLinvel(new Vector3(side * 5, 0, 0), true);
      for (let i = 0; i < 15; i++) game.step();
      const frame = game.snapshot();
      assert.equal(frame.recoveries, 0);
      assert.ok(
        Math.abs(frame.balls[0].x) < PINBALL.width / 2 - PINBALL.radius,
      );
      assert.ok(frame.balls[0].vx * side < 0);
      game.destroy();
    }
});

test('the central jump has supported takeoff, free flight and a physical landing', () => {
  const game = new PinballSimulation(1, 42),
    ball = internals(game).bodies[0];
  const entry = KICKERS[2];
  ball.setTranslation(
    new Vector3(entry.x, boardHeight(entry.z) + PINBALL.radius, entry.z),
    true,
  );
  ball.setLinvel(new Vector3(0, 0, 2), true);
  let elevated = false,
    airborne = false,
    landed = false;
  for (let i = 0; i < 360 && !landed; i++) {
    const frame = game.step(),
      b = frame.balls[0];
    const clearance = b.y - boardHeight(b.z);
    elevated ||= clearance > 1.5;
    airborne ||=
      elevated &&
      b.z > JUMP.centre!.at(-1)!.z + PINBALL.radius &&
      clearance > 1;
    landed = airborne && clearance < 0.4;
    assert.equal(frame.recoveries, 0);
  }
  assert.ok(
    elevated && airborne && landed,
    'climb, leave the lip, fall onto the deck',
  );
  assert.equal(game.snapshot().jumps, 1, 'count takeoff once');
  game.destroy();
});

test('a resting sphere rolls down the deck with rotational inertia and little slip', () => {
  const game = new PinballSimulation(1, 42),
    ball = internals(game).bodies[0];
  ball.setTranslation(
    new Vector3(
      0,
      boardHeight(-11) + PINBALL.radius * Math.sqrt(1 + PINBALL.slope ** 2),
      -11,
    ),
    true,
  );
  ball.setLinvel(new Vector3(0, 0, 0), true);
  ball.setAngvel(new Vector3(0, 0, 0), true);
  for (let i = 0; i < 120; i++) game.step();
  const angle = Math.atan(PINBALL.slope);
  const expectedAcceleration = (PINBALL.gravity * Math.sin(angle)) / 1.4;
  assert.ok(
    Math.abs(velocity(ball).length() - expectedAcceleration * 2) < 0.08,
  );
  const normal = new Vector3(0, Math.cos(angle), Math.sin(angle));
  const contactVelocity = velocity(ball).add(
    spin(ball).cross(normal.multiplyScalar(-PINBALL.radius)),
  );
  assert.ok(
    contactVelocity.length() < 0.06,
    'rotation matches travel across the surface',
  );
  assert.ok(position(ball).z > -9.6 && position(ball).z < -9.4);
  game.destroy();
});

test('a booster cannot accelerate an airborne ball above its belt', () => {
  const game = new PinballSimulation(1, 42),
    ball = internals(game).bodies[0];
  const middle = JUMP.centre![16];
  ball.setTranslation(new Vector3(middle.x, middle.y + 0.9, middle.z), true);
  ball.setLinvel(new Vector3(0, 0, 0), true);
  ball.setAngvel(new Vector3(0, 0, 0), true);
  for (let i = 0; i < 6; i++) game.step();
  assert.ok(Math.abs(velocity(ball).z) < 1e-6);
  assert.ok(Math.abs(velocity(ball).x) < 1e-6);
  assert.ok(Math.abs(velocity(ball).y + PINBALL.gravity * 0.1) < 0.01);
  game.destroy();
});

test('passive ball collisions do not create energy', () => {
  const game = new PinballSimulation(2, 42),
    bodies = internals(game).bodies;
  bodies.forEach((ball, i) => {
    ball.setTranslation(
      new Vector3(i ? 0.4 : -0.4, boardHeight(-10) + PINBALL.radius, -10),
      true,
    );
    ball.setLinvel(new Vector3(i ? -2 : 2, 0, 0), true);
    ball.setAngvel(new Vector3(0, 0, -(i ? -2 : 2) / PINBALL.radius), true);
  });
  const energy = () =>
    bodies.reduce(
      (sum, b) =>
        sum +
        velocity(b).lengthSq() * 0.5 +
        0.2 * PINBALL.radius ** 2 * spin(b).lengthSq() +
        PINBALL.gravity * position(b).y,
      0,
    );
  const before = energy();
  for (let i = 0; i < 20; i++) {
    game.step();
    assert.ok(energy() <= before + 0.05);
  }
  game.destroy();
});

test('dynamic flippers stay attached to their hinges and render their actual poses', () => {
  const game = new PinballSimulation(1, 42);
  const normal = new Vector3(0, 1, PINBALL.slope).normalize();
  let peakSpeed = 0;
  for (let i = 0; i < 600; i++) {
    const frame = game.step();
    internals(game).flippers.forEach((body, index) => {
      assert.equal(body.bodyType(), RAPIER.RigidBodyType.Dynamic);
      assert.ok(Math.abs(body.mass() - FLIPPER_DRIVE.mass) < 1e-6);
      const f = FLIPPERS[index];
      const pivot = new Vector3(-f.length / 2, 0, 0)
        .applyQuaternion(rotation(body))
        .add(position(body));
      const expectedPivot = new Vector3(
        f.x,
        boardHeight(f.z),
        f.z,
      ).addScaledVector(normal, f.height / 2);
      assert.ok(
        pivot.distanceTo(expectedPivot) < 0.002,
        'hinge does not drift',
      );
      const expected = frame.flippers[index];
      assert.ok(
        position(body).distanceTo(
          new Vector3(expected.x, expected.y, expected.z),
        ) < 1e-6,
      );
      const actual = new Vector3(0, 1, 0).applyQuaternion(rotation(body));
      assert.ok(actual.distanceTo(normal) < 0.0001);
      peakSpeed = Math.max(peakSpeed, Math.abs(spin(body).dot(normal)));
    });
  }
  assert.ok(
    peakSpeed > 4 && peakSpeed < 6,
    `crisp physical swing: ${peakSpeed}`,
  );
  game.destroy();
});

test('a ball slows a finite-mass flipper and receives no infinite-mass kick', () => {
  const game = new PinballSimulation(1, 42),
    { world, flippers, bodies } = internals(game),
    paddle = flippers[0],
    ball = bodies[0],
    f = FLIPPERS[0];
  // Isolate a passive impact: no drive, floor, gravity or other mechanisms.
  world.gravity = { x: 0, y: 0, z: 0 };
  world.colliders.forEach((collider) => {
    if (
      collider.handle !== paddle.collider(0).handle &&
      collider.handle !== ball.collider(0).handle
    )
      collider.setCollisionGroups(0);
  });
  const q = mechanismOrientation(0),
    normal = new Vector3(0, 1, PINBALL.slope).normalize();
  const pivot = new Vector3(f.x, boardHeight(f.z), f.z).addScaledVector(
    normal,
    f.height / 2,
  );
  const offset = new Vector3(f.length / 2, 0, 0).applyQuaternion(q);
  const omega = normal.clone().multiplyScalar(4);
  paddle.setRotation(q, true);
  paddle.setTranslation(pivot.clone().add(offset), true);
  paddle.setAngvel(omega, true);
  paddle.setLinvel(omega.clone().cross(offset), true);
  ball.setTranslation(
    pivot
      .clone()
      .add(new Vector3(1.7, 0, 0).applyQuaternion(q))
      .addScaledVector(
        new Vector3(0, 0, 1).applyQuaternion(q),
        -(f.width / 2 + PINBALL.radius + 0.015),
      ),
    true,
  );
  ball.setLinvel(new Vector3(), true);
  ball.setAngvel(new Vector3(), true);
  for (let i = 0; i < 12; i++) {
    paddle.resetTorques(true);
    world.step();
  }
  assert.ok(
    spin(paddle).dot(normal) > 0 && spin(paddle).dot(normal) < 2,
    'the paddle yields to the impact',
  );
  assert.ok(
    velocity(ball).length() > 1 && velocity(ball).length() < 3,
    'finite inertia governs the impulse instead of an imposed wall velocity',
  );
  assert.ok(velocity(ball).z < -1, 'the strike still returns the ball uphill');
  game.destroy();
});

test('CCD stops a fast ball at a thin rail without a global speed clamp', () => {
  for (const side of [-1, 1]) {
    const game = new PinballSimulation(1, 42);
    const ball = internals(game).bodies[0];
    ball.setTranslation(
      { x: side * 4.9, y: boardHeight(-10) + PINBALL.radius, z: -10 },
      true,
    );
    ball.setLinvel({ x: side * 400, y: 0, z: 0 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const frame = game.step();
    assert.equal(frame.recoveries, 0);
    assert.ok(Math.abs(frame.balls[0].x) < PINBALL.width / 2 - PINBALL.radius);
    assert.ok(
      frame.balls[0].vx * side < 0,
      'the ball actually bounced off the rail',
    );
    game.destroy();
  }
  const game = new PinballSimulation(1, 42);
  const ball = internals(game).bodies[0];
  ball.setTranslation({ x: 0, y: 5, z: -10 }, true);
  ball.setLinvel({ x: 0, y: 0, z: 100 }, true);
  const frame = game.step();
  assert.ok(
    frame.balls[0].vz > 99,
    'free motion retains speed beyond normal gameplay',
  );
  game.destroy();
});

test('a ball against the outside of a lane is not trapped between back-face seams', () => {
  const game = new PinballSimulation(1, 1);
  const ball = internals(game).bodies[0];
  // Position observed in the migration regression: this touches the outside wall.
  ball.setTranslation({ x: 2.10605, y: -0.418595, z: 6.95716 }, true);
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 120; i++) game.step();
  const frame = game.snapshot();
  assert.equal(frame.recoveries, 0);
  assert.ok(frame.balls[0].z > 7.5, 'gravity carries it past the lane seam');
  game.destroy();
});

test('ground-level balls leave low ramp undersides under gravity without a rescue', () => {
  for (const [x, z] of [
    [-2.65, -1.5],
    [2.65, -1.5],
    [0.5, 1.3],
  ]) {
    const game = new PinballSimulation(1, 42),
      ball = internals(game).bodies[0];
    ball.setTranslation({ x, y: boardHeight(z) + PINBALL.radius, z }, true);
    ball.setLinvel({ x: 0, y: 0, z: -1 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 300 && !game.snapshot().result; i++) game.step();
    const f = game.snapshot();
    assert.equal(f.recoveries, 0);
    assert.ok(
      Math.hypot(f.balls[0].x - x, f.balls[0].z - z) > 1,
      `ground ball escapes the low section at ${x}, ${z}`,
    );
    game.destroy();
  }
});

test('a rotating mechanism hitting a resting ball counts the speed at the contact point', () => {
  const game = new PinballSimulation(1, 42);
  const internal = internals(game),
    ball = internal.bodies[0];
  internal.world.gravity = { x: 0, y: 0, z: 0 };
  // Only the rotor can touch this ball; isolate its angular contribution.
  ball.collider(0).setCollisionGroups((1 << 16) | 2);
  for (let i = 0; i < internal.rotor.numColliders(); i++)
    internal.rotor.collider(i).setCollisionGroups((2 << 16) | 1);
  const point = new Vector3(ROTOR.length / 2 + PINBALL.radius - 0.04, 0, 0)
    .applyQuaternion(mechanismOrientation(internal.phase + 0.45))
    .add(position(internal.rotor));
  ball.setTranslation(point, true);
  ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  for (let i = 0; i < 20 && game.snapshot().contacts === 0; i++) game.step();
  assert.ok(game.snapshot().contacts > 0);
  assert.ok(velocity(ball).length() > 0.5);
  game.destroy();
});
