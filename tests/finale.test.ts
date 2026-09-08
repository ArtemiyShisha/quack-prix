import test from 'node:test';
import assert from 'node:assert/strict';
import { wavePoolState } from '../lib/wave-pool.ts';
import { GATE, RADIUS } from '../lib/track.ts';
import { RaceSimulation } from '../lib/race.ts';

test('the whirlpool keeps flowing through a wide gap at every gate phase', () => {
  for (const phase of [0, 1, 2, 4])
    for (let tick = 0; tick < 600; tick++) {
      const state = wavePoolState(tick / 60, phase);
      assert.ok(state.openings.every((x) => x >= 0.35 && x <= 1));
      const left =
        GATE.centres[0] - state.openings[0] * GATE.travel + GATE.width / 2;
      const right =
        GATE.centres[1] + state.openings[1] * GATE.travel - GATE.width / 2;
      assert.ok(
        right - left > RADIUS * 4,
        'gates must never collect ducks behind a narrow opening',
      );
    }
  assert.notDeepEqual(wavePoolState(0, 1), wavePoolState(1, 1));
});

test('physical sluices use the continuous flow state from the beginning', () => {
  const race = new RaceSimulation(4, 91);
  for (let tick = 0; tick < 120; tick++) {
    const frame = race.step();
    frame.gates.forEach((x, i) =>
      assert.ok(
        Math.abs(
          x -
            (GATE.centres[i] +
              frame.pool.openings[i] * GATE.travel * (i === 0 ? -1 : 1)),
        ) < 1e-8,
      ),
    );
  }
  race.destroy();
});
