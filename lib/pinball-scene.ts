import * as THREE from 'three';
import {
  BUMPERS,
  JUMP,
  GUIDES,
  DECK,
  FLIPPERS,
  KICKERS,
  PINBALL,
  RAMPS,
  RAILS,
  ROTOR,
  RUNOUT,
  boardHeight,
  runoutHeight,
  flipperPose,
  mechanismOrientation,
  type PinballFrame,
  type Surface,
} from './pinball';
import { COLOURS } from './track';
import type { Member } from './roster';

export function createPinballScene(
  host: HTMLDivElement,
  onFailure: () => void,
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e8eff0');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute(
    'aria-label',
    '3D-пинбол: цветные шарики отскакивают от грибков, лопаток и возвращаются по боковым горкам',
  );
  host.appendChild(renderer.domElement);
  const labels = document.createElement('div');
  labels.className = 'pinball-labels';
  labels.setAttribute('aria-hidden', 'true');
  host.appendChild(labels);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 110);
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  function geometry<T extends THREE.BufferGeometry>(g: T): T {
    geometries.push(g);
    return g;
  }
  function material(colour: string, roughness = 0.4, metalness = 0.08) {
    const m = new THREE.MeshStandardMaterial({
      color: colour,
      roughness,
      metalness,
    });
    materials.push(m);
    return m;
  }
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D = scene,
  ) {
    const view = new THREE.Mesh(g, m);
    view.castShadow = true;
    view.receiveShadow = true;
    parent.add(view);
    return view;
  }
  scene.add(new THREE.HemisphereLight('#f9ffff', '#587482', 2.8));
  const sun = new THREE.DirectionalLight('#fff1dd', 3.7);
  sun.position.set(-8, 21, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 18,
    bottom: -18,
    near: 0.5,
    far: 45,
  });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const navy = material('#163b4c', 0.65),
    edge = material('#e5eeec', 0.28),
    wood = material('#be8e5e', 0.65),
    gold = material('#f4bc51', 0.28, 0.25);
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const sphere = geometry(new THREE.SphereGeometry(1, 28, 20));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 32));
  const ring = geometry(new THREE.TorusGeometry(1, 0.055, 8, 40));
  const base = mesh(box, wood);
  base.scale.set(PINBALL.width + 0.45, 0.65, PINBALL.length + 0.6);
  base.position.set(0, -0.43, 0);
  base.rotation.x = Math.atan(PINBALL.slope);
  function surface(s: Surface, m: THREE.Material) {
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(s.positions, 3),
    );
    g.setIndex(s.indices);
    g.computeVertexNormals();
    return mesh(g, m);
  }
  surface(DECK, navy);
  surface(RUNOUT, gold);
  const floor = mesh(
    geometry(new THREE.PlaneGeometry(150, 150)),
    material('#e8eff0', 0.9),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.8;
  floor.castShadow = false;
  // Physical deck, rails, ramp triangles and mechanism poses come from the simulation module.
  for (const rail of [...RAILS, ...GUIDES]) {
    const a = new THREE.Vector3(rail.a.x, rail.a.y, rail.a.z),
      b = new THREE.Vector3(rail.b.x, rail.b.y, rail.b.z),
      direction = b.clone().sub(a);
    const view = mesh(box, GUIDES.includes(rail) ? gold : edge);
    view.scale.set(direction.length(), rail.height, rail.width);
    view.position.copy(a.add(b).multiplyScalar(0.5));
    view.position.y += rail.height / 2;
    view.quaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      direction.normalize(),
    );
  }
  const rampMaterial = material('#56c8b8', 0.3, 0.2);
  [JUMP, ...RAMPS].forEach((ramp) => {
    const laneView = surface(
      ramp,
      ramp === JUMP
        ? material('#f2be61', 0.3, 0.2)
        : ramp === RAMPS[1]
          ? material('#ef8b72', 0.3, 0.15)
          : rampMaterial,
    );
    // The level approach shares the deck plane; avoid two coplanar draw surfaces.
    laneView.position.y = 0.01;
    const support = material('#90aaa9', 0.65);
    for (let i = 8; i < ramp.edges[0].length; i += 14) {
      const a = ramp.edges[0][i],
        b = ramp.edges[1][i];
      const post = mesh(cylinder, support);
      const y = Math.min(a.y, b.y);
      post.scale.set(0.07, y + 2.6, 0.07);
      post.position.set((a.x + b.x) / 2, (y - 2.6) / 2, (a.z + b.z) / 2);
    }
    // Visible arrows follow the same centreline as the physical lane.
    const lane = ramp.centre!;
    const marks = Array.from({ length: ramp === JUMP ? 4 : 12 }, (_, i) =>
      Math.floor(((i + 0.5) / (ramp === JUMP ? 4 : 12)) * (lane.length - 3)),
    );
    for (const i of marks) {
      const a = lane[i],
        b = lane[Math.min(i + 3, lane.length - 1)];
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize(),
        new THREE.Vector3(a.x, a.y + 0.08, a.z),
        i < 36 && ramp !== JUMP ? 1.0 : 0.8,
        i < 36 && ramp !== JUMP ? '#ffe39d' : '#f4fffc',
        0.35,
        0.32,
      );
      scene.add(arrow);
      geometries.push(arrow.line.geometry, arrow.cone.geometry);
      materials.push(...[arrow.line.material, arrow.cone.material].flat());
    }
  });
  const bumperViews = BUMPERS.map((b, i) => {
    const group = new THREE.Group();
    group.position.set(b.x, boardHeight(b.z), b.z);
    scene.add(group);
    const foot = mesh(cylinder, gold, group);
    foot.scale.set(b.radius, 0.26, b.radius);
    foot.position.y = 0.13;
    const stem = mesh(cylinder, edge, group);
    stem.scale.set(b.radius * 0.73, 0.68, b.radius * 0.73);
    stem.position.y = 0.56;
    const capSurface = material(i === 2 ? '#f16e51' : '#64dac1', 0.24, 0.15);
    capSurface.emissive.set(capSurface.color);
    capSurface.emissiveIntensity = 0.12;
    const cap = mesh(sphere, capSurface, group);
    cap.scale.set(b.radius, 0.27, b.radius);
    cap.position.y = 1.05;
    const rim = mesh(ring, edge, group);
    rim.rotation.x = Math.PI / 2;
    rim.scale.setScalar(b.radius * 0.87);
    rim.position.y = 0.9;
    return { cap, capSurface };
  });
  const kickerViews = KICKERS.map((k, index) => {
    const group = new THREE.Group();
    group.position.set(k.x, boardHeight(k.z), k.z);
    const lane = (index < 2 ? RAMPS[index] : JUMP).centre!;
    group.rotation.y = Math.atan2(
      -(lane[1].x - lane[0].x),
      -(lane[1].z - lane[0].z),
    );
    scene.add(group);
    const platform = mesh(cylinder, gold, group);
    const platformRadius = index < 2 ? 0.65 : k.radius;
    platform.scale.set(platformRadius, 0.08, platformRadius);
    platform.position.set(0, 0.03, 0);
    const coilPoints = Array.from({ length: 100 }, (_, i) => {
      const t = i / 99,
        a = t * Math.PI * 10;
      return new THREE.Vector3(
        Math.cos(a) * 0.19,
        0.15 + Math.sin(a) * 0.19,
        0.5 + t * 0.55,
      );
    });
    mesh(
      geometry(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(coilPoints),
          100,
          0.035,
          6,
          false,
        ),
      ),
      edge,
      group,
    );
    const plate = mesh(box, gold, group);
    plate.scale.set(0.72, 0.38, 0.16);
    plate.position.set(0, 0.3, 0.43);
    return plate;
  });
  const coral = material('#f5795b', 0.3),
    rotorSurface = material('#f1bd59', 0.3, 0.15);
  const flippers = FLIPPERS.map((f) => {
    const view = mesh(box, coral);
    view.scale.set(f.length, f.height, f.width);
    const pivot = mesh(cylinder, gold);
    pivot.scale.set(0.24, f.height + 0.12, 0.24);
    pivot.position.set(f.x, boardHeight(f.z) + f.height / 2, f.z);
    return view;
  });
  const rotor = new THREE.Group();
  rotor.position.set(ROTOR.x, boardHeight(ROTOR.z) + ROTOR.height / 2, ROTOR.z);
  scene.add(rotor);
  for (const angle of [0, Math.PI / 2]) {
    const blade = mesh(box, rotorSurface, rotor);
    blade.scale.set(ROTOR.length, ROTOR.height, ROTOR.width);
    blade.rotation.y = angle;
  }
  const hub = mesh(cylinder, edge, rotor);
  hub.scale.set(0.24, 0.8, 0.24);

  function decal(
    text: string,
    x: number,
    z: number,
    width: number,
    colour = '#b0d2d7',
    height = 0.65,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '800 65px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.fillText(text, 384, 85, 730);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    materials.push(mat);
    const view = mesh(geometry(new THREE.PlaneGeometry(width, height)), mat);
    view.rotation.x = -Math.PI / 2 + Math.atan(PINBALL.slope);
    view.position.set(x, boardHeight(z) + 0.012, z);
    view.castShadow = false;
    return texture;
  }
  const textures = [
    decal('КРЯК–РАЛЛИ', 0, -11.6, 5.2, '#eef4df', 0.7),
    decal('ОРБИТА', 0, -9.25, 2.2, '#ffe39d', 0.4),
    decal('РАМПА ↓', -2.65, -4.9, 2.3, '#8bf0d3', 0.42),
    decal('РАМПА ↓', 2.65, -4.9, 2.3, '#ffc0a5', 0.42),
    decal('ПРЫЖОК ↓', 0, -2.3, 2.3, '#ffe39d', 0.48),
    decal('ФИНИШ', 0, 11.58, 1.45, '#ffe39d', 0.46),
  ];
  // Painted approach lines show the downhill fan without adding barriers.
  function paintedLine(
    points: THREE.Vector3[],
    colour: string,
    opacity = 0.45,
  ) {
    const shape = geometry(new THREE.BufferGeometry().setFromPoints(points));
    const ink = new THREE.LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
    });
    materials.push(ink);
    const line = new THREE.Line(shape, ink);
    scene.add(line);
  }
  for (const side of [-1, 1]) {
    paintedLine(
      [
        new THREE.Vector3(side * 1.2, boardHeight(-5.4) + 0.015, -5.4),
        new THREE.Vector3(side * 2.65, boardHeight(-4.5) + 0.015, -4.5),
      ],
      side < 0 ? '#efac8b' : '#77e2ca',
    );
    const orbit = Array.from({ length: 70 }, (_, i) => {
      const t = i / 69;
      return new THREE.Vector3(
        side * (5.5 - 1.7 * Math.sin(Math.PI * t)),
        boardHeight(-3 - 7.7 * t) + 0.015,
        -3 - 7.7 * t,
      );
    });
    paintedLine(orbit, '#f4cb73', 0.65);
  }
  const takeoff = JUMP.centre!.at(-1)!;
  const lip = mesh(box, gold);
  lip.scale.set(1.58, 0.05, 0.1);
  lip.position.set(takeoff.x, takeoff.y + 0.02, takeoff.z);
  lip.rotation.y = Math.atan2(-0.6, 3.4);
  for (let i = 0; i < 8; i++) {
    const mark = mesh(box, i % 2 ? navy : edge);
    mark.scale.set(0.23, 0.025, 0.18);
    mark.position.set(
      -0.805 + i * 0.23,
      runoutHeight(PINBALL.finishZ) + 0.018,
      PINBALL.finishZ - 0.18,
    );
  }
  const goalRing = mesh(ring, gold);
  goalRing.scale.set(0.84, 0.66, 0.84);
  goalRing.rotation.x = Math.PI / 2;
  goalRing.position.set(
    0,
    runoutHeight(PINBALL.finishZ + 0.5) - 0.1,
    PINBALL.finishZ + 0.5,
  );

  type BallView = {
    group: THREE.Group;
    skin: THREE.MeshStandardMaterial;
    label: HTMLDivElement;
    trail: THREE.Line;
    history: THREE.Vector3[];
  };
  let balls: BallView[] = [],
    memberKey = '',
    frame: PinballFrame | null = null,
    people: Member[] = [],
    disposed = false,
    request = 0;
  const ballShape = geometry(new THREE.SphereGeometry(PINBALL.radius, 28, 20));
  const stripeShape = geometry(
    new THREE.TorusGeometry(PINBALL.radius * 0.994, 0.034, 8, 32),
  );
  function clearBalls() {
    for (const ball of balls) {
      scene.remove(ball.group, ball.trail);
      ball.skin.dispose();
      ball.trail.geometry.dispose();
      (ball.trail.material as THREE.Material).dispose();
      ball.label.remove();
    }
    balls = [];
  }
  function setMembers() {
    const key = people.map((m) => `${m.id}:${m.name}`).join('|');
    if (key === memberKey) return;
    memberKey = key;
    clearBalls();
    balls = people.map((member) => {
      const colour = COLOURS[member.id % 8];
      const skin = new THREE.MeshStandardMaterial({
        color: colour,
        roughness: 0.18,
        metalness: 0.35,
        emissive: colour,
        emissiveIntensity: 0,
      });
      const group = new THREE.Group();
      scene.add(group);
      mesh(ballShape, skin, group);
      mesh(stripeShape, edge, group);
      const label = document.createElement('div');
      label.className = 'pinball-ball-label';
      label.textContent = member.name;
      label.style.setProperty('--ball-colour', colour);
      labels.appendChild(label);
      const trailShape = new THREE.BufferGeometry();
      trailShape.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(15 * 3), 3),
      );
      const trail = new THREE.Line(
        trailShape,
        new THREE.LineBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      scene.add(trail);
      return { group, skin, label, trail, history: [] };
    });
  }
  let width = 1,
    height = 1;
  const cameraHome = new THREE.Vector3();
  const homeTarget = new THREE.Vector3(0, 0.3, 0.7);
  const cameraDirection = new THREE.Vector3(0, 30, 18).normalize();
  const mapPoints = [DECK, RUNOUT, JUMP, ...RAMPS].flatMap((s) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < s.positions.length; i += 3)
      points.push(
        new THREE.Vector3(
          s.positions[i],
          s.positions[i + 1],
          s.positions[i + 2],
        ),
      );
    return points;
  });
  for (const r of [...RAILS, ...GUIDES])
    for (const p of [r.a, r.b])
      mapPoints.push(new THREE.Vector3(p.x, p.y + r.height, p.z));
  function fitTable() {
    const fittingCamera = new THREE.PerspectiveCamera(
      camera.fov,
      camera.aspect,
      0.1,
      110,
    );
    const p = new THREE.Vector3();
    for (let distance = 28; distance <= 90; distance += 0.5) {
      fittingCamera.position
        .copy(cameraDirection)
        .multiplyScalar(distance)
        .add(homeTarget);
      fittingCamera.lookAt(homeTarget);
      fittingCamera.updateMatrixWorld();
      if (
        mapPoints.every((point) => {
          p.copy(point).project(fittingCamera);
          return Math.abs(p.x) <= 0.9 && p.y <= 0.76 && p.y >= -0.85;
        })
      )
        return fittingCamera.position.clone();
    }
    return cameraDirection.clone().multiplyScalar(90).add(homeTarget);
  }
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cameraHome.copy(fitTable());
    camera.position.copy(cameraHome);
    camera.lookAt(homeTarget);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const loss = (event: Event) => {
    event.preventDefault();
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', loss);
  let previousElapsed = -1;
  const projected = new THREE.Vector3();
  function draw() {
    if (disposed) return;
    request = requestAnimationFrame(draw);
    if (document.hidden) return;
    setMembers();
    const time = frame?.elapsed ?? 0;
    flippers.forEach((view, i) => {
      const pose = frame?.flippers[i] ?? flipperPose(i, 0, 0);
      view.position.set(pose.x, pose.y, pose.z);
      const orientation = mechanismOrientation(pose.angle);
      view.quaternion.set(
        orientation.x,
        orientation.y,
        orientation.z,
        orientation.w,
      );
    });
    const rotorOrientation = mechanismOrientation(frame?.rotorAngle ?? 0);
    rotor.quaternion.set(
      rotorOrientation.x,
      rotorOrientation.y,
      rotorOrientation.z,
      rotorOrientation.w,
    );
    bumperViews.forEach((b, i) => {
      const pulse = Math.max(
        0,
        1 - (time - (frame?.bumperHits[i] ?? -10)) / 0.23,
      );
      b.cap.scale.y = 0.27 - pulse * 0.07;
      b.capSurface.emissiveIntensity = 0.12 + pulse * 1.8;
    });
    kickerViews.forEach((k, i) => {
      const pulse = Math.max(
        0,
        1 - (time - (frame?.kickerHits[i] ?? -10)) / 0.3,
      );
      k.position.z = 0.43 - pulse * 0.3;
    });
    camera.updateMatrixWorld();
    const placements: {
      view: BallView;
      x: number;
      y: number;
      width: number;
      anchorX: number;
      anchorY: number;
    }[] = [];
    balls.forEach((ball, slot) => {
      const state = frame?.balls[slot];
      const x = state?.x ?? (slot - (balls.length - 1) / 2) * 0.86,
        z = state?.z ?? PINBALL.startZ;
      ball.group.position.set(
        x,
        state?.y ?? boardHeight(z) + PINBALL.radius,
        z,
      );
      if (state)
        ball.group.quaternion.set(state.qx, state.qy, state.qz, state.qw);
      else ball.group.quaternion.identity();
      ball.skin.emissiveIntensity = state
        ? Math.max(0, 0.7 * (1 - (time - state.lastHitAt) / 0.22))
        : 0;
      if (time !== previousElapsed && state) {
        ball.history.unshift(ball.group.position.clone());
        if (ball.history.length > 15) ball.history.pop();
      }
      const attr = ball.trail.geometry.attributes.position;
      for (let i = 0; i < ball.history.length; i++) {
        const p = ball.history[i];
        attr.setXYZ(i, p.x, p.y + 0.02, p.z);
      }
      attr.needsUpdate = true;
      ball.trail.geometry.setDrawRange(0, ball.history.length);
      ball.trail.visible = Boolean(frame && !frame.result);
      projected
        .copy(ball.group.position)
        .add(new THREE.Vector3(0, 0.62, 0))
        .project(camera);
      const px = (projected.x * 0.5 + 0.5) * width,
        py = (-projected.y * 0.5 + 0.5) * height;
      const labelWidth = Math.min(108, Math.max(34, ball.label.offsetWidth));
      placements.push({
        view: ball,
        x: Math.max(
          labelWidth / 2 + 5,
          Math.min(width - labelWidth / 2 - 5, px),
        ),
        y: Math.max(76, Math.min(height - 35, py)),
        width: labelWidth,
        anchorX: px,
        anchorY: py,
      });
      ball.label.style.display =
        people[slot].name && projected.z < 1 ? '' : 'none';
      ball.label.classList.toggle('is-winner', frame?.result?.slot === slot);
    });
    // Keep names legible when the balls crowd around a bumper.
    for (let pass = 0; pass < 8; pass++)
      for (let i = 0; i < placements.length; i++)
        for (let j = i + 1; j < placements.length; j++) {
          const a = placements[i],
            b = placements[j];
          if (
            Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 5 &&
            Math.abs(a.y - b.y) < 23
          ) {
            const sign = a.anchorY <= b.anchorY ? -1 : 1;
            const move = (23 - Math.abs(a.y - b.y)) / 2;
            a.y = Math.max(76, a.y + sign * move);
            b.y = Math.min(height - 35, b.y - sign * move);
          }
        }
    for (const p of placements) {
      p.view.label.style.left = `${p.x}px`;
      p.view.label.style.top = `${p.y}px`;
    }
    previousElapsed = time;
    renderer.render(scene, camera);
  }
  request = requestAnimationFrame(draw);
  let seed: number | null = null;
  return {
    update(next: PinballFrame | null, members: Member[]) {
      if (seed !== (next?.seed ?? null)) {
        for (const ball of balls) ball.history = [];
        previousElapsed = -1;
        seed = next?.seed ?? null;
      }
      frame = next;
      people = members.filter((m) => m.active && m.name.trim());
      if (!people.length)
        people = Array.from({ length: 6 }, (_, id) => ({
          id,
          name: '',
          active: true,
        }));
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', loss);
      clearBalls();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labels.remove();
    },
  };
}
