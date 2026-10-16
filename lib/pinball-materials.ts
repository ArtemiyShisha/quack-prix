import * as THREE from 'three';
import { REACTOR_GOAL } from './pinball-reactor.ts';

// Small, seamless surface maps supply relief and roughness. The playfield art
// has its own world-aligned UVs, so detail never stretches with the floor mesh.
export function createPinballTextures(
  anisotropy: number,
  owned: THREE.Texture[],
) {
  function configure<T extends THREE.Texture>(texture: T, colour = false): T {
    texture.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = anisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
  function remember<T extends THREE.Texture>(texture: T): T {
    owned.push(texture);
    return texture;
  }
  function finish(kind: 'enamel' | 'steel' | 'rubber') {
    const size = 256,
      heights = new Float32Array(size * size),
      normals = new Uint8Array(size * size * 4),
      roughness = new Uint8Array(size * size * 4);
    let seed = 41729;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const brushed = Array.from({ length: size }, random);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const grain = random();
        heights[y * size + x] =
          kind === 'steel' ? brushed[y] * 0.85 + grain * 0.15 : grain;
      }
    const sample = (x: number, y: number) =>
      heights[((y + size) % size) * size + ((x + size) % size)];
    const strength = kind === 'rubber' ? 0.32 : kind === 'steel' ? 0.14 : 0.09;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4,
          dx = (sample(x - 1, y) - sample(x + 1, y)) * strength,
          dy = (sample(x, y - 1) - sample(x, y + 1)) * strength,
          length = Math.sqrt(dx * dx + dy * dy + 1),
          value = Math.round(211 + sample(x, y) * 44);
        normals.set(
          [
            ((dx / length) * 0.5 + 0.5) * 255,
            ((dy / length) * 0.5 + 0.5) * 255,
            (0.5 / length + 0.5) * 255,
            255,
          ],
          i,
        );
        roughness.set([value, value, value, 255], i);
      }
    const maps = [normals, roughness].map((data) => {
      const texture = remember(
        configure(new THREE.DataTexture(data, size, size)),
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      return texture;
    });
    return { normalMap: maps[0], roughnessMap: maps[1] };
  }
  const enamel = finish('enamel'),
    steel = finish('steel'),
    rubber = finish('rubber');
  function repeat(texture: THREE.Texture, x: number, y: number) {
    const copy = remember(texture.clone());
    copy.repeat.set(x, y);
    copy.needsUpdate = true;
    return copy;
  }
  function reactorDeck(top = -11) {
    const length = 11.8 - top;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = top < -11 ? 4096 : 2048;
    const ctx = canvas.getContext('2d')!;
    const px = (x: number) => ((x + 7.2) / 14.4) * canvas.width,
      py = (z: number) => ((z - top) / length) * canvas.height;
    const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, '#07435a');
    base.addColorStop((-3.248 - top) / length, '#0a4e63');
    base.addColorStop((-0.056 - top) / length, '#246475');
    base.addColorStop((2.224 - top) / length, '#b88942');
    base.addColorStop(1, '#d8ad62');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fine printed rules remain below the routes and target markings.
    ctx.strokeStyle = '#c3edf20b';
    ctx.lineWidth = 1.4;
    for (let x = -7; x <= 7; x += 0.5) {
      ctx.beginPath();
      ctx.moveTo(px(x), 0);
      ctx.lineTo(px(x), py(-1.5));
      ctx.stroke();
    }
    for (let z = Math.floor(top); z < -1.5; z += 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, py(z));
      ctx.lineTo(canvas.width, py(z));
      ctx.stroke();
    }
    function ring(radius: number, colour: string, width: number) {
      ctx.beginPath();
      ctx.ellipse(
        px(REACTOR_GOAL.x),
        py(REACTOR_GOAL.z),
        (radius / 14.4) * canvas.width,
        (radius / length) * canvas.height,
        0,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ring(6.3, '#63481780', 4);
    ring(6.12, '#fff1b55c', 2);
    ring(5.5, '#6348174d', 2);
    ring(3.65, '#6748168c', 4);
    ring(3.48, '#f7e4a654', 2);
    ring(1.27, '#153d48', 12);
    ring(1.42, '#fbe3a7', 3);
    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2,
        inner = i % 4 === 0 ? 5.84 : 5.99;
      ctx.beginPath();
      ctx.moveTo(
        px(Math.cos(angle) * inner),
        py(REACTOR_GOAL.z + Math.sin(angle) * inner),
      );
      ctx.lineTo(
        px(Math.cos(angle) * 6.1),
        py(REACTOR_GOAL.z + Math.sin(angle) * 6.1),
      );
      ctx.strokeStyle = '#624a2680';
      ctx.lineWidth = i % 4 === 0 ? 4 : 2;
      ctx.stroke();
    }
    // Register marks and fasteners are printed artwork, never obstacles.
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#a4d5dc80';
      ctx.lineWidth = 3;
      for (const z of [-9.4, -7.2, -5, -2.8]) {
        const x = side * 6.0;
        ctx.beginPath();
        ctx.moveTo(px(x), py(z - 0.17));
        ctx.lineTo(px(x), py(z + 0.17));
        ctx.moveTo(px(x - 0.12), py(z));
        ctx.lineTo(px(x + 0.12), py(z));
        ctx.stroke();
      }
    }
    return {
      map: remember(configure(new THREE.CanvasTexture(canvas), true)),
      normalMap: repeat(enamel.normalMap, 18, (28 * length) / 22.8),
      roughnessMap: repeat(enamel.roughnessMap, 18, (28 * length) / 22.8),
    };
  }
  function ball(colour: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#143e52';
    ctx.fillRect(0, 224, 1024, 64);
    ctx.fillStyle = '#fff9df';
    ctx.fillRect(0, 231, 1024, 50);
    // Owned by the ball: changing the roster releases this map with its skin.
    return configure(new THREE.CanvasTexture(canvas), true);
  }
  return { enamel, steel, rubber, reactorDeck, ball };
}
