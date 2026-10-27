import * as THREE from 'three';

const MAX_PARTICLES = 500;
const GRAVITY = 20;
const FLOOR_Y = 0.08;

const tmpMatrix = new THREE.Matrix4();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/** A fixed pool of little cubes for hits, deaths and explosions. Nothing is allocated during play. */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private readonly pos = new Float32Array(MAX_PARTICLES * 3);
  private readonly vel = new Float32Array(MAX_PARTICLES * 3);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  private next = 0;
  private colorsDirty = false;

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshLambertMaterial(),
      MAX_PARTICLES,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, hidden);
      this.mesh.setColorAt(i, white);
    }
  }

  burst(x: number, y: number, z: number, color: THREE.Color, amount = 5, speed = 5, size = 1): void {
    for (let k = 0; k < amount; k++) {
      const i = this.next;
      this.next = (i + 1) % MAX_PARTICLES;
      const j = i * 3;
      this.pos[j] = x;
      this.pos[j + 1] = y;
      this.pos[j + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[j] = Math.cos(a) * s;
      this.vel[j + 1] = 3 + Math.random() * speed * 0.8;
      this.vel[j + 2] = Math.sin(a) * s;
      this.life[i] = 0.5 + Math.random() * 0.4;
      this.size[i] = size * (0.6 + Math.random() * 0.6);
      this.mesh.setColorAt(i, color);
    }
    this.colorsDirty = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < MAX_PARTICLES; i++) this.mesh.setMatrixAt(i, hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    const { pos, vel, life } = this;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        this.mesh.setMatrixAt(i, hidden);
        continue;
      }
      const j = i * 3;
      vel[j + 1] -= GRAVITY * dt;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < FLOOR_Y) {
        pos[j + 1] = FLOOR_Y;
        vel[j + 1] *= -0.3;
        vel[j] *= 0.6;
        vel[j + 2] *= 0.6;
      }
      const s = Math.min(1, life[i] * 3) * this.size[i];
      tmpMatrix.makeScale(s, s, s).setPosition(pos[j], pos[j + 1], pos[j + 2]);
      this.mesh.setMatrixAt(i, tmpMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colorsDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorsDirty = false;
    }
  }
}
