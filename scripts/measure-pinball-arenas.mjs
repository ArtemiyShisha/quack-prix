import { PinballArenaSimulation } from '../lib/pinball-arenas.ts';
import { initPinballPhysics, PINBALL } from '../lib/pinball.ts';
import { PINBALL_MAPS } from '../lib/pinball-maps.ts';

const samples = Number(process.argv[2] ?? 8);
const firstSeed = Number(process.argv[3] ?? 1000);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 100 ||
  !Number.isSafeInteger(firstSeed)
)
  throw new Error(
    'Usage: node --experimental-strip-types scripts/measure-pinball-arenas.mjs [samples 1–100] [firstSeed]',
  );
await initPinballPhysics();
for (const { id: map } of PINBALL_MAPS) {
  for (const count of [1, 2, 4, 8]) {
    const rows = [];
    for (let i = 0; i < samples; i++) {
      const game = new PinballArenaSimulation(count, firstSeed + i, map);
      try {
        let frame = game.snapshot(),
          peakSpeed = 0;
        const stages = new Set(),
          springHits = Array(game.map.springs.length).fill(0),
          lastSpring = springHits.map(() => -10);
        while (
          !frame.result &&
          frame.elapsed <= (game.map.maxSeconds ?? PINBALL.maxSeconds) + 0.1
        ) {
          frame = game.step();
          for (const ball of frame.balls)
            peakSpeed = Math.max(
              peakSpeed,
              Math.hypot(ball.vx, ball.vy, ball.vz),
            );
          for (const stage of frame.stages) stages.add(stage);
          frame.kickerHits.forEach((at, index) => {
            if (at > lastSpring[index]) springHits[index]++;
            lastSpring[index] = at;
          });
        }
        rows.push({
          seed: firstSeed + i,
          time: frame.result?.time,
          reason: frame.result?.reason,
          contacts: frame.contacts,
          returns: frame.returns,
          jumps: frame.jumps,
          displaced: frame.displaced,
          recoveries: frame.recoveries,
          lateOpening: frame.elapsed >= (game.map.releaseAt ?? 65),
          peakSpeed,
          stages: [...stages],
          springHits,
        });
      } finally {
        game.destroy();
      }
    }
    const times = rows.map((r) => r.time ?? Infinity).sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        map,
        count,
        samples,
        firstSeed,
        min: times[0],
        median: times[Math.floor(samples / 2)],
        max: times.at(-1),
        fallback: rows.filter((r) => r.reason !== 'finish').length,
        recoveries: rows.reduce((s, r) => s + r.recoveries, 0),
        lateOpening: rows.filter((r) => r.lateOpening).length,
        meanContacts: rows.reduce((s, r) => s + r.contacts, 0) / samples,
        roundsWithReturns: rows.filter((r) => r.returns > 0).length,
        roundsWithJumps: rows.filter((r) => r.jumps > 0).length,
        roundsWithSprings: rows.filter((r) => r.springHits.some((n) => n > 0))
          .length,
        meanDisplaced: rows.reduce((s, r) => s + r.displaced, 0) / samples,
        rows,
      }),
    );
  }
}
