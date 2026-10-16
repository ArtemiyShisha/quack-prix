import { CatmullRomCurve3, Vector3 } from 'three';
import { createReactorArena } from './pinball-reactor.ts';
import { arenaLevelOpening } from './pinball-maps.ts';
import type {
  ArenaFloor,
  ArenaGoal,
  ArenaLevel,
  ArenaMotor,
  ArenaRail,
  PinballArena,
} from './pinball-maps.ts';
import type { Point3 } from './pinball.ts';

export const DESCENT_LEVEL_NAMES = ['Реактор', 'Турбина', 'Ядро'] as const;
export const DESCENT_RELEASE_AT = 95;
export const DESCENT_MAX_SECONDS = 180;

export function descentViewProgress(
  levels: ArenaLevel[],
  frame: {
    stages: number[];
    balls: (Point3 & { slot: number })[];
  } | null,
) {
  let progress = 0;
  for (const ball of frame?.balls ?? []) {
    const stage = frame!.stages[ball.slot];
    if (!stage || stage >= levels.length) continue;
    const from = levels[stage - 1].goal.z,
      to = levels[stage].entry.z,
      t = Math.max(0, Math.min(1, (ball.z - from) / (to - from)));
    progress = Math.max(progress, stage - 1 + t * t * (3 - 2 * t));
  }
  return progress;
}

function bowl(
  name: string,
  colour: string,
  centreZ: number,
  goal: ArenaGoal,
  entry: Point3,
  height: PinballArena['height'],
) {
  const count = 112,
    rings = 36,
    boundary = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2,
        x = 6.6 * Math.cos(a),
        z = centreZ + 7 * Math.sin(a);
      return { x, y: height(x, z), z };
    }),
    positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rings; row++)
    for (const edge of boundary) {
      const dx = edge.x - goal.x,
        dz = edge.z - goal.z,
        length = Math.hypot(dx, dz),
        radius = goal.radius + ((length - goal.radius) * row) / rings,
        x = goal.x + (dx * radius) / length,
        z = goal.z + (dz * radius) / length;
      positions.push(x, height(x, z), z);
    }
  for (let row = 0; row < rings; row++)
    for (let col = 0; col < count; col++) {
      const a = row * count + col,
        next = row * count + ((col + 1) % count);
      indices.push(a, next, a + count, next, next + count, a + count);
    }
  const level: ArenaLevel = {
    name,
    colour,
    goal,
    entry,
    boundary,
    wallHeight: 3.4,
    opening: {
      x: entry.x < 0 ? -2 : 3.3,
      halfWidth: 2.35,
      maxZ: centreZ - 4.3,
    },
  };
  const floor: ArenaFloor = { positions, indices, edges: [boundary], colour };
  const rails: ArenaRail[] = boundary.flatMap((a, i) =>
    arenaLevelOpening(level, a, boundary[(i + 1) % count])
      ? []
      : [
          {
            a,
            b: boundary[(i + 1) % count],
            height: level.wallHeight!,
            width: 0.24,
            kind: 'outer',
          },
        ],
  );
  return { level, floor, rails };
}

function chute(points: Point3[]) {
  const path = new CatmullRomCurve3(
      points.map((p) => new Vector3(p.x, p.y, p.z)),
      false,
      'centripetal',
    ),
    positions: number[] = [],
    indices: number[] = [],
    rails: ArenaRail[] = [],
    edges: Point3[][] = [[], []],
    steps = 112;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      centre = path.getPoint(t),
      tangent = path.getTangent(t),
      side = new Vector3(tangent.z, 0, -tangent.x)
        .normalize()
        .multiplyScalar(1.38);
    for (const [edge, sign] of [-1, 1].entries()) {
      const p = centre.clone().addScaledVector(side, sign);
      positions.push(p.x, p.y, p.z);
      edges[edge].push({ x: p.x, y: p.y, z: p.z });
      if (i)
        rails.push({
          a: edges[edge][i - 1],
          b: edges[edge][i],
          height: 1.55,
          width: 0.18,
          kind: 'guard',
        });
    }
    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  // A rear catch wall receives a real vertical fall from the preceding well.
  rails.push({
    a: edges[0][0],
    b: edges[1][0],
    height: 2,
    width: 0.18,
    kind: 'guard',
  });
  return {
    floor: {
      positions,
      indices,
      edges,
      colour: '#335a70',
    } satisfies ArenaFloor,
    rails,
  };
}

function crown(id: string, goal: ArenaGoal, speed: number): ArenaMotor {
  return {
    id,
    x: goal.x,
    z: goal.z,
    length: 5.2,
    width: 0.24,
    height: 0.78,
    speed,
    angle: 0.25,
    gate: true,
    arc: {
      radius: 2.6,
      from: Math.PI * 0.78,
      sweep: Math.PI * 1.28,
      hold: 1.5,
    },
    rebound: {
      speed: 4.4,
      restitution: 0.88,
      cooldown: 0.25,
      outsideOnly: true,
    },
  };
}

