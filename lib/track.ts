export const WIDTH = 960;
export const WALL_X = [56, 904];
export const HEIGHT = 2400;
export const VIEW_HEIGHT = 760;
export const RADIUS = 23;
export const FINISH_Y = 2316;
export const PEGS = [
  ...Array.from({ length: 6 }, (_, i) => ({
    x: 145 + i * 134,
    y: 215,
    radius: 16,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    x: 212 + i * 134,
    y: 294,
    radius: 16,
  })),
];
// The first two ramps form a fork. Their shared apex blocks a straight fall.
export const SLOPES = [
  { x1: 480, y1: 372, x2: 160, y2: 505 },
  { x1: 480, y1: 372, x2: 800, y2: 505 },
  { x1: 69, y1: 710, x2: 330, y2: 802 },
  { x1: 891, y1: 710, x2: 630, y2: 802 },
  { x1: 69, y1: 920, x2: 622, y2: 1070 },
  { x1: 891, y1: 1170, x2: 300, y2: 1330 },
  { x1: 69, y1: 1470, x2: 285, y2: 1555 },
  { x1: 891, y1: 1470, x2: 675, y2: 1555 },
  { x1: 480, y1: 1860, x2: 230, y2: 1980 },
  { x1: 480, y1: 1860, x2: 730, y2: 1980 },
];
export const BUMPERS = [
  { x: 180, y: 627, radius: 30, travel: 24, period: 2.8 },
  { x: 480, y: 845, radius: 26, travel: 50, period: 3.2 },
  { x: 780, y: 627, radius: 30, travel: 24, period: 2.8 },
];
export const CURRENT = { top: 900, bottom: 1430, drag: 0.042 };
export const ROTORS = [
  { x: 759, y: 1110, length: 146, thickness: 20, direction: 1, blades: 2 },
  { x: 480, y: 2150, length: 134, thickness: 19, direction: -1, blades: 2 },
];
export const BOOSTS = [
  {
    x: 465,
    y: 992,
    length: 170,
    width: 55,
    angle: Math.atan2(150, 553),
    force: 0.00042,
  },
  {
    x: 530,
    y: 1233,
    length: 170,
    width: 55,
    angle: Math.atan2(160, -591),
    force: 0.00042,
  },
];
export const GATE = {
  y: 1740,
  centres: [190, 770],
  angles: [0.1, -0.1],
  width: 610,
  thickness: 24,
  travel: 210,
};
export const POOL = {
  triggerY: 1430,
  top: 1490,
  bottom: 1765,
  x: 480,
  y: 1620,
  fillSeconds: 6.5,
  releaseSeconds: 2.4,
  resetSeconds: 1.3,
};
export const RAILS = [
  { x1: 69, y1: 2070, x2: 370, y2: 2230 },
  { x1: 891, y1: 2070, x2: 590, y2: 2230 },
];
export const SECTIONS = [
  { y: 176, label: '01 / РАЗВИЛКА', name: 'Развилка' },
  { y: 571, label: '02 / МЯГКИЙ СЛАЛОМ', name: 'Мягкий слалом' },
  { y: 962, label: '03 / ТУРБО-КАСКАДЫ', name: 'Турбо-каскады' },
  { y: 1430, label: '04 / ВОЛНОВОЙ БАССЕЙН', name: 'Волновой бассейн' },
  { y: 1830, label: '05 / ПОСЛЕДНИЙ КАСКАД', name: 'Последний каскад' },
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
export function startX(slot: number, count: number) {
  return 480 + (slot - (count - 1) / 2) * 90;
}
