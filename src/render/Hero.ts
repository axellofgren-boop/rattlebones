import * as THREE from 'three';
import { damp } from '../core/math';
import type { HatKind } from '../game/characters';
import { ModelBuilder, PALETTE, groundQuad, shadowMaterial } from './models';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const ball = (r: number, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cyl = (top: number, bottom: number, h: number, seg = 6) => new THREE.CylinderGeometry(top, bottom, h, seg);

const DARK = 0x221a2c;
const GOLD = 0xffd23f;

/** Builds a character's hat in head space (the skull's top is at about y = 0.5). */
function hatGeometry(kind: HatKind, accent: number): THREE.BufferGeometry {
  const b = new ModelBuilder();
  switch (kind) {
    case 'bandana':
      b.add(cyl(0.36, 0.36, 0.12, 9), accent, [0, 0.36, 0])
        .add(box(0.08, 0.22, 0.04), accent, [0.08, 0.27, -0.38], [0.4, 0, 0.4])
        .add(box(0.08, 0.22, 0.04), accent, [-0.06, 0.25, -0.38], [0.5, 0, -0.3]);
      break;
    case 'helmet':
      b.add(cyl(0.4, 0.4, 0.42, 10), 0x9aa3b5, [0, 0.3, 0])
        .add(ball(0.4), 0x9aa3b5, [0, 0.5, 0], [0, 0, 0], [1, 0.5, 1])
        .add(box(0.46, 0.06, 0.06), DARK, [0, 0.24, 0.38])
        .add(box(0.06, 0.25, 0.06), DARK, [0, 0.14, 0.39])
        .add(box(0.08, 0.32, 0.46), accent, [0, 0.82, -0.05]);
      break;
    case 'wizard':
      b.add(cyl(0.55, 0.55, 0.05, 12), accent, [0, 0.42, 0])
        .add(new THREE.ConeGeometry(0.36, 0.9, 8), accent, [0.05, 0.88, 0], [0, 0, -0.2])
        .add(ball(0.07, 0), GOLD, [0.1, 0.7, 0.3]);
      break;
    case 'pirate':
      b.add(cyl(0.58, 0.58, 0.08, 3), DARK, [0, 0.45, 0], [0, Math.PI, 0])
        .add(cyl(0.33, 0.36, 0.25, 8), DARK, [0, 0.58, 0])
        .add(cyl(0.37, 0.37, 0.06, 8), accent, [0, 0.5, 0])
        .add(ball(0.07, 0), 0xffffff, [0, 0.6, 0.34]);
      break;
    case 'beanie':
      b.add(ball(0.38), accent, [0, 0.38, 0], [0, 0, 0], [1, 0.75, 1])
        .add(cyl(0.39, 0.39, 0.1, 10), 0xf3f6ff, [0, 0.3, 0])
        .add(ball(0.11, 0), 0xf3f6ff, [0, 0.7, 0]);
      break;
    case 'goggles':
      b.add(cyl(0.36, 0.36, 0.08, 10), DARK, [0, 0.4, 0])
        .add(cyl(0.12, 0.12, 0.08, 8), accent, [0.14, 0.42, 0.31], [Math.PI / 2, 0, 0])
        .add(cyl(0.12, 0.12, 0.08, 8), accent, [-0.14, 0.42, 0.31], [Math.PI / 2, 0, 0])
        .add(ball(0.14, 0), 0x6bdc3a, [0.1, 0.56, -0.1]);
      break;
    case 'witch':
      b.add(cyl(0.62, 0.62, 0.04, 12), DARK, [0, 0.42, 0])
        .add(new THREE.ConeGeometry(0.33, 1.0, 8), DARK, [0.08, 0.92, 0], [0, 0, -0.35])
        .add(cyl(0.3, 0.33, 0.07, 8), accent, [0, 0.5, 0]);
      break;
    case 'cowboy':
      b.add(cyl(0.62, 0.6, 0.05, 12), accent, [0, 0.42, 0], [0, 0, 0], [1, 1, 0.85])
        .add(cyl(0.28, 0.33, 0.32, 8), accent, [0, 0.6, 0])
        .add(cyl(0.335, 0.335, 0.06, 8), DARK, [0, 0.48, 0]);
      break;
    case 'tophat':
      b.add(cyl(0.48, 0.48, 0.05, 12), DARK, [0, 0.43, 0])
        .add(cyl(0.3, 0.3, 0.6, 10), DARK, [0, 0.75, 0])
        .add(cyl(0.31, 0.31, 0.1, 10), accent, [0, 0.52, 0]);
      break;
    case 'headphones':
      b.add(new THREE.TorusGeometry(0.4, 0.05, 6, 12, Math.PI), accent, [0, 0.22, 0])
        .add(cyl(0.15, 0.15, 0.12, 8), DARK, [0.4, 0.2, 0], [0, 0, Math.PI / 2])
        .add(cyl(0.15, 0.15, 0.12, 8), DARK, [-0.4, 0.2, 0], [0, 0, Math.PI / 2])
        .add(cyl(0.1, 0.1, 0.13, 8), accent, [0.41, 0.2, 0], [0, 0, Math.PI / 2])
        .add(cyl(0.1, 0.1, 0.13, 8), accent, [-0.41, 0.2, 0], [0, 0, Math.PI / 2]);
      break;
    case 'hood':
      b.add(ball(0.45), accent, [0, 0.26, -0.17], [0, 0, 0], [1.05, 1.05, 0.95])
        .add(new THREE.ConeGeometry(0.2, 0.4, 6), accent, [0, 0.62, -0.32], [-0.6, 0, 0]);
      break;
    case 'halo':
      b.add(new THREE.TorusGeometry(0.28, 0.045, 6, 16), GOLD, [0, 0.8, 0], [Math.PI / 2, 0, 0]).add(
        new THREE.TorusGeometry(0.33, 0.02, 4, 16),
        accent,
        [0, 0.8, 0],
        [Math.PI / 2, 0, 0],
      );
      break;
  }
  return b.build();
}

/** The playable skeleton: a jointed model so limbs can swing while walking, wearing a character's hat. */
export class Hero {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head: THREE.Mesh;
  private readonly hat: THREE.Mesh;
  private readonly shadow = new THREE.Mesh(groundQuad(), shadowMaterial());
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private walkPhase = 0;
  private flash = 0;

  constructor() {
    const { bone, boneShade, socket, bandana } = PALETTE;
    const mat = this.material;

    const torso = new ModelBuilder()
      .add(box(0.42, 0.16, 0.24), boneShade, [0, 0.78, 0])
      .add(cyl(0.05, 0.05, 0.55), bone, [0, 1.05, -0.04])
      .add(box(0.5, 0.07, 0.3), bone, [0, 1.06, 0])
      .add(box(0.54, 0.07, 0.32), bone, [0, 1.17, 0])
      .add(box(0.5, 0.07, 0.3), bone, [0, 1.28, 0])
      .add(box(0.06, 0.3, 0.06), boneShade, [0, 1.17, 0.15])
      .add(box(0.7, 0.08, 0.12), bone, [0, 1.38, 0])
      .build();
    this.body.add(new THREE.Mesh(torso, mat));

    const skull = new ModelBuilder()
      .add(ball(0.34, 1), bone, [0, 0.2, 0], [0, 0, 0], [1, 0.92, 1])
      .add(box(0.34, 0.12, 0.28), boneShade, [0, -0.05, 0.05])
      .add(ball(0.1, 0), socket, [0.13, 0.22, 0.27])
      .add(ball(0.1, 0), socket, [-0.13, 0.22, 0.27])
      .add(new THREE.ConeGeometry(0.05, 0.1, 3), socket, [0, 0.08, 0.31], [Math.PI, 0, 0])
      .add(box(0.22, 0.03, 0.02), socket, [0, 0.01, 0.2])
      .build();
    this.head = new THREE.Mesh(skull, mat);
    this.head.position.y = 1.52;
    this.body.add(this.head);
    this.hat = new THREE.Mesh(hatGeometry('bandana', bandana), mat);
    this.head.add(this.hat);

    const arm = () =>
      new ModelBuilder()
        .add(cyl(0.05, 0.05, 0.5), bone, [0, -0.25, 0])
        .add(ball(0.09, 0), bone, [0, -0.54, 0])
        .build();
    this.armL.position.set(0.36, 1.36, 0);
    this.armR.position.set(-0.36, 1.36, 0);
    this.armL.add(new THREE.Mesh(arm(), mat));
    this.armR.add(new THREE.Mesh(arm(), mat));
    this.body.add(this.armL, this.armR);

    const leg = () =>
      new ModelBuilder()
        .add(cyl(0.06, 0.06, 0.6), bone, [0, -0.3, 0])
        .add(box(0.14, 0.08, 0.26), boneShade, [0, -0.62, 0.06])
        .build();
    this.legL.position.set(0.14, 0.7, 0);
    this.legR.position.set(-0.14, 0.7, 0);
    this.legL.add(new THREE.Mesh(leg(), mat));
    this.legR.add(new THREE.Mesh(leg(), mat));

    this.shadow.scale.setScalar(1.4);
    this.root.add(this.body, this.legL, this.legR, this.shadow);
  }

  /** Dresses the skeleton as a character: swaps the hat and its accent colour. */
  setLook(hat: HatKind, accent: number): void {
    this.hat.geometry.dispose();
    this.hat.geometry = hatGeometry(hat, accent);
  }

  /** Short red flash when hurt. */
  hurt(): void {
    this.flash = 0.25;
  }

  /** `air` = height above the ground, so the shadow stays on the ground during jumps. */
  update(dt: number, speed01: number, facing: number, pose: 'stand' | 'air' | 'slide' = 'stand', air = 0): void {
    this.root.rotation.y = facing;
    this.shadow.position.y = 0.04 - air;
    speed01 = Math.min(1, speed01);
    // Walk cycle: legs and arms swing opposite each other, the whole body bobs.
    this.walkPhase += dt * (4 + speed01 * 10);
    const swing = Math.sin(this.walkPhase) * 0.7 * speed01;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.9;
    this.armR.rotation.x = swing * 0.9;
    this.armL.rotation.z = 0.15;
    this.armR.rotation.z = -0.15;
    this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.08 * speed01;
    // A goofy head wobble, a little even when standing still.
    this.head.rotation.z = Math.sin(this.walkPhase * 0.5) * (0.06 + 0.1 * speed01);
    this.head.rotation.x = -0.05 + Math.sin(this.walkPhase) * 0.05 * speed01;

    // Jumping: limbs flail upwards. Sliding: lean way back with legs out front.
    const lean = pose === 'slide' ? -1.0 : 0;
    this.body.rotation.x = damp(this.body.rotation.x, lean, 14, dt);
    if (pose === 'slide') {
      this.body.position.y = -0.35;
      this.legL.rotation.x = this.legR.rotation.x = -1.3;
      this.armL.rotation.x = this.armR.rotation.x = -2.4;
    } else if (pose === 'air') {
      this.legL.rotation.x = 0.6;
      this.legR.rotation.x = -0.3;
      this.armL.rotation.z = 2.4;
      this.armR.rotation.z = -2.4;
    }

    if (this.flash > 0) {
      this.flash -= dt;
      const k = Math.max(0, this.flash) * 4;
      this.material.emissive.setRGB(k, k * 0.1, k * 0.1);
    }
  }
}
