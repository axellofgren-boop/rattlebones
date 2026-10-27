import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnemyKind } from '../config';

/**
 * Every model is assembled from simple shapes with colours baked into the vertices,
 * then merged into ONE geometry. That way a whole horde of one enemy type is a single
 * draw call, and there are no texture or model files to load.
 * Models face +Z and stand on y = 0.
 */

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

/** One material for all low-poly models; colours come from the geometry. */
export const toonMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

export class ModelBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(
    shape: THREE.BufferGeometry,
    color: number,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): this {
    const g = shape.index ? shape.toNonIndexed() : shape;
    if (g !== shape) shape.dispose();
    g.deleteAttribute('uv');
    tmpQuat.setFromEuler(tmpEuler.set(rot[0], rot[1], rot[2]));
    tmpMatrix.compose(tmpPos.set(...pos), tmpQuat, tmpScale.set(...scale));
    g.applyMatrix4(tmpMatrix);
    tmpColor.setHex(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts);
    if (!merged) throw new Error('ModelBuilder: parts could not be merged');
    for (const p of this.parts) p.dispose();
    merged.computeBoundingSphere();
    return merged;
  }
}

// Shape shorthands keep the model recipes below readable.
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cyl = (top: number, bottom: number, h: number, seg = 7) => new THREE.CylinderGeometry(top, bottom, h, seg);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);

export const PALETTE = {
  bone: 0xf3ead2,
  boneShade: 0xd9cba6,
  socket: 0x1d1426,
  bandana: 0xe23d4b,
};

/** The bone the hero throws. Lies along X so it can spin around Y. */
export function boneGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(cyl(0.07, 0.07, 0.7), PALETTE.bone, [0, 0, 0], [0, 0, Math.PI / 2])
    .add(ball(0.12, 0), PALETTE.bone, [0.36, 0, 0.07])
    .add(ball(0.12, 0), PALETTE.bone, [0.36, 0, -0.07])
    .add(ball(0.12, 0), PALETTE.bone, [-0.36, 0, 0.07])
    .add(ball(0.12, 0), PALETTE.bone, [-0.36, 0, -0.07])
    .build();
}

export function skullGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(ball(0.32, 1), PALETTE.bone, [0, 0.05, 0], [0, 0, 0], [1, 0.9, 1])
    .add(box(0.3, 0.14, 0.26), PALETTE.boneShade, [0, -0.2, 0.04])
    .add(ball(0.09, 0), PALETTE.socket, [0.12, 0.06, 0.25])
    .add(ball(0.09, 0), PALETTE.socket, [-0.12, 0.06, 0.25])
    .add(cone(0.04, 0.08, 3), PALETTE.socket, [0, -0.06, 0.29], [Math.PI, 0, 0])
    .build();
}

export function tombstoneGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(box(0.9, 1.1, 0.3), 0x9a9aa8, [0, 0.55, 0])
    .add(cyl(0.45, 0.45, 0.3, 10), 0x9a9aa8, [0, 1.1, 0], [Math.PI / 2, 0, 0], [1, 1, 1])
    .add(box(0.5, 0.08, 0.32), 0x6c6c7a, [0, 0.95, 0])
    .add(box(0.08, 0.5, 0.32), 0x6c6c7a, [0, 0.85, 0])
    .build();
}

/** White gem; the instance colour tints it by XP value. */
export function gemGeometry(): THREE.BufferGeometry {
  return new ModelBuilder().add(new THREE.OctahedronGeometry(0.22, 0), 0xffffff, [0, 0, 0], [0, 0, 0], [0.8, 1.2, 0.8]).build();
}

export function healGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(ball(0.3, 1), 0xb5532e, [0, 0, 0], [0, 0, 0], [1, 0.85, 1.2])
    .add(cyl(0.06, 0.06, 0.4), PALETTE.bone, [0, 0, -0.4], [Math.PI / 2, 0, 0])
    .add(ball(0.09, 0), PALETTE.bone, [0.05, 0, -0.6])
    .add(ball(0.09, 0), PALETTE.bone, [-0.05, 0, -0.6])
    .build();
}

export function magnetGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(new THREE.TorusGeometry(0.3, 0.1, 6, 10, Math.PI), 0xe23d4b, [0, 0.05, 0])
    .add(box(0.2, 0.2, 0.2), 0xdfe6ef, [0.3, -0.05, 0])
    .add(box(0.2, 0.2, 0.2), 0xdfe6ef, [-0.3, -0.05, 0])
    .build();
}

export function chestGeometry(): THREE.BufferGeometry {
  return new ModelBuilder()
    .add(box(0.9, 0.5, 0.6), 0x8a5a2b, [0, 0.25, 0])
    .add(cyl(0.3, 0.3, 0.9, 8), 0xa06a35, [0, 0.5, 0], [0, 0, Math.PI / 2], [1, 1, 1])
    .add(box(0.95, 0.12, 0.65), 0xffc93c, [0, 0.42, 0])
    .add(box(0.16, 0.2, 0.1), 0xffc93c, [0, 0.42, 0.32])
    .build();
}

