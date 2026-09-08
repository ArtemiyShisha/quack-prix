import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { RaceSimulation } from '../lib/race.ts';
import { wavePoolState } from '../lib/wave-pool.ts';
import { POOL, GATE } from '../lib/track.ts';

test('the pool fills once on arrival and then releases through alternating sides', () => {
  const idle = wavePoolState(null, 0);
  assert.equal(idle.phase, 'waiting');
  const filling = wavePoolState(POOL.fillSeconds / 2, 0);
  assert.equal(filling.phase, 'filling');
  assert.equal(filling.openSide, null);
  const first = wavePoolState(POOL.fillSeconds + 0.7, 0);
  const second = wavePoolState(
    POOL.fillSeconds + POOL.releaseSeconds + POOL.resetSeconds + 0.7,
    0,
  );
  assert.equal(first.phase, 'releasing');
  assert.equal(first.openSide, 0);
  assert.equal(second.openSide, 1);
  assert.ok(first.opening > 0.9);
});

test('a first physical arrival starts one shared pool cycle', () => {
  const race = new RaceSimulation(4, 91);
  const bodies = (race as unknown as { bodies: Matter.Body[] }).bodies;
  bodies.forEach((body) => Matter.Body.setStatic(body, true));
  let frame = race.step();
  assert.equal(frame.pool.phase, 'waiting');
  Matter.Body.setPosition(bodies[0], { x: 200, y: POOL.triggerY + 2 });
  frame = race.step();
  assert.equal(frame.pool.phase, 'filling');
  for (let i = 0; i < 90; i++) frame = race.step();
  const age = frame.pool.age;
  Matter.Body.setPosition(bodies[1], { x: 600, y: POOL.triggerY + 2 });
  frame = race.step();
  assert.ok(frame.pool.age > age, 'a late arrival must not restart the pool');
  while (frame.pool.phase !== 'releasing' || frame.pool.opening < 0.9)
    frame = race.step();
  const open = frame.pool.openSide!;
  assert.ok(
    Math.abs(frame.gates[open] - GATE.centres[open]) > GATE.travel * 0.9,
  );
  race.destroy();
});

test('the final stretch allows frequent reversals of the third-stage leader', () => {
  for (const count of [4, 8]) {
    let retained = 0;
    for (let seed = 0; seed < 60; seed++) {
      const race = new RaceSimulation(count, seed);
      let frame = race.snapshot(),
        leader: number | null = null;
      while (!frame.result) {
        frame = race.step();
        if (leader === null) {
          const front = [...frame.ducks].sort((a, b) => b.y - a.y)[0];
          if (front.y >= 1430) leader = front.slot;
        }
      }
      retained += Number(frame.result.slot === leader);
      race.destroy();
    }
    assert.ok(
      retained <= 36,
      `${count} ducks: third-stage leader retained ${retained}/60 wins; the final stretch must still matter`,
    );
  }
});
