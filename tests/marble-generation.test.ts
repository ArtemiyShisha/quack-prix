import test from 'node:test';
import assert from 'node:assert/strict';
import * as track from '../lib/marble-track.ts';
import { MarbleSimulation } from '../lib/marble-race.ts';
import {
  overviewCamera,
  followCamera,
  finaleCamera,
} from '../lib/marble-camera.ts';
import {
  PerspectiveCamera,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Raycaster,
} from 'three';

function generate(seed: number) {
  assert.equal(
    typeof track.createMarbleCourse,
    'function',
    'course generation is missing',
  );
  return track.createMarbleCourse(seed);
}

void test('fresh race seeds change actual track geometry and section order', () => {
  const courses = Array.from({ length: 20 }, (_, seed) => generate(seed + 100));
  const geometry = new Set(
    courses.map((c) => JSON.stringify(c.TRACK_MESHES.map((m) => m.positions))),
  );
  const sequences = new Set(
    courses.map((c) => c.sections.map((s) => s.kind).join(',')),
  );
  assert.ok(
    geometry.size >= 18,
    'new seeds must create different physical routes',
  );
  assert.ok(sequences.size >= 6, 'courses must vary the order of their events');
});

void test('a seed reproduces the same geometry and never mutates another course', () => {
  const a = generate(310);
  const before = JSON.stringify(a.TRACK_MESHES);
  generate(311);
  const b = generate(310);
  assert.equal(JSON.stringify(b.TRACK_MESHES), before);
  assert.equal(JSON.stringify(a.TRACK_MESHES), before);
  assert.deepEqual(a.sections, b.sections);
});

void test('generated sections connect continuously and stay downhill', () => {
  for (const seed of [1, 42, 100, 310, 999, 0xffffffff]) {
    const c = generate(seed);
    assert.equal(c.sections[0].from, -5);
    assert.equal(c.sections.at(-1)?.to, c.pathLength);
    for (let i = 1; i < c.sections.length; i++)
      assert.equal(c.sections[i - 1].to, c.sections[i].from);
    for (let z = -5; z < c.pathLength; z += 0.25) {
      const p = c.mainCentre(z),
        q = c.mainCentre(z + 0.25);
      assert.ok(q.y < p.y, `uphill section at seed ${seed}, z ${z}`);
      assert.ok(
        Math.hypot(q.x - p.x, q.z - p.z) < 0.3,
        'a join must not create a sideways jump',
      );
      assert.ok(
        c.mainWidth(z) >= 2.1,
        'track must contain the eight-marble field',
      );
    }
  }
});

void test('races use their seed to build a fresh physical course', () => {
  const a = new MarbleSimulation(4, 42),
    b = new MarbleSimulation(4, 43);
  try {
    assert.ok(a.course, 'simulation must expose its current course');
    assert.equal(a.snapshot().courseSeed, 42);
    assert.notDeepEqual(a.course.TRACK_MESHES, b.course.TRACK_MESHES);
    assert.deepEqual(a.course.TRACK_MESHES, generate(42).TRACK_MESHES);
  } finally {
    a.destroy();
    b.destroy();
  }
});

void test('generated physics reproduces the same trace across independently created races', () => {
  const a = new MarbleSimulation(4, 812),
    b = new MarbleSimulation(4, 812);
  try {
    for (let i = 0; i < 120; i++) assert.deepEqual(a.step(), b.step());
  } finally {
    a.destroy();
    b.destroy();
  }
});

void test('following generated courses keeps the visible racing surface unobstructed', () => {
  for (const seed of [24, 42, 310, 1002]) {
    const c = generate(seed);
    const obstacles = c.TRACK_MESHES.filter((m) => m.opacity === undefined).map(
      (part) => {
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          'position',
          new Float32BufferAttribute(part.positions, 3),
        );
        geometry.setIndex(part.indices);
        return new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
      },
    );
    try {
      for (const aspect of [0.6, 1.5])
        for (let z = 0; z < c.pathLength - 12; z += 2) {
          const pose = followCamera(z, aspect, c),
            p = c.mainCentre(z);
          const target = new Vector3(p.x, p.y + track.MARBLE_RADIUS, p.z);
          const ray = new Raycaster(
            pose.position,
            target.clone().sub(pose.position).normalize(),
            0,
            pose.position.distanceTo(target) - track.MARBLE_RADIUS,
          );
          assert.equal(
            ray.intersectObjects(obstacles, false).length,
            0,
            `hidden course seed ${seed}, z ${z}`,
          );
        }
    } finally {
      for (const mesh of obstacles) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }
});

void test('generated courses remain visible in overview, follow and finale cameras', () => {
  for (const seed of [1, 42, 310]) {
    const c = generate(seed);
    for (const aspect of [0.6, 1.5]) {
      const camera = new PerspectiveCamera(43, aspect, 0.1, 1000);
      const check = (
        pose: ReturnType<typeof overviewCamera>,
        points: Vector3[],
      ) => {
        camera.position.copy(pose.position);
        camera.lookAt(pose.target);
        camera.updateMatrixWorld();
        for (const point of points) {
          const p = point.clone().project(camera);
          assert.ok(
            Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.94 && p.z < 1,
            `clipped course seed ${seed} at ${point.toArray().join(',')}, aspect ${aspect}`,
          );
        }
      };
      const vertices: Vector3[] = [];
      for (const mesh of c.TRACK_MESHES)
        for (let i = 0; i < mesh.positions.length; i += 30)
          vertices.push(new Vector3(...mesh.positions.slice(i, i + 3)));
      check(overviewCamera(aspect, c), vertices);
      for (let z = 0; z < c.pathLength - 12; z += 5) {
        const p = c.mainCentre(z);
        check(followCamera(z, aspect, c), [
          new Vector3(p.x, p.y + track.MARBLE_RADIUS, p.z),
        ]);
      }
      check(finaleCamera(aspect, c), [
        new Vector3(c.FUNNEL.x, c.FUNNEL.bottom, c.FUNNEL.z),
        new Vector3(c.FUNNEL.x, 1, c.MARBLE_FINISH_Z),
      ]);
    }
  }
});

void test('different generated courses finish naturally for small and full teams without escapes', () => {
  for (const [count, seed] of [
    [1, 701],
    [1, 42],
    [4, 100],
    [4, 1002],
    [8, 310],
    [1, 2],
    [8, 2],
  ]) {
    const race = new MarbleSimulation(count, seed);
    try {
      let frame = race.snapshot();
      while (!frame.result) {
        frame = race.step();
        for (const p of frame.marbles)
          assert.ok(
            [p.x, p.y, p.z, p.progress].every(Number.isFinite) &&
              p.y > -2 &&
              p.x > race.course.bounds.minX - 2 &&
              p.x < race.course.bounds.maxX + 2 &&
              p.z > race.course.bounds.minZ - 2 &&
              p.z < race.course.bounds.maxZ + 2,
            `escape seed ${seed}, count ${count}, time ${frame.elapsed}, pos ${p.x},${p.y},${p.z}`,
          );
      }
      assert.equal(
        frame.result.reason,
        'finish',
        `stalled course seed ${seed}`,
      );
      assert.ok(frame.result.time < 75);
    } finally {
      race.destroy();
    }
  }
});
