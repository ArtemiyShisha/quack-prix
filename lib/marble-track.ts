export type Point3 = { x: number; y: number; z: number };
export type TrackMesh = {
  positions: number[];
  indices: number[];
  colour: string;
  opacity?: number;
  edges: Point3[][];
};
export const MARBLE_RADIUS = 0.48;
export const MARBLE_FINISH_Z = 128;
export const MARBLE_MAX_SECONDS = 75;
export const PADDLE_SPEED = 1.1;
export const FUNNEL = { x: 6.4, z: 106, radius: 9.5, hole: 1.25, bottom: 3.4 };
export const RUNOUT_START = FUNNEL.z - 4;
export const runoutCentre = (z: number): Point3 => ({
  x: FUNNEL.x,
  y: 1.6 - 0.12 * (z - RUNOUT_START),
  z,
});
const anchors = [
  [-5, 0],
  [0, 0],
  [12, -6],
  [24, 7],
  [37, 0],
  [50, -7],
  [62, -2],
  [74, 7],
  [87, -5],
  [106, 12.8],
];
const smooth = (t: number) => t * t * (3 - 2 * t);
export function mainCentre(z: number): Point3 {
  const found = anchors.findIndex((p) => p[0] >= z);
  const i = found < 0 ? anchors.length - 1 : Math.max(1, found);
  const a = anchors[i - 1],
    b = anchors[i],
    t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
  const wave =
    z > 58 && z < 82 ? 0.28 * Math.sin((Math.PI * (z - 58)) / 6) ** 2 : 0;
  return { x: a[1] + (b[1] - a[1]) * smooth(t), y: 55.6 - 0.46 * z + wave, z };
}
export function mainWidth(z: number) {
  const wide = Math.max(0, Math.min(1, (z - 27) / 6, (71 - z) / 6));
  return (
    3.4 +
    1.9 * smooth(wide) -
    1.2 * smooth(Math.max(0, Math.min(1, (z - (FUNNEL.z - 10)) / 10)))
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
  bankScale: number | ((z: number) => number) = 1,
  opening?: (x: number, z: number) => boolean,
): TrackMesh {
  const positions: number[] = [],
    indices: number[] = [],
    edges: Point3[][] = [[], []];
  const rows = Math.ceil((to - from) * 2),
    columns = 16;
  for (let i = 0; i <= rows; i++) {
    const s = from + ((to - from) * i) / rows,
      p = centre(s),
      before = centre(s - 0.01),
      after = centre(s + 0.01);
    const dx = after.x - before.x,
      dz = after.z - before.z,
      length = Math.hypot(dx, dz) || 1;
    for (let j = 0; j <= columns; j++) {
      const u = (2 * j) / columns - 1,
        r = width(s),
        v = {
          x: p.x + (dz / length) * u * r,
          y:
            p.y +
            troughHeight(u) *
              (typeof bankScale === 'number' ? bankScale : bankScale(s)),
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
        const centreU = u + 1 / columns;
        const cellX = p.x + (dz / length) * centreU * r;
        const cellZ = p.z - (dx / length) * centreU * r + 0.25;
        if (!opening?.(cellX, cellZ)) indices.push(a, c, b, b, c, d);
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
  return { positions, indices, colour: '#ffc76c', opacity: 0.38, edges };
}
export const SHORTCUT_ENTRY = {
  x: -2.5,
  z: 37,
  halfWidth: 1.35,
  halfLength: 2.4,
};
export function shortcutCentre(z: number): Point3 {
  const t = smooth(Math.max(0, Math.min(1, (z - 40) / 26)));
  const straight = -2.5 + (mainCentre(66).x + 2.5) * t;
  const blend = smooth(Math.max(0, Math.min(1, (z - 60) / 6)));
  const x = straight + (mainCentre(z).x - straight) * blend;
  const depth =
    z < 66 ? 3 : 3 * (1 - smooth(Math.max(0, Math.min(1, (z - 66) / 16))));
  return { x, y: mainCentre(z).y - depth, z };
}
export const shortcutWidth = (z: number) => {
  if (z < 50)
    return 3.4 - 1.75 * smooth(Math.max(0, Math.min(1, (z - 42) / 8)));
  return z < 60
    ? 1.65
    : z < 66
      ? 1.65 + (mainWidth(z) - 1.65) * smooth((z - 60) / 6)
      : mainWidth(z);
};
export const shortcutBankScale = (z: number) =>
  0.28 + 0.37 * (1 - smooth(Math.max(0, Math.min(1, (z - 42) / 8))));
const entryOpening = (x: number, z: number) =>
  Math.abs(x - SHORTCUT_ENTRY.x) < SHORTCUT_ENTRY.halfWidth &&
  Math.abs(z - SHORTCUT_ENTRY.z) < SHORTCUT_ENTRY.halfLength;
const fork = trough(30, 47, mainCentre, mainWidth, '#b6a4e9', 1, entryOpening);
fork.opacity = 0.48;
const pegDeck = trough(47, 66, mainCentre, mainWidth, '#efb57e');
pegDeck.opacity = 0.48;
const mainSections: TrackMesh[] = [
  trough(-5, 17, mainCentre, mainWidth, '#76d7d7'),
  trough(17, 30, mainCentre, mainWidth, '#79b9ee'),
  fork,
  pegDeck,
  trough(82, 96, mainCentre, mainWidth, '#a4ce95'),
  trough(96, FUNNEL.z, mainCentre, mainWidth, '#79b9ee'),
];
const shortcut = trough(
  33,
  66,
  shortcutCentre,
  shortcutWidth,
  '#50c9b5',
  shortcutBankScale,
);
const merge = trough(
  66,
  82,
  shortcutCentre,
  shortcutWidth,
  '#50c9b5',
  (z) => 0.28 + 0.72 * smooth(Math.max(0, Math.min(1, (z - 66) / 6))),
);
export const PEGS = [49, 54, 59].flatMap((z, row) =>
  [-2.8, 0, 2.8].map((offset) => {
    const p = mainCentre(z),
      x = p.x + offset + (row % 2 ? 1.1 : 0);
    return { x, y: p.y - 0.2, z, radius: 0.55, height: 2.1 };
  }),
);
export const FINISH_GATE = {
  ...runoutCentre(MARBLE_FINISH_Z - 5),
  length: 3.2,
  height: 1.8,
  width: 0.32,
};
export const finishGateAngle = (time: number, phase: number) =>
  phase + time * 1.35;
// Clear side guards catch bank launches on the faster wave/turn section.
// They are real collision surfaces, with the same shape used for rendering.
function guards(section: TrackMesh): TrackMesh {
  const positions: number[] = [],
    indices: number[] = [];
  for (const edge of section.edges) {
    const start = positions.length / 3;
    edge.forEach((p, i) => {
      positions.push(p.x, p.y, p.z, p.x, p.y + 3, p.z);
      if (i < edge.length - 1) {
        const a = start + i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
  }
  return { positions, indices, colour: '#b8e6ed', opacity: 0.18, edges: [] };
}
const runout = trough(
  RUNOUT_START,
  MARBLE_FINISH_Z + 5,
  runoutCentre,
  (z) => 3.5 - 1.3 * smooth(Math.max(0, Math.min(1, (z - (FUNNEL.z + 4)) / 8))),
  '#ef9988',
  0.28,
);
export const TRACK_MESHES: TrackMesh[] = [
  ...mainSections,
  ...mainSections.map(guards),
  shortcut,
  merge,
  guards(merge),
  funnel(),
  runout,
  guards({
    ...runout,
    edges: runout.edges.map((edge) =>
      edge.filter((p) => p.z > FUNNEL.z + FUNNEL.radius + 1),
    ),
  }),
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
