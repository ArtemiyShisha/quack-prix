export const WIDTH = 960,
  HEIGHT = 3440,
  VIEW_HEIGHT = 850,
  RADIUS = 22;
export const FINISH_DISTANCE = 4000;
export type Point = { x: number; y: number };
type StageBase = Point & {
  drain: number;
  exit: Point;
  friction: number;
  label: string;
};
export type BowlStage = StageBase & {
  kind: 'bowl';
  radius: number;
  strength: number;
};
export type ChuteStage = StageBase & {
  kind: 'fork' | 'cascade';
  outline: Point[];
  top: number;
  gravity: number;
};
export type Stage = BowlStage | ChuteStage;
export const STAGES: Stage[] = [
  {
    kind: 'bowl',
    x: 420,
    y: 420,
    exit: { x: 420, y: 420 },
    radius: 225,
    drain: 56,
    strength: 0.000006,
    friction: 0.005,
    label: '01 / БОЛЬШОЙ ВИРАЖ',
  },
  {
    kind: 'fork',
    x: 540,
    y: 1170,
    top: 820,
    outline: [
      { x: 240, y: 820 },
      { x: 840, y: 820 },
      { x: 840, y: 1220 },
      { x: 540, y: 1510 },
      { x: 240, y: 1220 },
    ],
    exit: { x: 540, y: 1450 },
    drain: 56,
    gravity: 0.00024,
    friction: 0.005,
    label: '02 / ОСТРОВ НЕВЕЗЕНИЯ',
  },
  {
    kind: 'cascade',
    x: 420,
    y: 1920,
    top: 1610,
    outline: [
      { x: 100, y: 1610 },
      { x: 740, y: 1610 },
      { x: 740, y: 2050 },
      { x: 420, y: 2370 },
      { x: 100, y: 2050 },
    ],
    exit: { x: 420, y: 2310 },
    drain: 56,
    gravity: 0.00065,
    friction: 0.005,
    label: '03 / КАСКАД КАЧЕЛЕЙ',
  },
  {
    kind: 'bowl',
    x: 540,
    y: 2670,
    exit: { x: 540, y: 2670 },
    radius: 230,
    drain: 56,
    strength: 0.0000058,
    friction: 0.005,
    label: '04 / ПОСЛЕДНЯЯ ЧАША',
  },
];
export const BOWLS = STAGES.filter(
  (stage): stage is BowlStage => stage.kind === 'bowl',
);
export function boundaryClearance(stage: Stage, point: Point) {
  if (stage.kind === 'bowl')
    return stage.radius - Math.hypot(point.x - stage.x, point.y - stage.y);
  return Math.min(
    ...stage.outline.map((a, i) => {
      const b = stage.outline[(i + 1) % stage.outline.length],
        dx = b.x - a.x,
        dy = b.y - a.y;
      return (
        ((point.x - a.x) * -dy + (point.y - a.y) * dx) / Math.hypot(dx, dy)
      );
    }),
  );
}
function bezier(a: Point, b: Point, c: Point, d: Point) {
  return Array.from({ length: 61 }, (_, i) => {
    const t = i / 60,
      u = 1 - t;
    return {
      x:
        u * u * u * a.x +
        3 * u * u * t * b.x +
        3 * u * t * t * c.x +
        t * t * t * d.x,
      y:
        u * u * u * a.y +
        3 * u * u * t * b.y +
        3 * u * t * t * c.y +
        t * t * t * d.y,
    };
  });
}
const controls = [
  [
    { x: 420, y: 420 },
    { x: 420, y: 750 },
    { x: 540, y: 740 },
    { x: 540, y: 880 },
  ],
  [
    { x: 540, y: 1450 },
    { x: 540, y: 1550 },
    { x: 420, y: 1520 },
    { x: 420, y: 1660 },
  ],
  [
    { x: 420, y: 2310 },
    { x: 420, y: 2460 },
    { x: 740, y: 2460 },
    { x: 740, y: 2670 },
  ],
  [
    { x: 540, y: 2670 },
    { x: 540, y: 3020 },
    { x: 760, y: 3020 },
    { x: 760, y: 3300 },
  ],
];
export const PIPES = controls.map((control) => {
  const points = bezier(control[0], control[1], control[2], control[3]);
  let s = 0;
  return points.map((p, i) => {
    if (i) s += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    return { ...p, s };
  });
});
export function pipePoint(index: number, s: number) {
  const points = PIPES[index];
  s = Math.max(0, Math.min(points.at(-1)!.s, s));
  const i = Math.max(
      1,
      points.findIndex((p) => p.s >= s),
    ),
    a = points[i - 1],
    b = points[i];
  const t = (s - a.s) / (b.s - a.s),
    length = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tx: (b.x - a.x) / length,
    ty: (b.y - a.y) / length,
  };
}
export function startPosition(slot: number, count: number) {
  const columns = Math.min(4, count),
    column = slot % columns,
    row = Math.floor(slot / columns);
  const angle = -2.85 + (column - (columns - 1) / 2) * 0.3,
    radius = 195 - row * 51,
    b = BOWLS[0];
  return {
    x: b.x + Math.cos(angle) * radius,
    y: b.y + Math.sin(angle) * radius,
    angle,
  };
}
export const PADDLES = [
  {
    stage: 1,
    x: 540,
    y: 1030,
    length: 110,
    width: 16,
    baseAngle: -Math.PI / 2,
    amplitude: 0.7,
    rate: 1.1,
  },
  {
    stage: 2,
    x: 620,
    y: 1840,
    length: 90,
    width: 16,
    baseAngle: Math.PI / 2,
    amplitude: 0.65,
    rate: 0.9,
  },
  {
    stage: 2,
    x: 220,
    y: 2060,
    length: 90,
    width: 16,
    baseAngle: Math.PI / 2,
    amplitude: 0.55,
    rate: 1,
  },
];
export function paddlePose(
  p: (typeof PADDLES)[number],
  time: number,
  phase: number,
) {
  const angle = p.baseAngle + p.amplitude * Math.sin(p.rate * time + phase);
  return {
    x: p.x + (Math.cos(angle) * p.length) / 2,
    y: p.y + (Math.sin(angle) * p.length) / 2,
    angle,
  };
}
export const ISLANDS = [
  { stage: 1, x: 540, y: 1160, length: 260, width: 125, angle: Math.PI / 2 },
];
export const RAILS = [
  { stage: 2, a: { x: 100, y: 1740 }, b: { x: 500, y: 1900 }, width: 18 },
  { stage: 2, a: { x: 740, y: 1920 }, b: { x: 350, y: 2120 }, width: 18 },
];
export const HUES = [0, 115, 285, 170, 325, 58, 220, 35];
export const COLOURS = [
  '#efb900',
  '#22a789',
  '#ea739d',
  '#3ba0dc',
  '#e78448',
  '#71a848',
  '#9480dd',
  '#a99345',
];
