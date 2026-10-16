import { LEGACY_MARBLE_COURSE } from '../lib/marble-track.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MarbleSimulation } from '../lib/marble-race.ts';
import { FUNNEL, MARBLE_FINISH_Z } from '../lib/marble-track.ts';
void test('marbles roll and descend in three dimensions under gravity', () => {
  const race = new MarbleSimulation(4, 18, LEGACY_MARBLE_COURSE);
  const first = race.snapshot();
  let frame = first;
  for (let i = 0; i < 240; i++) frame = race.step();
  assert.ok(frame.marbles.some((p, i) => p.z > first.marbles[i].z + 2));
  assert.ok(frame.marbles.every((p, i) => p.y < first.marbles[i].y));
  assert.ok(frame.marbles.some((p) => Math.hypot(p.qx, p.qy, p.qz) > 0.1));
  race.destroy();
});

void test('three-dimensional setup is repeatable and fresh seeds change trajectories', () => {
  const a = new MarbleSimulation(3, 71, LEGACY_MARBLE_COURSE),
    b = new MarbleSimulation(3, 71, LEGACY_MARBLE_COURSE),
    c = new MarbleSimulation(3, 72, LEGACY_MARBLE_COURSE);
  for (let i = 0; i < 90; i++) {
    assert.deepEqual(a.step(), b.step());
    c.step();
  }
  assert.notDeepEqual(a.snapshot().marbles, c.snapshot().marbles);
  a.destroy();
  b.destroy();
  c.destroy();
});

void test('the marked finish rejects bypasses and compares physical crossing times', () => {
  const r = new MarbleSimulation(2, 11, LEGACY_MARBLE_COURSE);
  const internal = r as unknown as {
    bodies: import('cannon-es').Body[];
    stages: number[];
  };
  internal.bodies.forEach((body, i) => {
    body.position.set(
      FUNNEL.x + (i ? 1 : -1),
      1,
      MARBLE_FINISH_Z - (i ? 0.02 : 0.06),
    );
    body.velocity.set(0, 0, 12);
  });
  assert.equal(r.step().result, null, 'skipping the funnel cannot win');
  internal.stages.fill(2);
  internal.bodies.forEach((body) => {
    body.position.set(FUNNEL.x + 10, 1, MARBLE_FINISH_Z - 0.06);
    body.velocity.set(0, 0, 12);
  });
  assert.equal(
    r.step().result,
    null,
    'a crossing outside the finish opening cannot win',
  );
  internal.bodies.forEach((body, i) => {
    body.position.set(
      FUNNEL.x + (i ? 1 : -1),
      1,
      MARBLE_FINISH_Z - (i ? 0.02 : 0.06),
    );
    body.velocity.set(0, 0, 12);
  });
  const f = r.step();
  assert.equal(f.result?.slot, 1);
  assert.equal(f.result?.reason, 'finish');
  assert.deepEqual(r.step(), f);
  r.destroy();
});

void test('only a marble fully below the funnel outlet enters the finish chute stage', () => {
  const r = new MarbleSimulation(1, 31, LEGACY_MARBLE_COURSE),
    internal = r as unknown as {
      bodies: import('cannon-es').Body[];
      stages: number[];
    };
  internal.stages[0] = 1;
  const body = internal.bodies[0];
  body.position.set(FUNNEL.x, 3.25, FUNNEL.z);
  body.velocity.set(0, 0, 0);
  assert.equal(r.step().marbles[0].stage, 1);
  body.position.set(FUNNEL.x, 2.8, FUNNEL.z);
  body.velocity.set(0, -1, 0);
  assert.equal(r.step().marbles[0].stage, 2);
  r.destroy();
});

void test('wave-section banks retain fast marbles through the new reversing bend', () => {
  const race = new MarbleSimulation(3, 210, LEGACY_MARBLE_COURSE);
  let frame = race.snapshot();
  while (frame.elapsed < 19) {
    frame = race.step();
    assert.ok(
      frame.marbles.every((p) => p.y > -2 && Math.abs(p.x) < 30),
      `escape at ${frame.elapsed}`,
    );
  }
  race.destroy();
});