/** Visual size multiplier per enemy kind (models are built at roughly human scale). */
export const ENEMY_SCALE: Record<EnemyKind, number> = {
  shambler: 1,
  bat: 1,
  golem: 1,
  imp: 1,
  brute: 1.9,
  keeper: 2.3,
};

export function enemyGeometry(kind: EnemyKind): THREE.BufferGeometry {
  const b = new ModelBuilder();
  switch (kind) {
    case 'shambler': {
      const skin = 0x8fbf6a;
      b.add(box(0.22, 0.6, 0.22), 0x3b4a7a, [0.15, 0.3, 0])
        .add(box(0.22, 0.6, 0.22), 0x3b4a7a, [-0.15, 0.3, 0])
        .add(box(0.62, 0.66, 0.36), 0x8a6a45, [0, 0.93, 0])
        .add(box(0.46, 0.44, 0.42), skin, [0, 1.48, 0.02], [0.15, 0, 0.1])
        .add(box(0.11, 0.09, 0.04), 0xfff27a, [0.11, 1.54, 0.23])
        .add(box(0.08, 0.07, 0.04), 0xfff27a, [-0.12, 1.5, 0.23])
        .add(box(0.2, 0.06, 0.04), 0x3a2230, [0, 1.36, 0.23])
        .add(box(0.16, 0.16, 0.62), skin, [0.38, 1.12, 0.3])
        .add(box(0.16, 0.16, 0.62), skin, [-0.38, 1.12, 0.3]);
      break;
    }
    case 'bat': {
      const fur = 0x5a3d7a;
      b.add(ball(0.3, 1), fur, [0, 1.3, 0])
        .add(cone(0.09, 0.22, 4), fur, [0.14, 1.6, 0])
        .add(cone(0.09, 0.22, 4), fur, [-0.14, 1.6, 0])
        .add(box(0.7, 0.05, 0.42), 0x3a2550, [0.5, 1.35, -0.05], [0, 0, 0.35])
        .add(box(0.7, 0.05, 0.42), 0x3a2550, [-0.5, 1.35, -0.05], [0, 0, -0.35])
        .add(ball(0.06, 0), 0xff4040, [0.1, 1.38, 0.26])
        .add(ball(0.06, 0), 0xff4040, [-0.1, 1.38, 0.26])
        .add(cone(0.03, 0.08, 3), 0xffffff, [0.05, 1.2, 0.27], [Math.PI, 0, 0])
        .add(cone(0.03, 0.08, 3), 0xffffff, [-0.05, 1.2, 0.27], [Math.PI, 0, 0]);
      break;
    }
    case 'golem': {
      const mud = 0x7b5a3a;
      b.add(box(0.36, 0.5, 0.36), mud, [0.28, 0.25, 0])
        .add(box(0.36, 0.5, 0.36), mud, [-0.28, 0.25, 0])
        .add(box(1.25, 1.1, 0.9), mud, [0, 1.0, 0])
        .add(box(1.3, 0.2, 0.95), 0x5f9a3a, [0, 1.6, 0])
        .add(box(0.62, 0.5, 0.56), 0x6a4c30, [0, 1.85, 0.08])
        .add(box(0.14, 0.1, 0.04), 0xff9a2a, [0.14, 1.9, 0.37])
        .add(box(0.14, 0.1, 0.04), 0xff9a2a, [-0.14, 1.9, 0.37])
        .add(box(0.38, 1.0, 0.38), mud, [0.85, 0.85, 0.1], [0.3, 0, 0])
        .add(box(0.38, 1.0, 0.38), mud, [-0.85, 0.85, 0.1], [0.3, 0, 0])
        .add(ball(0.18, 0), 0x5f9a3a, [0.35, 1.3, 0.45]);
      break;
    }
    case 'imp': {
      const red = 0xd8453a;
      b.add(box(0.14, 0.35, 0.14), 0x8a2a24, [0.12, 0.18, 0])
        .add(box(0.14, 0.35, 0.14), 0x8a2a24, [-0.12, 0.18, 0])
        .add(box(0.5, 0.5, 0.36), red, [0, 0.6, 0])
        .add(ball(0.32, 1), red, [0, 1.08, 0.02])
        .add(cone(0.07, 0.22, 4), 0x2a1a1a, [0.2, 1.36, 0], [0, 0, -0.5])
        .add(cone(0.07, 0.22, 4), 0x2a1a1a, [-0.2, 1.36, 0], [0, 0, 0.5])
        .add(cyl(0.09, 0.09, 0.3), 0xfff3d6, [0, 1.5, 0])
        .add(cone(0.08, 0.2, 5), 0xffd23f, [0, 1.75, 0])
        .add(ball(0.06, 0), 0xffe680, [0.11, 1.12, 0.28])
        .add(ball(0.06, 0), 0xffe680, [-0.11, 1.12, 0.28])
        .add(cone(0.05, 0.4, 3), 0x8a2a24, [0, 0.5, -0.3], [-1.1, 0, 0]);
      break;
    }
    case 'brute': {
      b.add(box(0.3, 0.6, 0.3), 0x3d2f22, [0.22, 0.3, 0])
        .add(box(0.3, 0.6, 0.3), 0x3d2f22, [-0.22, 0.3, 0])
        .add(box(0.95, 0.85, 0.6), 0x4a6b2a, [0, 0.98, 0])
        .add(box(0.28, 0.75, 0.28), 0x4a6b2a, [0.62, 0.95, 0.12], [0.4, 0, 0.15])
        .add(box(0.28, 0.75, 0.28), 0x4a6b2a, [-0.62, 0.95, 0.12], [0.4, 0, -0.15])
        .add(ball(0.55, 1), 0xff8a1c, [0, 1.8, 0], [0, 0, 0], [1.1, 0.82, 1])
        .add(cyl(0.06, 0.08, 0.22), 0x4a6b2a, [0, 2.3, 0], [0, 0, 0.3])
        .add(cone(0.11, 0.16, 3), 0xffe14a, [0.2, 1.88, 0.5], [Math.PI / 2, 0, 0])
        .add(cone(0.11, 0.16, 3), 0xffe14a, [-0.2, 1.88, 0.5], [Math.PI / 2, 0, 0])
        .add(box(0.4, 0.08, 0.05), 0xffe14a, [0, 1.62, 0.53]);
      break;
    }
    case 'keeper': {
      const robe = 0x2c2340;
      b.add(cone(0.85, 2.2, 7), robe, [0, 1.1, 0])
        .add(ball(0.42, 1), robe, [0, 2.25, -0.02])
        .add(ball(0.3, 1), 0x0e0a16, [0, 2.2, 0.15], [0, 0, 0], [1, 1, 0.6])
        .add(ball(0.07, 0), 0x6ef3ff, [0.11, 2.24, 0.34])
        .add(ball(0.07, 0), 0x6ef3ff, [-0.11, 2.24, 0.34])
        .add(box(0.22, 0.8, 0.22), robe, [0.62, 1.55, 0.2], [0.6, 0, -0.3])
        .add(box(0.22, 0.8, 0.22), robe, [-0.62, 1.55, 0.2], [0.6, 0, 0.3])
        .add(cyl(0.05, 0.05, 3.2), 0x5a4030, [0.85, 1.6, 0.5])
        .add(box(1.3, 0.12, 0.08), 0xc9d3dc, [0.35, 3.15, 0.5], [0, 0, -0.25])
        .add(box(0.3, 0.36, 0.3), 0x3a3a3a, [-0.85, 1.0, 0.55])
        .add(box(0.2, 0.26, 0.2), 0xffd23f, [-0.85, 1.0, 0.55]);
      break;
    }
  }
  return b.build();
}

