import type { PinballArena, ArenaRail } from './pinball-maps.ts';
import type { Point3 } from './pinball.ts';

export const REACTOR_GOAL = { x: 0, z: 4.4, radius: 1.02, y: -0.42 };
export const REACTOR_BOWL_ENTRY = -1.4;

export function reactorHeight(x: number, z: number) {
  const bowl = 0.042 * (x * x + (z - REACTOR_GOAL.z) ** 2);
  const approach = 1.72 + (-2 - z) * 0.32 + x * x * 0.018;
  const t = Math.max(0, Math.min(1, (z + 3) / 1.5));
  const blend = t * t * (3 - 2 * t);
  return approach * (1 - blend) + bowl * blend;
}

export const REACTOR_ISLAND = [
  [0, -8.45],
  [-0.85, -7.6],
  [-1.35, -6.4],
  [-1.25, -4.9],
  [-0.65, -3.6],
  [0, -2.9],
  [0.65, -3.6],
  [1.25, -4.9],
  [1.35, -6.4],
  [0.85, -7.6],
] as const;

export function createReactorArena(fairStart = false): PinballArena {
  const goal = REACTOR_GOAL;
  const height = fairStart
    ? (x: number, z: number) => {
        const t = Math.max(0, Math.min(1, (z + 11.4) / 2));
        // A planar runway keeps every starting slot at the same potential
        // energy. Blend back into the existing field before the island.
        return reactorHeight(x * t * t * (3 - 2 * t), z);
      }
    : reactorHeight;
  const boundary: Point3[] = Array.from({ length: 144 }, (_, i) => {
    const angle = (i / 144) * Math.PI * 2;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const radius =
      s >= 0
        ? 6.8
        : 1 /
          Math.pow(
            Math.pow(Math.abs(c) / 6.8, 6) + Math.pow(-s / 15, 6),
            1 / 6,
          );
    const x = c * radius,
      originalZ = goal.z + s * radius,
      z =
        fairStart && originalZ < -8.8
          ? -8.8 + (originalZ + 8.8) * 4
          : originalZ;
    return { x, y: height(x, z), z };
  });
  // The goal is an actual hole in the same mesh used by Rapier and Three.
  // No invisible finish line, covered floor or coordinate-based capture.
  const positions: number[] = [],
    indices: number[] = [];
  const rings = 64,
    count = boundary.length;
  for (let row = 0; row <= rings; row++) {
    const t = row / rings;
    boundary.forEach((edge) => {
      const dx = edge.x - goal.x,
        dz = edge.z - goal.z;
      const length = Math.hypot(dx, dz);
      const radius = goal.radius + (length - goal.radius) * t;
      const x = goal.x + (dx / length) * radius;
      const z = goal.z + (dz / length) * radius;
      positions.push(x, height(x, z), z);
    });
  }
  for (let row = 0; row < rings; row++)
    for (let col = 0; col < count; col++) {
      const a = row * count + col,
        next = row * count + ((col + 1) % count);
      const b = a + count,
        bn = next + count;
      indices.push(a, next, b, next, bn, b);
    }
  const point = (x: number, z: number) => ({ x, y: height(x, z), z });
  const guide = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    kind: ArenaRail['kind'] = 'guide',
  ): ArenaRail => ({
    a: point(ax, az),
    b: point(bx, bz),
    height: 1.05,
    width: 0.24,
    kind,
  });
  const rails: ArenaRail[] = boundary.map((a, i) => ({
    a,
    b: boundary[(i + 1) % count],
    height: 2.05,
    width: 0.24,
    kind: 'outer',
  }));
  REACTOR_ISLAND.forEach(([x, z], i) => {
    const next = REACTOR_ISLAND[(i + 1) % REACTOR_ISLAND.length];
    rails.push(guide(x, z, next[0], next[1], 'island'));
  });
  // Both lanes aim across the shared landing. Their collision, not a chosen
  // trajectory, decides how the pack enters the final bowl.
  rails.push(
    guide(-6.6, -4.0, -5.4, -2.0),
    guide(-5.4, -2.0, -3.3, -0.2),
    guide(-3.3, -0.2, -1.8, 0.55),
    guide(6.6, -3.0, 5.1, -1.0),
    guide(5.1, -1.0, 3.4, 0.15),
    guide(3.4, 0.15, 1.8, 0.7),
  );
  if (fairStart)
    for (const side of [-1, 1])
      rails.push({
        ...guide(side * 3.62, -14.25, side * 3.62, -13.85),
        width: 0.24,
        height: 2.8,
      });
  // The horseshoe faces away from the approach. A direct downhill shot must
  // first go around it and rejoin the pack before attempting the hole.
  return {
    id: 'reactor',
    height,
    floor: [{ positions, indices, edges: [boundary] }],
    boundary,
    rails,
    start: fairStart
      ? {
          z: -14.5,
          width: 5.8,
          gate: {
            z: -14.05,
            width: 7,
            height: 1,
            depth: 0.16,
            opensAt: 0.55,
            openingDuration: 0.22,
            lift: 1.7,
          },
        }
      : { z: -9.5, width: 5.8 },
    exitZ: goal.z,
    finishZ: goal.z,
    finishHalfWidth: goal.radius,
    goal: { ...goal },
    bumpers: [
      { x: -3.05, z: -6.4, radius: 0.68, strength: 3.1 },
      { x: -4.2, z: -3.8, radius: 0.6, strength: 3.1 },
      { x: -4.55, z: 3.65, radius: 0.65, strength: 4.3 },
      { x: 4.55, z: 3.65, radius: 0.65, strength: 4.3 },
      { x: -2.25, z: 8.35, radius: 0.55, strength: 4.0 },
      { x: 2.25, z: 8.35, radius: 0.55, strength: 4.0 },
    ],
    motors: [
      {
        id: 'shortcut-rotor',
        x: 3.45,
        z: -5.8,
        length: 3.35,
        width: 0.38,
        height: 0.72,
        speed: -2.25,
        angle: 0.3,
        cross: true,
      },
      {
        id: 'merge-rotor',
        x: 0,
        z: 0.5,
        length: 2.7,
        width: 0.32,
        height: 0.62,
        speed: 1.9,
        angle: 1.0,
        elevation: 0.16,
      },
      {
        id: 'exit-gate',
        x: goal.x,
        z: goal.z,
        length: 3.7,
        width: 0.3,
        height: 0.65,
        speed: 2.3,
        swing: 1.2,
        angle: 0,
        elevation: 0.25,
        gate: true,
      },
      {
        id: 'goal-crown',
        x: goal.x,
        z: goal.z,
        length: 5.7,
        width: 0.24,
        height: 0.82,
        speed: 0.38,
        angle: 0,
        gate: true,
        rebound: {
          speed: 4.8,
          restitution: 0.88,
          cooldown: 0.25,
          outsideOnly: true,
        },
        arc: {
          radius: 2.85,
          from: Math.PI * 0.82,
          sweep: Math.PI * 1.36,
          hold: 4,
        },
      },
    ],
    springs: [-1, 1].map((side) => ({
      x: side * 4.05,
      z: 7.1,
      radius: 0.9,
      direction: { x: -side * 0.65, y: 0.08, z: -1 },
      speed: 6.4,
      period: 3.8,
      activeFor: 2.5,
    })),
    arms: [],
    platforms: [],
    blocks: [],
  };
}
