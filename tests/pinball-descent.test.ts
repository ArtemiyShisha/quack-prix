import test from 'node:test';
import assert from 'node:assert/strict';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { initPinballPhysics, PINBALL } from '../lib/pinball.ts';
import { PinballArenaSimulation } from '../lib/pinball-arenas.ts';
import {
  createDescentArena,
  descentViewProgress,
} from '../lib/pinball-descent.ts';

await initPinballPhysics();
type Internals = {
  bodies: RAPIER.RigidBody[];
  motors: { body: RAPIER.RigidBody }[];
  world: RAPIER.World;
  stages: number[];
  ticks: number;
};
const inside = (game: PinballArenaSimulation) => game as unknown as Internals;

test('descent: every team starts aligned, at the same height and at rest across seeds', () => {
  for (let count = 1; count <= 8; count++)
    for (const seed of [42, 1000, 1001]) {
      const game = new PinballArenaSimulation(count, seed, 'descent');
      try {
        const frame = game.snapshot(),
          first = frame.balls[0],
          gate = game.map.start.gate!;
        assert.equal(frame.startGateOpen, false);
        for (const [slot, ball] of frame.balls.entries()) {
          assert.equal(ball.y, first.y, 'equal gravitational potential energy');
          assert.equal(ball.z, first.z, 'one starting row');
          assert.deepEqual([ball.vx, ball.vy, ball.vz], [0, 0, 0]);
          const spin = inside(game).bodies[slot].angvel();
          assert.deepEqual([spin.x, spin.y, spin.z], [0, 0, 0]);
          assert.ok(Math.abs(ball.x) + PINBALL.radius < gate.width / 2);
          assert.ok(ball.z + PINBALL.radius < gate.z - gate.depth / 2);
          if (slot)
            assert.ok(ball.x - frame.balls[slot - 1].x > 2 * PINBALL.radius);
        }
      } finally {
        game.destroy();
      }
    }
});

test('descent: one physical gate holds the entire row and releases it evenly onto the runway', () => {
  for (let count = 1; count <= 8; count++) {
    const game = new PinballArenaSimulation(count, 42, 'descent');
    try {
      const gate = game.map.start.gate!;
      // Keep it shut longer to prove that gravity cannot carry a ball through it.
      gate.opensAt = 1.6;
      const closed = game
        .snapshot()
        .objects.find((o) => o.id === 'start-gate')!;
      let frame = game.snapshot();
      while (frame.elapsed < gate.opensAt - 0.1) {
        frame = game.step();
        assert.equal(frame.startGateOpen, false);
        for (const ball of frame.balls)
          assert.ok(ball.z + PINBALL.radius < gate.z - gate.depth / 2 + 0.006);
      }
      const crossingTimes: number[] = [],
        runwayEnd = -11.5;
      while (
        frame.elapsed < 6 &&
        crossingTimes.filter(Number.isFinite).length < count
      ) {
        const before = frame;
        frame = game.step();
        frame.balls.forEach((ball, i) => {
          if (Number.isFinite(crossingTimes[i]) || ball.z < runwayEnd) return;
          const t =
            (runwayEnd - before.balls[i].z) / (ball.z - before.balls[i].z);
          crossingTimes[i] =
            before.elapsed + t * (frame.elapsed - before.elapsed);
        });
      }
      assert.equal(
        crossingTimes.filter(Number.isFinite).length,
        count,
        'every ball leaves the gate',
      );
      assert.ok(
        Math.max(...crossingTimes) - Math.min(...crossingTimes) < 0.015,
        'no slot gets a head start before the first obstacle',
      );
      assert.equal(frame.startGateOpen, true);
      const raised = frame.objects.find((o) => o.id === 'start-gate')!;
      assert.ok(raised.y - closed.y > gate.lift - 0.001);
      assert.equal(frame.recoveries, 0);
      assert.equal(frame.result, null);
      const z = frame.balls.map((b) => b.z);
      assert.ok(Math.max(...z) - Math.min(...z) < 0.03);
      const islandFront = Math.min(
        ...game.map.rails
          .filter((rail) => rail.kind === 'island')
          .map((rail) => Math.min(rail.a.z, rail.b.z)),
      );
      assert.ok(
        islandFront - gate.z > 5.5,
        'the first obstacle follows a long common run-up',
      );
    } finally {
      game.destroy();
    }
  }
});

