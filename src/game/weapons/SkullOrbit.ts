import * as THREE from 'three';
import { skullGeometry, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_SKULLS = 8;
/** Seconds before the same enemy can be hit again by the skulls. */
const REHIT_DELAY = 0.45;
const SPIN_SPEED = 4.2;

const COUNT = [3, 3, 4, 4, 5];
const DAMAGE = [12, 15, 18, 21, 26];
const RADIUS = [3.0, 3.2, 3.4, 3.6, 3.9];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Grinning skulls circle the hero and chomp anything they touch. */
class SkullOrbit extends Weapon {
  private readonly mesh = new THREE.InstancedMesh(skullGeometry(), toonMaterial, MAX_SKULLS);
  /** Earliest time each enemy slot may be hit again. */
  private readonly nextHit: Float32Array;
  private readonly found = new Int32Array(24);
  private angle = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    this.nextHit = new Float32Array(ctx.enemies.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ctx.scene.add(this.mesh);
  }

  update(dt: number): void {
    const { player, enemies, time } = this.ctx;
    const area = player.stats.area;
    const count = this.stat(COUNT);
    const radius = this.stat(RADIUS) * area;
    // Faster attack speed also spins the skulls faster.
    this.angle += (dt * SPIN_SPEED) / player.stats.cooldown;

    for (let k = 0; k < count; k++) {
      const a = this.angle + (k / count) * Math.PI * 2;
      const x = player.x + Math.sin(a) * radius;
      const z = player.z + Math.cos(a) * radius;

      const n = enemies.inRadius(x, z, 0.75 * area, this.found);
      for (let j = 0; j < n; j++) {
        const slot = this.found[j];
        if (time < this.nextHit[slot]) continue;
        this.nextHit[slot] = time + REHIT_DELAY;
        this.ctx.damage(slot, this.dmg(DAMAGE), player.x, player.z, 0.9);
      }

      tmpQuat.setFromAxisAngle(UP, a + Math.PI / 2);
      const s = area * 1.1;
      tmpMatrix.compose(tmpPos.set(x, player.y + 1.0 + Math.sin(a * 2) * 0.15, z),tmpQuat, tmpScale.set(s, s, s));
      this.mesh.setMatrixAt(k, tmpMatrix);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export const SKULL_ORBIT: WeaponDef = {
  id: 'skull-orbit',
  name: 'Skull Buddies',
  icon: '💀',
  levels: [
    'Three skulls circle you and chomp enemies.',
    '+3 damage, wider circle.',
    '+1 skull, +3 damage.',
    '+3 damage, wider circle.',
    '+1 skull, +5 damage.',
  ],
  create: (ctx) => new SkullOrbit(ctx),
};
