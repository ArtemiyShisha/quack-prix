import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  TRACK_MESHES,
  FUNNEL,
  MARBLE_FINISH_Z,
  MARBLE_RADIUS,
  mainCentre,
} from '../lib/marble-track.ts';

void test('overview frames the entire track at desktop and portrait aspect ratios', async () => {
  const cameraModule = await import('../lib/marble-camera.ts');
  for (const aspect of [0.6, 1, 1.5, 2]) {
    const pose = cameraModule.overviewCamera(aspect);
    const camera = new THREE.PerspectiveCamera(43, aspect, 0.1, 600);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
    for (const part of TRACK_MESHES)
      for (let i = 0; i < part.positions.length; i += 3) {
        const p = new THREE.Vector3(...part.positions.slice(i, i + 3)).project(
          camera,
        );
        assert.ok(
          Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.94 && p.z < 1,
          `clipped track at aspect ${aspect}`,
        );
      }
  }
});

void test('finale camera sees the funnel interior and finish past the approach track', async () => {
  const { finaleCamera } = await import('../lib/marble-camera.ts');
  const obstacles = TRACK_MESHES.filter(
    (part) => part.opacity === undefined,
  ).map((part) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    g.setIndex(part.indices);
    return new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
  });
  for (const aspect of [0.6, 1.5]) {
    const pose = finaleCamera(aspect),
      camera = new THREE.PerspectiveCamera(43, aspect, 0.1, 600);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
    const targets = [
      new THREE.Vector3(FUNNEL.x, 1, MARBLE_FINISH_Z),
      new THREE.Vector3(FUNNEL.x, 1.8, FUNNEL.z + 4),
      new THREE.Vector3(FUNNEL.x, 1.6, FUNNEL.z + 8),
    ];
    for (const r of [2, 5, 8])
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        // The outer entrance sector lies underneath the feed chute, outside the open bowl.
        if (r === 8 && a >= 1.5 * Math.PI) continue;
        targets.push(
          new THREE.Vector3(
            FUNNEL.x + Math.cos(a) * r,
            FUNNEL.bottom + 0.055 * r * r + MARBLE_RADIUS,
            FUNNEL.z + Math.sin(a) * r,
          ),
        );
      }
    for (const p of targets) {
      const screen = p.clone().project(camera);
      assert.ok(
        Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94,
        'finale clipped',
      );
      const ray = new THREE.Raycaster(
        camera.position,
        p.clone().sub(camera.position).normalize(),
        0,
        camera.position.distanceTo(p) - MARBLE_RADIUS,
      );
      assert.equal(
        ray.intersectObjects(obstacles, false).length,
        0,
        `hidden finale point ${p.toArray()}`,
      );
    }
  }
  for (const m of obstacles) {
    m.geometry.dispose();
    m.material.dispose();
  }
});

void test('extended course adds descending waves and further turns', () => {
  assert.ok(FUNNEL.z >= 100);
  assert.ok(MARBLE_FINISH_Z >= 130);
  const slopes = [];
  for (let z = 58; z < 82; z += 0.25)
    slopes.push((mainCentre(z + 0.25).y - mainCentre(z).y) / 0.25);
  assert.ok(
    Math.max(...slopes) - Math.min(...slopes) > 0.2,
    'wave slopes vary',
  );
  assert.ok(Math.max(...slopes) < 0, 'waves remain downhill');
  assert.ok(
    mainCentre(74).x > 3 && mainCentre(87).x < -3,
    'additional left/right turns',
  );
});

void test('each downhill section stays in frame with a clear line of sight while following', async () => {
  const { followCamera, finaleCamera } =
    await import('../lib/marble-camera.ts');
  const meshes = TRACK_MESHES.filter((p) => p.opacity === undefined).map(
    (part) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(part.positions, 3),
      );
      g.setIndex(part.indices);
      return new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      );
    },
  );
  for (const aspect of [0.6, 1.5])
    for (let z = 0; z <= FUNNEL.z; z += 2) {
      const pose =
        z >= FUNNEL.z - 12 ? finaleCamera(aspect) : followCamera(z, aspect);
      const camera = new THREE.PerspectiveCamera(43, aspect, 0.1, 650);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateMatrixWorld();
      const centre = mainCentre(z),
        p = new THREE.Vector3(centre.x, centre.y + MARBLE_RADIUS, z);
      const screen = p.clone().project(camera);
      assert.ok(
        Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94,
        `clipped section at ${z}`,
      );
      const ray = new THREE.Raycaster(
        camera.position,
        p.clone().sub(camera.position).normalize(),
        0,
        camera.position.distanceTo(p) - MARBLE_RADIUS,
      );
      assert.equal(
        ray.intersectObjects(meshes, false).length,
        0,
        `hidden section at ${z}`,
      );
    }
  for (const m of meshes) {
    m.geometry.dispose();
    m.material.dispose();
  }
});
