import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ICE, type IceFrame } from './ice-floe';
import { COLOURS } from './track';
import type { Member } from './roster';

export function createIceScene(host: HTMLDivElement, onFailure: () => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9eef4');
  scene.fog = new THREE.Fog('#d9eef4', 24, 55);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute(
    'aria-label',
    'Объёмные утки сталкиваются на тающей льдине посреди воды',
  );
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 70);
  camera.position.set(8.8, 10.8, 12);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.2, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 9;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.42;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const lights = new THREE.HemisphereLight('#effaff', '#407790', 2.5);
  scene.add(lights);
  const sun = new THREE.DirectionalLight('#fff5df', 3.4);
  sun.position.set(-6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -7,
    right: 7,
    top: 7,
    bottom: -7,
    near: 0.5,
    far: 30,
  });
  sun.shadow.bias = -0.001;
  scene.add(sun);

  function geometry<T extends THREE.BufferGeometry>(value: T): T {
    geometries.push(value);
    return value;
  }
  function material(colour: string, roughness = 0.4) {
    const value = new THREE.MeshStandardMaterial({ color: colour, roughness });
    materials.push(value);
    return value;
  }
  function mesh(
    shape: THREE.BufferGeometry,
    surface: THREE.Material | THREE.Material[],
    parent: THREE.Object3D = scene,
  ) {
    const value = new THREE.Mesh(shape, surface);
    value.castShadow = true;
    value.receiveShadow = true;
    parent.add(value);
    return value;
  }
  const sphere = geometry(new THREE.SphereGeometry(1, 24, 16));
  const ice = mesh(geometry(new THREE.CylinderGeometry(1, 1, 0.38, 64)), [
    material('#b8e7f4', 0.18),
    material('#effbff', 0.2),
    material('#88d0e8'),
  ]);
  ice.position.y = -0.2;
  const cracks = new THREE.Group();
  scene.add(cracks);
  const crackMaterial = new THREE.LineBasicMaterial({
    color: '#7fc6df',
    transparent: true,
    opacity: 0.5,
  });
  materials.push(crackMaterial);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    const shape = geometry(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(
          Math.cos(angle) * 0.42,
          0.005,
          Math.sin(angle) * 0.42,
        ),
        new THREE.Vector3(
          Math.cos(angle + 0.2) * 0.62,
          0.005,
          Math.sin(angle + 0.2) * 0.62,
        ),
        new THREE.Vector3(
          Math.cos(angle) * 0.98,
          0.005,
          Math.sin(angle) * 0.98,
        ),
      ]),
    );
    cracks.add(new THREE.Line(shape, crackMaterial));
  }
  const edge = mesh(
    geometry(new THREE.TorusGeometry(1, 0.013, 6, 96)),
    material('#99def4'),
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.01;
  const waterShape = geometry(new THREE.PlaneGeometry(70, 70, 48, 48));
  waterShape.rotateX(-Math.PI / 2);
  const water = mesh(waterShape, material('#59b7d0', 0.25));
  water.position.y = ICE.waterLevel;
  water.castShadow = false;
  const waveMaterial = new THREE.MeshBasicMaterial({
    color: '#b7f0fa',
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(waveMaterial);
  const waves: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const wave = mesh(
      geometry(new THREE.RingGeometry(5 + i * 1.8, 5.018 + i * 1.8, 96)),
      waveMaterial,
    );
    wave.rotation.x = -Math.PI / 2;
    wave.position.y = ICE.waterLevel + 0.08;
    wave.castShadow = false;
    waves.push(wave);
  }
  const chips: THREE.Mesh[] = [];
  const chipShape = geometry(new THREE.CylinderGeometry(0.32, 0.38, 0.24, 5));
  const chipMaterial = material('#daf5fe');
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI * 2) / 14;
    const radius = 5.8 + Math.sin(i * 5) * 0.65;
    const chip = mesh(chipShape, chipMaterial);
    chip.position.set(
      Math.cos(angle) * radius,
      ICE.waterLevel + 0.05,
      Math.sin(angle) * radius,
    );
    chip.scale.set(1 + (i % 3) * 0.2, 1, 0.6 + (i % 2) * 0.3);
    chip.rotation.y = angle;
    chips.push(chip);
  }
  const wind = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-4.8, 0.9, 0),
    1.4,
    '#3d98b8',
    0.32,
    0.18,
  );
  scene.add(wind);
  const beakMaterial = material('#f29545', 0.32);
  const white = material('#fff');
  const black = material('#203846');
  const beakShape = geometry(new THREE.SphereGeometry(1, 16, 12));
  const splashShape = geometry(new THREE.RingGeometry(0.45, 0.52, 40));

  type DuckView = {
    group: THREE.Group;
    label: THREE.Sprite;
    splash: THREE.Mesh;
    surface: THREE.Material;
    wing: THREE.Mesh;
  };
  let ducks: DuckView[] = [];
  let memberKey = '';
  function makeLabel(name: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 80;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffffeb';
    context.beginPath();
    context.roundRect(0, 0, 384, 80, 26);
    context.fill();
    context.font = 'bold 33px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#285169';
    context.fillText(
      name.length > 14 ? `${name.slice(0, 13)}…` : name,
      192,
      42,
      354,
    );
    const texture = new THREE.CanvasTexture(canvas);
    const surface = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const label = new THREE.Sprite(surface);
    label.visible = Boolean(name);
    label.scale.set(1.7, 0.355, 1);
    scene.add(label);
    return label;
  }
  function setMembers(members: Member[]) {
    const key = members
      .map((member) => `${member.id}:${member.name}`)
      .join('|');
    if (memberKey === key) return;
    memberKey = key;
    for (const duck of ducks) {
      scene.remove(duck.group, duck.label, duck.splash);
      duck.surface.dispose();
      const labelMaterial = duck.label.material as THREE.SpriteMaterial;
      labelMaterial.map?.dispose();
      labelMaterial.dispose();
      (duck.splash.material as THREE.Material).dispose();
    }
    ducks = members.map((member) => {
      const group = new THREE.Group();
      scene.add(group);
      const surface = new THREE.MeshStandardMaterial({
        color: COLOURS[member.id % 8],
        roughness: 0.25,
        metalness: 0.04,
      });
      const body = mesh(sphere, surface, group);
      body.scale.set(0.54, 0.38, 0.65);
      body.position.y = -0.12;
      const head = mesh(sphere, surface, group);
      head.scale.setScalar(0.35);
      head.position.set(0, 0.34, 0.35);
      const beak = mesh(beakShape, beakMaterial, group);
      beak.scale.set(0.25, 0.1, 0.28);
      beak.position.set(0, 0.24, 0.65);
      const wing = mesh(sphere, surface, group);
      wing.scale.set(0.08, 0.22, 0.34);
      wing.position.set(0.48, -0.08, -0.02);
      const otherWing = mesh(sphere, surface, group);
      otherWing.scale.copy(wing.scale);
      otherWing.position.set(-0.48, -0.08, -0.02);
      const tail = mesh(sphere, surface, group);
      tail.scale.set(0.24, 0.2, 0.3);
      tail.position.set(0, 0.04, -0.55);
      tail.rotation.x = -0.5;
      for (const side of [-1, 1]) {
        const eye = mesh(sphere, white, group);
        eye.scale.setScalar(0.095);
        eye.position.set(side * 0.235, 0.41, 0.57);
        const pupil = mesh(sphere, black, group);
        pupil.scale.setScalar(0.052);
        pupil.position.set(side * 0.248, 0.415, 0.635);
      }
      const splashSurface = new THREE.MeshBasicMaterial({
        color: '#effbff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const splash = mesh(splashShape, splashSurface);
      splash.castShadow = false;
      splash.rotation.x = -Math.PI / 2;
      splash.position.y = ICE.waterLevel + 0.1;
      return { group, label: makeLabel(member.name), splash, surface, wing };
    });
  }

  let frame: IceFrame | null = null,
    people: Member[] = [],
    overview = false;
  let disposed = false,
    request = 0,
    finishedAt: number | null = null,
    seed: number | null = null;
  const observer = new ResizeObserver(() => resize());
  function resize() {
    const width = Math.max(host.clientWidth, 1),
      height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  observer.observe(host);
  resize();
  const loss = (event: Event) => {
    event.preventDefault();
    onFailure();
  };
  renderer.domElement.addEventListener('webglcontextlost', loss);
  const started = performance.now();
  const cameraTarget = new THREE.Vector3(0, -0.2, 0);
  const cameraPosition = new THREE.Vector3();
  function draw(now: number) {
    if (disposed) return;
    request = requestAnimationFrame(draw);
    if (document.hidden) return;
    setMembers(people);
    const decorativeTime = (now - started) / 1000;
    const radius = frame?.iceRadius ?? ICE.radius;
    ice.scale.set(Math.max(radius, 0.001), 1, Math.max(radius, 0.001));
    cracks.scale.set(radius, 1, radius);
    edge.scale.setScalar(Math.max(radius, 0.001));
    const positions = waterShape.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      positions.setY(
        i,
        0.045 * Math.sin(x * 0.8 + decorativeTime) +
          0.025 * Math.cos(z * 1.1 - decorativeTime * 1.3),
      );
    }
    positions.needsUpdate = true;
    waterShape.computeVertexNormals();
    chips.forEach((chip, index) => {
      chip.position.y =
        ICE.waterLevel + 0.03 + Math.sin(decorativeTime * 1.2 + index) * 0.045;
      chip.rotation.z = Math.sin(decorativeTime + index) * 0.06;
    });
    waves.forEach((wave, index) => {
      wave.scale.setScalar(1 + Math.sin(decorativeTime * 0.4 + index) * 0.04);
    });
    if (frame?.result && finishedAt === null) finishedAt = now;
    const simulationTime =
      (frame?.elapsed ?? 0) +
      (finishedAt === null ? 0 : Math.min(2, (now - finishedAt) / 1000));
    ducks.forEach((duck, slot) => {
      const state = frame?.iceDucks[slot];
      const angle = (slot * Math.PI * 2) / Math.max(ducks.length, 1);
      if (!state) {
        duck.group.position.set(
          Math.cos(angle) * 2.05,
          ICE.duckRadius,
          Math.sin(angle) * 2.05,
        );
        duck.group.rotation.set(0, angle + Math.PI * 1.5, 0);
        duck.label.material.opacity = 1;
        duck.splash.visible = false;
      } else if (state.alive) {
        duck.group.position.set(state.x, state.y, state.z);
        duck.group.rotation.set(
          0,
          state.angle,
          Math.sin(decorativeTime * 7 + slot) * 0.045,
        );
        duck.wing.rotation.z = Math.sin(decorativeTime * 9 + slot) * 0.15;
        duck.label.material.opacity = 1;
        duck.splash.visible = false;
      } else {
        const age = Math.max(0, simulationTime - state.eliminatedAt!);
        const flight = Math.min(age, 0.5);
        duck.group.position.set(
          state.exitX + state.exitVx * flight * 0.5,
          Math.max(ICE.waterLevel + 0.17, ICE.duckRadius - 9 * age * age),
          state.exitZ + state.exitVz * flight * 0.5,
        );
        duck.group.rotation.set(
          Math.min(age * 1.7, 0.2),
          state.angle,
          Math.sin(decorativeTime * 2 + slot) * 0.12,
        );
        duck.label.material.opacity = 0.4;
        duck.splash.position.x = duck.group.position.x;
        duck.splash.position.z = duck.group.position.z;
        duck.splash.scale.setScalar(0.8 + Math.min(age, 1) * 1.7);
        (duck.splash.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          1 - Math.abs(age - 0.4) / 0.65,
        );
        duck.splash.visible = age < 1.05;
      }
      duck.label.position
        .copy(duck.group.position)
        .add(new THREE.Vector3(0, 1.05, 0));
    });
    const breeze = frame?.wind ?? { x: 1, z: 0.2 };
    wind.setDirection(new THREE.Vector3(breeze.x, 0, breeze.z).normalize());
    wind.position.x = -Math.max(3.4, radius + 0.8);
    controls.enabled = overview;
    if (overview) controls.update();
    else {
      const zoom = frame ? Math.max(0.78, radius / ICE.radius) : 1;
      const portrait = camera.aspect < 1 ? 1.4 : 1;
      cameraPosition.set(
        8.3 * zoom * portrait,
        9.8 * zoom * portrait,
        11.5 * zoom * portrait,
      );
      camera.position.lerp(cameraPosition, 0.04);
      camera.lookAt(cameraTarget);
      controls.target.copy(cameraTarget);
    }
    renderer.render(scene, camera);
  }
  request = requestAnimationFrame(draw);
  return {
    update(next: IceFrame | null, members: Member[], showAll: boolean) {
      if (seed !== next?.seed || (!next && frame)) {
        finishedAt = null;
        seed = next?.seed ?? null;
      }
      frame = next;
      people = members.filter((member) => member.active && member.name.trim());
      if (!people.length)
        people = Array.from({ length: 6 }, (_, id) => ({
          id,
          name: '',
          active: true,
        }));
      overview = showAll;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', loss);
      for (const duck of ducks) {
        duck.surface.dispose();
        (duck.splash.material as THREE.Material).dispose();
        const labelSurface = duck.label.material as THREE.SpriteMaterial;
        labelSurface.map?.dispose();
        labelSurface.dispose();
      }
      for (const shape of geometries) shape.dispose();
      for (const surface of materials) surface.dispose();
      wind.line.geometry.dispose();
      wind.cone.geometry.dispose();
      const arrowMaterials = [wind.line.material, wind.cone.material].flat();
      for (const surface of arrowMaterials) surface.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
