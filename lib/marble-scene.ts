import * as THREE from 'three';
import { placeMarbleLabels, type LabelAnchor } from './marble-label-layout';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  TRACK_MESHES,
  BUMPERS,
  ISLAND_3D,
  PADDLE_3D,
  FUNNEL,
  MARBLE_RADIUS,
  MARBLE_FINISH_Z,
  mainCentre,
  marbleStart,
} from './marble-track';
import { COLOURS, HUES } from './track';
import type { MarbleFrame } from './marble-race';
import type { Member } from './roster';

export function createMarbleScene(host: HTMLDivElement, onFailure: () => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dceaf2');
  scene.fog = new THREE.Fog('#dceaf2', 100, 240);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.setAttribute(
    'aria-label',
    'Объёмная трасса с катящимися шариками',
  );
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 350);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 18;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.enabled = false;
  const light = new THREE.DirectionalLight('#fff4df', 3.2);
  light.position.set(-20, 60, 32);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, {
    left: -40,
    right: 40,
    top: 75,
    bottom: -60,
    near: 0.5,
    far: 150,
  });
  light.shadow.bias = -0.0005;
  light.target.position.set(0, 6, 42);
  scene.add(
    light,
    light.target,
    new THREE.HemisphereLight('#f0fbff', '#8d91a9', 2.4),
  );
  const fill = new THREE.DirectionalLight('#b7caff', 1.2);
  fill.position.set(30, 25, -20);
  scene.add(fill);
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [],
    textures: THREE.Texture[] = [];
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
    mesh(g, material(part.colour));
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
  for (const z of [0, 12, 24, 37, 50, 63, 73]) {
    const p = mainCentre(z),
      h = p.y + 4;
    for (const side of [-1, 1]) {
      mesh(
        new THREE.CylinderGeometry(0.28, 0.42, h, 10),
        support,
        p.x + side * 2,
        p.y - h / 2,
        z,
      );
      mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.22, 16),
        white,
        p.x + side * 2,
        -3.85,
        z,
      );
    }
    mesh(new THREE.BoxGeometry(4.8, 0.3, 0.5), white, p.x, p.y - 0.35, z);
  }
  for (const angle of [0, Math.PI * 0.66, Math.PI * 1.33]) {
    const x = FUNNEL.x + Math.cos(angle) * 7,
      z = FUNNEL.z + Math.sin(angle) * 7;
    mesh(new THREE.CylinderGeometry(0.34, 0.5, 10, 12), support, x, 1, z);
  }
  mesh(new THREE.BoxGeometry(8, 4, 0.3), white, 0, 33.4, -5);
  mesh(new THREE.BoxGeometry(7, 1.2, 0.3), white, FUNNEL.x, 2.1, 76);
  const bumperMeshes = BUMPERS.map((b) => [
    mesh(
      new THREE.CylinderGeometry(b.radius, b.radius, 1.8, 24),
      peach,
      b.x,
      b.y,
      b.z,
    ),
    mesh(
      new THREE.CylinderGeometry(b.radius * 0.75, b.radius * 0.75, 0.12, 24),
      white,
      b.x,
      b.y + 0.92,
      b.z,
    ),
  ]);
  const island = ISLAND_3D;
  mesh(
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
  for (const sign of [-1, 1])
    mesh(
      new THREE.CylinderGeometry(
        island.radius,
        island.radius,
        island.height,
        32,
      ),
      peach,
      island.x,
      island.y + island.height / 2,
      island.z + island.halfLength * sign,
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
  // The finish surface and arch share the physical crossing coordinate.
  const finishY = 1.6 - 0.075 * (MARBLE_FINISH_Z - 76) + 0.025;
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
  const labelLayer = document.createElement('div');
  labelLayer.className = 'marble-labels';
  labelLayer.setAttribute('aria-hidden', 'true');
  host.appendChild(labelLayer);
  const stems = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  stems.classList.add('marble-label-stems');
  labelLayer.appendChild(stems);
  type Ball = {
    mesh: THREE.Mesh;
    label: HTMLDivElement;
    stem: SVGLineElement;
    member: Member;
    texture: THREE.CanvasTexture;
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
  const focus = new THREE.Vector3(0, 30, 3),
    target = new THREE.Vector3(),
    desiredCamera = new THREE.Vector3(),
    projected = new THREE.Vector3(),
    position = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  function setMembers(list: Member[]) {
    const nextKey = list.map((p) => p.id + ':' + p.name).join('|');
    if (nextKey === key) return;
    key = nextKey;
    for (const b of balls) {
      scene.remove(b.mesh);
      b.material.dispose();
      b.texture.dispose();
      b.label.remove();
      b.stem.remove();
    }
    balls = list.map((member, slot) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = COLOURS[member.id % 8];
      ctx.fillRect(0, 0, 512, 256);
      ctx.fillStyle = '#ffefda';
      ctx.fillRect(0, 104, 512, 48);
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const x of [128, 384]) {
        ctx.beginPath();
        ctx.arc(x, 128, 39, 0, Math.PI * 2);
        ctx.fillStyle = '#fff8e9';
        ctx.fill();
        ctx.fillStyle = COLOURS[member.id % 8];
        ctx.fillText(String(member.id + 1), x, 130);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshPhysicalMaterial({
        map: texture,
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
      const label = document.createElement('div');
      label.className = 'marble-name';
      label.style.borderColor = COLOURS[member.id % 8];
      const img = document.createElement('img');
      img.src = '/duck.png';
      img.alt = '';
      img.style.filter = `hue-rotate(${HUES[member.id % 8]}deg)`;
      label.appendChild(img);
      const name = document.createElement('span');
      name.textContent = member.name || String(member.id + 1);
      label.appendChild(name);
      labelLayer.appendChild(label);
      const stem = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      );
      stem.setAttribute('stroke', COLOURS[member.id % 8]);
      stem.setAttribute('stroke-width', '1.5');
      stem.setAttribute('opacity', '.65');
      stems.appendChild(stem);
      return { mesh: object, label, stem, member, texture, material: mat };
    });
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
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
    bumperMeshes.forEach((pair, i) =>
      pair.forEach((m) => {
        m.position.x = frame?.bumperX[i] ?? BUMPERS[i].x;
      }),
    );
    const ranked = frame
      ? [...frame.marbles].sort((a, b) => b.progress - a.progress)
      : [];
    const leader = ranked[0];
    if (leader) {
      if (leader.stage === 1) target.set(FUNNEL.x, 6, FUNNEL.z);
      else target.set(leader.x, leader.y, leader.z + 4);
    } else target.set(0, 30, 3);
    focus.lerp(target, 0.045);
    if (lastOverview !== overview) {
      lastOverview = overview;
      controls.enabled = overview;
      if (overview) {
        camera.position.set(92, 110, -30);
        controls.target.set(2, 9, 47);
      } else {
        camera.position.copy(focus).add(new THREE.Vector3(19, 23, -25));
        controls.target.copy(focus);
      }
    }
    if (overview) controls.update();
    else {
      desiredCamera.copy(focus).add(new THREE.Vector3(19, 23, -25));
      camera.position.lerp(desiredCamera, 0.07);
      camera.lookAt(focus);
    }
    renderer.render(scene, camera);
    const width = host.clientWidth,
      height = host.clientHeight;
    const anchors: LabelAnchor[] = [];
    balls.forEach((b, slot) => {
      projected.copy(b.mesh.position);
      projected.y += 1.15;
      projected.project(camera);
      const visible =
        projected.z > -1 &&
        projected.z < 1 &&
        Math.abs(projected.x) < 1 &&
        Math.abs(projected.y) < 1;
      b.label.hidden = !visible;
      b.stem.style.display = 'none';
      if (!visible) return;
      anchors.push({
        slot,
        x: (projected.x * 0.5 + 0.5) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
        width: b.label.offsetWidth,
        height: b.label.offsetHeight,
      });
    });
    const placements = placeMarbleLabels(anchors, width, height);
    for (const anchor of anchors) {
      const b = balls[anchor.slot],
        box = placements.find((p) => p.slot === anchor.slot);
      b.label.hidden = !box;
      if (!box) continue;
      b.label.style.transform = `translate(${box.x}px,${box.y}px)`;
      b.stem.style.display = '';
      b.stem.setAttribute('x1', String(anchor.x));
      b.stem.setAttribute('y1', String(anchor.y + 8));
      b.stem.setAttribute('x2', String(box.x + box.width / 2));
      b.stem.setAttribute('y2', String(box.y + box.height));
    }
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
        b.texture.dispose();
      }
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
