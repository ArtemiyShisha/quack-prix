import type { Point3, Surface } from './pinball.ts';
import { createReactorArena } from './pinball-reactor.ts';
import { createDescentArena } from './pinball-descent.ts';

// Retain the earlier arena layouts for shared geometry and physics regressions.
// Only «Глубина» is available in the game.
const ARENA_LAYOUTS = [
  {
    id: 'reactor',
    name: 'Реактор',
    icon: '◉',
    colour: '#19c9c3',
    tagline: 'Два пути · встречные потоки · борьба в финальной чаше',
    description:
      'Обходи остров или рискни пройти через быстрый ротор. Оба пути сходятся в чаше: промах у финиша возвращает в борьбу.',
  },
  {
    id: 'descent',
    name: 'Глубина',
    icon: '⇣',
    colour: '#55d5ef',
    tagline: 'Три уровня · падения в лунки · открытые скоростные желоба',
    description:
      'Реактор — только начало. Провались в лунку, пронесись по желобу и продолжи борьбу на следующем этаже. Победа — в третьей лунке.',
  },
  {
    id: 'cascade',
    name: 'Каскад',
    icon: '≋',
    colour: '#63bce5',
    tagline: 'Три чаши · перепады высоты · возвратные пружины',
    description:
      'Спускайся через три чаши с выходами на разных сторонах. Нижняя пружина может отправить лидера обратно наверх.',
  },
  {
    id: 'crossroads',
    name: 'Перекрёсток',
    icon: '∞',
    colour: '#c29af0',
    tagline: 'Две петли · встречные потоки · общий перекрёсток',
    description:
      'Два кольца пересекаются на одном уровне. На перекрёстке шарики сталкиваются, меняют петлю и сбивают друг друга с курса.',
  },
  {
    id: 'seesaw',
    name: 'Качели',
    icon: '⌁',
    colour: '#edb75d',
    tagline: 'Подвижные платформы · встречные наклоны · прыжки',
    description:
      'Две платформы качаются в противофазе. Наклон собирает шарики у края, затем отправляет обратно через общее поле.',
  },
  {
    id: 'fortress',
    name: 'Крепость',
    icon: '▥',
    colour: '#ed997d',
    tagline: 'Подвижные блоки · физические ворота · меняющееся поле',
    description:
      'Пробивай проходы в стенах из лёгких блоков. Ворота поддаются ударам, а сдвинутые блоки становятся новыми препятствиями.',
  },
] as const;
export type PinballMapId = (typeof ARENA_LAYOUTS)[number]['id'];
export const PINBALL_MAPS = ARENA_LAYOUTS.filter((m) => m.id === 'descent');
export const DEFAULT_PINBALL_MAP: PinballMapId = 'descent';
export const isPinballMap = (
  value: unknown,
): value is (typeof PINBALL_MAPS)[number]['id'] =>
  PINBALL_MAPS.some((m) => m.id === value);
export const mapInfo = (id: PinballMapId) =>
  ARENA_LAYOUTS.find((m) => m.id === id)!;
