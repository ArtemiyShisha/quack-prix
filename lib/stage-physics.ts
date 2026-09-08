import Matter from 'matter-js';
import { RADIUS, type Stage, type Point } from './track.ts';
const { Bodies, Body } = Matter;

export function railBody(a: Point, b: Point, width = 14) {
  return Bodies.rectangle(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    Math.hypot(b.x - a.x, b.y - a.y) + 3,
    width,
    {
      isStatic: true,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      restitution: 0.45,
      friction: 0.001,
      chamfer: { radius: 4 },
    },
  );
}

export function stageWalls(stage: Stage) {
  const points =
    stage.kind === 'bowl'
      ? Array.from({ length: 64 }, (_, i) => ({
          x: stage.x + Math.cos((i * Math.PI * 2) / 64) * stage.radius,
          y: stage.y + Math.sin((i * Math.PI * 2) / 64) * stage.radius,
        }))
      : stage.outline;
  return points.map((a, i) => railBody(a, points[(i + 1) % points.length]));
}

// Backstop for rare discrete-step penetration: reflect only at the local solid wall.
export function containBody(body: Matter.Body, stage: Stage) {
  const margin = RADIUS + 7;
  const correct = (nx: number, ny: number, depth: number) => {
    if (depth <= 1) return;
    const v = { x: body.velocity.x, y: body.velocity.y },
      normal = v.x * nx + v.y * ny;
    Body.setPosition(body, {
      x: body.position.x + nx * depth,
      y: body.position.y + ny * depth,
    });
    if (normal < 0)
      Body.setVelocity(body, {
        x: v.x - 1.45 * normal * nx,
        y: v.y - 1.45 * normal * ny,
      });
  };
  if (stage.kind === 'bowl') {
    const dx = stage.x - body.position.x,
      dy = stage.y - body.position.y,
      radius = Math.hypot(dx, dy);
    if (radius)
      correct(dx / radius, dy / radius, radius - stage.radius + margin);
  } else {
    for (let iteration = 0; iteration < 2; iteration++) {
      stage.outline.forEach((a, i) => {
        const b = stage.outline[(i + 1) % stage.outline.length],
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy);
        const nx = -dy / length,
          ny = dx / length;
        correct(
          nx,
          ny,
          margin -
            ((body.position.x - a.x) * nx + (body.position.y - a.y) * ny),
        );
      });
    }
  }
}
