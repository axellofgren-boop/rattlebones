import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { ModelBuilder, PALETTE, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_RANGS = 12;
const OUT_TIME = 0.55;
const RETURN_SPEED = 17;
const REHIT_DELAY = 0.35;
const TARGET_RANGE = 14;
const SPREAD = 0.5;

const DAMAGE = [14, 18, 20, 26, 34];
const COUNT = [1, 1, 2, 2, 3];
const DISTANCE = [8, 9, 9, 10, 11];
const COOLDOWN = [1.6, 1.5, 1.45, 1.35, 1.2];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** A curved rib flies out, slices through everything, and comes back to the hero. */
class Ribarang extends Weapon {
  private readonly mesh: THREE.InstancedMesh;
  private readonly alive = new Uint8Array(MAX_RANGS);
  private readonly x = new Float32Array(MAX_RANGS);
  private readonly z = new Float32Array(MAX_RANGS);
  private readonly ox = new Float32Array(MAX_RANGS);
  private readonly oz = new Float32Array(MAX_RANGS);
  private readonly dirX = new Float32Array(MAX_RANGS);
  private readonly dirZ = new Float32Array(MAX_RANGS);
  private readonly age = new Float32Array(MAX_RANGS);
  /** Earliest time each enemy can be hit again (so out and back can both hit). */
  private readonly nextHit: Float32Array;
  private readonly found = new Int32Array(24);
  private next = 0;
  private cooldown = 0.6;

  constructor(ctx: CombatContext) {
    super(ctx);
    this.nextHit = new Float32Array(ctx.enemies.capacity);
    const geo = new ModelBuilder()
      .add(new THREE.BoxGeometry(0.75, 0.12, 0.2), PALETTE.bone, [0.3, 0, 0.18], [0, 0.5, 0])
      .add(new THREE.BoxGeometry(0.75, 0.12, 0.2), PALETTE.bone, [-0.3, 0, 0.18], [0, -0.5, 0])
      .add(new THREE.IcosahedronGeometry(0.14, 0), PALETTE.boneShade, [0, 0, 0.36])
      .build();
    this.mesh = new THREE.InstancedMesh(geo, toonMaterial, MAX_RANGS);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    ctx.scene.add(this.mesh);
  }

  update(dt: number): void {
    const { player, enemies, time } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
      const target = enemies.nearest(player.x, player.z, TARGET_RANGE);
      const aim = target >= 0 ? Math.atan2(enemies.x[target] - player.x, enemies.z[target] - player.z) : player.facing;
      const count = this.stat(COUNT) + player.stats.projectiles;
      for (let k = 0; k < count; k++) this.launch(aim + (k - (count - 1) / 2) * SPREAD);
      this.ctx.sfx.throwBone();
    }

    const area = player.stats.area;
    const reach = this.stat(DISTANCE) * area;
    let drawn = 0;
    for (let i = 0; i < MAX_RANGS; i++) {
      if (!this.alive[i]) continue;
      this.age[i] += dt;
      if (this.age[i] < OUT_TIME) {
        // Flying out, slowing down at the far end like a real boomerang.
        const d = reach * Math.sin(((this.age[i] / OUT_TIME) * Math.PI) / 2);
        this.x[i] = this.ox[i] + this.dirX[i] * d;
        this.z[i] = this.oz[i] + this.dirZ[i] * d;
      } else {
        // Coming home to wherever the hero is now.
        const dx = player.x - this.x[i];
        const dz = player.z - this.z[i];
        const dist = Math.hypot(dx, dz);
        if (dist < 0.8) {
          this.alive[i] = 0;
          continue;
        }
        const step = Math.min(dist, RETURN_SPEED * dt);
        this.x[i] += (dx / dist) * step;
        this.z[i] += (dz / dist) * step;
      }

      const n = enemies.inRadius(this.x[i], this.z[i], 0.6 * area, this.found);
      for (let k = 0; k < n; k++) {
        const slot = this.found[k];
        if (time < this.nextHit[slot]) continue;
        this.nextHit[slot] = time + REHIT_DELAY;
        this.ctx.damage(slot, this.dmg(DAMAGE), this.x[i], this.z[i], 0.7);
      }

      tmpQuat.setFromAxisAngle(UP, this.age[i] * 20);
      const s = area * 1.2;
      tmpMatrix.compose(tmpPos.set(this.x[i], heightAt(this.x[i], this.z[i]) + 1, this.z[i]), tmpQuat, tmpScale.set(s, s, s));
      this.mesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private launch(angle: number): void {
    const i = this.next;
    this.next = (i + 1) % MAX_RANGS;
    const { player } = this.ctx;
    this.alive[i] = 1;
    this.ox[i] = this.x[i] = player.x;
    this.oz[i] = this.z[i] = player.z;
    this.dirX[i] = Math.sin(angle);
    this.dirZ[i] = Math.cos(angle);
    this.age[i] = 0;
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export const RIBARANG: WeaponDef = {
  id: 'ribarang',
  name: 'Ribarang',
  icon: '🪃',
  levels: [
    'Throw a rib that slices through enemies and comes back.',
    '+4 damage, flies further.',
    'Throw 2 ribs. +2 damage.',
    '+6 damage, flies further.',
    'Throw 3 ribs. +8 damage, flies even further.',
  ],
  create: (ctx) => new Ribarang(ctx),
};
