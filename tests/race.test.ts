import test from 'node:test';
import assert from 'node:assert/strict';
import { BOWLS } from '../lib/track.ts';
import {
  RaceSimulation,
  firstCrossing,
  FLUSH_SECONDS,
  MAX_SECONDS,
} from '../lib/race.ts';
const duck = (slot: number, y: number) => ({ slot, x: 480, y, angle: 0 });
test('finish detects fast crossings and compares substep crossing times', () => {
  assert.equal(
    firstCrossing(
      [duck(0, 90), duck(1, 80)],
      [duck(0, 130), duck(1, 100)],
      100,
      [1, 0],
    ),
    0,
  );
  assert.equal(
    firstCrossing(
      [duck(0, 90), duck(1, 90)],
      [duck(0, 110), duck(1, 110)],
      100,
      [1, 0],
    ),
    1,
  );
  assert.equal(firstCrossing([duck(0, 110)], [duck(0, 90)], 100, [0]), null);
});
test('fresh race contains precisely 1–8 physical slots with equal sizes', () => {
  for (let n = 1; n <= 8; n++) {
    const race = new RaceSimulation(n, 12);
    const state = race.snapshot();
    assert.equal(state.ducks.length, n);
    assert.deepEqual(
      state.ducks.map((d) => d.slot),
      Array.from({ length: n }, (_, i) => i),
    );
    assert.equal(state.result, null);
    race.destroy();
  }
  assert.throws(() => new RaceSimulation(0, 1));
  assert.throws(() => new RaceSimulation(9, 1));
});
test('fixed seed yields the same physical trace, independent of previous races', () => {
  function run() {
    const r = new RaceSimulation(8, 904);
    for (let i = 0; i < 600; i++) r.step();
    const state = r.snapshot();
    r.destroy();
    return state;
  }
  assert.deepEqual(run(), run());
});
test('new physical seeds change trajectories', () => {
  const a = new RaceSimulation(8, 91),
    b = new RaceSimulation(8, 92);
  for (let i = 0; i < 240; i++) {
    a.step();
    b.step();
  }
  assert.notDeepEqual(a.snapshot().ducks, b.snapshot().ducks);
  a.destroy();
  b.destroy();
});
test('race keeps a generous emergency bound and freezes its first result', () => {
  for (let n = 1; n <= 8; n++)
    for (let seed = 0; seed < 6; seed++) {
      const race = new RaceSimulation(n, seed);
      let frame = race.snapshot();
      for (let t = 0; t < MAX_SECONDS * 60 + 1 && !frame.result; t++)
        frame = race.step();
      assert.ok(frame.result, `n=${n} seed=${seed}`);
      assert.ok(frame.elapsed <= MAX_SECONDS + 0.001);
      assert.ok(frame.result.slot >= 0 && frame.result.slot < n);
      assert.deepEqual(race.step(), frame);
      race.destroy();
    }
});
test('a completely jammed race triggers the shared flush and explicit distance fallback', async () => {
  const { default: Matter } = await import('matter-js');
  const race = new RaceSimulation(4, 118);
  const internals = race as unknown as {
    bodies: Matter.Body[];
    tieRanks: number[];
  };
  internals.bodies.forEach((body, i) => {
    Matter.Body.setPosition(body, {
      x: BOWLS[0].x + 100 + (i === 2 ? -30 : 0),
      y: BOWLS[0].y,
    });
    Matter.Body.setStatic(body, true);
  });
  let frame = race.snapshot();
  for (let t = 0; t < FLUSH_SECONDS * 60 - 1; t++) frame = race.step();
  assert.equal(frame.flushing, false);
  frame = race.step();
  assert.equal(frame.flushing, true);
  assert.equal(frame.elapsed, FLUSH_SECONDS);
  while (!frame.result) frame = race.step();
  assert.deepEqual(frame.result, {
    slot: 2,
    time: MAX_SECONDS,
    reason: 'distance',
  });
  assert.deepEqual(race.step(), frame);
  race.destroy();
  const tie = new RaceSimulation(4, 118);
  const tied = tie as unknown as { bodies: Matter.Body[]; tieRanks: number[] };
  tied.bodies.forEach((body, i) => {
    Matter.Body.setPosition(body, { x: BOWLS[0].x + 100, y: BOWLS[0].y });
    Matter.Body.setStatic(body, true);
  });
  let equal = tie.snapshot();
  while (!equal.result) equal = tie.step();
  assert.equal(equal.result.slot, tied.tieRanks.indexOf(0));
  tie.destroy();
});
