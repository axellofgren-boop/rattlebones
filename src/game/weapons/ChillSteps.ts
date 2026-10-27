import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_PATCHES = 32;
const TICK = 0.4;
/** Distance walked between frost patches; standing still still drops one now and then. */
const STEP_DISTANCE = 1.6;
const IDLE_DROP_TIME = 1.2;

const DAMAGE = [3, 4, 5, 6, 8];
const RADIUS = [1.3, 1.4, 1.6, 1.7, 2.0];
const LIFETIME = [2.5, 2.8, 3.1, 3.4, 4.0];
const CHILL_SECONDS = 1.5;

const tmpMatrix = new THREE.Matrix4();

/** Every step leaves a patch of frost that hurts and slows anything walking over it. */
class ChillSteps extends Weapon {
  private readonly mesh: THREE.InstancedMesh;
  private readonly x = new Float32Array(MAX_PATCHES);
  private readonly z = new Float32Array(MAX_PATCHES);
  private readonly age = new Float32Array(MAX_PATCHES).fill(-1);
  private readonly found = new Int32Array(64);
  private readonly hitThisTick: Uint8Array;
  private next = 0;
  private walked = 0;
  private idle = 0;
  private tick = 0;
  private lastX = 0;
  private lastZ = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    this.hitThisTick = new Uint8Array(ctx.enemies.capacity);
    const geo = new THREE.CircleGeometry(1, 7);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_PATCHES,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    ctx.scene.add(this.mesh);
    this.lastX = ctx.player.x;
    this.lastZ = ctx.player.z;
  }

  update(dt: number): void {
    const { player, enemies } = this.ctx;
    this.walked += Math.hypot(player.x - this.lastX, player.z - this.lastZ);
    this.lastX = player.x;
    this.lastZ = player.z;
    this.idle += dt;
    if ((this.walked >= STEP_DISTANCE || this.idle >= IDLE_DROP_TIME) && player.grounded) {
      this.walked = 0;
      this.idle = 0;
      this.drop(player.x, player.z);
    }

    const life = this.stat(LIFETIME) * player.stats.duration;
    const radius = this.stat(RADIUS) * player.stats.area;
    this.tick -= dt;
    const hurt = this.tick <= 0;
    if (hurt) {
      this.tick = TICK * player.stats.cooldown;
      this.hitThisTick.fill(0); // overlapping patches count once per enemy per tick
    }

    let drawn = 0;
    for (let i = 0; i < MAX_PATCHES; i++) {
      if (this.age[i] < 0) continue;
      this.age[i] += dt;
      if (this.age[i] > life) {
        this.age[i] = -1;
        continue;
      }
      if (hurt) {
        const n = enemies.inRadius(this.x[i], this.z[i], radius, this.found);
        for (let k = 0; k < n; k++) {
          const slot = this.found[k];
          if (this.hitThisTick[slot]) continue;
          this.hitThisTick[slot] = 1;
          enemies.applyChill(slot, CHILL_SECONDS * player.stats.duration);
          this.ctx.damage(slot, this.dmg(DAMAGE), this.x[i], this.z[i], 0);
        }
      }
      // Grow in quickly, shrink away at the end.
      const t = this.age[i];
      const s = radius * Math.min(1, t * 6) * Math.min(1, (life - t) * 2);
      tmpMatrix.makeScale(s, 1, s).setPosition(this.x[i], heightAt(this.x[i], this.z[i]) + 0.06, this.z[i]);
      this.mesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private drop(x: number, z: number): void {
    const i = this.next;
    this.next = (i + 1) % MAX_PATCHES;
    this.x[i] = x;
    this.z[i] = z;
    this.age[i] = 0;
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

export const CHILL_STEPS: WeaponDef = {
  id: 'chill-steps',
  name: 'Chill Steps',
  icon: '❄️',
  levels: [
    'Your footsteps leave frost that hurts and slows enemies.',
    '+1 damage, frost lasts longer.',
    '+1 damage, bigger patches.',
    '+1 damage, frost lasts longer.',
    '+2 damage, much bigger, longer-lasting patches.',
  ],
  create: (ctx) => new ChillSteps(ctx),
};
