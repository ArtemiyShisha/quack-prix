import test from 'node:test';
import assert from 'node:assert/strict';
import { ChaosClock } from '../lib/chaos.ts';
import { RaceSimulation } from '../lib/race.ts';

test('fresh random launch directions recur throughout the race and replay with a seed', () => {
  function sample(seed: number) {
    const clock = new ChaosClock(seed, 8),
      events = [];
    for (let tick = 1; tick <= 1800; tick++) {
      const event = clock.step(tick);
      if (event) events.push(event);
    }
    return events;
  }
  const events = sample(91);
  assert.ok(events.length >= 16 && events.length <= 30);
  assert.deepEqual(events, sample(91));
  assert.notDeepEqual(events, sample(92));
  for (let i = 1; i < events.length; i++)
    assert.ok(events[i].at - events[i - 1].at <= 2);
  assert.ok(events.flatMap((e) => e.kicks).some((k) => k.vy < -6));
  assert.ok(events.flatMap((e) => e.kicks).some((k) => k.vy > 6));
  assert.ok(events.every((e) => e.kicks.length === 8));
  assert.notDeepEqual(events[0].kicks, events[1].kicks);
});

test('chaos events launch bodies visibly and reverse rotors without angle jumps', () => {
  const race = new RaceSimulation(8, 91);
  let frame = race.snapshot(),
    events = 0;
  for (let i = 0; i < 600 && !frame.result; i++) {
    const previous = frame;
    frame = race.step();
    for (let rotor = 0; rotor < frame.rotorAngles.length; rotor++)
      assert.ok(
        Math.abs(frame.rotorAngles[rotor] - previous.rotorAngles[rotor]) < 0.08,
      );
    if (frame.chaos.serial !== previous.chaos.serial) {
      events++;
      assert.ok(frame.ducks.every((d) => d.kick?.at === frame.chaos.at));
      assert.ok(frame.ducks.some((d) => Math.abs(d.vy) > 5));
    }
  }
  assert.ok(events >= 5);
  race.destroy();
});

test('ducks keep moving briskly before the whirlpool and receive new launches in the finale', () => {
  const speeds: number[] = [];
  let lateEvents = 0;
  for (let seed = 0; seed < 8; seed++) {
    const race = new RaceSimulation(8, seed);
    let frame = race.snapshot();
    while (!frame.result) {
      const serial = frame.chaos.serial;
      frame = race.step();
      if (serial !== frame.chaos.serial && frame.ducks.some((d) => d.y > 1430))
        lateEvents++;
      if (Math.round(frame.elapsed * 60) % 6 === 0)
        for (const duck of frame.ducks)
          if (duck.y > 900 && duck.y < 1430)
            speeds.push(Math.hypot(duck.vx, duck.vy));
    }
    race.destroy();
  }
  speeds.sort((a, b) => a - b);
  assert.ok(speeds.length > 100);
  assert.ok(
    speeds[Math.floor(speeds.length / 2)] > 3,
    'the cascades must not become a viscous crawl',
  );
  assert.ok(speeds.filter((speed) => speed < 1).length / speeds.length < 0.2);
  assert.ok(
    lateEvents > 24,
    'random launches must continue after the third section',
  );
});

test('strong launches cannot push a duck into the side walls at a ramp junction', () => {
  const race = new RaceSimulation(5, 1059);
  let frame = race.snapshot();
  while (!frame.result) {
    frame = race.step();
    assert.ok(frame.ducks.every((d) => d.x >= 92 && d.x <= 868));
  }
  assert.equal(frame.result.reason, 'finish');
  race.destroy();
});
