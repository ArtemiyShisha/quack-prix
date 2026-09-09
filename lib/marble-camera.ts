import { Box3, Vector3 } from 'three';
import {
  TRACK_MESHES,
  FUNNEL,
  MARBLE_FINISH_Z,
  mainCentre,
  mainWidth,
  shortcutCentre,
  shortcutWidth,
} from './marble-track.ts';

export const CAMERA_FOV = 43;
export type CameraPose = { position: Vector3; target: Vector3 };
const coursePoints = TRACK_MESHES.flatMap((part) => {
  const points: Vector3[] = [];
  for (let i = 0; i < part.positions.length; i += 3)
    points.push(
      new Vector3(
        part.positions[i],
        part.positions[i + 1],
        part.positions[i + 2],
      ),
    );
  return points;
});
coursePoints.push(
  new Vector3(FUNNEL.x - 3, 4, MARBLE_FINISH_Z),
  new Vector3(FUNNEL.x + 3, 4, MARBLE_FINISH_Z),
);

// Fit against both view axes: a portrait canvas needs a different camera distance.
function fit(
  points: Vector3[],
  aspect: number,
  direction: Vector3,
): CameraPose {
  const target = new Box3().setFromPoints(points).getCenter(new Vector3());
  const back = direction.clone().normalize();
  const right = new Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right).normalize();
  const tangent = Math.tan((CAMERA_FOV * Math.PI) / 360) * 0.86;
  let distance = 18;
  for (const point of points) {
    const delta = point.clone().sub(target),
      depth = delta.dot(back);
    distance = Math.max(
      distance,
      depth + Math.abs(delta.dot(right)) / (tangent * aspect),
      depth + Math.abs(delta.dot(up)) / tangent,
    );
  }
  return { target, position: back.multiplyScalar(distance).add(target) };
}

export function overviewCamera(aspect: number): CameraPose {
  return fit(coursePoints, aspect, new Vector3(0.65, 1.5, 0.8));
}
export function finaleCamera(aspect: number): CameraPose {
  return fit(
    coursePoints.filter((p) => p.z >= FUNNEL.z - 12),
    aspect,
    new Vector3(-0.3, 1, 0.2),
  );
}
export function followCamera(z: number, aspect: number): CameraPose {
  const points: Vector3[] = [];
  for (let s = Math.max(-5, z - 10); s <= Math.min(FUNNEL.z, z + 15); s += 1) {
    const p = mainCentre(s),
      width = mainWidth(s) + 1.5;
    if (s >= 33 && s <= 82) {
      const lower = shortcutCentre(s),
        half = shortcutWidth(s);
      points.push(
        new Vector3(lower.x - half, lower.y, s),
        new Vector3(lower.x + half, lower.y + 2, s),
      );
    }
    for (const x of [-width, width])
      for (const y of [0, 5]) points.push(new Vector3(p.x + x, p.y + y, s));
  }
  return fit(points, aspect, new Vector3(0.18, 1, 0.4));
}
