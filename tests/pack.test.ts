import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation } from '../lib/race.ts';

const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

test('the second stage preserves a compact pack into the cascades', () => {
  for (const count of [4, 8]) {
    const spans: number[] = [],
      addedSpans: number[] = [],
      gaps: number[] = [];
    let unfinished = 0;
    for (let seed = 0; seed < 50; seed++) {
      const race = new RaceSimulation(count, seed);
      let frame = race.snapshot(),
        first: number | null = null,
        measured = false;
      const entries: (number | undefined)[] = Array(count).fill(undefined),
        exits: (number | undefined)[] = Array(count).fill(undefined);
      while (!frame.result) {
        frame = race.step();
        for (const duck of frame.ducks) {
          if (duck.y >= 571 && entries[duck.slot] === undefined)
            entries[duck.slot] = frame.elapsed;
          if (duck.y >= 900 && exits[duck.slot] === undefined)
            exits[duck.slot] = frame.elapsed;
        }
        const order = [...frame.ducks].sort((a, b) => b.y - a.y);
        if (first === null && order[0].y >= 900) first = frame.elapsed;
        if (first !== null && !measured && frame.elapsed >= first + 3) {
          measured = true;
          gaps.push(order[0].y - order[Math.floor(count / 2)].y);
        }
      }
      const complete = exits.filter(
        (time): time is number => time !== undefined,
      );
      if (complete.length < count) unfinished++;
      else {
        const span = Math.max(...complete) - Math.min(...complete);
        const entered = entries as number[];
        spans.push(span);
        addedSpans.push(span - (Math.max(...entered) - Math.min(...entered)));
      }
      race.destroy();
    }
    assert.ok(
      unfinished <= 5,
      `${count} ducks: ${unfinished}/50 races still had an unfinished stage-two exit`,
    );
    assert.ok(
      median(spans) <= 6,
      `${count} ducks: median exit spread exceeds six seconds`,
    );
    assert.ok(
      median(addedSpans) <= 2.5,
      `${count} ducks: stage two amplifies the incoming spread too much`,
    );
    assert.ok(
      median(gaps) <= 250,
      `${count} ducks: the middle of the pack drops too far behind the leader on the next cascade`,
    );
  }
});

test('soft buoys absorb a downward impact instead of launching the duck back uphill', async () => {
  const { default: Matter } = await import('matter-js');
  const { BUMPERS, RADIUS } = await import('../lib/track.ts');
  const race = new RaceSimulation(1, 42),
    bumper = race.snapshot().bumpers[0];
  const body = (race as unknown as { bodies: Matter.Body[] }).bodies[0];
  Matter.Body.setPosition(body, {
    x: bumper.x,
    y: bumper.y - BUMPERS[0].radius - RADIUS + 1,
  });
  Matter.Body.setVelocity(body, { x: 0, y: 8 });
  const frame = race.step();
  assert.ok(frame.bumpers[0].hitAt >= 0);
  assert.ok(frame.ducks[0].vy > -1.5, 'a buoy must absorb most upward rebound');
  race.destroy();
});
