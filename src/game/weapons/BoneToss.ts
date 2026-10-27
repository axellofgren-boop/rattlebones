import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { boneGeometry, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_BONES = 120;
/** Each bone remembers this many enemies it already hit, so piercing bones don't hit twice. */
const MEMORY = 6;
const SPEED = 15;
const LIFETIME = 1.3;
const RANGE = 17;
const SPREAD = 0.22;

const COUNT = [1, 2, 2, 3, 3];
const DAMAGE = [15, 15, 20, 20, 28];
const PIERCE = [2, 2, 3, 3, 4];
const COOLDOWN = [0.95, 0.9, 0.85, 0.8, 0.65];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Throws spinning bones at the nearest enemy. The hero's starting weapon. */
class BoneToss extends Weapon {
  private readonly mesh = new THREE.InstancedMesh(boneGeometry(), toonMaterial, MAX_BONES);
  private readonly alive = new Uint8Array(MAX_BONES);
  private readonly x = new Float32Array(MAX_BONES);
  private readonly z = new Float32Array(MAX_BONES);
  private readonly vx = new Float32Array(MAX_BONES);
  private readonly vz = new Float32Array(MAX_BONES);
  private readonly life = new Float32Array(MAX_BONES);
  private readonly pierce = new Uint8Array(MAX_BONES);
  private readonly hits = new Int32Array(MAX_BONES * MEMORY);
  private readonly found = new Int32Array(16);
  private next = 0;
  private cooldown = 0.3;

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
      const target = enemies.nearest(player.x, player.z, RANGE);
      if (target >= 0) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        const aim = Math.atan2(enemies.x[target] - player.x, enemies.z[target] - player.z);
        const count = this.stat(COUNT) + player.stats.projectiles;
        for (let k = 0; k < count; k++) this.launch(aim + (k - (count - 1) / 2) * SPREAD);
        this.ctx.sfx.throwBone();
      }
    }

    const area = player.stats.area;
    const hitRadius = 0.45 * area;
    let drawn = 0;
    for (let i = 0; i < MAX_BONES; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.z[i] += this.vz[i] * dt;

      const n = enemies.inRadius(this.x[i], this.z[i], hitRadius, this.found);
      for (let k = 0; k < n && this.alive[i]; k++) {
        const slot = this.found[k];
        if (this.alreadyHit(i, slot)) continue;
        this.remember(i, slot);
        this.ctx.damage(slot, this.dmg(DAMAGE),this.x[i] - this.vx[i], this.z[i] - this.vz[i], 0.6);
        if (--this.pierce[i] === 0) this.alive[i] = 0;
      }
      if (!this.alive[i]) continue;

      tmpQuat.setFromAxisAngle(UP, this.life[i] * 18);
      tmpMatrix.compose(tmpPos.set(this.x[i], heightAt(this.x[i], this.z[i]) + 1, this.z[i]),tmpQuat, tmpScale.set(area, area, area));
      this.mesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private launch(angle: number): void {
    const i = this.next;
    this.next = (i + 1) % MAX_BONES;
    const { player } = this.ctx;
    this.alive[i] = 1;
    this.x[i] = player.x;
    this.z[i] = player.z;
    this.vx[i] = Math.sin(angle) * SPEED;
    this.vz[i] = Math.cos(angle) * SPEED;
    this.life[i] = LIFETIME;
    this.pierce[i] = this.stat(PIERCE);
    this.hits.fill(-1, i * MEMORY, (i + 1) * MEMORY);
  }

  private alreadyHit(bone: number, slot: number): boolean {
    for (let m = 0; m < MEMORY; m++) if (this.hits[bone * MEMORY + m] === slot) return true;
    return false;
  }

  private remember(bone: number, slot: number): void {
    for (let m = 0; m < MEMORY; m++) {
      if (this.hits[bone * MEMORY + m] === -1) {
        this.hits[bone * MEMORY + m] = slot;
        return;
      }
    }
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export const BONE_TOSS: WeaponDef = {
  id: 'bone-toss',
  name: 'Bone Toss',
  icon: '🦴',
  levels: [
    'Throw spinning bones at the nearest enemy. Each bone hits 2 enemies.',
    '+1 bone per throw.',
    '+5 damage, bones pierce 1 more enemy.',
    '+1 bone per throw, throw faster.',
    '+8 damage, pierce 1 more, throw much faster.',
  ],
  create: (ctx) => new BoneToss(ctx),
};