/** Scenery: built once, placed many times with instancing. */
export function propGeometry(kind: 'grave' | 'tree' | 'pumpkin' | 'rock' | 'mushroom'): THREE.BufferGeometry {
  const b = new ModelBuilder();
  switch (kind) {
    case 'grave':
      b.add(box(0.7, 0.9, 0.22), 0x8e8e9e, [0, 0.45, 0])
        .add(cyl(0.35, 0.35, 0.22, 8), 0x8e8e9e, [0, 0.9, 0], [Math.PI / 2, 0, 0])
        .add(box(0.9, 0.08, 1.4), 0x4a6b2f, [0, 0.04, 0.75]);
      break;
    case 'tree':
      b.add(cyl(0.18, 0.3, 2.4, 6), 0x5b4334, [0, 1.2, 0])
        .add(cyl(0.07, 0.11, 1.1, 5), 0x5b4334, [0.45, 2.1, 0], [0, 0, -0.9])
        .add(cyl(0.06, 0.1, 0.9, 5), 0x5b4334, [-0.38, 2.35, 0.1], [0.2, 0, 0.8])
        .add(cyl(0.05, 0.08, 0.8, 5), 0x5b4334, [0.05, 2.7, -0.3], [-0.7, 0, 0]);
      break;
    case 'pumpkin':
      b.add(ball(0.42, 1), 0xf07f1a, [0, 0.32, 0], [0, 0, 0], [1.15, 0.8, 1.15])
        .add(cyl(0.05, 0.07, 0.2), 0x4a6b2a, [0, 0.7, 0]);
      break;
    case 'rock':
      b.add(new THREE.DodecahedronGeometry(0.7, 0), 0x7d7a86, [0, 0.35, 0], [0.3, 0.5, 0], [1.2, 0.75, 1]);
      break;
    case 'mushroom':
      b.add(cyl(0.08, 0.1, 0.35, 6), 0xf3ead2, [0, 0.17, 0])
        .add(ball(0.22, 1), 0x9b59d0, [0, 0.38, 0], [0, 0, 0], [1, 0.55, 1])
        .add(ball(0.05, 0), 0xffffff, [0.1, 0.45, 0.08]);
      break;
  }
  return b.build();
}

/** Soft dark circle used as a cheap shadow under characters. */
export function shadowMaterial(): THREE.MeshBasicMaterial {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false });
}

/** Flat 1×1 quad lying on the ground, for shadows. */
export function groundQuad(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}
