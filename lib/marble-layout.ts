export type EventKind = 'slalom' | 'waves' | 'bumpers' | 'pins';
export type CourseSection = {
  kind: EventKind | 'fork' | 'merge';
  name: string;
  from: number;
  to: number;
};

/** The original course is retained as a fixed physical regression fixture. */
export function createLegacyLayout() {
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
  function mainCentre(z: number) {
    const found = anchors.findIndex((p) => p[0] >= z),
      i = found < 0 ? anchors.length - 1 : Math.max(1, found),
      a = anchors[i - 1],
      b = anchors[i];
    const t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
    const wave =
      z > 58 && z < 82 ? 0.28 * Math.sin((Math.PI * (z - 58)) / 6) ** 2 : 0;
    return {
      x: a[1] + (b[1] - a[1]) * smooth(t),
      y: 55.6 - 0.46 * z + wave,
      z,
    };
  }
  const sections: CourseSection[] = [
    { kind: 'slalom', name: 'Серпантин', from: -5, to: 17 },
    { kind: 'bumpers', name: 'Толкатели', from: 17, to: 30 },
    { kind: 'fork', name: 'Развилка', from: 30, to: 66 },
    { kind: 'merge', name: 'Слияние', from: 66, to: 82 },
    { kind: 'waves', name: 'Волны', from: 82, to: 96 },
    { kind: 'slalom', name: 'Финал', from: 96, to: 106 },
  ];
  const pegs = [49, 54, 59].flatMap((z, row) =>
    [-2.8, 0, 2.8].map((offset) => ({
      z,
      offset: offset + (row % 2 ? 1.1 : 0),
      radius: 0.55,
    })),
  );
  return {
    mainCentre,
    sections,
    pegs,
    bumpers: [
      { z: 19, offset: -1.35, radius: 0.62 },
      { z: 25, offset: 1.35, radius: 0.62 },
    ],
    mapZ: (z: number) => z,
    canonicalZ: (z: number) => z,
    shortcutSide: -1,
    shortcutX: -2.5,
    gravity: 34,
    paddleSpeed: 1.1,
    bumperSpeed: 0.95,
    finishSpeed: 1.35,
    name: 'Классическая трасса',
  };
}
