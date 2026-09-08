import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { RaceSimulation } from '../lib/race.ts';
import * as track from '../lib/track.ts';
test('moving bumpers change physical position during the race', () => {
  const race = new RaceSimulation(4, 45);
  const before = race.snapshot();
  assert.ok(
    Array.isArray(before.bumpers) && before.bumpers.length >= 3,
    'missing moving pinball section',
  );
  assert.equal(before.gates.length, 2);
  for (let i = 0; i < 30; i++) race.step();
  const after = race.snapshot();
  assert.notDeepEqual(
    after.bumpers.map((b) => b.x),
    before.bumpers.map((b) => b.x),
  );
  const bodies = race as unknown as {
    bumpers: Matter.Body[];
    gates: Matter.Body[];
  };
  assert.equal(after.bumpers[0].x, bodies.bumpers[0].position.x);
  assert.equal(after.gates[0], bodies.gates[0].position.x);
  race.destroy();
});
test('an active water jet accelerates a duck in the marked direction', () => {
  assert.ok(
    Array.isArray(track.BOOSTS) && track.BOOSTS.length >= 2,
    'missing turbo ramps',
  );
  const race = new RaceSimulation(1, 42);
  let frame = race.snapshot();
  for (let i = 0; i < 240 && !frame.boostActive[0]; i++) frame = race.step();
  assert.ok(frame.boostActive[0]);
  const body = (race as unknown as { bodies: Matter.Body[] }).bodies[0];
  const boost = track.BOOSTS[0];
  Matter.Body.setPosition(body, { x: boost.x, y: boost.y });
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  frame = race.step();
  assert.ok(frame.ducks[0].boosted);
  assert.ok(frame.ducks[0].vx > 0.02, 'jet must apply forward motion');
  race.destroy();
});
test('pinball contact produces an outward kick and a visible impact', () => {
  const race = new RaceSimulation(1, 2);
  let frame = race.snapshot();
  assert.ok(frame.bumpers?.length);
  const bumper = frame.bumpers[0];
  const body = (race as unknown as { bodies: Matter.Body[] }).bodies[0];
  Matter.Body.setPosition(body, {
    x: bumper.x + track.RADIUS + track.BUMPERS[0].radius - 1,
    y: bumper.y,
  });
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  frame = race.step();
  assert.ok(frame.bumpers[0].hitAt >= 0);
  assert.ok(frame.ducks[0].vx > 0, 'contact must push the duck away');
  race.destroy();
});
test('a lone duck can leave the sluices without the emergency flush', () => {
  const race = new RaceSimulation(1, 0);
  const body = (race as unknown as { bodies: Matter.Body[] }).bodies[0];
  Matter.Body.setPosition(body, { x: 110, y: 1420 });
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  let frame = race.snapshot();
  while (!frame.result) frame = race.step();
  assert.equal(
    frame.flushing,
    false,
    'sloped sluices must carry a duck toward the opening',
  );
  assert.equal(frame.result.reason, 'finish');
  assert.ok(
    frame.elapsed < 22,
    'the sluice must not hold a lone duck on a flat shelf',
  );
  race.destroy();
});
test('the natural route reaches the pinball bumpers', () => {
  const race = new RaceSimulation(8, 0);
  let frame = race.snapshot(),
    contacts = 0;
  while (!frame.result) {
    frame = race.step();
    if (frame.bumpers.some((b) => b.hitAt >= 0)) contacts++;
  }
  assert.ok(
    contacts > 0,
    'the course must direct ducks through the pinball section',
  );
  race.destroy();
});
test('a duck can win by crossing the finish after thirty seconds', () => {
  const race = new RaceSimulation(1, 9);
  const body = (race as unknown as { bodies: Matter.Body[] }).bodies[0];
  Matter.Body.setStatic(body, true);
  let frame = race.snapshot();
  for (let tick = 0; tick < 31 * 60; tick++) frame = race.step();
  assert.equal(frame.result, null);
  assert.equal(frame.flushing, false);
  Matter.Body.setStatic(body, false);
  Matter.Body.setPosition(body, { x: 480, y: track.FINISH_Y - 8 });
  Matter.Body.setVelocity(body, { x: 0, y: 5 });
  for (let tick = 0; tick < 60 && !frame.result; tick++) frame = race.step();
  assert.equal(frame.result?.reason, 'finish');
  assert.ok(frame.result!.time > 31);
  assert.equal(frame.flushing, false);
  race.destroy();
});
