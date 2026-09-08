export const WIDTH = 960;
export const WALL_X = [56, 904];
export const HEIGHT = 1760;
export const VIEW_HEIGHT = 760;
export const RADIUS = 23;
export const FINISH_Y = 1680;
export const PEGS = [
  ...Array.from({ length: 6 }, (_, i) => ({
    x: 145 + i * 134,
    y: 218,
    radius: 16,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    x: 212 + i * 134,
    y: 296,
    radius: 16,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    x: 240 + i * 155,
    y: 934 + (i % 2) * 56,
    radius: 20,
  })),
];
export const ROTORS = [
  { x: 750, y: 565, length: 168, thickness: 22, direction: 1 },
  { x: 221, y: 850, length: 150, thickness: 22, direction: -1 },
  { x: 743, y: 1260, length: 180, thickness: 22, direction: 1 },
  { x: 480, y: 1550, length: 134, thickness: 19, direction: -1 },
];
export const SLOPES = [
  { x1: 69, y1: 361, x2: 695, y2: 466 },
  { x1: 891, y1: 674, x2: 264, y2: 786 },
  { x1: 69, y1: 1070, x2: 706, y2: 1185 },
];
export const RAILS = [
  { x1: 69, y1: 1440, x2: 370, y2: 1620 },
  { x1: 891, y1: 1440, x2: 590, y2: 1620 },
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
