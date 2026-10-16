import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURLING,
  CurlingSimulation,
  distanceToButton,
  type CurlingStone,
} from '../lib/curling.ts';

function finish(count: number, seed: number) {
  const game = new CurlingSimulation(count, seed);
  let frame = game.snapshot();
  for (let tick = 0; tick < 90 * 60 && !frame.result; tick++)
    frame = game.step();
  assert.ok(frame.result, `unfinished round: ${count} stones, seed ${seed}`);
  return { game, frame };
}

test('curling accepts 1–8 equal stones and rejects invalid team sizes', () => {
  for (let count = 1; count <= 8; count++) {
    const frame = new CurlingSimulation(count, 42).snapshot();
    assert.equal(frame.stones.length, count);
    assert.equal(frame.result, null);
    assert.equal(frame.closestSlot, null);
    assert.ok(
      frame.stones.every((s) => !s.delivered && s.vx === 0 && s.vy === 0),
    );
  }
  for (const count of [0, 9, 1.5, NaN])
    assert.throws(() => new CurlingSimulation(count, 42));
});

test('the same seed reproduces a whole curling round; fresh seeds change it', () => {
  const a = finish(8, 42).frame;
  const b = finish(8, 42).frame;
  const c = finish(8, 43).frame;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.stones, c.stones);
});

test('every team size ends with the closest stone after all stones stop', () => {
  for (let count = 1; count <= 8; count++) {
    for (const seed of [1, 42, 310, 904]) {
      const { game, frame } = finish(count, seed);
      assert.equal(frame.delivered, count);
      assert.equal(frame.result?.reason, 'closest');
      assert.equal(frame.activeSlot, null);
      assert.ok(
        frame.stones.every((s) => s.delivered && s.vx === 0 && s.vy === 0),
      );
      const winner = frame.stones[frame.result!.slot];
      const closest = Math.min(...frame.stones.map(distanceToButton));
      assert.ok(Math.abs(distanceToButton(winner) - closest) < 1e-8);
      assert.deepEqual(game.step(), frame);
    }
  }
});

test('shots wait for the previous stones to stop and preserve the assigned order', () => {
  const game = new CurlingSimulation(3, 12);
  let previous = game.snapshot();
  while (!previous.result) {
    const next = game.step();
    if (next.delivered > previous.delivered) {
      assert.equal(next.delivered, previous.delivered + 1);
      assert.ok(previous.stones.every((s) => s.vx === 0 && s.vy === 0));
      assert.equal(next.activeSlot, previous.delivered);
    }
    previous = next;
  }
});

test('spinning stones curve instead of following a straight ray', () => {
  const game = new CurlingSimulation(1, 42);
  const start = game.step().stones[0];
  for (let i = 0; i < 180; i++) game.step();
  const later = game.snapshot().stones[0];
  const straightY = start.y + ((later.x - start.x) * start.vy) / start.vx;
  assert.ok(Math.abs(later.y - straightY) > 0.15);
});

test('a contact transfers momentum and can dislodge a stationary leader', () => {
  const game = new CurlingSimulation(2, 5);
  const internals = game as unknown as {
    stones: CurlingStone[];
    delivered: number;
  };
  internals.delivered = 2;
  Object.assign(internals.stones[0], {
    delivered: true,
    x: CURLING.targetX,
    y: 0,
    vx: 0,
    vy: 0,
  });
  Object.assign(internals.stones[1], {
    delivered: true,
    x: CURLING.targetX - 0.43,
    y: 0,
    vx: 2,
    vy: 0,
  });
  const after = game.step();
  assert.ok(
    after.stones[0].vx > 1.5,
    'the stationary stone receives the incoming impulse',
  );
  assert.ok(
    after.stones[1].vx < 0.3,
    'the thrown stone loses most of its forward momentum',
  );
  for (let i = 0; i < 120; i++) game.step();
  assert.ok(game.snapshot().stones[0].x > CURLING.targetX + 0.3);
});

test('stones remain finite and inside the sheet, including boundary contacts', () => {
  const game = new CurlingSimulation(8, 1000);
  let frame = game.snapshot();
  while (!frame.result) {
    frame = game.step();
    for (const stone of frame.stones) {
      assert.ok(
        [stone.x, stone.y, stone.vx, stone.vy, stone.angle].every(
          Number.isFinite,
        ),
      );
      assert.ok(
        stone.x >= CURLING.stoneRadius &&
          stone.x <= CURLING.length - CURLING.stoneRadius,
      );
      assert.ok(Math.abs(stone.y) <= CURLING.width / 2 - CURLING.stoneRadius);
    }
  }
});

test('snapshot values cannot mutate the live simulation or its finished result', () => {
  const game = new CurlingSimulation(2, 42);
  const snapshot = game.snapshot();
  snapshot.stones[0].x = 999;
  assert.equal(game.snapshot().stones[0].x, CURLING.releaseX);
  const finished = finish(1, 42);
  finished.frame.result!.slot = 999;
  assert.equal(finished.game.snapshot().result!.slot, 0);
});

test('equal distances use seeded tie ranks rather than favouring the first throw', () => {
  const winners = new Set<number>();
  for (let seed = 0; seed < 16; seed++) {
    const game = new CurlingSimulation(2, seed);
    const internals = game as unknown as {
      stones: CurlingStone[];
      delivered: number;
      ranks: number[];
    };
    internals.delivered = 2;
    internals.stones.forEach((stone, slot) =>
      Object.assign(stone, {
        delivered: true,
        x: CURLING.targetX,
        y: slot === 0 ? -0.6 : 0.6,
      }),
    );
    let frame = game.snapshot();
    for (let step = 0; step < 120 && !frame.result; step++) frame = game.step();
    assert.equal(frame.result?.slot, internals.ranks.indexOf(0));
    winners.add(frame.result!.slot);
  }
  assert.equal(winners.size, 2);
});

test('a stone touching the side or end board reflects back inside the ice', () => {
  const game = new CurlingSimulation(1, 5);
  const internals = game as unknown as {
    stones: CurlingStone[];
    delivered: number;
  };
  internals.delivered = 1;
  Object.assign(internals.stones[0], {
    delivered: true,
    x: CURLING.length - CURLING.stoneRadius - 0.001,
    y: CURLING.width / 2 - CURLING.stoneRadius - 0.001,
    vx: 2,
    vy: 2,
  });
  const stone = game.step().stones[0];
  assert.ok(stone.vx < 0 && stone.vy < 0);
  assert.ok(stone.x <= CURLING.length - CURLING.stoneRadius);
  assert.ok(stone.y <= CURLING.width / 2 - CURLING.stoneRadius);
});
