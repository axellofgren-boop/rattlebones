import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { tombstoneGeometry, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_TOMBS = 16;
const DROP_HEIGHT = 9;
const FALL_TIME = 0.38;
const LINGER_TIME = 0.7;
const RANGE = 10;

const DAMAGE = [32, 40, 50, 62, 85];
const COUNT = [1, 2, 2, 3, 4];
const RADIUS = [1.8, 1.9, 2.2, 2.4, 2.7];
const COOLDOWN = [2.5, 2.4, 2.2, 2.0, 1.7];

const DUST = new THREE.Color(0xb8b0a0);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Tombstones fall from the sky and squash whatever is underneath. */
class TombDrop extends Weapon {
  private readonly mesh = new THREE.InstancedMesh(tombstoneGeometry(), toonMaterial, MAX_TOMBS);
  private readonly x = new Float32Array(MAX_TOMBS);
  private readonly z = new Float32Array(MAX_TOMBS);
  private readonly spin = new Float32Array(MAX_TOMBS);
  /** Seconds since the tomb was dropped; negative = unused. */
  private readonly age = new Float32Array(MAX_TOMBS).fill(-1);
  private readonly found = new Int32Array(64);
  private next = 0;
  private cooldown = 1.2;

  constructor(ctx: CombatContext) {
    super(ctx);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    ctx.scene.add(this.mesh);
  }

  update(dt: number): void {
    const { player, enemies } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const n = enemies.inRadius(player.x, player.z, RANGE, this.found);
      if (n > 0) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        for (let k = 0; k < this.stat(COUNT); k++) {
          const target = this.found[Math.floor(Math.random() * n)];
          this.drop(enemies.x[target], enemies.z[target]);
        }
      }
    }

    const area = this.ctx.player.stats.area;
    let drawn = 0;
    for (let i = 0; i < MAX_TOMBS; i++) {
      if (this.age[i] < 0) continue;
      const before = this.age[i];
      this.age[i] += dt;
      if (before < FALL_TIME && this.age[i] >= FALL_TIME) this.land(i, area);
      if (this.age[i] > FALL_TIME + LINGER_TIME) {
        this.age[i] = -1;
        continue;
      }
      const t = this.age[i];
      // Falls with gravity, then sinks into the ground.
      const ground = heightAt(this.x[i], this.z[i]);
      const y = ground + (t < FALL_TIME ? DROP_HEIGHT * (1 - (t / FALL_TIME) ** 2) : -((t - FALL_TIME) / LINGER_TIME) * 1.6);
      const s = area * 1.3;
      tmpQuat.setFromAxisAngle(UP, this.spin[i]);
      tmpMatrix.compose(tmpPos.set(this.x[i], y, this.z[i]), tmpQuat, tmpScale.set(s, s, s));
      this.mesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private drop(x: number, z: number): void {
    const i = this.next;
    this.next = (i + 1) % MAX_TOMBS;
    this.x[i] = x;
    this.z[i] = z;
    this.spin[i] = Math.random() * Math.PI * 2;
    this.age[i] = 0;
  }

  private land(i: number, area: number): void {
    const radius = this.stat(RADIUS) * area;
    const n = this.ctx.enemies.inRadius(this.x[i], this.z[i], radius, this.found);
    for (let k = 0; k < n; k++) this.ctx.damage(this.found[k], this.dmg(DAMAGE), this.x[i], this.z[i], 1.2);
    this.ctx.particles.burst(this.x[i], heightAt(this.x[i], this.z[i]) + 0.3, this.z[i], DUST, 10, 7, 1.2);
    this.ctx.sfx.boom();
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export const TOMB_DROP: WeaponDef = {
  id: 'tomb-drop',
  name: 'Tomb Drop',
  icon: '🪦',
  levels: [
    'A tombstone falls from the sky onto an enemy.',
    '+1 tombstone, +8 damage.',
    '+10 damage, bigger impact.',
    '+1 tombstone, +12 damage, drops faster.',
    '+1 tombstone, +23 damage, much bigger.',
  ],
  create: (ctx) => new TombDrop(ctx),
};
