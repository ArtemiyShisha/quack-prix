import test from 'node:test';
import assert from 'node:assert/strict';
import type { Body, World } from 'cannon-es';
import {
  ICE,
  IceSimulation,
  iceExitFraction,
  iceRadiusAt,
} from '../lib/ice-floe.ts';

function complete(count: number, seed: number) {
  const game = new IceSimulation(count, seed);
  let frame = game.snapshot();
  for (let step = 0; step < 16 * 60 && !frame.result; step++)
    frame = game.step();
  assert.ok(frame.result, `count=${count}, seed=${seed} did not finish`);
  return { game, frame };
}

type Internals = {
  bodies: Body[];
  world: World;
  ranks: number[];
  windAt: (time: number) => { x: number; z: number };
};

test('ice accepts 1–8 identical physical ducks and rejects invalid counts', () => {
  for (let count = 1; count <= 8; count++) {
    const game = new IceSimulation(count, 100);
    const frame = game.snapshot();
    const bodies = (game as unknown as Internals).bodies;
    assert.equal(frame.remaining, count);
    assert.equal(frame.result, null);
    assert.ok(
      frame.iceDucks.every(
        (duck) => duck.alive && Math.hypot(duck.x, duck.z) < frame.iceRadius,
      ),
    );
    assert.ok(
      bodies.every(
        (body) =>
          body.mass === 1 &&
          body.shapes[0].boundingSphereRadius === ICE.duckRadius,
      ),
    );
    game.destroy();
  }
  for (const count of [0, 9, 1.5, NaN])
    assert.throws(() => new IceSimulation(count, 1));
});

test('the ice melts continuously after the initial clash and disappears at fifteen seconds', () => {
  assert.equal(iceRadiusAt(0), ICE.radius);
  assert.equal(iceRadiusAt(ICE.meltStarts), ICE.radius);
  assert.equal(iceRadiusAt(ICE.meltsAt), 0);
  assert.equal(iceRadiusAt(100), 0);
  for (let time = ICE.meltStarts; time < ICE.meltsAt; time += 0.1) {
    assert.ok(iceRadiusAt(time + 0.1) < iceRadiusAt(time));
  }
});

test('the same seed reproduces contacts, falls and winner; new seeds change the round', () => {
  const a = complete(8, 904).frame;
  assert.deepEqual(complete(8, 904).frame, a);
  assert.notDeepEqual(complete(8, 905).frame.iceDucks, a.iceDucks);
});

test('every team size finishes by melting, with the last survivor as winner', () => {
  for (let count = 1; count <= 8; count++) {
    for (const seed of [0, 1, 42, 100, 310, 904, 0xffffffff]) {
      const { game, frame } = complete(count, seed);
      assert.ok(frame.result!.time <= ICE.meltsAt);
      assert.equal(frame.result!.reason, 'survivor');
      assert.ok(frame.result!.slot >= 0 && frame.result!.slot < count);
      assert.ok(frame.remaining <= 1);
      const winner = frame.iceDucks[frame.result!.slot];
      if (frame.remaining === 1) assert.equal(winner.alive, true);
      else
        assert.ok(
          frame.iceDucks.every(
            (duck) => duck.eliminatedAt! <= winner.eliminatedAt! + 1e-10,
          ),
        );
      assert.deepEqual(game.step(), frame);
      game.destroy();
    }
  }
});

test('full teams clash immediately and real contacts change trajectories', () => {
  const game = new IceSimulation(8, 42),
    ghost = new IceSimulation(8, 42);
  for (const body of (ghost as unknown as Internals).bodies)
    body.collisionFilterMask = 1;
  for (let step = 0; step < 75; step++) {
    game.step();
    ghost.step();
  }
  assert.ok(game.snapshot().contacts >= 4);
  assert.equal(ghost.snapshot().contacts, 0);
  assert.notDeepEqual(game.snapshot().iceDucks, ghost.snapshot().iceDucks);
  game.destroy();
  ghost.destroy();
});

