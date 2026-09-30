import * as THREE from 'three';
import {
  CAMERA_FOV,
  overviewCamera,
  finaleCamera,
  followCamera,
} from './marble-camera';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  MARBLE_RADIUS,
  troughHeight,
  LEGACY_MARBLE_COURSE,
  type MarbleCourse,
} from './marble-track';
import { COLOURS } from './track';
import type { MarbleFrame } from './marble-race';
import type { Member } from './roster';

export function createMarbleScene(
  host: HTMLDivElement,
  onFailure: () => void,
  course: MarbleCourse = LEGACY_MARBLE_COURSE,
) {
  const {
    TRACK_MESHES,
    BUMPERS,
    ROTATORS,
    ISLAND_3D,
    PADDLE_3D,
    FUNNEL,
    MARBLE_FINISH_Z,
    mainCentre,
    marbleStart,
    RUNOUT_START,
    runoutCentre,
    PEGS,
    FINISH_GATE,
    SHORTCUT_ENTRY,
    mainWidth,
    shortcutCentre,
    shortcutWidth,
  } = course;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dceaf2');
  scene.fog = new THREE.Fog('#dceaf2', 350, 950);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute(
    'aria-label',
    'Объёмная трасса с катящимися шариками',
  );
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 18;
  controls.maxDistance = 420;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.enabled = false;
  const light = new THREE.DirectionalLight('#fff4df', 3.2);
  light.position.set(-20, mainCentre(0).y + 35, FUNNEL.z * 0.45);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {
    left: -40,
    right: 40,
    top: FUNNEL.z * 0.7,
    bottom: -FUNNEL.z * 0.7,
    near: 0.5,
    far: FUNNEL.z + 130,
  });
  if (course.seed !== null)
    Object.assign(light.shadow.camera, {
      left: -90,
      right: 90,
      top: 90,
      bottom: -90,
      far: 300,
    });
  light.shadow.bias = -0.0005;
  light.target.position.set(
    (course.bounds.minX + course.bounds.maxX) / 2,
    mainCentre(course.pathLength / 2).y,
    (course.bounds.minZ + course.bounds.maxZ) / 2,
  );
  scene.add(
    light,
    light.target,
    new THREE.HemisphereLight('#f0fbff', '#8d91a9', 2.4),
  );
  const fill = new THREE.DirectionalLight('#b7caff', 1.2);
  fill.position.set(30, 25, -20);
  scene.add(fill);
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  const material = (colour: string, roughness = 0.38) => {
    const m = new THREE.MeshStandardMaterial({
      color: colour,
      roughness,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    materials.push(m);
    return m;
  };
  const white = material('#fff4e5'),
    support = material('#aac3d2'),
    peach = material('#f09168'),
    purple = material('#7865ad');
  const mesh = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    geometries.push(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  };
  for (const part of TRACK_MESHES) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    g.setIndex(part.indices);
    g.computeVertexNormals();
    const surface = material(part.colour);
    if (part.opacity !== undefined) {
      surface.transparent = true;
      surface.opacity = part.opacity;
      surface.depthWrite = false;
      surface.roughness = 0.2;
    }
    const trackPart = mesh(g, surface);
    if (part.opacity !== undefined) trackPart.castShadow = false;
    for (const edge of part.edges) {
      const curve = new THREE.CatmullRomCurve3(
        edge.map((p) => new THREE.Vector3(p.x, p.y + 0.05, p.z)),
      );
      mesh(
        new THREE.TubeGeometry(
          curve,
          Math.max(32, edge.length),
          0.11,
          6,
          false,
        ),
        white,
      );
    }
  }
  const ground = mesh(
    new THREE.PlaneGeometry(400, 400),
    material('#c5dbe6'),
    0,
    -4,
    40,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const grid = new THREE.GridHelper(240, 60, '#adcbdc', '#b9d3e2');
  grid.position.set(0, -3.99, 40);
  scene.add(grid);
  for (let z = 0; z < course.pathLength - 6; z += 18) {
    const p = mainCentre(z),
      h = p.y + 4;
    if (course.seed !== null) {
      const next = mainCentre(z + 0.01),
        angle = Math.atan2(next.x - p.x, next.z - p.z),
        width = mainWidth(z) + 0.8;
      for (const side of [-1, 1]) {
        const x = p.x + Math.cos(angle) * width * side,
          s = p.z - Math.sin(angle) * width * side;
        mesh(
          new THREE.CylinderGeometry(0.28, 0.42, h, 10),
          support,
          x,
          p.y - h / 2,
          s,
        );
        mesh(
          new THREE.CylinderGeometry(0.85, 0.85, 0.22, 16),
          white,
          x,
          -3.85,
          s,
        );
      }
      const beam = mesh(
        new THREE.BoxGeometry(width * 2, 0.3, 0.5),
        white,
        p.x,
        p.y - 0.35,
        p.z,
      );
      beam.rotation.y = angle;
      continue;
    }
    const lower =
      z >= course.shortcutFrom && z <= course.mergeTo ? shortcutCentre(z) : p;
    const lowerWidth =
      z >= course.shortcutFrom && z <= course.mergeTo
        ? shortcutWidth(z)
        : mainWidth(z);
    const left = Math.min(p.x - mainWidth(z), lower.x - lowerWidth) - 0.8;
    const right = Math.max(p.x + mainWidth(z), lower.x + lowerWidth) + 0.8;
    for (const legX of [left, right]) {
      mesh(
        new THREE.CylinderGeometry(0.28, 0.42, h, 10),
        support,
        legX,
        p.y - h / 2,
        z,
      );
      mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.22, 16),
        white,
        legX,
        -3.85,
        z,
      );
    }
    mesh(
      new THREE.BoxGeometry(right - left, 0.3, 0.5),
      white,
      (left + right) / 2,
      lower.y - 0.35,
      z,
    );
  }
  for (const angle of [0, Math.PI * 0.66, Math.PI * 1.33]) {
    const x = FUNNEL.x + Math.cos(angle) * 7,
      z = FUNNEL.z + Math.sin(angle) * 7;
    mesh(new THREE.CylinderGeometry(0.34, 0.5, 10, 12), support, x, 1, z);
  }
  mesh(new THREE.BoxGeometry(8, 4, 0.3), white, 0, mainCentre(-5).y + 2, -5);
  mesh(new THREE.BoxGeometry(7, 1.2, 0.3), white, FUNNEL.x, 2.1, RUNOUT_START);
  const bumperMeshes = BUMPERS.map((b) => [
    mesh(
      new THREE.CylinderGeometry(b.radius, b.radius, b.height, 24),
      peach,
      b.x,
      b.y,
      b.z,
    ),
    mesh(
      new THREE.CylinderGeometry(b.radius * 0.75, b.radius * 0.75, 0.12, 24),
      white,
      b.x,
      b.y + b.height / 2 + 0.02,
      b.z,
    ),
  ]);
  const rotorMeshes = ROTATORS.map((r, i) => {
    const colour = material(i % 2 ? '#ee6388' : '#8d59cf', 0.25);
    const parts = Array.from({ length: r.blades }, (_, blade) => {
      const part = mesh(
        new THREE.BoxGeometry(r.length, r.height, r.width),
        colour,
        r.x,
        r.y,
        r.z,
      );
      part.rotation.y = r.phase + (blade * Math.PI) / 2;
      return part;
    });
    mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.3, 20),
      white,
      r.x,
      r.y + r.height / 2 + 0.15,
      r.z,
    );
    return parts;
  });
  const island = ISLAND_3D;
  const islandMesh = mesh(
    new THREE.BoxGeometry(
      island.radius * 2,
      island.height,
      island.halfLength * 2,
    ),
    peach,
    island.x,
    island.y + island.height / 2,
    island.z,
  );
  islandMesh.rotation.y = island.angle;
  for (const sign of [-1, 1])
    mesh(
      new THREE.CylinderGeometry(
        island.radius,
        island.radius,
        island.height,
        32,
      ),
      peach,
      island.x + Math.sin(island.angle) * island.halfLength * sign,
      island.y + island.height / 2,
      island.z + Math.cos(island.angle) * island.halfLength * sign,
    );
  const gate = PADDLE_3D,
    paddle = mesh(
      new THREE.BoxGeometry(gate.length, gate.height, gate.width),
      purple,
      gate.x,
      gate.y + gate.height / 2,
      gate.z,
    );
  mesh(
    new THREE.CylinderGeometry(0.2, 0.2, gate.height + 0.2, 16),
    white,
    gate.x,
    gate.y + gate.height / 2,
    gate.z,
  );
  for (const peg of PEGS) {
    mesh(
      new THREE.CylinderGeometry(peg.radius, peg.radius, peg.height, 20),
      peach,
      peg.x,
      peg.y + peg.height / 2,
      peg.z,
    );
    mesh(
      new THREE.CylinderGeometry(peg.radius * 0.8, peg.radius * 0.8, 0.12, 16),
      white,
      peg.x,
      peg.y + peg.height + 0.04,
      peg.z,
    );
  }
  if (course.hasShortcut) {
    const rim: THREE.Vector3[] = [];
    const entry = SHORTCUT_ENTRY;
    for (const [x, z] of [
      [entry.x - entry.halfWidth, entry.z - entry.halfLength],
      [entry.x + entry.halfWidth, entry.z - entry.halfLength],
      [entry.x + entry.halfWidth, entry.z + entry.halfLength],
      [entry.x - entry.halfWidth, entry.z + entry.halfLength],
      [entry.x - entry.halfWidth, entry.z - entry.halfLength],
    ])
      rim.push(
        new THREE.Vector3(
          x,
          mainCentre(z).y +
            troughHeight((x - mainCentre(z).x) / mainWidth(z)) +
            0.07,
          z,
        ),
      );
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(rim, false, 'centripetal'),
        48,
        0.1,
        6,
        false,
      ),
      material('#29bba1'),
    );
  }
  const finaleGate = mesh(
    new THREE.BoxGeometry(
      FINISH_GATE.length,
      FINISH_GATE.height,
      FINISH_GATE.width,
    ),
    purple,
    FINISH_GATE.x,
    FINISH_GATE.y + FINISH_GATE.height / 2 - 0.2,
    FINISH_GATE.z,
  );
  mesh(
    new THREE.CylinderGeometry(0.2, 0.2, FINISH_GATE.height + 0.1, 16),
    peach,
    FINISH_GATE.x,
    FINISH_GATE.y + FINISH_GATE.height / 2 - 0.2,
    FINISH_GATE.z,
  );
  // The finish surface and arch share the physical crossing coordinate.
  const finishY = runoutCentre(MARBLE_FINISH_Z).y + 0.025;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 2; j++)
      mesh(
        new THREE.BoxGeometry(0.5, 0.035, 0.5),
        i % 2 === j ? purple : white,
        FUNNEL.x - 1.75 + i * 0.5,
        finishY,
        MARBLE_FINISH_Z + (j - 0.5) * 0.5,
      );
  for (const side of [-1, 1])
    mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 3.7, 12),
      purple,
      FUNNEL.x + side * 2.5,
      finishY + 1.8,
      MARBLE_FINISH_Z,
    );
  mesh(
    new THREE.BoxGeometry(5.4, 0.55, 0.22),
    peach,
    FUNNEL.x,
    finishY + 3.7,
    MARBLE_FINISH_Z,
  );
  type Ball = {
    mesh: THREE.Mesh;
    material: THREE.MeshPhysicalMaterial;
  };
  let balls: Ball[] = [],
    key = '',
    frame: MarbleFrame | null = null,
    members: Member[] = [],
    overview = false,
    lastOverview: boolean | null = null,
    disposed = false,
    request = 0;
  const sphere = new THREE.SphereGeometry(MARBLE_RADIUS, 32, 24);
  geometries.push(sphere);
  const initial = followCamera(0, 1, course);
  const focus = initial.target.clone(),
    position = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  function setMembers(list: Member[]) {
    const nextKey = list.map((p) => p.id + ':' + p.name).join('|');
    if (nextKey === key) return;
    key = nextKey;
    for (const b of balls) {
      scene.remove(b.mesh);
      b.material.dispose();
    }
    balls = list.map((member, slot) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: COLOURS[member.id % 8],
        roughness: 0.19,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
      const object = new THREE.Mesh(sphere, mat);
      object.castShadow = true;
      object.receiveShadow = true;
      const p = marbleStart(slot, list.length);
      object.position.set(p.x, p.y, p.z);
      scene.add(object);
      return { mesh: object, material: mat };
    });
  }
  let wholePose = overviewCamera(1, course),
    finalPose = finaleCamera(1, course);
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wholePose = overviewCamera(camera.aspect, course);
    finalPose = finaleCamera(camera.aspect, course);
    controls.maxDistance = Math.max(
      420,
      wholePose.position.distanceTo(wholePose.target) * 1.6,
    );
    lastOverview = null;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const loss = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(request);
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', loss);
  function draw() {
    if (disposed) return;
    request = requestAnimationFrame(draw);
    if (document.hidden) return;
    setMembers(
      members.length
        ? members
        : Array.from({ length: 8 }, (_, id) => ({
            id,
            name: '',
            active: true,
          })),
    );
    balls.forEach((b, i) => {
      const p = frame?.marbles[i] ?? marbleStart(i, balls.length);
      position.set(p.x, p.y, p.z);
      b.mesh.position.lerp(position, 0.6);
      const state = frame?.marbles[i];
      if (state) {
        rotation.set(state.qx, state.qy, state.qz, state.qw);
        b.mesh.quaternion.slerp(rotation, 0.6);
      }
    });
    paddle.rotation.y = frame?.paddleAngle ?? 0.4;
    finaleGate.rotation.y = frame?.finishGateAngle ?? 0.78;
    rotorMeshes.forEach((parts, i) =>
      parts.forEach((part, blade) => {
        part.rotation.y =
          (frame?.rotorAngles?.[i] ?? ROTATORS[i].phase) +
          (blade * Math.PI) / 2;
      }),
    );
    bumperMeshes.forEach((pair, i) =>
      pair.forEach((m) => {
        m.position.x = frame?.bumperX[i] ?? BUMPERS[i].x;
        m.position.z = frame?.bumperZ?.[i] ?? BUMPERS[i].z;
      }),
    );
    const leader = frame?.marbles.reduce((a, b) =>
      a.progress > b.progress ? a : b,
    );
    const inFinale =
      leader &&
      (leader.stage > 0 || leader.parameter >= course.pathLength - 12);
    const pose = overview
      ? wholePose
      : inFinale
        ? finalPose
        : followCamera(leader?.parameter ?? 0, camera.aspect, course);
    if (lastOverview !== overview) {
      lastOverview = overview;
      controls.enabled = overview;
      camera.position.copy(pose.position);
      focus.copy(pose.target);
      controls.target.copy(pose.target);
      camera.lookAt(focus);
    }
    if (overview) controls.update();
    else {
      camera.position.lerp(pose.position, 0.09);
      focus.lerp(pose.target, 0.09);
      camera.lookAt(focus);
    }
    renderer.render(scene, camera);
  }
  draw();
  return {
    update(next: MarbleFrame | null, people: Member[], showAll: boolean) {
      frame = next;
      members = people.filter((p) => p.active && p.name.trim());
      overview = showAll;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', loss);
      for (const b of balls) {
        b.material.dispose();
      }
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
