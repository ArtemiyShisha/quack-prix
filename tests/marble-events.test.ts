import { LEGACY_MARBLE_COURSE } from '../lib/marble-track.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MarbleSimulation } from '../lib/marble-race.ts';
import * as course from '../lib/marble-track.ts';
import type { Body } from 'cannon-es';
const internals = (r: MarbleSimulation) =>
  r as unknown as { bodies: Body[]; stages: number[]; finishGate: Body };

void test('the side opening drops a marble onto a separate lower route', () => {
  const race = new MarbleSimulation(1, 12, LEGACY_MARBLE_COURSE),
    body = internals(race).bodies[0];
  body.position.set(-2.4, course.mainCentre(37).y + 1.3, 37);
  body.velocity.set(0, 0, 2);
  let f = race.snapshot();
  for (let i = 0; i < 65; i++) f = race.step();
  assert.ok(
    f.marbles[0].y < course.mainCentre(f.marbles[0].z).y - 1,
    'marble must fall through the opening',
  );
  assert.ok(f.marbles[0].shortcut);
  race.destroy();
});

void test('a marble rolls through the lower shortcut and rejoins the main course', () => {
  assert.equal(typeof course.shortcutCentre, 'function');
  const race = new MarbleSimulation(1, 21, LEGACY_MARBLE_COURSE),
    body = internals(race).bodies[0];
  const p = course.shortcutCentre(40);
  body.position.set(p.x, p.y + course.MARBLE_RADIUS + 0.05, p.z);
  body.velocity.set(0, 0, 7);
  let f = race.snapshot();
  for (let i = 0; i < 900 && f.marbles[0].z < 85; i++) f = race.step();
  assert.ok(
    f.marbles[0].z >= 85,
    'shortcut must have an unobstructed physical merge',
  );
  assert.ok(f.marbles[0].y > course.mainCentre(f.marbles[0].z).y - 0.5);
  race.destroy();
});

void test('final barrier varies its physical opening and snapshot uses its actual rotation', () => {
  assert.equal(typeof course.finishGateAngle, 'function');
  assert.ok(
    Math.abs(course.finishGateAngle(0, 0) - course.finishGateAngle(1, 0)) > 0.5,
  );
  const race = new MarbleSimulation(1, 11, LEGACY_MARBLE_COURSE),
    body = internals(race).finishGate;
  for (let i = 0; i < 120; i++) race.step();
  assert.ok(
    Math.abs(
      race.snapshot().finishGateAngle -
        2 * Math.atan2(body.quaternion.y, body.quaternion.w),
    ) < 1e-8,
  );
  race.destroy();
});

void test('both sides of the shortcut join the landing without a seam escape', () => {
  for (const u of [-0.8, -0.5, 0, 0.5, 0.8]) {
    const race = new MarbleSimulation(1, 21, LEGACY_MARBLE_COURSE),
      body = internals(race).bodies[0],
      z = 63;
    const p = course.shortcutCentre(z),
      before = course.shortcutCentre(z - 0.01),
      after = course.shortcutCentre(z + 0.01);
    const dx = after.x - before.x,
      dz = after.z - before.z,
      length = Math.hypot(dx, dz);
    body.position.set(
      p.x + (dz / length) * u * course.shortcutWidth(z),
      p.y + course.troughHeight(u) * 0.28 + course.MARBLE_RADIUS + 0.05,
      p.z - (dx / length) * u * course.shortcutWidth(z),
    );
    body.velocity.set((dx / length) * 12, 0, (dz / length) * 12);
    let f = race.snapshot();
    for (let i = 0; i < 600 && f.marbles[0].z < 85; i++) {
      f = race.step();
      assert.ok(
        f.marbles[0].y > course.mainCentre(f.marbles[0].z).y - 5,
        `fell through merge at u=${u}`,
      );
    }
    assert.ok(f.marbles[0].z >= 85, `merge stalled at u=${u}`);
    race.destroy();
  }
});

void test('the lower intake catches a marble dropping off the outer edge of the opening', () => {
  const race = new MarbleSimulation(1, 21, LEGACY_MARBLE_COURSE),
    body = internals(race).bodies[0],
    z = 36.2;
  body.position.set(-4.2, course.mainCentre(z).y - 1.4, z);
  body.velocity.set(-1.8, -4, 1);
  let f = race.snapshot();
  for (let i = 0; i < 180; i++) {
    f = race.step();
    assert.ok(
      f.marbles[0].y > course.mainCentre(f.marbles[0].z).y - 5,
      'missed the receiving chute',
    );
  }
  race.destroy();
});
