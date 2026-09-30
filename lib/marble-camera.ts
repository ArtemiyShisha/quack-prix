import { Box3, Vector3 } from 'three';
import { LEGACY_MARBLE_COURSE, type MarbleCourse } from './marble-track.ts';

export const CAMERA_FOV = 43;
export type CameraPose = { position: Vector3; target: Vector3 };
const pointCache = new WeakMap<MarbleCourse, Vector3[]>();
function pointsFor(course: MarbleCourse) {
  const cached = pointCache.get(course);
  if (cached) return cached;
  const points = course.TRACK_MESHES.flatMap((part) => {
    const vertices: Vector3[] = [];
    for (let i = 0; i < part.positions.length; i += 3)
      vertices.push(
        new Vector3(
          part.positions[i],
          part.positions[i + 1],
          part.positions[i + 2],
        ),
      );
    return vertices;
  });
  points.push(
    new Vector3(course.FUNNEL.x - 3, 4, course.MARBLE_FINISH_Z),
    new Vector3(course.FUNNEL.x + 3, 4, course.MARBLE_FINISH_Z),
  );
  pointCache.set(course, points);
  return points;
}

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

export function overviewCamera(
  aspect: number,
  course: MarbleCourse = LEGACY_MARBLE_COURSE,
): CameraPose {
  return fit(pointsFor(course), aspect, new Vector3(0.65, 1.5, 0.8));
}
export function finaleCamera(
  aspect: number,
  course: MarbleCourse = LEGACY_MARBLE_COURSE,
): CameraPose {
  return fit(
    pointsFor(course).filter((p) =>
      course.seed === null
        ? p.z >= course.FUNNEL.z - 12
        : p.y < 22 &&
          Math.hypot(p.x - course.FUNNEL.x, p.z - course.FUNNEL.z) < 40,
    ),
    aspect,
    new Vector3(-0.3, 1, 0.2),
  );
}
export function followCamera(
  z: number,
  aspect: number,
  course: MarbleCourse = LEGACY_MARBLE_COURSE,
): CameraPose {
  const { mainCentre, mainWidth, shortcutCentre, shortcutWidth } = course;
  const points: Vector3[] = [];
  for (
    let s = Math.max(-5, z - 10);
    s <= Math.min(course.pathLength, z + 15);
    s += 1
  ) {
    const p = mainCentre(s),
      width = mainWidth(s) + 1.5;
    if (course.hasShortcut && s >= course.shortcutFrom && s <= course.mergeTo) {
      const lower = shortcutCentre(s),
        half = shortcutWidth(s);
      points.push(
        new Vector3(lower.x - half, lower.y, lower.z),
        new Vector3(lower.x + half, lower.y + 2, lower.z),
      );
    }
    for (const x of [-width, width])
      for (const y of [0, 5]) points.push(new Vector3(p.x + x, p.y + y, p.z));
  }
  const back = course.cameraBack(z);
  return fit(
    points,
    aspect,
    course.seed === null
      ? new Vector3(0.18, 1, 0.4)
      : new Vector3(back.x * 0.75, 1.3, back.z * 0.75),
  );
}
