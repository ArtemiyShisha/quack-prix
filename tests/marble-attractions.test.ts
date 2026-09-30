import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from 'cannon-es';
import { createMarbleCourse, MARBLE_RADIUS } from '../lib/marble-track.ts';
import { MarbleSimulation } from '../lib/marble-race.ts';
import * as paths from '../lib/marble-path.ts';

void test('new courses have a broad silhouette and spend a substantial distance turning', () => {
  for (const seed of [24, 42, 310, 701, 1000, 1002]) {
    const course = createMarbleCourse(seed);
    const points = [];
    let turning = 0;
    for (let z = 0; z < (course.pathLength ?? course.FUNNEL.z); z++) {
      const a = course.mainCentre(z),
        b = course.mainCentre(z + 1);
      points.push(a.x);
      turning += Number(Math.abs(b.x - a.x) > 0.45 || b.z < a.z);
    }
    assert.ok(
      Math.max(...points) - Math.min(...points) >= 28,
      `narrow straight course seed ${seed}`,
    );
    assert.ok(
      turning / points.length > 0.3,
      `too much straight running seed ${seed}`,
    );
  }
});

void test('new seeds produce three compact course shapes with real returning routes', () => {
  const courses = Array.from({ length: 24 }, (_, seed) =>
    createMarbleCourse(seed),
  );
  assert.equal(
    new Set(courses.map((c) => c.style)).size,
    3,
    'course shapes are still just one stretched lane',
  );
  for (const course of courses) {
    let backwards = 0;
    const points = [];
    for (let s = 0; s < course.pathLength; s++) {
      const a = course.mainCentre(s),
        b = course.mainCentre(s + 1);
      points.push(a.z);
      backwards += Number(b.z < a.z);
    }
    assert.ok(
      backwards > course.pathLength * 0.2,
      'a course must contain returning bends',
    );
    assert.ok(
      Math.max(...points) - Math.min(...points) < 90,
      'course footprint is still stretched',
    );
  }
});

void test('the next race rejects seeds that would repeat the previous course shape', () => {
  assert.equal(
    typeof paths.nextMarbleSeed,
    'function',
    'fresh race selection still allows consecutive identical shapes',
  );
  const draws = [0, 1, 2, 2, 3];
  const source = () => {
    const seed = draws.shift();
    assert.notEqual(seed, undefined);
    return seed!;
  };
  const next = paths.nextMarbleSeed(0, source);
  assert.equal(next, 2);
  assert.equal(paths.nextMarbleSeed(next, source), 3);
});

void test('large moving obstacles occupy the racing lane and continue changing during a race', () => {
  const race = new MarbleSimulation(4, 42);
  try {
    const course = race.course;
    assert.ok(
      course.ROTATORS?.length >= 3,
      'a windmill section needs several real rotating obstacles',
    );
    assert.ok(
      course.ROTATORS.every(
        (r) => r.length >= 5 && r.height >= MARBLE_RADIUS * 3,
      ),
    );
    assert.ok(
      course.BUMPERS.every(
        (b) => b.radius >= MARBLE_RADIUS * 2 && b.amplitude >= 1.4,
      ),
    );
    const first = race.snapshot();
    for (let i = 0; i < 45; i++) race.step();
    const second = race.snapshot();
    assert.equal(first.rotorAngles.length, course.ROTATORS.length);
    assert.notDeepEqual(first.rotorAngles, second.rotorAngles);
  } finally {
    race.destroy();
  }
});

void test('a rotating crossbar physically redirects a marble compared with an open lane', () => {
  const gated = new MarbleSimulation(1, 42),
    open = new MarbleSimulation(1, 42);
  try {
    assert.ok(gated.course.ROTATORS?.length, 'physical crossbars are missing');
    const descriptor = gated.course.ROTATORS[0];
    type Internals = {
      bodies: import('cannon-es').Body[];
      rotators: import('cannon-es').Body[];
      world: import('cannon-es').World;
    };
    const a = gated as unknown as Internals,
      b = open as unknown as Internals;
    for (const body of b.rotators) b.world.removeBody(body);
    const start = gated.course.mainCentre(descriptor.distance - 1.5),
      after = gated.course.mainCentre(descriptor.distance - 1.49);
    const heading = Math.atan2(after.x - start.x, after.z - start.z);
    a.rotators[0].quaternion.setFromAxisAngle(Vec3.UNIT_Y, heading);
    for (const internals of [a, b]) {
      const body = internals.bodies[0],
        p = start;
      body.position.set(
        p.x + Math.cos(heading),
        p.y + MARBLE_RADIUS + 0.1,
        p.z - Math.sin(heading),
      );
      body.velocity.set(Math.sin(heading) * 6, 0, Math.cos(heading) * 6);
    }
    for (let i = 0; i < 45; i++) {
      gated.step();
      open.step();
    }
    const p = gated.snapshot().marbles[0],
      q = open.snapshot().marbles[0];
    assert.ok(
      Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > 1,
      'crossbar has no meaningful physical effect',
    );
  } finally {
    gated.destroy();
    open.destroy();
  }
});

void test('the wider turning mesh keeps all floor triangles consistently oriented', () => {
  for (const seed of [24, 42, 310, 701, 1000, 1002]) {
    const course = createMarbleCourse(seed);
    for (const mesh of course.TRACK_MESHES.filter(
      (part) => part.edges.length === 2,
    ))
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices
          .slice(i, i + 3)
          .map((v) => mesh.positions.slice(v * 3, v * 3 + 3));
        const normalY =
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        assert.ok(normalY > 0, `folded floor at seed ${seed}`);
      }
  }
});
