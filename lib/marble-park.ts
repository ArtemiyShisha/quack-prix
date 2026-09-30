import { createParkPath } from './marble-path.ts';
import { seededRandom, shuffled } from './random.ts';
import type { CourseSection } from './marble-layout.ts';
import type { MarbleCourse, Point3, TrackMesh } from './marble-track.ts';

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number) => Math.max(0, Math.min(1, t));

export function createMarblePark(
  seed: number,
  base: MarbleCourse,
): MarbleCourse {
  const path = createParkPath(seed);
  const random = seededRandom(seed ^ 0x793acf1);
  const order = shuffled(['slalom', 'waves', 'bumpers', 'pins'] as const, () =>
    Math.floor(random() * 2 ** 32),
  );
  const titles = {
    slalom: 'Зигзаг',
    waves: 'Горки',
    bumpers: 'Толкатели',
    pins: 'Ветряки',
  };
  const colours = {
    slalom: '#72bde7',
    waves: '#69d6af',
    bumpers: '#f9b352',
    pins: '#d193e4',
    fork: '#b6a4e9',
    merge: '#50c9b5',
  };
  const fractions = [0, 0.16, 0.32, 0.46, 0.56, 0.78, 1];
  const kinds = [
    order[0],
    order[1],
    'fork',
    'merge',
    order[2],
    order[3],
  ] as const;
  const sections: CourseSection[] = kinds.map((kind, i) => ({
    kind,
    name:
      kind === 'fork'
        ? 'Развилка'
        : kind === 'merge'
          ? 'Слияние'
          : titles[kind],
    from: i === 0 ? -5 : fractions[i] * path.length,
    to: fractions[i + 1] * path.length,
  }));
  const slope = 0.31 + random() * 0.025;
  const mainCentre = (s: number): Point3 => {
    const p = path.at(s);
    const wave = sections.find((e) => e.kind === 'waves');
    const relief =
      wave && s > wave.from && s < wave.to
        ? 0.9 *
          Math.sin((2 * Math.PI * (s - wave.from)) / (wave.to - wave.from)) ** 2
        : 0;
    return { x: p.x, z: p.z, y: 6.84 + slope * (path.length - s) + relief };
  };
  const mainWidth = (s: number) => {
    const fork = sections[2];
    const wide = smooth(
      clamp(Math.min((s - fork.from) / 5, (fork.to - s) / 5)),
    );
    return 3.4 + 1.9 * wide - 1.2 * smooth(clamp((s - path.length + 12) / 12));
  };
  function loft(from: number, to: number, colour: string): TrackMesh {
    const positions: number[] = [],
      indices: number[] = [],
      edges: Point3[][] = [[], []];
    const rows = Math.ceil((to - from) * 2),
      columns = 16;
    for (let row = 0; row <= rows; row++) {
      const s = from + ((to - from) * row) / rows,
        p = mainCentre(s),
        heading = path.at(s).heading,
        r = mainWidth(s);
      for (let col = 0; col <= columns; col++) {
        const u = (col * 2) / columns - 1;
        const v = {
          x: p.x + Math.cos(heading) * u * r,
          y: p.y + base.troughHeight(u),
          z: p.z - Math.sin(heading) * u * r,
        };
        positions.push(v.x, v.y, v.z);
        if (col === 0) edges[0].push(v);
        if (col === columns) edges[1].push(v);
        if (row < rows && col < columns) {
          const a = row * (columns + 1) + col,
            b = a + 1,
            c = a + columns + 1;
          indices.push(a, c, b, b, c, c + 1);
        }
      }
    }
    return { positions, indices, edges, colour };
  }
  function guards(part: TrackMesh): TrackMesh {
    const positions: number[] = [],
      indices: number[] = [];
    for (const edge of part.edges) {
      const start = positions.length / 3;
      edge.forEach((p, i) => {
        positions.push(p.x, p.y, p.z, p.x, p.y + 3, p.z);
        if (i < edge.length - 1) {
          const a = start + i * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
    }
    return { positions, indices, edges: [], colour: '#b8e6ed', opacity: 0.18 };
  }
  const mainMeshes = sections.map((e) => loft(e.from, e.to, colours[e.kind]));
  // The lower coil stays visible underneath the earlier lap.
  if (path.style !== 'Серпантин')
    for (const part of mainMeshes) part.opacity = 0.62;
  const end = mainCentre(path.length);
  const dx = end.x - 12.8,
    dz = end.z - base.FUNNEL.z;
  const translate = (p: Point3): Point3 => ({
    x: p.x + dx,
    y: p.y,
    z: p.z + dz,
  });
  const finishMeshes = base.FINISH_MESHES.map(
    (m): TrackMesh => ({
      ...m,
      positions: m.positions.map((v, i) =>
        i % 3 === 0 ? v + dx : i % 3 === 2 ? v + dz : v,
      ),
      edges: m.edges.map((e) => e.map(translate)),
    }),
  );
  const FUNNEL = {
    ...base.FUNNEL,
    x: base.FUNNEL.x + dx,
    z: base.FUNNEL.z + dz,
  };
  const MARBLE_FINISH_Z = base.MARBLE_FINISH_Z + dz,
    RUNOUT_START = base.RUNOUT_START + dz;
  const runoutCentre = (z: number): Point3 => ({
    x: FUNNEL.x,
    y: 1.6 - 0.12 * (z - RUNOUT_START),
    z,
  });
  const located = (s: number, offset = 0) => {
    const p = mainCentre(s),
      h = path.at(s).heading;
    return {
      ...p,
      x: p.x + Math.cos(h) * offset,
      z: p.z - Math.sin(h) * offset,
      nx: Math.cos(h),
      nz: -Math.sin(h),
      distance: s,
    };
  };
  const PEGS = sections
    .filter((e) => e.kind === 'slalom')
    .flatMap((e) =>
      [0.2, 0.4, 0.6, 0.8].map((t, i) => ({
        ...located(e.from + (e.to - e.from) * t, i % 2 ? 1.35 : -1.35),
        radius: 1.15,
        height: 3.2,
      })),
    );
  const fork = sections[2];
  // Leave room beyond the island's rounded end. A peg alongside that cap
  // creates a permanent wedge for a whole field of marbles on tight bends.
  for (const t of [0.85])
    for (const offset of [-3.2, 0, 3.2])
      PEGS.push({
        ...located(fork.from + (fork.to - fork.from) * t, offset),
        radius: 0.8,
        height: 3.2,
      });
  const BUMPERS = sections
    .filter((e) => e.kind === 'bumpers')
    .flatMap((e) =>
      [0.25, 0.5, 0.75].map((t, i) => {
        const p = located(e.from + (e.to - e.from) * t, i % 2 ? 1 : -1);
        return {
          ...p,
          y: p.y + 1.5,
          radius: 1.15,
          height: 3.4,
          amplitude: 1.65,
        };
      }),
    );
  const ROTATORS = sections
    .filter((e) => e.kind === 'pins')
    .flatMap((e) =>
      [0.22, 0.5, 0.78].map((t, i) => {
        const p = located(e.from + (e.to - e.from) * t);
        return {
          ...p,
          y: p.y + 0.9,
          length: i === 1 ? 5.2 : 6.6,
          width: 0.5,
          height: 3.6,
          blades: i === 1 ? 2 : 1,
          speed: (i % 2 ? -1 : 1) * (0.65 + random() * 0.5),
          phase: random() * Math.PI * 2,
        };
      }),
    );
  const island = located(fork.from + (fork.to - fork.from) * 0.42);
  const ISLAND_3D = {
    ...island,
    y: island.y - 0.1,
    height: 3.5,
    radius: 1.25,
    halfLength: 3.1,
    angle: path.at(island.distance).heading,
  };
  const paddle = located(fork.from + 3, -1.1);
  const PADDLE_3D = { ...paddle, length: 5.2, height: 2.6, width: 0.5 };
  const FINISH_GATE = {
    ...base.FINISH_GATE,
    x: base.FINISH_GATE.x + dx,
    z: base.FINISH_GATE.z + dz,
  };
  const finishSpeed = 0.85 + random() * 0.9;
  const TRACK_MESHES = [
    ...mainMeshes,
    ...mainMeshes.map((part) => guards(part)),
    ...finishMeshes,
  ];
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (const m of TRACK_MESHES)
    for (let i = 0; i < m.positions.length; i += 3) {
      bounds.minX = Math.min(bounds.minX, m.positions[i]);
      bounds.maxX = Math.max(bounds.maxX, m.positions[i]);
      bounds.minZ = Math.min(bounds.minZ, m.positions[i + 2]);
      bounds.maxZ = Math.max(bounds.maxZ, m.positions[i + 2]);
    }
  const samples = Array.from(
    { length: Math.ceil(path.length) + 1 },
    (_, i) => ({
      s: Math.min(i, path.length),
      ...mainCentre(Math.min(i, path.length)),
    }),
  );
  const progressAt = (p: Point3) => {
    let best = Infinity,
      result = 0;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i],
        b = samples[i + 1],
        vx = b.x - a.x,
        vy = b.y - a.y,
        vz = b.z - a.z;
      const t = clamp(
        ((p.x - a.x) * vx + (p.y - a.y) * vy + (p.z - a.z) * vz) /
          (vx * vx + vy * vy + vz * vz),
      );
      const distance =
        (p.x - a.x - t * vx) ** 2 +
        (p.y - a.y - t * vy) ** 2 +
        (p.z - a.z - t * vz) ** 2;
      if (distance < best) {
        best = distance;
        result = a.s + t * (b.s - a.s);
      }
    }
    return result;
  };
  const cameraBack = (s: number) => {
    const p = mainCentre(s),
      vx = p.x - (bounds.minX + bounds.maxX) / 2,
      vz = p.z - (bounds.minZ + bounds.maxZ) / 2;
    const length = Math.hypot(vx, vz) || 1;
    return { x: vx / length, z: vz / length };
  };
  const marbleStart = (slot: number, count: number): Point3 => {
    const columns = Math.min(4, count),
      x = ((slot % columns) - (columns - 1) / 2) * 1.12,
      s = -1.6 - Math.floor(slot / columns) * 1.15,
      p = mainCentre(s);
    return {
      ...p,
      x: p.x + x,
      y: p.y + base.troughHeight(x / mainWidth(s)) + 0.48 + 0.06,
    };
  };
  return {
    ...base,
    seed,
    style: path.style,
    name: `${path.style} · ${order.map((k) => titles[k]).join(' · ')}`,
    pathLength: path.length,
    sections,
    mainCentre,
    mainWidth,
    marbleStart,
    progressAt,
    cameraBack,
    bounds,
    hasShortcut: false,
    shortcutAt: () => false,
    shortcutFrom: fork.from,
    shortcutTo: fork.to,
    mergeTo: sections[3].to,
    shortcutCentre: mainCentre,
    shortcutWidth: mainWidth,
    SHORTCUT_ENTRY: {
      x: island.x,
      z: island.z,
      halfWidth: 1.35,
      halfLength: 2.4,
    },
    TRACK_MESHES,
    FINISH_MESHES: finishMeshes,
    FUNNEL,
    MARBLE_FINISH_Z,
    RUNOUT_START,
    runoutCentre,
    BUMPERS,
    ROTATORS,
    PEGS,
    ISLAND_3D,
    PADDLE_3D,
    FINISH_GATE,
    gravity: 34,
    PADDLE_SPEED: 0.8 + random() * 0.7,
    bumperSpeed: 0.65 + random() * 0.8,
    finishSpeed,
    finishGateAngle: (time, phase) => phase + time * finishSpeed,
  };
}
