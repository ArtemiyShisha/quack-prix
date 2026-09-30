import { seededRandom, shuffled } from './random.ts';

type EventKind = 'slalom' | 'waves' | 'bumpers' | 'pins';
export type CourseSection = {
  kind: EventKind | 'fork' | 'merge';
  name: string;
  from: number;
  to: number;
};
const names = {
  slalom: 'Виражи',
  waves: 'Волны',
  bumpers: 'Толкатели',
  pins: 'Штырьки',
  fork: 'Развилка',
  merge: 'Слияние',
};
const smooth = (t: number) => t * t * (3 - 2 * t);

export function createLayout(seed?: number) {
  const legacy = seed === undefined;
  const random = seededRandom((seed ?? 0) ^ 0x7b83a1d5);
  const order = legacy
    ? (['slalom', 'bumpers', 'waves', 'slalom'] as EventKind[])
    : shuffled<EventKind>(['slalom', 'waves', 'bumpers', 'pins'], () =>
        Math.floor(random() * 2 ** 32),
      );
  const lengths = legacy
    ? [17, 13, 14, 10]
    : order.map(() => 30 + Math.floor(random() * 7));
  const prefix = lengths[0] + lengths[1];
  const forkScale = legacy ? 1 : 1.35;
  // The two-level fork uses the proven intake and merge proportions.
  const canonical = [-5, 0, 17, 30, 47, 66, 82, 96, 106, 128, 133];
  const actual = [
    -5,
    0,
    lengths[0],
    prefix,
    prefix + 17 * forkScale,
    prefix + 36 * forkScale,
    prefix + 52 * forkScale,
    prefix + 52 * forkScale + lengths[2],
    prefix + 52 * forkScale + lengths[2] + lengths[3],
  ];
  actual.push(actual[8] + 22, actual[8] + 27);
  function map(value: number, from: number[], to: number[]) {
    const found = from.findIndex((v) => v >= value);
    const i = found < 0 ? from.length - 1 : Math.max(1, found);
    return (
      to[i - 1] +
      ((to[i] - to[i - 1]) * (value - from[i - 1])) / (from[i] - from[i - 1])
    );
  }
  const mapZ = (z: number) => map(z, canonical, actual);
  const canonicalZ = (z: number) => map(z, actual, canonical);
  const ranges = [
    [-5, actual[2]],
    [actual[2], actual[3]],
    [actual[6], actual[7]],
    [actual[7], actual[8]],
  ];
  const events = order.map(
    (kind, i): CourseSection => ({
      kind,
      name: names[kind],
      from: ranges[i][0],
      to: ranges[i][1],
    }),
  );
  const sections: CourseSection[] = [
    events[0],
    events[1],
    { kind: 'fork', name: names.fork, from: actual[3], to: actual[5] },
    { kind: 'merge', name: names.merge, from: actual[5], to: actual[6] },
    events[2],
    events[3],
  ];
  const slope = legacy ? 0.46 : 0.43 + random() * 0.035;
  const shortcutSide = legacy ? -1 : random() < 0.5 ? -1 : 1;
  let anchors: number[][];
  if (legacy)
    anchors = [
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
  else {
    anchors = [
      [-5, 0],
      [0, 0],
    ];
    let x = 0;
    const append = (section: CourseSection, final = false, end?: number) => {
      const span = section.to - Math.max(0, section.from);
      const start = Math.max(0, section.from);
      const sampledEnd = final
        ? 12.8
        : (random() < 0.5 ? -1 : 1) * (3 + random());
      const endX = end ?? sampledEnd;
      if (
        section.kind === 'slalom' &&
        !final &&
        (end === undefined || section.from === -5)
      ) {
        anchors.push([
          start + span * 0.5,
          x > 0 ? -3 - random() : 3 + random(),
        ]);
      } else if (end === undefined)
        anchors.push([start + span * 0.5, x + (endX - x) * 0.5]);
      anchors.push([section.to, endX]);
      x = endX;
    };
    append(events[0], false, shortcutSide * -3.5);
    // Preserve the broad approach into the island: a sharp bend at the fork
    // entrance creates a pocket in the bank even when the centre stays downhill.
    append({ ...events[1], to: mapZ(24) }, false, shortcutSide * -7);
    anchors.push(
      [mapZ(37), 0],
      [mapZ(50), shortcutSide * 7],
      [mapZ(62), shortcutSide * 2],
      [mapZ(74), shortcutSide * -7],
      [mapZ(82), shortcutSide * -4],
    );
    x = shortcutSide * -4;
    append(events[2]);
    append(events[3], true);
  }
  function mainCentre(z: number) {
    const found = anchors.findIndex((p) => p[0] >= z);
    const i = found < 0 ? anchors.length - 1 : Math.max(1, found);
    const a = anchors[i - 1],
      b = anchors[i];
    const t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0])));
    const waveSection = legacy
      ? { from: 58, to: 82 }
      : events.find((s) => s.kind === 'waves');
    const wave =
      waveSection && z > waveSection.from && z < waveSection.to
        ? 0.28 *
          Math.sin(
            (Math.PI * (z - waveSection.from)) /
              ((waveSection.to - waveSection.from) / (legacy ? 4 : 3)),
          ) **
            2
        : 0;
    return {
      x: a[1] + (b[1] - a[1]) * smooth(t),
      y: 6.84 + slope * (actual[8] - z) + wave,
      z,
    };
  }
  const pegs: { z: number; offset: number; radius: number }[] = [];
  const addPegs = (rows: number[], wide: boolean) =>
    rows.forEach((z, row) =>
      (wide ? [-2.8, 0, 2.8] : [-1.6, 1.6]).forEach((offset) =>
        pegs.push({
          z,
          offset: offset + (row % 2 ? (wide ? 1.1 : 0.5) : 0),
          radius: 0.55,
        }),
      ),
    );
  addPegs([49, 54, 59].map(mapZ), true);
  if (!legacy)
    for (const section of events.filter((s) => s.kind === 'pins')) {
      const span = section.to - section.from;
      addPegs(
        [0.25, 0.5, 0.75].map((t) => section.from + span * t),
        false,
      );
    }
  const bumpers: { z: number; offset: number; radius: number }[] = [];
  if (legacy)
    bumpers.push(
      { z: 19, offset: -1.35, radius: 0.62 },
      { z: 25, offset: 1.35, radius: 0.62 },
    );
  else
    for (const section of events.filter((s) => s.kind === 'bumpers'))
      [0.25, 0.55, 0.8].forEach((t, i) =>
        bumpers.push({
          z: section.from + (section.to - section.from) * t,
          offset: i % 2 ? 1.35 : -1.35,
          radius: 0.62,
        }),
      );
  return {
    mapZ,
    canonicalZ,
    mainCentre,
    sections,
    pegs,
    bumpers,
    shortcutSide,
    gravity: legacy ? 34 : 16,
    shortcutX: mainCentre(mapZ(37)).x + shortcutSide * 2.5,
    paddleSpeed: legacy ? 1.1 : 0.8 + random() * 0.7,
    bumperSpeed: legacy ? 0.95 : 0.65 + random() * 0.8,
    finishSpeed: legacy ? 1.35 : 0.85 + random() * 0.9,
    name: legacy
      ? 'Классическая трасса'
      : `${names[order[0]]} · ${names[order[1]]} · ${names[order[2]]} · ${names[order[3]]}`,
  };
}
