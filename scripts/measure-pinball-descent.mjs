import { PinballArenaSimulation } from '../lib/pinball-arenas.ts';
import { initPinballPhysics } from '../lib/pinball.ts';

const samples = Number(process.argv[2] ?? 8),
  firstSeed = Number(process.argv[3] ?? 1000),
  count = Number(process.argv[4] ?? 8);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 100 ||
  !Number.isSafeInteger(firstSeed) ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > 8
)
  throw new Error(
    'Usage: measure-pinball-descent.mjs [samples 1–100] [firstSeed] [count 1–8]',
  );
await initPinballPhysics();
const rows = [];
for (let seed = firstSeed; seed < firstSeed + samples; seed++) {
  const game = new PinballArenaSimulation(count, seed, 'descent');
  try {
    let frame = game.snapshot(),
      firstDrop = null,
      peakSpeed = 0;
    const levelTimes = Array.from({ length: count }, () => [0, null, null]);
    while (!frame.result && frame.elapsed < game.map.maxSeconds + 0.1) {
      frame = game.step();
      frame.balls.forEach((ball) => {
        peakSpeed = Math.max(peakSpeed, Math.hypot(ball.vx, ball.vy, ball.vz));
        for (let level = 1; level <= frame.stages[ball.slot]; level++) {
          if (levelTimes[ball.slot][level] === null)
            levelTimes[ball.slot][level] = frame.elapsed;
          if (level === 1 && firstDrop === null) firstDrop = ball.slot;
        }
      });
    }
    rows.push({
      seed,
      count,
      time: frame.result?.time,
      reason: frame.result?.reason,
      recoveries: frame.recoveries,
      contacts: frame.contacts,
      ballContacts: frame.ballContacts,
      firstDrop,
      winner: frame.result?.slot,
      levelTimes,
      peakSpeed,
      finalPositions:
        frame.result?.reason === 'finish'
          ? undefined
          : frame.balls.map((b) => ({
              slot: b.slot,
              x: b.x,
              y: b.y,
              z: b.z,
              stage: frame.stages[b.slot],
            })),
    });
  } finally {
    game.destroy();
  }
}
const times = rows.map((r) => r.time).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    samples,
    firstSeed,
    count,
    min: times[0],
    median: times[Math.floor(samples / 2)],
    max: times.at(-1),
    finishes: rows.filter((r) => r.reason === 'finish').length,
    recoveries: rows.reduce((n, r) => n + r.recoveries, 0),
    firstDropLost: rows.filter((r) => r.firstDrop !== r.winner).length,
    rows,
  }),
);
