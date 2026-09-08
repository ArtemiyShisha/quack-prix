export const WIDTH = 960;
export const WALL_X = [56, 904];
export const HEIGHT = 1960;
export const VIEW_HEIGHT = 760;
export const RADIUS = 23;
export const FINISH_Y = 1876;
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
  { x1: 69, y1: 710, x2: 365, y2: 802 },
  { x1: 891, y1: 710, x2: 595, y2: 802 },
  { x1: 69, y1: 920, x2: 622, y2: 1070 },
  { x1: 891, y1: 1170, x2: 300, y2: 1330 },
];
export const BUMPERS = [
  { x: 180, y: 627, radius: 37, travel: 35, period: 2.8 },
  { x: 480, y: 724, radius: 39, travel: 90, period: 3.2 },
  { x: 780, y: 627, radius: 37, travel: 35, period: 2.8 },
];
export const ROTORS = [
  { x: 480, y: 839, length: 174, thickness: 20, direction: -1, blades: 3 },
  { x: 759, y: 1110, length: 146, thickness: 20, direction: 1, blades: 2 },
  { x: 480, y: 1767, length: 130, thickness: 19, direction: -1, blades: 2 },
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
  y: 1505,
  centres: [190, 770],
  angles: [0.22, -0.22],
  width: 460,
  thickness: 24,
  travel: 80,
  period: 2.6,
};
export const RAILS = [
  { x1: 69, y1: 1700, x2: 370, y2: 1820 },
  { x1: 891, y1: 1700, x2: 590, y2: 1820 },
];
export const SECTIONS = [
  { y: 176, label: '01 / РАЗВИЛКА', name: 'Развилка' },
  { y: 571, label: '02 / ПИНБОЛ', name: 'Пинбол' },
  { y: 962, label: '03 / ТУРБО-КАСКАДЫ', name: 'Турбо-каскады' },
  { y: 1430, label: '04 / ШЛЮЗЫ', name: 'Шлюзы' },
  { y: 1660, label: '05 / ФИНАЛЬНАЯ ВОРОНКА', name: 'Финальная воронка' },
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
