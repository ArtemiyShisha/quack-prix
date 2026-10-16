import { freshSeed, seededRandom, type Uint32Source } from './random.ts';

export const MARBLE_PREVIEW_SEED = 20260930;
export function nextMarbleSeed(
  previousSeed: number,
  source: Uint32Source = freshSeed,
): number {
  const previousStyle = createParkPath(previousSeed).style;
  let seed: number;
  do {
    seed = source();
  } while (createParkPath(seed).style === previousStyle);
  return seed;
}

type FlatPoint = { x: number; z: number; heading: number };
type Segment = {
  from: number;
  to: number;
  start: FlatPoint;
  curvature: number;
};

/** Arc length is the route coordinate; world Z may reverse or return to itself. */
export function createParkPath(seed: number) {
  const random = seededRandom(seed ^ 0x53af189d);
  const styleIndex = Math.floor(random() * 3);
  const style = ['Серпантин', 'Спираль', 'Двойное кольцо'][styleIndex];
  const mirror = random() < 0.5 ? -1 : 1;
  const segments: Segment[] = [];
  let length = 0,
    current: FlatPoint = { x: 0, z: 0, heading: 0 };
  function advance(
    start: FlatPoint,
    distance: number,
    curvature: number,
  ): FlatPoint {
    if (!curvature)
      return {
        x: start.x + Math.sin(start.heading) * distance,
        z: start.z + Math.cos(start.heading) * distance,
        heading: start.heading,
      };
    const angle = start.heading + distance * curvature;
    return {
      x: start.x + (Math.cos(start.heading) - Math.cos(angle)) / curvature,
      z: start.z + (Math.sin(angle) - Math.sin(start.heading)) / curvature,
      heading: angle,
    };
  }
  const add = (distance: number, curvature = 0) => {
    segments.push({
      from: length,
      to: length + distance,
      start: current,
      curvature,
    });
    current = advance(current, distance, curvature);
    length += distance;
  };
  add(8);
  if (styleIndex === 0) {
    const radius = 8.5 + random() * 2;
    const straight = 24 + random() * 5;
    add(straight);
    add(Math.PI * radius, mirror / radius);
    add(straight + random() * 3);
    add(Math.PI * radius, -mirror / radius);
    add(straight);
  } else if (styleIndex === 1) {
    const radius = 18 + random() * 3;
    add(Math.PI * 2 * radius, mirror / radius);
    add(16 + random() * 5);
  } else {
    const radius = 14 + random() * 2;
    add(Math.PI * 2 * radius, mirror / radius);
    add(Math.PI * 2 * radius, -mirror / radius);
    add(16);
  }
  add(12);
  function at(s: number): FlatPoint {
    const section = segments.find((p) => p.to >= s) ?? segments.at(-1)!;
    return advance(section.start, s - section.from, section.curvature);
  }
  return { style, length, at };
}