test('a head-on collision reverses both ducks rather than sending them through each other', () => {
  const game = new IceSimulation(2, 1);
  const internals = game as unknown as Internals;
  internals.windAt = () => ({ x: 0, z: 0 });
  internals.bodies.forEach((body, slot) => {
    body.position.set(slot === 0 ? -0.62 : 0.62, ICE.duckRadius, 0);
    body.velocity.set(slot === 0 ? 2 : -2, 0, 0);
  });
  for (let step = 0; step < 20 && game.snapshot().contacts === 0; step++)
    game.step();
  const ducks = game.snapshot().iceDucks;
  assert.ok(ducks[0].vx < -0.5 && ducks[1].vx > 0.5);
  assert.ok(game.snapshot().contacts > 0);
  game.destroy();
});

test('crossing the edge removes a duck from collisions and cannot be undone', () => {
  const game = new IceSimulation(3, 42);
  const internals = game as unknown as Internals;
  internals.bodies[0].position.set(ICE.radius - 0.005, ICE.duckRadius, 0);
  internals.bodies[0].velocity.set(5, 0, 0);
  let frame = game.step();
  assert.equal(frame.iceDucks[0].alive, false);
  assert.ok(frame.iceDucks[0].eliminatedAt! > 0);
  assert.equal(internals.world.bodies.includes(internals.bodies[0]), false);
  internals.bodies[0].position.set(0, ICE.duckRadius, 0);
  frame = game.step();
  assert.equal(frame.iceDucks[0].alive, false);
  game.destroy();
});

test('edge crossings compare moments within a physics step, including a melting edge', () => {
  assert.ok(
    Math.abs(iceExitFraction({ x: 3, z: 0 }, { x: 5, z: 0 }, 4, 4) - 0.5) <
      1e-10,
  );
  assert.ok(
    Math.abs(iceExitFraction({ x: 3.5, z: 0 }, { x: 3.5, z: 0 }, 4, 3) - 0.5) <
      1e-10,
  );
  assert.equal(iceExitFraction({ x: 4, z: 0 }, { x: 5, z: 0 }, 4, 4), 0);
  const game = new IceSimulation(2, 42);
  const internals = game as unknown as Internals;
  internals.windAt = () => ({ x: 0, z: 0 });
  internals.bodies[0].position.set(ICE.radius - 0.002, ICE.duckRadius, 0);
  internals.bodies[1].position.set(-ICE.radius + 0.02, ICE.duckRadius, 0);
  internals.bodies[0].velocity.set(5, 0, 0);
  internals.bodies[1].velocity.set(-5, 0, 0);
  const frame = game.step();
  assert.equal(
    frame.result?.slot,
    1,
    'the later fall wins when both leave within one substep',
  );
  assert.ok(frame.iceDucks[0].eliminatedAt! < frame.iceDucks[1].eliminatedAt!);
  game.destroy();
});

test('exactly simultaneous falls use seeded tie ranks rather than array order', () => {
  const winners = new Set<number>();
  for (let seed = 0; seed < 10; seed++) {
    const game = new IceSimulation(2, seed);
    const internals = game as unknown as Internals;
    internals.windAt = () => ({ x: 0, z: 0 });
    internals.bodies.forEach((body, slot) => {
      body.position.set(
        slot === 0 ? ICE.radius - 0.01 : -ICE.radius + 0.01,
        ICE.duckRadius,
        0,
      );
      body.velocity.set(slot === 0 ? 5 : -5, 0, 0);
    });
    const frame = game.step();
    assert.equal(frame.result?.slot, internals.ranks.indexOf(1));
    winners.add(frame.result!.slot);
    game.destroy();
  }
  assert.equal(winners.size, 2);
});

test('snapshots stay finite, do not expose mutable state and cleanup removes physical bodies', () => {
  const game = new IceSimulation(8, 1000);
  const original = game.snapshot();
  original.iceDucks[0].x = 999;
  assert.notEqual(game.snapshot().iceDucks[0].x, 999);
  let frame = game.snapshot();
  while (!frame.result) {
    frame = game.step();
    for (const duck of frame.iceDucks)
      assert.ok(
        [duck.x, duck.y, duck.z, duck.vx, duck.vz].every(Number.isFinite),
      );
  }
  frame.result!.slot = 999;
  assert.notEqual(game.snapshot().result!.slot, 999);
  game.destroy();
  assert.equal((game as unknown as Internals).world.bodies.length, 0);
});