export type ArenaRail = {
  a: Point3;
  b: Point3;
  height: number;
  width: number;
  accent?: boolean;
  kind?: 'outer' | 'guide' | 'island' | 'guard';
};
export type ArenaBumper = {
  x: number;
  z: number;
  radius: number;
  strength: number;
};
export type ArenaSpring = {
  x: number;
  z: number;
  radius: number;
  direction: Point3;
  speed: number;
  period?: number;
  activeFor?: number;
};
export type ArenaMotor = {
  id: string;
  x: number;
  z: number;
  length: number;
  width: number;
  height: number;
  speed: number;
  angle: number;
  cross?: boolean;
  gate?: boolean;
  swing?: number;
  elevation?: number;
  arc?: { radius: number; from: number; sweep: number; hold: number };
  rebound?: {
    speed: number;
    restitution: number;
    cooldown: number;
    outsideOnly?: boolean;
  };
};
export type ArenaArm = {
  id: string;
  x: number;
  z: number;
  length: number;
  angle: number;
  passive?: boolean;
};
export type ArenaPlatform = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  length: number;
  phase: number;
  deflector?: { x: number; z: number; length: number; angle: number };
};
export type ArenaBlock = {
  id: string;
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};
export type ArenaFloor = Surface & { colour?: string };
export type ArenaGoal = { x: number; z: number; radius: number; y: number };
export type ArenaStartGate = {
  z: number;
  width: number;
  height: number;
  depth: number;
  opensAt: number;
  openingDuration: number;
  lift: number;
};
export type ArenaLevel = {
  name: string;
  colour: string;
  goal: ArenaGoal;
  boundary: Point3[];
  entry: Point3;
  opening?: { x: number; halfWidth: number; maxZ: number };
  wallHeight?: number;
};
export function arenaLevelOpening(level: ArenaLevel, a: Point3, b: Point3) {
  const opening = level.opening;
  return (
    !!opening &&
    (a.z + b.z) / 2 < opening.maxZ &&
    Math.abs((a.x + b.x) / 2 - opening.x) < opening.halfWidth
  );
}
export type PinballArena = {
  id: PinballMapId;
  floor: ArenaFloor[];
  rails: ArenaRail[];
  bumpers: ArenaBumper[];
  springs: ArenaSpring[];
  motors: ArenaMotor[];
  arms: ArenaArm[];
  platforms: ArenaPlatform[];
  blocks: ArenaBlock[];
  height: (x: number, z: number) => number;
  boundary: Point3[];
  start: { z: number; width: number; gate?: ArenaStartGate };
  exitZ: number;
  finishZ: number;
  finishHalfWidth: number;
  flow?: 'eight';
  exitDrop?: number;
  goal?: ArenaGoal;
  levels?: ArenaLevel[];
  releaseAt?: number;
  maxSeconds?: number;
};
export function arenaStartGatePosition(
  gate: ArenaStartGate,
  height: PinballArena['height'],
  time: number,
): Point3 {
  const t = Math.max(
    0,
    Math.min(1, (time - gate.opensAt) / gate.openingDuration),
  );
  return {
    x: 0,
    y:
      height(0, gate.z) +
      gate.height / 2 -
      0.06 +
      gate.lift * t * t * (3 - 2 * t),
    z: gate.z,
  };
}
const p = (
  x: number,
  z: number,
  height: (x: number, z: number) => number,
): Point3 => ({ x, y: height(x, z), z });
function strip(
  left: number,
  right: number,
  top: number,
  bottom: number,
  height: (x: number, z: number) => number,
  rows = 48,
  columns = 32,
): ArenaFloor {
  const positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const x = left + ((right - left) * col) / columns,
        z = top + ((bottom - top) * row) / rows;
      positions.push(x, height(x, z), z);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col;
        indices.push(
          a,
          a + columns + 1,
          a + 1,
          a + 1,
          a + columns + 1,
          a + columns + 2,
        );
      }
    }
  return { positions, indices, edges: [] };
}
function radial(
  boundary: Point3[],
  height: (x: number, z: number) => number,
  centreZ = 0,
): ArenaFloor {
  const positions: number[] = [0, height(0, centreZ), centreZ],
    indices: number[] = [];
  const count = boundary.length,
    rings = 24;
  for (let ring = 1; ring <= rings; ring++)
    for (const edge of boundary) {
      const t = ring / rings,
        x = edge.x * t,
        z = centreZ + (edge.z - centreZ) * t;
      positions.push(x, height(x, z), z);
    }
  for (let i = 0; i < count; i++) indices.push(0, 1 + ((i + 1) % count), 1 + i);
  for (let ring = 1; ring < rings; ring++)
    for (let i = 0; i < count; i++) {
      const a = 1 + (ring - 1) * count + i,
        b = 1 + (ring - 1) * count + ((i + 1) % count),
        c = a + count,
        d = b + count;
      indices.push(a, d, c, a, b, d);
    }
  return { positions, indices, edges: [boundary] };
}
function rail(a: Point3, b: Point3, height = 1.2, accent = false): ArenaRail {
  return { a, b, height, width: 0.22, accent };
}
function finish(arena: PinballArena) {
  const y = arena.height(0, arena.exitZ) - (arena.exitDrop ?? 0);
  const chuteHeight = (_x: number, z: number) =>
    y - Math.max(0, z - arena.exitZ) * 0.4;
  arena.floor.push({
    ...strip(
      -1.18,
      1.18,
      arena.exitZ - 0.25,
      arena.finishZ + 0.7,
      chuteHeight,
      6,
      2,
    ),
    colour: '#e9bd67',
  });
  for (const side of [-1, 1]) {
    arena.rails.push(
      rail(
        p(side * 1.16, arena.exitZ - 0.05, chuteHeight),
        p(side * 0.94, arena.exitZ + 0.8, chuteHeight),
      ),
    );
    arena.rails.push(
      rail(
        p(side * 0.94, arena.exitZ + 0.8, chuteHeight),
        p(side * 0.94, arena.finishZ + 0.7, chuteHeight),
      ),
    );
  }
  if (arena.id === 'cascade' || arena.id === 'fortress') {
    arena.rails = arena.rails.flatMap((r) => {
      const count = Math.max(
        1,
        Math.ceil(Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z) / 0.4),
      );
      const at = (t: number) => {
        const x = r.a.x + (r.b.x - r.a.x) * t,
          z = r.a.z + (r.b.z - r.a.z) * t;
        return {
          x,
          z,
          y: z > arena.exitZ ? chuteHeight(x, z) : arena.height(x, z),
        };
      };
      return Array.from({ length: count }, (_, i) => ({
        ...r,
        a: at(i / count),
        b: at((i + 1) / count),
      }));
    });
  }
  return arena;
}
function rectangle(
  arena: PinballArena,
  halfWidth: number,
  top: number,
  bottom: number,
) {
  const h = arena.height;
  arena.boundary = [
    p(-halfWidth, top, h),
    p(halfWidth, top, h),
    p(halfWidth, bottom, h),
    p(-halfWidth, bottom, h),
  ];
  arena.rails.push(
    rail(
      p(-halfWidth, top, h),
      p(halfWidth, top, h),
      arena.id === 'cascade' ? 4 : 1.2,
    ),
  );
  for (const side of [-1, 1]) {
    arena.rails.push(
      rail(
        p(side * halfWidth, top, h),
        p(side * halfWidth, bottom, h),
        arena.id === 'cascade' ? 4 : arena.id === 'seesaw' ? 2.8 : 1.4,
      ),
    );
    arena.rails.push(
      rail(p(side * halfWidth, bottom, h), p(side * 1.1, arena.exitZ, h), 1.2),
    );
  }
  arena.floor.push(strip(-halfWidth, halfWidth, top, arena.exitZ + 0.05, h));
}
function base(
  id: PinballMapId,
  height: PinballArena['height'],
  exitZ: number,
  startZ: number,
): PinballArena {
  return {
    id,
    height,
    exitZ,
    finishZ: exitZ + 2.2,
    finishHalfWidth: 0.72,
    start: { z: startZ, width: 5.8 },
    floor: [],
    boundary: [],
    rails: [],
    bumpers: [],
    springs: [],
    motors: [],
    arms: [],
    platforms: [],
    blocks: [],
  };
}
export function createPinballArena(id: PinballMapId): PinballArena {
  if (id === 'reactor') return createReactorArena();
  if (id === 'descent') return createDescentArena();
  if (id === 'crossroads') {
    const h = (x: number, z: number) =>
      0.012 * x * x + 0.012 * z * z - 0.19 * z;
    const a = base(id, h, 6.0, -3.5);
    a.flow = 'eight';
    a.start.width = 5;
    a.boundary = Array.from({ length: 128 }, (_, i) => {
      const t = (i / 128) * Math.PI * 2,
        r =
          Math.sin(t) > 0
            ? 1 / Math.sqrt((Math.cos(t) / 7.4) ** 2 + (Math.sin(t) / 6) ** 2)
            : 3 * Math.abs(Math.cos(t)) +
              Math.sqrt(4.4 ** 2 - 9 * Math.sin(t) ** 2);
      return p(
        r * Math.cos(t),
        r * Math.sin(t) * (Math.sin(t) < 0 ? 1.3 : 1),
        h,
      );
    });
    a.floor.push(radial(a.boundary, h));
    a.boundary.forEach((v, i) => {
      const next = a.boundary[(i + 1) % a.boundary.length];
      if ((v.z + next.z) / 2 > 5.7 && Math.abs((v.x + next.x) / 2) < 1.14)
        return;
      a.rails.push(rail(v, next, 1.45));
    });
    // The two islands form actual loops; their centre junction stays at one height.
    a.bumpers = [
      { x: -3, z: 0, radius: 1.05, strength: 2.8 },
      { x: 3, z: 0, radius: 1.05, strength: 2.8 },
      { x: -5.6, z: 1.3, radius: 0.5, strength: 3.5 },
      { x: 5.6, z: -1.3, radius: 0.5, strength: 3.5 },
    ];
    a.motors = [
      {
        id: 'junction',
        x: 0,
        z: 0,
        length: 2.1,
        width: 0.27,
        height: 0.65,
        speed: 1.2,
        angle: 0,
      },
      {
        id: 'exit-gate',
        x: 0,
        z: 5.85,
        length: 1.75,
        width: 0.2,
        height: 0.6,
        speed: -0.9,
        angle: 0,
        gate: true,
      },
    ];
    return finish(a);
  }
  if (id === 'cascade') {
    const h = (x: number, z: number) => {
      const level = z < -3 ? 0 : z < 3 ? 1 : 2,
        centre = -6 + level * 6;
      const step =
        z < -3.3
          ? 3.6
          : z < -2.5
            ? 3.6 - ((z + 3.3) / 0.8) * 1.8
            : z < 2.7
              ? 1.8
              : z < 3.5
                ? 1.8 - ((z - 2.7) / 0.8) * 1.8
                : 0;
      return step + 0.006 * x * x + 0.01 * (z - centre) ** 2 - 0.17 * z;
    };
    const a = base(id, h, 10.5, -9.4);
    rectangle(a, 6.2, -10.2, 8.6);
    // Two staggered spillways force a visit to every bowl.
    a.rails.push(
      rail(p(-6.2, -5.8, h), p(2.3, -2.8, h), 1.1, true),
      rail(p(6.2, -0.2, h), p(-2.3, 3.1, h), 1.1, true),
    );
    a.floor[0].colour = '#266581';
    a.bumpers = [-6, 0, 6].flatMap((z) =>
      [-1, 1].map((side) => ({
        x: side * 2.8,
        z: z - 0.4,
        radius: 0.62,
        strength: 3.6,
      })),
    );
    a.motors = [-6, 0, 6].map((z, i) => ({
      id: `bowl-${i}`,
      x: 0,
      z: z - 0.5,
      length: 2.5,
      width: 0.3,
      height: 0.7,
      speed: i % 2 ? -1 : 1.1,
      angle: i,
      cross: true,
    }));
    a.springs = [
      {
        x: 5.15,
        z: -1.5,
        radius: 0.8,
        direction: { x: -0.15, y: 1, z: -1 },
        speed: 9.5,
        period: 7.5,
        activeFor: 2.4,
      },
      {
        x: -5.0,
        z: 4.6,
        radius: 0.8,
        direction: { x: 0.15, y: 1, z: -1 },
        speed: 9.5,
        period: 7.5,
        activeFor: 2.4,
      },
    ];
    a.arms = [
      { id: 'paddle-left', x: -2.8, z: 8.7, length: 2, angle: 0 },
      { id: 'paddle-right', x: 2.8, z: 8.7, length: 2, angle: Math.PI },
    ];
    return finish(a);
  }
  if (id === 'seesaw') {
    const h = (_x: number, z: number) => -0.18 * z;
    const a = base(id, h, 9.8, -8.4);
    rectangle(a, 6.25, -9.2, 8.4);
    // Low safety bed catches drops between the raised platforms.
    a.floor = [];
    a.floor.push(strip(-6.25, 6.25, -9.2, 9.8, (x, z) => h(x, z) - 1.55));
    a.floor.push({
      ...strip(-6.1, 6.1, -0.85, 0.85, h, 4, 4),
      colour: '#8caeaa',
    });
    a.exitDrop = 1.55;
    a.platforms = [
      {
        id: 'tilt-top',
        x: 0,
        y: h(0, -4.45),
        z: -4.45,
        width: 12,
        length: 7.1,
        phase: 0,
        deflector: { x: -1.8, z: 0, length: 8.4, angle: -0.23 },
      },
      {
        id: 'tilt-bottom',
        x: 0,
        y: h(0, 4.25),
        z: 4.25,
        width: 12,
        length: 6.7,
        phase: Math.PI,
        deflector: { x: 1.8, z: 0, length: 8.4, angle: 0.23 },
      },
    ];
    a.bumpers = [
      { x: -2.7, z: 0, radius: 0.62, strength: 4 },
      { x: 2.7, z: 0, radius: 0.62, strength: 4 },
    ];
    a.motors = [
      {
        id: 'middle',
        x: 0,
        z: 0,
        length: 2.6,
        width: 0.28,
        height: 0.7,
        speed: 1.1,
        angle: 0,
        cross: true,
      },
    ];
    return finish(a);
  }
  const h = (x: number, z: number) => 0.008 * x * x - 0.15 * z;
  const a = base('fortress', h, 10.4, -9);
  rectangle(a, 6.4, -10, 8.5);
  a.bumpers = [
    [-4.9, -5],
    [4.9, -5],
    [-4.9, 2],
    [4.9, 2],
  ].map(([x, z]) => ({ x, z, radius: 0.65, strength: 3.8 }));
  for (const [row, z] of [-3.5, 1.0, 5.2].entries())
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 1.5 + (row === 1 ? 0.4 : 0);
      a.blocks.push({
        id: `block-${row}-${col}`,
        x,
        z,
        width: 1.1,
        height: 0.9 + (col % 2) * 0.2,
        depth: 0.72,
      });
    }
  a.rails.push(
    rail(p(-6.4, -5.8, h), p(-3.9, -4.1, h), 0.9, true),
    rail(p(6.4, -1, h), p(3.9, 0.3, h), 0.9, true),
  );
  a.arms = [
    { id: 'door-left', x: -2.2, z: 3.9, length: 1.7, angle: 0, passive: true },
    {
      id: 'door-right',
      x: 2.2,
      z: 3.9,
      length: 1.7,
      angle: Math.PI,
      passive: true,
    },
  ];
  a.springs = [-2.8, 0, 2.8].map((x) => ({
    x,
    z: 2.0,
    radius: 1.5,
    direction: { x: 0, y: 0.2, z: 1 },
    speed: 5.5,
    period: 4,
    activeFor: 1.4,
  }));
  a.motors = [
    {
      id: 'battering-ram',
      x: 0,
      z: 2.4,
      length: 4.6,
      width: 0.26,
      height: 0.65,
      speed: 1.4,
      angle: 0,
      swing: 0.28,
      gate: true,
    },
    {
      id: 'breach-top',
      x: -1.3,
      z: -5.5,
      length: 3.4,
      width: 0.28,
      height: 0.7,
      speed: 0.85,
      angle: 0.4,
      cross: true,
    },
    {
      id: 'breach-middle',
      x: 1.3,
      z: -0.8,
      length: 3.4,
      width: 0.28,
      height: 0.7,
      speed: -1.05,
      angle: 1.2,
      cross: true,
    },
    {
      id: 'guard-left',
      x: -4.8,
      z: 6.5,
      length: 2,
      width: 0.28,
      height: 0.7,
      speed: 0.9,
      angle: 0,
    },
    {
      id: 'guard-right',
      x: 4.8,
      z: 6.5,
      length: 2,
      width: 0.28,
      height: 0.7,
      speed: -1.1,
      angle: 1,
    },
  ];
  return finish(a);
}
