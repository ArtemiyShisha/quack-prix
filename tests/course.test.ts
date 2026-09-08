import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { RaceSimulation } from '../lib/race.ts';
import { BOWLS, PIPES, RADIUS } from '../lib/track.ts';
const bodies = (r: RaceSimulation) =>
  (r as unknown as { bodies: Matter.Body[] }).bodies;
test('the bowls have open two-duck drains and connected downstream tubes', () => {
  assert.equal(BOWLS.length, 4);
  assert.equal(PIPES.length, BOWLS.length);
  BOWLS.forEach((b, i) => {
    assert.ok(b.drain * 2 > RADIUS * 4);
    assert.ok(b.radius > RADIUS * 9);
    assert.deepEqual(
      { x: PIPES[i][0].x, y: PIPES[i][0].y },
      { x: b.x, y: b.y },
    );
    if (i + 1 < BOWLS.length) {
      const next = BOWLS[i + 1],
        end = PIPES[i].at(-1)!;
      assert.ok(
        Math.hypot(end.x - next.x, end.y - next.y) < next.radius - RADIUS,
      );
    }
  });
});
test('gravity stays smooth and local throughout free rolling, with no timed launches', () => {
  const race = new RaceSimulation(1, 91),
    body = bodies(race)[0],
    b = BOWLS[0];
  let first: { vx: number; vy: number } | null = null;
  for (let tick = 0; tick < 600; tick++) {
    Matter.Body.setPosition(body, { x: b.x + 120, y: b.y });
    Matter.Body.setVelocity(body, { x: 0, y: 5 });
    const d = race.step().ducks[0];
    assert.ok(Math.hypot(d.vx, d.vy - 5) < 0.5);
    if (first) {
      assert.ok(Math.abs(d.vx - first.vx) < 1e-8);
      assert.ok(Math.abs(d.vy - first.vy) < 1e-8);
    } else first = { vx: d.vx, vy: d.vy };
  }
  race.destroy();
});
test('a lone duck keeps orbiting the bowl before physically entering its drain', () => {
  const r = new RaceSimulation(1, 91),
    b = BOWLS[0];
  let f = r.snapshot(),
    angle = Math.atan2(f.ducks[0].y - b.y, f.ducks[0].x - b.x),
    travel = 0,
    speeds: number[] = [];
  while (!f.ducks[0].inTube && f.elapsed < 20) {
    f = r.step();
    const d = f.ducks[0];
    if (d.inTube) break;
    const next = Math.atan2(d.y - b.y, d.x - b.x);
    travel += Math.abs(
      Math.atan2(Math.sin(next - angle), Math.cos(next - angle)),
    );
    angle = next;
    speeds.push(Math.hypot(d.vx, d.vy));
  }
  assert.ok(f.ducks[0].inTube);
  assert.ok(travel > Math.PI * 2);
  speeds.sort((a, b) => a - b);
  assert.ok(speeds[Math.floor(speeds.length / 2)] > 3);
  r.destroy();
});
test('the drain accepts a duck immediately at any race time and transit cannot hit surface ducks', () => {
  for (const phase of [0, 90, 270]) {
    const r = new RaceSimulation(1, 2),
      body = bodies(r)[0],
      mass = body.mass,
      b = BOWLS[0];
    Matter.Body.setStatic(body, true);
    for (let tick = 0; tick < phase; tick++) r.step();
    Matter.Body.setStatic(body, false);
    Matter.Body.setPosition(body, { x: b.x + 4, y: b.y });
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    let f = r.step();
    assert.ok(f.ducks[0].inTube);
    assert.equal(body.collisionFilter.mask, 0);
    while (f.ducks[0].stage === 0 && f.elapsed < 20) f = r.step();
    assert.equal(f.ducks[0].stage, 1);
    assert.equal(body.collisionFilter.mask, 0xffffffff);
    assert.equal(body.isStatic, false);
    assert.equal(body.mass, mass);
    r.destroy();
  }
});
test('physical duck contact changes the trajectory', () => {
  const r = new RaceSimulation(2, 91),
    b = BOWLS[0],
    ducks = bodies(r);
  ducks.forEach((body, i) => {
    Matter.Body.setPosition(body, { x: b.x + 90 + i * 42, y: b.y });
    Matter.Body.setVelocity(body, { x: i ? -3 : 3, y: 0 });
  });
  assert.ok(r.step().ducks[0].vx < 0);
  r.destroy();
});
test('a natural orbit race can finish after thirty seconds', () => {
  const r = new RaceSimulation(1, 0);
  let f = r.snapshot();
  for (let tick = 0; tick < 31 * 60; tick++) f = r.step();
  assert.equal(f.result, null);
  assert.equal(f.flushing, false);
  while (!f.result) f = r.step();
  assert.equal(f.result.reason, 'finish');
  assert.ok(f.result.time > 31);
  r.destroy();
});

test('the first physical drain arrival leads the tube even when two enter in the same step', () => {
  const r = new RaceSimulation(2, 91);
  const internals = r as unknown as {
    bodies: Matter.Body[];
    stages: number[];
    transits: { distance: number }[];
  };
  const b = BOWLS[3];
  internals.stages.fill(3);
  internals.bodies.forEach((body, i) => {
    Matter.Body.setPosition(body, { x: b.x + (i ? -35 : 40), y: b.y });
    Matter.Body.setVelocity(body, { x: i ? 8 : -8, y: 0 });
  });
  let f = r.step();
  assert.ok(f.ducks.every((d) => d.inTube));
  assert.ok(
    internals.transits[1].distance - internals.transits[0].distance >=
      2 * RADIUS,
  );
  while (!f.result) f = r.step();
  assert.equal(f.result.slot, 1);
  r.destroy();
});
