import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { PINBALL } from './pinball.ts';
import {
  createPinballArena,
  mapInfo,
  arenaLevelOpening,
  arenaStartGatePosition,
  type PinballMapId,
} from './pinball-maps.ts';
import {
  arenaArcSurface,
  arenaOrientation,
  arenaRailSurface,
  platformPose,
  type ArenaFrame,
} from './pinball-arenas.ts';
import { COLOURS } from './track';
import type { Member } from './roster';
import { REACTOR_GOAL, REACTOR_ISLAND } from './pinball-reactor.ts';
import { createPinballTextures } from './pinball-materials.ts';
import { descentViewProgress } from './pinball-descent.ts';

export function createPinballScene(
  host: HTMLDivElement,
  onFailure: () => void,
  mapId: PinballMapId,
) {
  const map = createPinballArena(mapId),
    info = mapInfo(mapId),
    scene = new THREE.Scene();
  const descent = mapId === 'descent',
    reactor = mapId === 'reactor' || descent;
  scene.background = new THREE.Color(reactor ? '#122b40' : '#e8eff0');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  // Supersample ordinary displays too: the small moving balls and inclined
  // field markings need more than one sample per CSS pixel.
  const pixelRatio = () => Math.min(2, Math.max(1.5, window.devicePixelRatio));
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = reactor ? 0.94 : 1.12;
  renderer.domElement.setAttribute(
    'aria-label',
    `3D-пинбол: ${info.name}. ${info.description}`,
  );
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140),
    geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [],
    textures: THREE.Texture[] = [],
    environments: THREE.WebGLRenderTarget[] = [];
  const surface = createPinballTextures(
    Math.min(16, renderer.capabilities.getMaxAnisotropy()),
    textures,
  );
  {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04);
    environments.push(environment);
    scene.environment = environment.texture;
    scene.environmentIntensity = reactor ? 0.65 : 0.35;
    room.dispose();
    generator.dispose();
  }
  const geometry = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  function material(
    colour: string,
    roughness = 0.4,
    metalness = 0.08,
    finish: 'enamel' | 'steel' | 'rubber' | null = 'enamel',
  ) {
    const m = new THREE.MeshPhysicalMaterial({
      color: colour,
      roughness,
      metalness,
      ...(finish ? surface[finish] : {}),
      clearcoat: finish === 'enamel' ? 0.65 : 0,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    });
    materials.push(m);
    return m;
  }
  function roundedBox(width: number, height: number, depth: number) {
    return geometry(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        3,
        Math.min(width, height, depth) * 0.17,
      ),
    );
  }
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material | THREE.Material[],
    parent: THREE.Object3D = scene,
  ) {
    if (!g.hasAttribute('uv') && g.hasAttribute('position')) {
      if (!g.hasAttribute('normal')) g.computeVertexNormals();
      const position = g.getAttribute('position'),
        normal = g.getAttribute('normal'),
        uv: number[] = [];
      for (let i = 0; i < position.count; i++) {
        const nx = Math.abs(normal.getX(i)),
          ny = Math.abs(normal.getY(i)),
          nz = Math.abs(normal.getZ(i));
        uv.push(
          nx > ny && nx > nz ? position.getZ(i) : position.getX(i),
          ny >= nx && ny >= nz ? position.getZ(i) : position.getY(i),
        );
      }
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    const view = new THREE.Mesh(g, m);
    view.castShadow = true;
    view.receiveShadow = true;
    parent.add(view);
    return view;
  }
  const box = geometry(new THREE.BoxGeometry(1, 1, 1)),
    sphere = geometry(new THREE.SphereGeometry(1, 48, 32)),
    cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 64));
  const edge = material(reactor ? '#bdced0' : '#edf3ed', 0.3, 0.72, 'steel'),
    gold = material(reactor ? '#ef652b' : '#f3bd5c', 0.31, 0.25),
    navy = material(reactor ? '#102e40' : '#244e61', 0.53, 0.32),
    accent = material(info.colour, 0.32, 0.15),
    wood = material('#be936b', 0.75),
    rubber = material('#102b33', 0.86, 0, 'rubber');
  const glass = material(reactor ? '#91e9ef' : '#b5d3d7', 0.12, 0.04, null);
  glass.transparent = true;
  glass.opacity = reactor ? 0.13 : 0.32;
  glass.clearcoat = 1;
  glass.clearcoatRoughness = 0.1;
  glass.depthWrite = false;
  scene.add(
    new THREE.HemisphereLight(
      '#eafaff',
      reactor ? '#162d49' : '#5a7380',
      reactor ? 0.75 : 2.8,
    ),
  );
  const sun = new THREE.DirectionalLight('#fff1dd', reactor ? 3.2 : 3.7);
  sun.position.set(-10, 25, -6);
  sun.castShadow = true;
  const shadowSize = Math.min(4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -16,
    right: 16,
    top: 20,
    bottom: -20,
    near: 0.5,
    far: 55,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 2;
  scene.add(sun);
  if (descent) {
    sun.target.position.set(0, -7, 19);
    sun.position.set(-12, 26, 10);
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 40,
      bottom: -40,
      far: 100,
    });
    scene.add(sun.target);
  }
  if (reactor) {
    const rim = new THREE.DirectionalLight('#8ae7ff', 1.2);
    rim.position.set(10, 14, -12);
    scene.add(rim);
  }
  const ground = mesh(
    geometry(new THREE.PlaneGeometry(150, 150)),
    material(reactor ? '#061421' : '#e8eff0', 0.9, 0, null),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = map.levels
    ? Math.min(...map.levels.map((level) => level.goal.y)) - 2
    : reactor
      ? -1.4
      : -6;
  ground.castShadow = false;
  const deckTop = map.start.gate
    ? Math.min(...(map.levels?.[0].boundary ?? map.boundary).map((p) => p.z)) -
      0.4
    : -11;
  const deckFinish = reactor ? surface.reactorDeck(deckTop) : null;
  for (const [floorIndex, floor] of map.floor.entries()) {
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(floor.positions, 3),
    );
    g.setIndex(floor.indices);
    g.computeVertexNormals();
    let deckMaterial = floor.colour ? material(floor.colour, 0.65) : navy;
    if (reactor && (!descent || floorIndex === 0)) {
      const uv: number[] = [];
      for (let i = 0; i < floor.positions.length; i += 3) {
        uv.push(
          (floor.positions[i] + 7.2) / 14.4,
          1 - (floor.positions[i + 2] - deckTop) / (11.8 - deckTop),
        );
      }
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      deckMaterial = material('#ffffff', 0.52, 0.08);
      Object.assign(deckMaterial, deckFinish);
      deckMaterial.clearcoat = 0.16;
      deckMaterial.clearcoatRoughness = 0.45;
    }
    const deck = mesh(g, deckMaterial);
    deck.castShadow = false;
    const backing = mesh(g, reactor ? navy : wood);
    backing.position.y = -0.17;
    backing.castShadow = false;
  }
  const guardPositions: number[] = [],
    guardIndices: number[] = [];
  for (const rail of map.rails) {
    // One continuous glass shell is drawn below. Individual short prisms
    // introduced false vertical seams and rounded normals on square corners.
    if (reactor && rail.kind === 'outer') continue;
    const surface = arenaRailSurface(rail, mapId === 'seesaw' ? 1.65 : 0);
    if (descent && rail.kind === 'guard') {
      const offset = guardPositions.length / 3;
      guardPositions.push(...surface.positions);
      guardIndices.push(...surface.indices.map((i) => i + offset));
      continue;
    }
    let shape = geometry(new THREE.BufferGeometry());
    shape.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(surface.positions, 3),
    );
    shape.setIndex(surface.indices);
    shape = geometry(toCreasedNormals(shape, Math.PI / 4));
    const view = mesh(
      shape,
      reactor
        ? rail.kind === 'outer'
          ? glass
          : rail.kind === 'guard'
            ? gold
            : edge
        : rail.accent
          ? gold
          : mapId === 'seesaw' || (mapId === 'cascade' && rail.height > 2)
            ? glass
            : edge,
    );
    if (view.material === glass) view.castShadow = false;
  }
  if (guardPositions.length) {
    const g = geometry(new THREE.BufferGeometry());
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(guardPositions, 3),
    );
    g.setIndex(guardIndices);
    mesh(geometry(toCreasedNormals(g, Math.PI / 4)), gold);
  }
  function tube(
    points: THREE.Vector3[],
    radius: number,
    skin: THREE.Material,
    closed = false,
  ) {
    const path = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
    return mesh(
      geometry(
        new THREE.TubeGeometry(
          path,
          Math.max(32, points.length * 2),
          radius,
          16,
          closed,
        ),
      ),
      skin,
    );
  }
  if (reactor) {
    for (const [levelIndex, boundary] of (
      map.levels?.map((level) => level.boundary) ?? [map.boundary]
    ).entries()) {
      const level = map.levels?.[levelIndex],
        opening = (i: number) =>
          !!level &&
          arenaLevelOpening(
            level,
            boundary[i],
            boundary[(i + 1) % boundary.length],
          );
      const glassPositions: number[] = [],
        glassIndices: number[] = [],
        count = boundary.length;
      boundary.forEach((p, i) => {
        const before = boundary[(i + count - 1) % count],
          after = boundary[(i + 1) % count],
          normal = new THREE.Vector2(after.z - before.z, before.x - after.x)
            .normalize()
            .multiplyScalar(0.12);
        for (const lift of [0, level?.wallHeight ?? 2.05])
          for (const side of [-1, 1])
            glassPositions.push(
              p.x + normal.x * side,
              p.y + lift,
              p.z + normal.y * side,
            );
        const a = i * 4,
          b = ((i + 1) % count) * 4;
        if (opening(i)) return;
        glassIndices.push(
          a,
          b,
          a + 2,
          b,
          b + 2,
          a + 2,
          a + 1,
          a + 3,
          b + 1,
          b + 1,
          a + 3,
          b + 3,
          a + 2,
          b + 2,
          a + 3,
          b + 2,
          b + 3,
          a + 3,
          a,
          a + 1,
          b,
          b,
          a + 1,
          b + 1,
        );
      });
      const glassGeometry = geometry(new THREE.BufferGeometry());
      glassGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(glassPositions, 3),
      );
      glassGeometry.setIndex(glassIndices);
      const shell = mesh(
        geometry(toCreasedNormals(glassGeometry, Math.PI / 4)),
        glass,
      );
      shell.castShadow = shell.receiveShadow = false;
      // Continuous cabinet edges avoid the old picket-fence silhouette.
      const positions: number[] = [],
        indices: number[] = [];
      boundary.forEach((p, i) => {
        positions.push(p.x, p.y - 0.04, p.z, p.x, p.y - 0.65, p.z);
        const a = i * 2,
          b = ((i + 1) % boundary.length) * 2;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      });
      const sides = geometry(new THREE.BufferGeometry());
      sides.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      sides.setIndex(indices);
      sides.computeVertexNormals();
      mesh(sides, navy);
      const runs: { points: typeof boundary; closed: boolean }[] = [];
      if (!level?.opening) runs.push({ points: boundary, closed: true });
      else {
        const first = boundary.findIndex((_, i) => opening(i));
        let run: typeof boundary = [];
        for (let step = 1; step <= boundary.length; step++) {
          const i = (first + step) % boundary.length;
          if (opening(i)) {
            if (run.length > 1) runs.push({ points: run, closed: false });
            run = [];
          } else {
            if (!run.length) run.push(boundary[i]);
            run.push(boundary[(i + 1) % boundary.length]);
          }
        }
        if (run.length > 1) runs.push({ points: run, closed: false });
      }
      const trim = material('#24d1d2', 0.24, 0.25);
      trim.emissive.set('#24d1d2');
      trim.emissiveIntensity = 0.35;
      for (const run of runs) {
        tube(
          run.points.map((p) => new THREE.Vector3(p.x, p.y + 0.12, p.z)),
          0.16,
          edge,
          run.closed,
        );
        tube(
          run.points.map((p) => new THREE.Vector3(p.x, p.y - 0.32, p.z)),
          0.055,
          trim,
          run.closed,
        );
        tube(
          run.points.map(
            (p) =>
              new THREE.Vector3(p.x, p.y + (level?.wallHeight ?? 2.05), p.z),
          ),
          0.065,
          trim,
          run.closed,
        );
      }
    }
    const islandPositions: number[] = [];
    REACTOR_ISLAND.forEach(([x, z]) =>
      islandPositions.push(x, map.height(x, z) + 0.06, z),
    );
    const islandGeometry = geometry(new THREE.BufferGeometry());
    islandGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(islandPositions, 3),
    );
    const islandIndices: number[] = [];
    for (let i = 1; i < REACTOR_ISLAND.length - 1; i++)
      islandIndices.push(0, i + 1, i);
    islandGeometry.setIndex(islandIndices);
    islandGeometry.computeVertexNormals();
    mesh(islandGeometry, material('#0c2c3f', 0.36, 0.55, 'steel'));
    (map.levels?.[0].boundary ?? map.boundary).forEach((p, i) => {
      if (i % 12) return;
      const x = p.x * 0.97,
        z = REACTOR_GOAL.z + (p.z - REACTOR_GOAL.z) * 0.97;
      const bolt = mesh(cylinder, edge);
      bolt.scale.set(0.075, 0.035, 0.075);
      bolt.position.set(x, map.height(x, z) + 0.04, z);
      bolt.quaternion.copy(arenaOrientation(map, x, z));
    });
    for (const [index, goal] of (
      map.levels?.map((level) => level.goal) ?? [REACTOR_GOAL]
    ).entries()) {
      const lip = map.height(goal.x + goal.radius, goal.z);
      const inside = material('#091d2d', 0.8);
      const well = mesh(
        geometry(
          new THREE.CylinderGeometry(
            goal.radius,
            goal.radius,
            1.8,
            64,
            1,
            true,
          ),
        ),
        descent && index < 2 ? glass : inside,
      );
      well.position.set(goal.x, lip - 0.9, goal.z);
      if (!descent || index === 2) {
        const dark = mesh(cylinder, inside);
        dark.scale.set(goal.radius, 0.04, goal.radius);
        dark.position.set(goal.x, lip - 1.75, goal.z);
      }
      for (let i = 0; i < 24; i++) {
        const segment = mesh(
          geometry(
            new THREE.TorusGeometry(
              goal.radius + 0.1,
              0.085,
              16,
              12,
              (Math.PI * 2) / 24 - 0.018,
            ),
          ),
          i % 2 ? gold : edge,
        );
        segment.rotation.x = Math.PI / 2;
        segment.rotation.z = (i / 24) * Math.PI * 2;
        segment.position.set(goal.x, lip + 0.02, goal.z);
      }
    }
  }
  const objectViews = new Map<string, THREE.Object3D>(),
    reboundSkins: { skin: THREE.MeshPhysicalMaterial; index: number }[] = [];
  if (map.start.gate) {
    const gate = map.start.gate,
      group = new THREE.Group();
    scene.add(group);
    mesh(roundedBox(gate.width, gate.height, gate.depth), accent, group);
    for (let i = 0; i < 14; i += 2) {
      const stripe = mesh(box, navy, group);
      stripe.scale.set(gate.width / 14, gate.height * 0.75, 0.008);
      stripe.position.set(
        -gate.width / 2 + ((i + 0.5) * gate.width) / 14,
        0,
        gate.depth / 2,
      );
    }
    group.position.copy(arenaStartGatePosition(gate, map.height, 0));
    objectViews.set('start-gate', group);
  }
  for (const [index, motor] of map.motors.entries()) {
    const group = new THREE.Group();
    scene.add(group);
    objectViews.set(motor.id, group);
    if (motor.arc) {
      const arc = motor.arc,
        points: THREE.Vector3[] = [],
        shape = arenaArcSurface(map, motor),
        band = geometry(new THREE.BufferGeometry());
      band.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(shape.positions, 3),
      );
      band.setIndex(shape.indices);
      for (const { start, count, materialIndex } of shape.groups)
        band.addGroup(start, count, materialIndex);
      const skin = material('#ed7137', 0.62, 0, 'rubber');
      skin.emissive.set('#ff6c21');
      reboundSkins.push({ skin, index });
      mesh(
        geometry(toCreasedNormals(band, Math.PI / 4)),
        [skin, material('#e4d4ac', 0.68, 0, 'rubber')],
        group,
      );
      for (let i = 0; i <= 64; i++) {
        const a = arc.from + (i / 64) * arc.sweep;
        const x = Math.cos(a) * arc.radius,
          z = Math.sin(a) * arc.radius;
        points.push(
          new THREE.Vector3(
            x,
            map.height(motor.x + x, motor.z + z) -
              map.height(motor.x, motor.z) +
              motor.height / 2,
            z,
          ),
        );
      }
      const path = new THREE.CatmullRomCurve3(points);
      mesh(geometry(new THREE.TubeGeometry(path, 128, 0.055, 16)), edge, group);
    } else
      for (const angle of motor.cross ? [0, Math.PI / 2] : [0]) {
        const bar = mesh(
          roundedBox(motor.length, motor.height, motor.width),
          motor.gate ? accent : gold,
          group,
        );
        bar.rotation.y = angle;
        for (const side of [-1, 1]) {
          const cap = mesh(sphere, edge, group);
          cap.scale.setScalar(motor.width * 0.62);
          cap.position.set(
            (side * Math.cos(angle) * motor.length) / 2,
            0,
            (-side * Math.sin(angle) * motor.length) / 2,
          );
        }
      }
    if (!motor.arc) {
      const hub = mesh(cylinder, edge, group);
      hub.scale.set(0.22, motor.height + 0.12, 0.22);
    }
    group.position.set(
      motor.x,
      map.height(motor.x, motor.z) + motor.height / 2 + (motor.elevation ?? 0),
      motor.z,
    );
    group.quaternion.copy(
      arenaOrientation(map, motor.x, motor.z).multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          motor.angle,
        ),
      ),
    );
  }
  for (const arm of map.arms) {
    const group = new THREE.Group();
    scene.add(group);
    objectViews.set(arm.id, group);
    mesh(
      roundedBox(arm.length, 0.72, 0.34),
      arm.passive ? accent : gold,
      group,
    );
    const pivot = mesh(cylinder, edge, group);
    pivot.position.x = -arm.length / 2;
    pivot.scale.set(0.2, 0.82, 0.2);
    const q = arenaOrientation(map, arm.x, arm.z).multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        arm.angle,
      ),
    );
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(
      arenaOrientation(map, arm.x, arm.z),
    );
    group.position
      .set(arm.x, map.height(arm.x, arm.z), arm.z)
      .addScaledVector(axis, 0.36)
      .add(new THREE.Vector3(arm.length / 2, 0, 0).applyQuaternion(q));
    group.quaternion.copy(q);
  }
  for (const platform of map.platforms) {
    const group = new THREE.Group();
    scene.add(group);
    objectViews.set(platform.id, group);
    const plate = mesh(box, accent, group);
    plate.scale.set(platform.width, 0.28, platform.length);
    plate.position.y = -0.14;
    for (const side of [-1, 1]) {
      const rail = mesh(box, edge, group);
      rail.scale.set(0.2, 1, platform.length);
      rail.position.set((side * platform.width) / 2, 0.5, 0);
    }
    if (platform.deflector) {
      const d = platform.deflector,
        guide = mesh(box, gold, group);
      guide.scale.set(d.length, 0.76, 0.24);
      guide.position.set(d.x, 0.38, d.z);
      guide.rotation.y = d.angle;
    }
    const pivot = mesh(cylinder, gold);
    pivot.rotation.x = Math.PI / 2;
    pivot.scale.set(0.15, platform.length + 0.5, 0.15);
    pivot.position.set(platform.x, platform.y - 0.32, platform.z);
    for (const side of [-1, 1]) {
      const mount = mesh(box, wood);
      mount.scale.set(0.65, 0.8, 0.5);
      mount.position.set(
        platform.x,
        platform.y - 0.5,
        platform.z + side * (platform.length / 2 + 0.2),
      );
    }
    const pose = platformPose(platform, 0, 0);
    group.position.copy(pose.position);
    group.quaternion.copy(pose.rotation);
    // Stripes belong to the moving body and show its current inclination.
    for (const side of [-1, 1]) {
      const stripe = mesh(box, gold, group);
      stripe.scale.set(0.08, 0.014, platform.length * 0.8);
      stripe.position.set(side * 1.2, 0.01, 0);
      stripe.castShadow = false;
    }
  }
  for (const block of map.blocks) {
    const group = new THREE.Group();
    scene.add(group);
    objectViews.set(block.id, group);
    const skin = material(
      block.id.includes('-1-')
        ? '#ecc679'
        : block.id.includes('-2-')
          ? '#a9d0bc'
          : '#e9a18b',
      0.55,
    );
    const view = mesh(box, skin, group);
    view.scale.set(block.width, block.height, block.depth);
    const seam = mesh(box, wood, group);
    seam.scale.set(block.width * 0.74, 0.045, block.depth + 0.015);
    seam.position.y = 0.04;
    group.quaternion.copy(arenaOrientation(map, block.x, block.z));
    group.position
      .set(block.x, map.height(block.x, block.z), block.z)
      .add(
        new THREE.Vector3(0, block.height / 2 + 0.015, 0).applyQuaternion(
          group.quaternion,
        ),
      );
  }
  const initialObjects = [...objectViews.values()].map((object) => ({
    object,
    position: object.position.clone(),
    rotation: object.quaternion.clone(),
  }));
  const bumperViews = map.bumpers.map((b) => {
    const group = new THREE.Group();
    group.position.set(b.x, map.height(b.x, b.z), b.z);
    scene.add(group);
    const foot = mesh(cylinder, gold, group);
    foot.scale.set(b.radius, 0.22, b.radius);
    foot.position.y = 0.11;
    const stem = mesh(cylinder, edge, group);
    stem.scale.set(b.radius * 0.73, 0.75, b.radius * 0.73);
    stem.position.y = 0.58;
    const colour = reactor ? '#bce32c' : info.colour;
    const skin = material(colour, 0.24, 0.08);
    skin.emissive.set(colour);
    skin.emissiveIntensity = 0.04;
    const cap = mesh(sphere, skin, group);
    cap.scale.set(b.radius, 0.25, b.radius);
    cap.position.y = 1.05;
    if (reactor) {
      const skirt = mesh(
        geometry(
          new THREE.TorusGeometry(b.radius * 0.85, b.radius * 0.12, 16, 64),
        ),
        rubber,
        group,
      );
      skirt.rotation.x = Math.PI / 2;
      skirt.position.y = 0.45;
      const ring = mesh(
        geometry(new THREE.TorusGeometry(b.radius * 0.87, 0.045, 16, 64)),
        edge,
        group,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.82;
      const badge = mesh(cylinder, edge, group);
      badge.scale.set(b.radius * 0.24, 0.025, b.radius * 0.24);
      badge.position.y = 1.3;
    }
    return { skin, cap };
  });
  const springViews = map.springs.map((s) => {
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(s.x, map.height(s.x, s.z) + 0.04, s.z);
    group.quaternion.copy(arenaOrientation(map, s.x, s.z));
    const skin = material('#dca044', 0.45, 0.35, 'steel');
    skin.emissive.set('#ef9a24');
    const disc = mesh(cylinder, skin, group);
    disc.scale.set(s.radius, 0.08, s.radius);
    disc.position.y = 0.04;
    if (reactor) {
      const surround = mesh(
        geometry(new THREE.TorusGeometry(s.radius, 0.055, 16, 64)),
        rubber,
        group,
      );
      surround.rotation.x = Math.PI / 2;
      surround.position.y = 0.1;
      decal(
        s.direction.x > 0 ? '↗' : '↖',
        s.x,
        s.z,
        s.radius * 1.2,
        '#1b4452',
        0.17,
      );
    } else {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(s.direction.x, 0, s.direction.z).normalize(),
        new THREE.Vector3(0, 0.12, 0),
        s.radius * 1.5,
        '#fff8dd',
        0.3,
        0.25,
      );
      group.add(arrow);
      geometries.push(arrow.line.geometry, arrow.cone.geometry);
      materials.push(...[arrow.line.material, arrow.cone.material].flat());
    }
    return { disc, skin };
  });
  function painted(points: THREE.Vector3[], colour: string, opacity = 0.65) {
    const g = geometry(new THREE.BufferGeometry().setFromPoints(points)),
      m = new THREE.LineBasicMaterial({
        color: colour,
        transparent: true,
        opacity,
      });
    materials.push(m);
    scene.add(new THREE.Line(g, m));
  }
  if (reactor) {
    for (const [list, colour] of [
      [
        [
          [-2.0, -9],
          [-4.0, -7.7],
          [-5.15, -5.7],
          [-4.85, -3.3],
          [-3.5, -1.2],
          [-0.4, 1.1],
        ],
        '#c9ed54',
      ],
      [
        [
          [2.0, -9],
          [3.7, -7.8],
          [4.65, -6],
          [3.3, -3.4],
          [2.0, -1.3],
          [0.4, 1.1],
        ],
        '#ffb66b',
      ],
    ] as const) {
      const path = new THREE.CatmullRomCurve3(
        list.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      );
      tube(
        Array.from({ length: 80 }, (_, i) => {
          const p = path.getPoint(i / 79);
          p.y = map.height(p.x, p.z) + 0.035;
          return p;
        }),
        0.032,
        material(colour, 0.6),
      );
    }
    for (const [x, z, angle] of [
      [-2.35, -8.5, -0.5],
      [2.35, -8.5, 0.5],
      [-4.8, -2.8, -0.65],
      [4.2, -2.2, 0.65],
      [-1.25, 7.8, Math.PI],
      [1.25, 7.8, Math.PI],
    ]) {
      const points = [
        [-0.2, -0.23],
        [0, 0],
        [0.2, -0.23],
      ].map(([px, pz]) => {
        const xx = x + Math.cos(angle) * px + Math.sin(angle) * pz;
        const zz = z - Math.sin(angle) * px + Math.cos(angle) * pz;
        return new THREE.Vector3(xx, map.height(xx, zz) + 0.03, zz);
      });
      tube(points, 0.045, edge);
    }
  }
  if (mapId === 'crossroads')
    for (const side of [-1, 1]) {
      const radius = 2.45;
      painted(
        Array.from({ length: 97 }, (_, i) => {
          const t = (i / 96) * Math.PI * 2,
            x = side * 3 + radius * Math.cos(t),
            z = radius * Math.sin(t);
          return new THREE.Vector3(x, map.height(x, z) + 0.025, z);
        }),
        info.colour,
        0.7,
      );
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2,
          x = side * 3 + radius * Math.cos(t),
          z = radius * Math.sin(t),
          arrow = new THREE.ArrowHelper(
            new THREE.Vector3(-Math.sin(t), 0, Math.cos(t)),
            new THREE.Vector3(x, map.height(x, z) + 0.05, z),
            0.6,
            '#e8d3ff',
            0.25,
            0.22,
          );
        scene.add(arrow);
        geometries.push(arrow.line.geometry, arrow.cone.geometry);
        materials.push(...[arrow.line.material, arrow.cone.material].flat());
      }
    }
  function decal(
    text: string,
    x: number,
    z: number,
    width: number,
    colour: string,
    lift = 0.03,
  ) {
    const canvas = document.createElement('canvas');
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '800 360px Arial, sans-serif';
    canvas.width = Math.ceil(ctx.measureText(text).width + 160);
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 360px Arial, sans-serif';
    ctx.fillText(text, canvas.width / 2, canvas.height * 0.54);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    textures.push(texture);
    const m = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materials.push(m);
    const g = geometry(
        new THREE.PlaneGeometry(
          width,
          (width * canvas.height) / canvas.width,
          16,
          8,
        ),
      ),
      positions = g.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const xx = x + positions.getX(i),
        zz = z - positions.getY(i);
      positions.setXYZ(i, xx, map.height(xx, zz) + lift, zz);
    }
    g.computeVertexNormals();
    const view = mesh(g, m);
    view.castShadow = false;
    view.receiveShadow = false;
  }
  if (reactor) {
    decal(
      'СТАРТ',
      0,
      map.start.gate ? map.start.z - 0.8 : -10.1,
      3.2,
      '#edfcff',
    );
    if (map.start.gate) {
      const z = map.start.gate.z + 0.2;
      painted(
        [-3.35, 3.35].map(
          (x) => new THREE.Vector3(x, map.height(x, z) + 0.025, z),
        ),
        '#b7f5f3',
        0.9,
      );
    }
    decal('РЕАКТОР', 0, -5.7, 2.15, '#8acada', 0.085);
    decal(
      descent ? 'УРОВЕНЬ 02 ↓' : 'ФИНИШ',
      0,
      7.0,
      descent ? 3.0 : 2.4,
      '#9b4b22',
    );
    if (map.levels) {
      decal('02 · ТУРБИНА', 0, 18.0, 4.2, '#d9f7ff');
      decal('УРОВЕНЬ 03 ↓', 0, 27.5, 3.0, '#d9f7ff');
      decal('03 · ЯДРО', 0, 34.8, 3.4, '#674421');
      decal('ФИНИШ', -1.5, 43.1, 2.6, '#814426');
      for (const level of map.levels.slice(1)) {
        for (const radius of [3.2, 4.8])
          painted(
            Array.from({ length: 97 }, (_, i) => {
              const angle = (i / 96) * Math.PI * 2,
                x = level.goal.x + Math.cos(angle) * radius,
                z = level.goal.z + Math.sin(angle) * radius;
              return new THREE.Vector3(x, map.height(x, z) + 0.025, z);
            }),
            '#f5edd4',
            0.3,
          );
      }
    }
  } else if (mapId === 'cascade')
    [-6, 0, 6].forEach((z, i) =>
      decal(`ЧАША 0${i + 1}`, -3.5, z - 1.8, 3.0, '#bcdee3'),
    );
  else if (mapId !== 'seesaw')
    decal(
      info.name.toLocaleUpperCase('ru'),
      0,
      map.start.z - 0.8,
      4.1,
      '#dce9df',
    );
  const finishY =
    map.height(0, map.exitZ) -
    (map.exitDrop ?? 0) -
    (map.finishZ - map.exitZ) * 0.4;
  for (let i = 0; !reactor && i < 8; i++) {
    const mark = mesh(box, i % 2 ? navy : edge);
    mark.scale.set(0.23, 0.025, 0.18);
    mark.position.set(-0.805 + i * 0.23, finishY + 0.025, map.finishZ - 0.15);
    mark.castShadow = false;
  }
  let frame: ArenaFrame | null = null,
    previousFrame: ArenaFrame | null = null,
    receivedAt = 0,
    transitionMs = 33,
    people: Member[] = [],
    disposed = false,
    request = 0,
    memberKey = '',
    seed: number | null = null,
    previousElapsed = -1;
  type BallView = {
    group: THREE.Group;
    skin: THREE.MeshPhysicalMaterial;
    trail: THREE.Line;
    history: THREE.Vector3[];
    impact: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  };
  let balls: BallView[] = [];
  const ballShape = geometry(new THREE.SphereGeometry(PINBALL.radius, 64, 48)),
    impactShape = geometry(
      new THREE.RingGeometry(PINBALL.radius * 1.1, PINBALL.radius * 1.24, 32),
    );
  function clearBalls() {
    for (const b of balls) {
      scene.remove(b.group, b.trail);
      scene.remove(b.impact);
      b.impact.material.dispose();
      b.skin.map?.dispose();
      b.skin.dispose();
      b.trail.geometry.dispose();
      (b.trail.material as THREE.Material).dispose();
    }
    balls = [];
  }
  function setMembers() {
    const key = people.map((m) => `${m.id}:${m.name}`).join('|');
    if (key === memberKey) return;
    memberKey = key;
    clearBalls();
    balls = people.map((member) => {
      const colour = COLOURS[member.id % 8],
        skin = new THREE.MeshPhysicalMaterial({
          map: surface.ball(colour),
          roughness: 0.2,
          metalness: 0.18,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.25,
          emissive: colour,
          emissiveIntensity: 0,
        }),
        group = new THREE.Group();
      scene.add(group);
      mesh(ballShape, skin, group);
      const trailGeometry = new THREE.BufferGeometry();
      trailGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(45), 3),
      );
      const trail = new THREE.Line(
        trailGeometry,
        new THREE.LineBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      );
      scene.add(trail);
      const impact = new THREE.Mesh(
        impactShape,
        new THREE.MeshBasicMaterial({
          color: '#fff8de',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      impact.visible = false;
      scene.add(impact);
      return { group, skin, trail, impact, history: [] };
    });
  }
  let width = 1,
    height = 1;
  const points = map.floor.flatMap((f) => {
    const list: THREE.Vector3[] = [];
    for (let i = 0; i < f.positions.length; i += 3)
      list.push(
        new THREE.Vector3(
          f.positions[i],
          f.positions[i + 1],
          f.positions[i + 2],
        ),
      );
    return list;
  });
  for (const r of map.rails)
    for (const p of [r.a, r.b])
      points.push(new THREE.Vector3(p.x, p.y + r.height, p.z));
  let cameraProgress = 0;
  const cameraViews: { target: THREE.Vector3; distance: number }[] = [],
    cameraTarget = new THREE.Vector3();
  const direction = new THREE.Vector3(
      reactor ? 2.5 : 0,
      reactor ? 36 : 30,
      18,
    ).normalize(),
    projected = new THREE.Vector3();
  function positionCamera() {
    const index = Math.floor(cameraProgress),
      from = cameraViews[index] ?? cameraViews[0],
      to = cameraViews[index + 1] ?? from;
    cameraTarget.lerpVectors(from.target, to.target, cameraProgress - index);
    const distance = THREE.MathUtils.lerp(
      from.distance,
      to.distance,
      cameraProgress - index,
    );
    camera.position.copy(direction).multiplyScalar(distance).add(cameraTarget);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
  }
  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cameraViews.length = 0;
    const views = map.levels?.map((level) => [
      ...level.boundary.flatMap((p) => [
        new THREE.Vector3(p.x, p.y + (level.wallHeight ?? 2.05), p.z),
        new THREE.Vector3(p.x, p.y - 0.65, p.z),
      ]),
      new THREE.Vector3(level.goal.x, level.goal.y - 1.5, level.goal.z),
      new THREE.Vector3(level.entry.x, level.entry.y + 1, level.entry.z),
    ]) ?? [points];
    for (const viewPoints of views) {
      const bounds = new THREE.Box3().setFromPoints(viewPoints),
        target = bounds.getCenter(new THREE.Vector3());
      target.y -= 0.2;
      let distance = 18;
      for (; distance <= 100; distance += 0.5) {
        camera.position.copy(direction).multiplyScalar(distance).add(target);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        if (
          viewPoints.every((p) => {
            projected.copy(p).project(camera);
            return (
              Math.abs(projected.x) <= 0.88 &&
              projected.y <= 0.74 &&
              projected.y >= -0.84
            );
          })
        )
          break;
      }
      cameraViews.push({ target, distance });
    }
    // The long course pans between floors while keeping its viewing angle
    // and scale fixed. It never zooms after, rotates around or tracks a ball.
    if (descent) {
      const distance = Math.max(...cameraViews.map((view) => view.distance));
      for (const view of cameraViews) view.distance = distance;
    }
    positionCamera();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const loss = (e: Event) => {
    e.preventDefault();
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', loss);
  function draw() {
    if (disposed) return;
    request = requestAnimationFrame(draw);
    if (document.hidden) return;
    setMembers();
    const alpha = Math.min(1, (performance.now() - receivedAt) / transitionMs);
    const time =
      previousFrame && frame
        ? THREE.MathUtils.lerp(previousFrame.elapsed, frame.elapsed, alpha)
        : (frame?.elapsed ?? 0);
    if (map.levels) {
      cameraProgress = Math.max(
        cameraProgress,
        descentViewProgress(map.levels, frame),
      );
      positionCamera();
    }
    for (const [i, pose] of (frame?.objects ?? []).entries()) {
      const object = objectViews.get(pose.id);
      if (object) {
        object.position.set(pose.x, pose.y, pose.z);
        object.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
        const before = previousFrame?.objects[i];
        if (before && before.id === pose.id) {
          object.position.lerpVectors(
            new THREE.Vector3(before.x, before.y, before.z),
            object.position,
            alpha,
          );
          object.quaternion.slerpQuaternions(
            new THREE.Quaternion(before.qx, before.qy, before.qz, before.qw),
            object.quaternion,
            alpha,
          );
        }
      }
    }
    bumperViews.forEach((view, i) => {
      const pulse = Math.max(
        0,
        1 - (time - (frame?.bumperHits[i] ?? -10)) / 0.23,
      );
      view.cap.scale.y = 0.25 - pulse * 0.06;
      view.skin.emissiveIntensity = 0.04 + pulse * 1.4;
    });
    for (const { skin, index } of reboundSkins) {
      const pulse = Math.max(
        0,
        1 - (time - (frame?.motorHits[index] ?? -10)) / 0.2,
      );
      skin.emissiveIntensity = pulse * 0.85;
    }
    springViews.forEach((view, i) => {
      view.skin.emissiveIntensity = frame?.springReady[i] === false ? 0 : 0.35;
      view.disc.scale.y =
        0.08 -
        Math.max(0, 1 - (time - (frame?.kickerHits[i] ?? -10)) / 0.25) * 0.04;
    });
    camera.updateMatrixWorld();
    balls.forEach((ball, slot) => {
      const state = frame?.balls[slot],
        x = state?.x ?? (slot - (balls.length - 1) / 2) * 0.74,
        z = state?.z ?? map.start.z;
      let y = state?.y ?? map.height(x, z) + PINBALL.radius;
      if (!state && map.start.gate) {
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(
          arenaOrientation(map, x, z),
        );
        y = map.height(x, z) + PINBALL.radius / normal.y + 0.004;
      }
      if (!state && map.platforms[0]) {
        const pose = platformPose(map.platforms[0], 0, 0),
          n = new THREE.Vector3(0, 1, 0).applyQuaternion(pose.rotation);
        y =
          pose.position.y -
          (n.x * (x - pose.position.x) + n.z * (z - pose.position.z)) / n.y +
          PINBALL.radius / n.y +
          0.02;
      }
      ball.group.position.set(x, y, z);
      if (state) {
        ball.group.quaternion.set(state.qx, state.qy, state.qz, state.qw);
        const before = previousFrame?.balls[slot];
        if (before) {
          ball.group.position.lerpVectors(
            new THREE.Vector3(before.x, before.y, before.z),
            ball.group.position,
            alpha,
          );
          ball.group.quaternion.slerpQuaternions(
            new THREE.Quaternion(before.qx, before.qy, before.qz, before.qw),
            ball.group.quaternion,
            alpha,
          );
        }
      } else ball.group.quaternion.identity();
      ball.skin.emissiveIntensity = state
        ? Math.max(
            0,
            (reactor ? 0.25 : 0.7) *
              (1 -
                (time - (reactor ? state.lastImpactAt : state.lastHitAt)) /
                  0.22),
          )
        : 0;
      const age = state ? time - state.lastImpactAt : 1;
      const at = ball.group.position;
      ball.impact.visible =
        reactor && age >= 0 && age < 0.2 && at.y < map.height(at.x, at.z) + 0.7;
      if (ball.impact.visible) {
        ball.impact.position.set(at.x, map.height(at.x, at.z) + 0.05, at.z);
        ball.impact.quaternion
          .copy(arenaOrientation(map, at.x, at.z))
          .multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              -Math.PI / 2,
            ),
          );
        ball.impact.scale.setScalar(0.85 + age * 7);
        ball.impact.material.opacity = (1 - age / 0.2) * 0.7;
      }
      if (time !== previousElapsed && state) {
        ball.history.unshift(ball.group.position.clone());
        if (ball.history.length > 15) ball.history.pop();
      }
      const attr = ball.trail.geometry.attributes.position;
      ball.history.forEach((p, i) => attr.setXYZ(i, p.x, p.y + 0.02, p.z));
      attr.needsUpdate = true;
      ball.trail.geometry.setDrawRange(0, ball.history.length);
      ball.trail.visible = !!frame && !frame.result;
    });
    previousElapsed = time;
    renderer.render(scene, camera);
  }
  request = requestAnimationFrame(draw);
  return {
    update(next: ArenaFrame | null, members: Member[]) {
      if (seed !== (next?.seed ?? null)) {
        for (const b of balls) b.history = [];
        previousElapsed = -1;
        cameraProgress = 0;
        seed = next?.seed ?? null;
        if (!next)
          for (const { object, position, rotation } of initialObjects) {
            object.position.copy(position);
            object.quaternion.copy(rotation);
          }
      }
      previousFrame =
        next &&
        frame &&
        next.seed === frame.seed &&
        next.elapsed > frame.elapsed
          ? frame
          : null;
      transitionMs =
        previousFrame && next
          ? Math.max(
              16,
              Math.min(80, (next.elapsed - previousFrame.elapsed) * 1000),
            )
          : 33;
      receivedAt = performance.now();
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
      for (const e of environments) e.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
