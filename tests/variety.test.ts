import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { RaceSimulation } from '../lib/race.ts';
import {
  STAGES,
  PADDLES,
  RADIUS,
  boundaryClearance,
  paddlePose,
} from '../lib/track.ts';

void test('two distinct downhill stages separate the preserved first and final bowls', () => {
  assert.deepEqual(
    STAGES.map((s) => s.kind),
    ['bowl', 'fork', 'cascade', 'bowl'],
  );
});

void test('hinged obstacles swing smoothly around a fixed pivot', () => {
  for (const paddle of PADDLES) {
    let previous = paddlePose(paddle, 0, 0.7);
    for (let tick = 1; tick < 600; tick++) {
      const pose = paddlePose(paddle, tick / 60, 0.7);
      assert.ok(
        Math.abs(
          Math.hypot(pose.x - paddle.x, pose.y - paddle.y) - paddle.length / 2,
        ) < 1e-8,
      );
      assert.ok(Math.hypot(pose.x - previous.x, pose.y - previous.y) < 2);
      previous = pose;
    }
  }
});

void test('inclined floors apply steady downhill gravity independent of obstacle phases', () => {
  for (const stage of [1, 2]) {
    const r = new RaceSimulation(1, 200),
      internals = r as unknown as { bodies: Matter.Body[]; stages: number[] };
    internals.stages[0] = stage;
    const body = internals.bodies[0],
      p = stage === 1 ? { x: 350, y: 950 } : { x: 400, y: 1680 };
    let previous: { vx: number; vy: number } | null = null;
    for (let tick = 0; tick < 600; tick++) {
      Matter.Body.setPosition(body, p);
      Matter.Body.setVelocity(body, { x: 1, y: 3 });
      const d = r.step().ducks[0];
      assert.ok(d.vx < 1 && d.vy > 3 && d.vy < 3.3);
      if (previous)
        assert.ok(Math.hypot(d.vx - previous.vx, d.vy - previous.vy) < 1e-8);
      previous = d;
    }
    r.destroy();
  }
});

void test('full teams use both branches and can change the leader through the final stage', () => {
  const branches = new Set(),
    times: number[] = [];
  let finalOvertakes = 0;
  for (let seed = 150; seed < 162; seed++) {
    const r = new RaceSimulation(8, seed);
    let f = r.snapshot(),
      firstFinal: number | null = null;
    while (!f.result) {
      f = r.step();
      assert.ok(!f.flushing, `unexpected rescue for seed ${seed}`);
      for (const d of f.ducks) {
        assert.ok(
          [d.x, d.y, d.progress, d.angle, d.vx, d.vy].every(Number.isFinite),
        );
        if (d.stage < STAGES.length && !d.inTube)
          assert.ok(boundaryClearance(STAGES[d.stage], d) >= RADIUS + 5);
        if (d.stage === 1 && !d.inTube && d.y > 1120 && d.y < 1220)
          branches.add(d.x < 540 ? 'left' : 'right');
        if (d.stage === 3 && firstFinal === null) firstFinal = d.slot;
      }
    }
    assert.equal(f.result.reason, 'finish');
    finalOvertakes += Number(f.result.slot !== firstFinal);
    times.push(f.result.time);
    r.destroy();
  }
  assert.equal(branches.size, 2);
  assert.ok(
    finalOvertakes >= 2,
    'final stage must leave room for natural overtaking across this sample',
  );
  times.sort((a, b) => a - b);
  assert.ok(
    times[6] > 20 && times[6] < 45,
    'timing stays around half a minute, without a strict deadline',
  );
});
