import { PinballArenaSimulation } from '../lib/pinball-arenas.ts';
import { initPinballPhysics, PINBALL } from '../lib/pinball.ts';
import { REACTOR_BOWL_ENTRY } from '../lib/pinball-reactor.ts';

const samples = Number(process.argv[2] ?? 16);
const firstSeed = Number(process.argv[3] ?? 1000);
const count = Number(process.argv[4] ?? 8);
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
    'Usage: measure-pinball-reactor.mjs [samples 1–100] [firstSeed] [count 1–8]',
  );
await initPinballPhysics();
const rows = [];
for (let seed = firstSeed; seed < firstSeed + samples; seed++) {
  const game = new PinballArenaSimulation(count, seed, 'reactor');
  try {
    let frame = game.snapshot(),
      firstBowl = null,
      firstNearGoal = null,
      peakSpeed = 0,
      springShots = 0,
      maxSlowNearWall = 0;
    const history = [],
      lanes = new Set(),
      lowerVisitors = new Set(),
      slowNearWall = Array(count).fill(0);
    const goal = game.map.goal;
    while (!frame.result && frame.elapsed < PINBALL.maxSeconds + 0.1) {
      const before = frame;
      frame = game.step();
      for (const ball of frame.balls) {
        peakSpeed = Math.max(peakSpeed, Math.hypot(ball.vx, ball.vy, ball.vz));
        if (ball.z > goal.z + 3) lowerVisitors.add(ball.slot);
        // A geometric diagnostic, not a collision detector: a slow sphere
        // lingering in the annulus immediately beside either wall face.
        const radius = Math.hypot(ball.x - goal.x, ball.z - goal.z);
        slowNearWall[ball.slot] =
          radius > 2.25 && radius < 3.5 && Math.hypot(ball.vx, ball.vz) < 0.7
            ? slowNearWall[ball.slot] + frame.elapsed - before.elapsed
            : 0;
        maxSlowNearWall = Math.max(maxSlowNearWall, slowNearWall[ball.slot]);
        if (ball.z > REACTOR_BOWL_ENTRY && firstBowl === null)
          firstBowl = ball.slot;
        if (
          Math.hypot(ball.x - goal.x, ball.z - goal.z) < 1.65 &&
          firstNearGoal === null
        )
          firstNearGoal = ball.slot;
        if (before.balls[ball.slot].z < -6.5 && ball.z >= -6.5)
          lanes.add(ball.x < 0 ? 'bypass' : 'rotor');
      }
      springShots += frame.kickerHits.filter(
        (hit, i) => hit > before.kickerHits[i],
      ).length;
      const ordered = frame.balls
        .map((ball) => ({
          slot: ball.slot,
          distance: Math.hypot(ball.x - goal.x, ball.z - goal.z),
        }))
        .sort((a, b) => a.distance - b.distance);
      history.push({ at: frame.elapsed, leader: ordered[0].slot });
    }
    const lastThird = history.filter((h) => h.at >= (frame.elapsed * 2) / 3);
    let current = lastThird[0]?.leader,
      candidate = current,
      candidateSince = 0,
      lateChanges = 0;
    for (const h of lastThird) {
      if (h.leader !== candidate) {
        candidate = h.leader;
        candidateSince = h.at;
      }
      if (candidate !== current && h.at - candidateSince >= 0.25) {
        current = candidate;
        lateChanges++;
      }
    }
    rows.push({
      seed,
      count,
      time: frame.result?.time,
      reason: frame.result?.reason,
      contacts: frame.contacts,
      ballContacts: frame.ballContacts,
      goalReturns: frame.goalReturns,
      recoveries: frame.recoveries,
      firstBowl,
      firstNearGoal,
      winner: frame.result?.slot,
      winnerChangedInLastThird: lastThird[0]?.leader !== frame.result?.slot,
      lateChanges,
      lanes: [...lanes],
      peakSpeed,
      lowerVisitors: lowerVisitors.size,
      springShots,
      maxSlowNearWall,
    });
  } finally {
    game.destroy();
  }
}
const times = rows.map((r) => r.time).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    count,
    samples,
    firstSeed,
    min: times[0],
    median: times[Math.floor(samples / 2)],
    max: times.at(-1),
    finishes: rows.filter((r) => r.reason === 'finish').length,
    recoveries: rows.reduce((n, r) => n + r.recoveries, 0),
    firstBowlLost: rows.filter((r) => r.firstBowl !== r.winner).length,
    firstNearGoalLost: rows.filter((r) => r.firstNearGoal !== r.winner).length,
    winnerChangedInLastThird: rows.filter((r) => r.winnerChangedInLastThird)
      .length,
    roundsWithLateChanges: rows.filter((r) => r.lateChanges > 0).length,
    roundsWithBallContacts: rows.filter((r) => r.ballContacts > 0).length,
    roundsWithBothLanes: rows.filter((r) => r.lanes.length > 1).length,
    roundsWithLowerVisits: rows.filter((r) => r.lowerVisitors > 0).length,
    averageLowerVisitors:
      rows.reduce((n, r) => n + r.lowerVisitors, 0) / samples,
    roundsWithSpringShots: rows.filter((r) => r.springShots > 0).length,
    maxSlowNearWall: Math.max(...rows.map((r) => r.maxSlowNearWall)),
    rows,
  }),
);