for (const stage of [0, 1]) {
  test(`descent: hole ${stage + 1} continues through a real chute to the next floor`, () => {
    const game = new PinballArenaSimulation(1, 42, 'descent');
    try {
      const data = inside(game),
        levels = game.map.levels!,
        goal = levels[stage].goal,
        ball = data.bodies[0],
        entry = levels[stage + 1].entry;
      // Isolate the transfer from the live paddles; full-course tests retain them.
      for (const motor of data.motors)
        for (let i = 0; i < motor.body.numColliders(); i++)
          motor.body.collider(i).setCollisionGroups(0);
      data.stages[0] = stage;
      ball.setTranslation({ x: goal.x, y: goal.y + 0.75, z: goal.z }, true);
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
      let frame = game.snapshot(),
        crossed = false,
        landed = false;
      let previous = new Vector3(goal.x, goal.y + 0.75, goal.z);
      while (!frame.result && frame.elapsed < 16 && !landed) {
        frame = game.step();
        const b = frame.balls[0],
          p = new Vector3(b.x, b.y, b.z);
        assert.ok(
          p.distanceTo(previous) < 0.75,
          'no coordinate teleport between floors',
        );
        previous = p;
        if (frame.stages[0] === stage + 1) crossed = true;
        if (
          crossed &&
          b.z >= entry.z &&
          b.y < game.map.height(b.x, b.z) + PINBALL.radius + 0.3
        )
          landed = true;
        assert.equal(
          frame.result,
          null,
          'an intermediate hole does not end the game',
        );
        assert.equal(frame.recoveries, 0, 'the well and chute retain the ball');
      }
      assert.ok(
        crossed,
        'actual downward crossing advances the individual stage',
      );
      assert.ok(landed, 'gravity carries the sphere to the next playable bowl');
      assert.equal(frame.stages[0], stage + 1);
    } finally {
      game.destroy();
    }
  });
}

test('descent: a final hole cannot be won by skipping the intermediate floors', () => {
  const game = new PinballArenaSimulation(2, 42, 'descent');
  try {
    const data = inside(game),
      goal = game.map.goal!;
    for (const motor of data.motors)
      for (let i = 0; i < motor.body.numColliders(); i++)
        motor.body.collider(i).setCollisionGroups(0);
    data.stages[1] = 2;
    data.bodies.forEach((ball, i) => {
      ball.setTranslation(
        {
          x: goal.x + (i ? 0.36 : -0.36),
          y: goal.y + (i ? 0.04 : 0.02),
          z: goal.z,
        },
        true,
      );
      ball.setLinvel({ x: 0, y: -8, z: 0 }, true);
    });
    const frame = game.step();
    assert.equal(frame.result?.reason, 'finish');
    assert.equal(
      frame.result?.slot,
      1,
      'the earlier unqualified crossing is ignored',
    );
    assert.equal(frame.stages[0], 0);
  } finally {
    game.destroy();
  }
});

test('descent: legitimate play on the deep floor does not trigger an emergency reset', () => {
  const game = new PinballArenaSimulation(1, 42, 'descent');
  try {
    const data = inside(game),
      z = 38,
      x = 4;
    data.stages[0] = 2;
    data.bodies[0].setTranslation(
      { x, z, y: game.map.height(x, z) + PINBALL.radius + 0.01 },
      true,
    );
    data.bodies[0].setLinvel({ x: 0, y: 0, z: 0 }, true);
    const frame = game.step();
    assert.ok(frame.balls[0].y < -7);
    assert.equal(frame.recoveries, 0);
    assert.equal(frame.stages[0], 2);
  } finally {
    game.destroy();
  }
});

test('descent: the late release opens a path underneath the stopped entry rotor', () => {
  const game = new PinballArenaSimulation(1, 42, 'descent');
  try {
    const data = inside(game),
      motor = game.map.motors.find((m) => m.id === 'core-entry')!,
      x = motor.x,
      z = motor.z - 2.3;
    data.ticks = (game.map.releaseAt! + 1) * PINBALL.physicsHz;
    data.stages[0] = 2;
    data.bodies[0].setTranslation(
      { x, z, y: game.map.height(x, z) + PINBALL.radius + 0.02 },
      true,
    );
    data.bodies[0].setLinvel({ x: 0, y: 0, z: 4 }, true);
    data.bodies[0].setAngvel({ x: 0, y: 0, z: 0 }, true);
    let frame = game.snapshot();
    const deadline = frame.elapsed + 2.5;
    while (
      !frame.result &&
      frame.balls[0].z < motor.z + 1.7 &&
      frame.elapsed < deadline
    )
      frame = game.step();
    assert.ok(
      frame.balls[0].z > motor.z + 1.7,
      'the parked cross cannot trap a late ball',
    );
    assert.equal(frame.recoveries, 0);
    assert.equal(frame.gateOpen, true);
    assert.ok(frame.springReady.every((ready) => !ready));
  } finally {
    game.destroy();
  }
});

test('descent: the view traverses a chute before showing the next whole floor', () => {
  const levels = createDescentArena().levels!;
  assert.equal(descentViewProgress(levels, null), 0);
  for (const stage of [1, 2]) {
    const from = levels[stage - 1].goal.z,
      to = levels[stage].entry.z;
    for (const t of [0, 0.5, 1]) {
      const progress = descentViewProgress(levels, {
        stages: [stage],
        balls: [{ slot: 0, x: 0, y: 0, z: from + (to - from) * t }],
      });
      assert.ok(Math.abs(progress - (stage - 1 + t)) < 1e-10);
    }
  }
});
