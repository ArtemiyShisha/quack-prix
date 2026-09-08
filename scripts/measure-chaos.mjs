import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { RaceSimulation, MAX_SECONDS } = await import(
  pathToFileURL(process.argv[2])
);
const start = Number(process.argv[3] ?? 0),
  runs = Number(process.argv[4] ?? 50);
const counts = process.argv[5]
  ? process.argv[5].split(',').map(Number)
  : [1, 4, 8];
const quant = (a, q = 0.5) =>
  [...a].sort((x, y) => x - y)[
    Math.min(a.length - 1, Math.floor(a.length * q))
  ];
const round = (x) => +x.toFixed(2);
const results = [];
for (const n of counts) {
  const duration = [],
    speeds = [],
    events = [],
    lateChanges = [];
  let flush = 0,
    distance = 0,
    thirdWins = 0,
    slow = 0,
    samples = 0;
  for (let seed = start; seed < start + runs; seed++) {
    const race = new RaceSimulation(n, seed);
    let f = race.snapshot(),
      third = null,
      lastLeader = null,
      changes = 0;
    while (!f.result) {
      f = race.step();
      assert.ok(f.elapsed <= MAX_SECONDS + 0.001);
      for (const d of f.ducks) {
        assert.ok([d.x, d.y, d.angle, d.vx, d.vy].every(Number.isFinite));
        assert.ok(
          d.x > 80 && d.x < 880,
          `wall escape ${n}/${seed}/${f.elapsed}: ${d.x}`,
        );
      }
      if (Math.round(f.elapsed * 60) % 6 === 0) {
        const order = [...f.ducks].sort((a, b) => b.y - a.y),
          leader = order[0].slot;
        if (third === null && order[0].y >= 1430) third = leader;
        if (third !== null && lastLeader !== null && leader !== lastLeader)
          changes++;
        lastLeader = leader;
        for (const d of f.ducks)
          if (d.y >= 900 && d.y < 1430) {
            const speed = Math.hypot(d.vx, d.vy);
            speeds.push(speed);
            samples++;
            slow += Number(speed < 1);
          }
      }
    }
    flush += Number(f.flushing);
    distance += Number(f.result.reason === 'distance');
    thirdWins += Number(third === f.result.slot);
    duration.push(f.result.time);
    events.push(f.chaos?.serial ?? 0);
    lateChanges.push(changes);
    race.destroy();
  }
  results.push({
    participants: n,
    runs,
    seedRange: [start, start + runs - 1],
    minTime: round(quant(duration, 0)),
    medianTime: round(quant(duration)),
    p90Time: round(quant(duration, 0.9)),
    maxTime: round(quant(duration, 1)),
    medianSpeedBeforePool: round(quant(speeds)),
    slowPercentBeforePool: round((100 * slow) / samples),
    medianChaosEvents: quant(events),
    medianLateLeaderChanges: quant(lateChanges),
    thirdStageLeaderWinPercent: (100 * thirdWins) / runs,
    flush,
    distance,
  });
}
console.log(JSON.stringify(results, null, 2));
