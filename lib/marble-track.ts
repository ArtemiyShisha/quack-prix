export type Point3 = { x: number; y: number; z: number };
export type TrackMesh = {
  positions: number[];
  indices: number[];
  colour: string;
  edges: Point3[][];
};
export const MARBLE_RADIUS = 0.48;
export const MARBLE_FINISH_Z = 98;
export const MARBLE_MAX_SECONDS = 75;
export const PADDLE_SPEED = 1.1;
export const FUNNEL = { x: 6.4, z: 80, radius: 9.5, hole: 1.25, bottom: 3.4 };
const anchors = [
  [-5, 0],
  [0, 0],
  [12, -6],
  [24, 7],
  [37, 0],
  [50, -7],
  [63, 4],
  [80, 12.8],
];
const smooth = (t: number) => t * t * (3 - 2 * t);
export function mainCentre(z: number): Point3 {
  const i = Math.max(
    1,
    anchors.findIndex((p) => p[0] >= z),
  );
  const a = anchors[i - 1],
    b = anchors[i],
    t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
  return { x: a[1] + (b[1] - a[1]) * smooth(t), y: 30 - 0.29 * z, z };
}
export function mainWidth(z: number) {
  const wide = Math.max(0, Math.min(1, (z - 27) / 6, (47 - z) / 6));
  return (
    3.4 +
    1.9 * smooth(wide) -
    1.2 * smooth(Math.max(0, Math.min(1, (z - 70) / 10)))
  );
}
export function troughHeight(u: number) {
  return 1.2 * u * u + 3 * Math.pow(Math.abs(u), 8);
}
function trough(
  from: number,
  to: number,
  centre: (s: number) => Point3,
  width: (s: number) => number,
  colour: string,
  bankScale = 1,
): TrackMesh {
  const positions: number[] = [],
    indices: number[] = [],
    edges: Point3[][] = [[], []];
  const rows = Math.ceil((to - from) * 2),
    columns = 16;
  for (let i = 0; i <= rows; i++) {
    const s = from + ((to - from) * i) / rows,
      p = centre(s),
      before = centre(Math.max(from, s - 0.01)),
      after = centre(Math.min(to, s + 0.01));
    const dx = after.x - before.x,
      dz = after.z - before.z,
      length = Math.hypot(dx, dz) || 1;
    for (let j = 0; j <= columns; j++) {
      const u = (2 * j) / columns - 1,
        r = width(s),
        v = {
          x: p.x + (dz / length) * u * r,
          y: p.y + troughHeight(u) * bankScale,
          z: p.z - (dx / length) * u * r,
        };
      positions.push(v.x, v.y, v.z);
      if (j === 0) edges[0].push(v);
      if (j === columns) edges[1].push(v);
      if (i < rows && j < columns) {
        const a = i * (columns + 1) + j,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  return { positions, indices, colour, edges };
}
function funnel(): TrackMesh {
  const positions: number[] = [],
    indices: number[] = [],
    edges: Point3[][] = [[]];
  const rings = 16,
    segments = 72;
  for (let i = 0; i <= rings; i++) {
    const r = FUNNEL.hole + ((FUNNEL.radius - FUNNEL.hole) * i) / rings;
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        p = {
          x: FUNNEL.x + Math.cos(a) * r,
          y: FUNNEL.bottom + 0.055 * r * r,
          z: FUNNEL.z + Math.sin(a) * r,
        };
      positions.push(p.x, p.y, p.z);
      if (i === rings) edges[0].push(p);
      if (i < rings && j < segments) {
        const a = i * (segments + 1) + j,
          b = a + 1,
          c = a + segments + 1,
          d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  // The rim is part of the same collision mesh, leaving only the central drain open.
  const start = positions.length / 3;
  for (let j = 0; j <= segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    for (const dy of [0, 2.5])
      positions.push(
        FUNNEL.x + Math.cos(a) * FUNNEL.radius,
        FUNNEL.bottom + 0.055 * FUNNEL.radius ** 2 + dy,
        FUNNEL.z + Math.sin(a) * FUNNEL.radius,
      );
    if (
      j < segments &&
      !(
        (j / segments) * Math.PI * 2 > 4.35 &&
        (j / segments) * Math.PI * 2 < 5.65
      )
    ) {
      const a = start + j * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return { positions, indices, colour: '#ffc76c', edges };
}
export const TRACK_MESHES: TrackMesh[] = [
  trough(-5, 17, mainCentre, mainWidth, '#76d7d7'),
  trough(17, 30, mainCentre, mainWidth, '#79b9ee'),
  trough(30, 47, mainCentre, mainWidth, '#b6a4e9'),
  trough(47, 66, mainCentre, mainWidth, '#76d7d7'),
  trough(66, 80, mainCentre, mainWidth, '#79b9ee'),
  funnel(),
  trough(
    76,
    103,
    (z) => ({ x: FUNNEL.x, y: 1.6 - 0.075 * (z - 76), z }),
    (z) => 3.5 - 1.3 * smooth(Math.max(0, Math.min(1, (z - 84) / 8))),
    '#ef9988',
    0.28,
  ),
];
export const BUMPERS = [
  { ...mainCentre(19), offset: -1.35, radius: 0.62 },
  { ...mainCentre(25), offset: 1.35, radius: 0.62 },
].map((p) => ({ ...p, x: p.x + p.offset, y: p.y + 0.9 }));
export const ISLAND_3D = {
  ...mainCentre(37),
  height: 3.3,
  y: mainCentre(37).y - 1.5,
  radius: 1.05,
  halfLength: 2.3,
};
export const PADDLE_3D = {
  ...mainCentre(46),
  x: mainCentre(46).x + 1.5,
  length: 2.0,
  height: 1.2,
  width: 0.28,
};
export function marbleStart(slot: number, count: number): Point3 {
  const columns = Math.min(4, count),
    column = slot % columns,
    row = Math.floor(slot / columns),
    x = (column - (columns - 1) / 2) * 1.12,
    z = -1.6 - row * 1.15;
  return {
    x,
    y: mainCentre(z).y + troughHeight(x / mainWidth(z)) + MARBLE_RADIUS + 0.06,
    z,
  };
}
