export const WIDTH = 960,
  HEIGHT = 3440,
  VIEW_HEIGHT = 850,
  RADIUS = 22;
export const FINISH_DISTANCE = 4000;
export const BOWLS = [
  {
    x: 420,
    y: 420,
    radius: 225,
    drain: 56,
    strength: 0.000006,
    friction: 0.005,
    label: '01 / БОЛЬШОЙ ВИРАЖ',
  },
  {
    x: 540,
    y: 1170,
    radius: 235,
    drain: 56,
    strength: 0.0000057,
    friction: 0.005,
    label: '02 / ДВОЙНАЯ СПИРАЛЬ',
  },
  {
    x: 420,
    y: 1920,
    radius: 225,
    drain: 56,
    strength: 0.0000063,
    friction: 0.005,
    label: '03 / МЕЖДУ ОСТРОВКАМИ',
  },
  {
    x: 540,
    y: 2670,
    radius: 230,
    drain: 56,
    strength: 0.0000058,
    friction: 0.005,
    label: '04 / ПОСЛЕДНЯЯ ЧАША',
  },
];
export type Point = { x: number; y: number };
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
    { x: 420, y: 830 },
    { x: 747, y: 680 },
    { x: 747, y: 1170 },
  ],
  [
    { x: 540, y: 1170 },
    { x: 540, y: 1580 },
    { x: 223, y: 1430 },
    { x: 223, y: 1920 },
  ],
  [
    { x: 420, y: 1920 },
    { x: 420, y: 2330 },
    { x: 742, y: 2180 },
    { x: 742, y: 2670 },
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
  { stage: 1, x: 615, y: 1170, length: 92, width: 14, direction: -1 },
];
export const PEGS = [
  { stage: 2, x: 350, y: 1830, radius: 19 },
  { stage: 2, x: 505, y: 1990, radius: 19 },
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
