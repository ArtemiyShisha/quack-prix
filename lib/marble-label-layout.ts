export type LabelAnchor = {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type LabelBox = {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function placeMarbleLabels(
  anchors: LabelAnchor[],
  width: number,
  height: number,
): LabelBox[] {
  const result: LabelBox[] = [],
    gap = 4,
    pad = 7;
  for (const a of anchors) {
    if (a.width > width - pad * 2 || a.height > height - pad * 2) continue;
    const clampX = (x: number) =>
      Math.max(pad, Math.min(width - pad - a.width, x));
    const clampY = (y: number) =>
      Math.max(pad, Math.min(height - pad - a.height, y));
    const baseX = clampX(a.x - a.width / 2),
      baseY = clampY(a.y - a.height);
    const xs = [
      baseX,
      pad,
      width - pad - a.width,
      ...result.flatMap((r) => [r.x - a.width - gap, r.x + r.width + gap]),
    ].map(clampX);
    const ys = [
      baseY,
      pad,
      height - pad - a.height,
      ...result.flatMap((r) => [r.y - a.height - gap, r.y + r.height + gap]),
    ].map(clampY);
    let best: LabelBox | null = null,
      cost = Infinity;
    for (const x of new Set(xs))
      for (const y of new Set(ys)) {
        if (
          result.some(
            (r) =>
              x < r.x + r.width + gap &&
              x + a.width + gap > r.x &&
              y < r.y + r.height + gap &&
              y + a.height + gap > r.y,
          )
        )
          continue;
        const distance = (x - baseX) ** 2 + (y - baseY) ** 2;
        if (distance < cost) {
          cost = distance;
          best = { slot: a.slot, x, y, width: a.width, height: a.height };
        }
      }
    // If the viewport cannot fit a label, keep its marble visible without covering another name.
    if (best) result.push(best);
  }
  return result;
}
