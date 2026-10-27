import * as THREE from 'three';
import { ARENA_RADIUS, COLORS } from '../config';
import { heightAt } from '../core/terrain';
import { propGeometry, toonMaterial } from './models';

/** Small seeded random generator so the graveyard looks the same every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sky, lights, the hilly arena and its decorations. Scenery is visual only: nothing blocks movement. */
export class World {
  readonly scene = new THREE.Scene();

  constructor() {
    const { scene } = this;
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 28, 62);

    scene.add(new THREE.HemisphereLight(0xd8d0ff, 0x3a3020, 2.2));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.0);
    sun.position.set(-8, 20, 10);
    scene.add(sun);

    scene.add(this.buildGround());
    this.scatterProps();
  }

  /** A big low-poly field: every triangle gets a slightly different green for a hand-made look. */
  private buildGround(): THREE.Mesh {
    const size = ARENA_RADIUS * 2 + 60;
    const segments = 70;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments).toNonIndexed();
    geo.rotateX(-Math.PI / 2);
    const rand = seeded(7);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(COLORS.ground);
    const grassDark = new THREE.Color(COLORS.groundDark);
    const dirt = new THREE.Color(0x3b3346);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const outside = Math.hypot(cx, cz) > ARENA_RADIUS + 1.5;
      c.copy(grass).lerp(grassDark, rand());
      if (outside) c.lerp(dirt, 0.75);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = c.r;
        colors[(i + k) * 3 + 1] = c.g;
        colors[(i + k) * 3 + 2] = c.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.deleteAttribute('uv');
    return new THREE.Mesh(geo, toonMaterial);
  }

  private scatterProps(): void {
    const rand = seeded(42);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();

    const place = (
      kind: Parameters<typeof propGeometry>[0],
      count: number,
      spot: (i: number) => [number, number],
      sizeMin: number,
      sizeMax: number,
    ) => {
      const mesh = new THREE.InstancedMesh(propGeometry(kind), toonMaterial, count);
      for (let i = 0; i < count; i++) {
        const [x, z] = spot(i);
        const s = sizeMin + rand() * (sizeMax - sizeMin);
        quat.setFromAxisAngle(up, rand() * Math.PI * 2);
        matrix.compose(pos.set(x, heightAt(x, z) - 0.05, z), quat, scale.set(s, s, s));
        mesh.setMatrixAt(i, matrix);
      }
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
    };

    // Random spot inside the arena, leaving the very centre clear for the start.
    const inside = (): [number, number] => {
      const r = 6 + Math.sqrt(rand()) * (ARENA_RADIUS - 8);
      const a = rand() * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    // Spot on the border band that marks the arena's edge.
    const border = (i: number, count: number, spread: number): [number, number] => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.05;
      const r = ARENA_RADIUS + 1.5 + rand() * spread;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };

    place('grave', 70, inside, 0.8, 1.3);
    place('pumpkin', 40, inside, 0.7, 1.4);
    place('mushroom', 80, inside, 0.8, 1.6);
    place('tree', 22, inside, 0.9, 1.4);
    place('rock', 150, (i) => border(i, 150, 2), 1.2, 2.4);
    place('tree', 70, (i) => border(i, 70, 6), 1.2, 1.9);
  }
}