export function createDescentArena(): PinballArena {
  const a = createReactorArena(true),
    upperHeight = a.height,
    firstGoal = { ...a.goal! },
    secondGoal = { x: 1.65, z: 23.8, radius: 1.18, y: -8.82 },
    finalGoal = { x: -1.5, z: 40.2, radius: 1.02, y: -18.42 },
    middleHeight = (x: number, z: number) =>
      -8.4 + 0.035 * ((x - secondGoal.x) ** 2 + (z - secondGoal.z) ** 2),
    finalHeight = (x: number, z: number) =>
      -18 + 0.037 * ((x - finalGoal.x) ** 2 + (z - finalGoal.z) ** 2),
    firstPipe = chute([
      { x: 0, y: -2.15, z: 3 },
      { x: 0, y: -2.8, z: 6.4 },
      { x: -1.5, y: -3.7, z: 8.8 },
      { x: -3.5, y: -4.7, z: 11.2 },
      { x: -3.2, y: -5.3, z: 13.8 },
      { x: -1.5, y: -5.72, z: 16.15 },
      { x: -0.5, y: -5.96, z: 17.1 },
    ]),
    secondPipe = chute([
      { x: 1.65, y: -10.55, z: 22.5 },
      { x: 1.65, y: -11.1, z: 25.3 },
      { x: 3.7, y: -12.1, z: 27.5 },
      { x: 4.2, y: -13, z: 30.3 },
      { x: 3.3, y: -13.9, z: 32 },
      { x: 0.8, y: -14.8, z: 34.4 },
    ]),
    middle = bowl(
      DESCENT_LEVEL_NAMES[1],
      '#4e8297',
      22.5,
      secondGoal,
      { x: -0.5, y: -5.96, z: 17.1 },
      middleHeight,
    ),
    last = bowl(
      DESCENT_LEVEL_NAMES[2],
      '#d0aa59',
      38.9,
      finalGoal,
      { x: 0.8, y: -14.8, z: 34.4 },
      finalHeight,
    );
  a.id = 'descent';
  a.height = (x, z) =>
    z < 13
      ? upperHeight(x, z)
      : z < 30.7
        ? middleHeight(x, z)
        : finalHeight(x, z);
  a.levels = [
    {
      name: DESCENT_LEVEL_NAMES[0],
      colour: '#2ed4c8',
      goal: firstGoal,
      boundary: [...a.boundary],
      entry: { x: 0, y: upperHeight(0, a.start.z), z: a.start.z },
    },
    middle.level,
    last.level,
  ];
  a.goal = finalGoal;
  a.exitZ = a.finishZ = finalGoal.z;
  a.finishHalfWidth = finalGoal.radius;
  a.releaseAt = DESCENT_RELEASE_AT;
  a.maxSeconds = DESCENT_MAX_SECONDS;
  a.floor.push(firstPipe.floor, middle.floor, secondPipe.floor, last.floor);
  a.rails.push(
    ...firstPipe.rails,
    ...middle.rails,
    ...secondPipe.rails,
    ...last.rails,
  );
  a.boundary = a.levels.flatMap((level) => level.boundary);
  // Early arrivals still have two live arenas ahead of them. The first bowl
  // keeps its layout but has a wider opening to feed the longer course.
  const firstCrown = a.motors.find((m) => m.id === 'goal-crown')!;
  firstCrown.arc = { ...firstCrown.arc!, sweep: Math.PI * 1.2, hold: 2 };
  firstCrown.speed = 0.5;
  a.motors.push(
    {
      id: 'turbine-entry',
      x: -1.4,
      z: 19.4,
      length: 3.3,
      width: 0.32,
      height: 0.7,
      speed: -2.1,
      angle: 0.4,
      cross: true,
    },
    {
      id: 'turbine-paddle',
      x: secondGoal.x,
      z: secondGoal.z,
      length: 3.2,
      width: 0.3,
      height: 0.64,
      speed: 2.5,
      swing: 1.1,
      angle: 0.6,
      elevation: 0.2,
      gate: true,
    },
    crown('turbine-crown', secondGoal, -0.56),
    {
      id: 'core-entry',
      x: 1,
      z: 36,
      length: 3.6,
      width: 0.34,
      height: 0.72,
      speed: 2.35,
      angle: 0.8,
      cross: true,
    },
    {
      id: 'core-paddle',
      x: finalGoal.x,
      z: finalGoal.z,
      length: 3.3,
      width: 0.3,
      height: 0.68,
      speed: 2.7,
      swing: 1.25,
      angle: 0.2,
      elevation: 0.2,
      gate: true,
    },
    crown('core-crown', finalGoal, 0.67),
  );
  a.bumpers.push(
    ...[
      [-4, 20.8],
      [4.1, 21],
      [-3.5, 24.6],
      [0, 27.2],
      [-3.8, 35.7],
      [4.1, 38.6],
      [-3.6, 43],
      [1.9, 43.1],
    ].map(([x, z]) => ({ x, z, radius: 0.62, strength: 4.1 })),
  );
  for (const z of [26.2, 42.5])
    for (const side of [-1, 1])
      a.springs.push({
        x: side * 4.05,
        z,
        radius: 0.88,
        direction: { x: -side * 0.6, y: 0.12, z: -1 },
        speed: 6.2,
        period: 4.2,
        activeFor: 2.8,
      });
  return a;
}
