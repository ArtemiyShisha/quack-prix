import { RaceSimulation } from '../lib/race.ts';
import { BOWLS, RADIUS, HEIGHT } from '../lib/track.ts';
import assert from 'node:assert/strict';
const runs = Number(process.argv[2] ?? 25),
  start = Number(process.argv[3] ?? 1000),
  counts = (process.argv[4] ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const quant = (a, q = 0.5) =>
    [...a].sort((a, b) => a - b)[
      Math.min(a.length - 1, Math.floor(a.length * q))
    ],
  round = (x) => +x.toFixed(2);
let out = [];
for (const n of counts) {
  let times = [],
    speeds = [],
    groups = [],
    companions = 0,
    samples = 0,
    slow = 0,
    thirdWins = 0,
    flush = 0,
    distance = 0,
    changes = 0,
    observed = 0;
  for (let seed = start; seed < start + runs; seed++) {
    const r = new RaceSimulation(n, seed);
    let f = r.snapshot(),
      third = null,
      entry = Array(4).fill(null),
      exit = Array(4).fill(null);
    while (!f.result) {
      f = r.step();
      assert.ok(f.elapsed <= 60);
      for (const d of f.ducks) {
        assert.ok(
          [d.x, d.y, d.vx, d.vy, d.progress, d.angle].every(Number.isFinite),
        );
        assert.ok(d.x > 0 && d.x < 960 && d.y > 0 && d.y < HEIGHT);
        if (d.stage < BOWLS.length && !d.inTube) {
          const b = BOWLS[d.stage];
          assert.ok(Math.hypot(d.x - b.x, d.y - b.y) < b.radius - RADIUS - 5);
        }
        if (d.stage > 0 && d.stage < 4 && entry[d.stage] === null)
          entry[d.stage] = d.slot;
        if (d.stage < 4 && d.inTube && exit[d.stage] === null)
          exit[d.stage] = d.slot;
      }
      if (third === null)
        third = f.ducks.find((d) => d.stage === 2)?.slot ?? null;
      if (Math.round(f.elapsed * 60) % 6 === 0 && f.elapsed > 1) {
        const live = f.ducks.filter((d) => !d.inTube && d.stage < 4),
          group = BOWLS.map((_, i) => live.filter((d) => d.stage === i).length);
        groups.push(Math.max(...group));
        const leader = [...f.ducks].sort((a, b) => b.progress - a.progress)[0];
        if (!leader.inTube && leader.stage < 4) {
          samples++;
          companions += Number(group[leader.stage] >= Math.ceil(n / 2));
        }
        for (const d of live) {
          const speed = Math.hypot(d.vx, d.vy);
          speeds.push(speed);
          slow += Number(speed < 1);
        }
      }
    }
    for (let stage = 1; stage < 4; stage++)
      if (entry[stage] !== null && exit[stage] !== null) {
        observed++;
        changes += Number(entry[stage] !== exit[stage]);
      }
    times.push(f.result.time);
    thirdWins += Number(third === f.result.slot);
    flush += Number(f.flushing);
    distance += Number(f.result.reason === 'distance');
    r.destroy();
  }
  out.push({
    n,
    runs,
    start,
    min: round(quant(times, 0)),
    median: round(quant(times)),
    p90: round(quant(times, 0.9)),
    max: round(quant(times, 1)),
    medianSpeed: round(quant(speeds)),
    slowPercent: round((slow * 100) / speeds.length),
    medianSameBowl: quant(groups),
    leaderWithHalfTeamPercent: round((companions * 100) / samples),
    thirdEntryWinPercent: (thirdWins * 100) / runs,
    changedExitOrderPercent: round((changes * 100) / observed),
    flush,
    distance,
  });
}
console.log(JSON.stringify(out, null, 2));
