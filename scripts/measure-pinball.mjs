import {
  PinballSimulation,
  PINBALL,
  initPinballPhysics,
} from '../lib/pinball.ts';
await initPinballPhysics();
const samples = Number(process.argv[2] ?? 5),
  firstSeed = Number(process.argv[3] ?? 1000);
if (
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 100 ||
  !Number.isInteger(firstSeed)
)
  throw new Error(
    'Usage: node --experimental-strip-types scripts/measure-pinball.mjs [samples 1–100] [seed]',
  );
for (const count of [1, 2, 4, 8]) {
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const game = new PinballSimulation(count, firstSeed + i);
    let frame = game.snapshot();
    const startExits = Array(count).fill(null);
    const slow = Array(count).fill(0);
    const returnSides = [0, 0];
    const launchEvents = [0, 0, 0];
    const lastLaunch = [-10, -10, -10];
    let peakSpeed = 0,
      longestStartStall = 0;
    while (!frame.result && frame.elapsed <= PINBALL.maxSeconds + 0.1) {
      const before = frame.elapsed;
      const prior = frame;
      frame = game.step();
      for (let side = 0; side < 3; side++)
        if (frame.kickerHits[side] > lastLaunch[side]) {
          launchEvents[side]++;
          lastLaunch[side] = frame.kickerHits[side];
        }
      for (const ball of frame.balls) {
        returnSides[ball.x < 0 ? 0 : 1] +=
          ball.loops - prior.balls[ball.slot].loops;
        if (ball.z > -5.5 && startExits[ball.slot] === null)
          startExits[ball.slot] = frame.elapsed;
        peakSpeed = Math.max(peakSpeed, Math.hypot(ball.vx, ball.vy, ball.vz));
        slow[ball.slot] =
          ball.z < -5.5 && Math.hypot(ball.vx, ball.vz) < 0.15
            ? slow[ball.slot] + frame.elapsed - before
            : 0;
        longestStartStall = Math.max(longestStartStall, slow[ball.slot]);
      }
    }
    rows.push({
      seed: firstSeed + i,
      time: frame.result?.time,
      reason: frame.result?.reason,
      contacts: frame.contacts,
      returns: frame.returns,
      jumps: frame.jumps,
      returnSides,
      launchEvents,
      recoveries: frame.recoveries,
      startExits,
      longestStartStall,
      peakSpeed,
    });
    game.destroy();
  }
  const times = rows.map((r) => r.time ?? Infinity).sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      count,
      samples,
      min: times[0],
      max: times.at(-1),
      median: times[Math.floor(times.length / 2)],
      fallback: rows.filter((r) => r.reason !== 'finish').length,
      recoveries: rows.reduce((sum, r) => sum + r.recoveries, 0),
      startRemaining: rows.reduce(
        (sum, r) => sum + r.startExits.filter((t) => t === null).length,
        0,
      ),
      lastStartExit: Math.max(
        ...rows.flatMap((r) => r.startExits.filter((t) => t !== null)),
      ),
      longestStartStall: Math.max(...rows.map((r) => r.longestStartStall)),
      peakSpeed: Math.max(...rows.map((r) => r.peakSpeed)),
      meanContacts: rows.reduce((sum, r) => sum + r.contacts, 0) / samples,
      meanReturns: rows.reduce((sum, r) => sum + r.returns, 0) / samples,
      returnSides: [0, 1].map((side) =>
        rows.reduce((sum, r) => sum + r.returnSides[side], 0),
      ),
      meanJumps: rows.reduce((sum, r) => sum + r.jumps, 0) / samples,
      roundsWithJumps: rows.filter((r) => r.jumps > 0).length,
      roundsWithReturns: rows.filter((r) => r.returns > 0).length,
      rows,
    }),
  );
}
