import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_SEGMENTS = 96;
/** Each link of the chain is drawn as a few jagged pieces so it looks like lightning. */
const JAGS = 3;
const BOLT_LIFE = 0.16;
const RANGE = 11;
const CHAIN_RANGE = 5.5;
const MAX_CHAIN = 12;

const DAMAGE = [20, 26, 32, 40, 52];
const CHAINS = [3, 4, 5, 6, 8];
const COOLDOWN = [1.4, 1.3, 1.2, 1.1, 0.95];
const STRIKES = [1, 1, 1, 2, 2];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** A lantern spirit zaps the nearest enemy, and the bolt jumps on to others nearby. */
class SoulZap extends Weapon {
  private readonly bolts: THREE.InstancedMesh;
  private readonly segLife = new Float32Array(MAX_SEGMENTS);
  private readonly segMatrix = new Float32Array(MAX_SEGMENTS * 16);
  private nextSeg = 0;
  private readonly found = new Int32Array(64);
  private readonly chain = new Int32Array(MAX_CHAIN);
  private cooldown = 0.8;

  constructor(ctx: CombatContext) {
    super(ctx);
    const geo = new THREE.BoxGeometry(0.12, 0.12, 1);
    geo.translate(0, 0, 0.5); // so scaling along Z stretches from the start point
    this.bolts = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xc8fbff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_SEGMENTS,
    );
    this.bolts.frustumCulled = false;
    this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bolts.count = 0;
    ctx.scene.add(this.bolts);
  }

  update(dt: number): void {
    const { player } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      let fired = false;
      for (let s = 0; s < this.stat(STRIKES); s++) fired = this.strike() || fired;
      if (fired) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        this.ctx.sfx.zap();
      }
    }

    let drawn = 0;
    for (let i = 0; i < MAX_SEGMENTS; i++) {
      if (this.segLife[i] <= 0) continue;
      this.segLife[i] -= dt;
      if (this.segLife[i] <= 0) continue;
      tmpMatrix.fromArray(this.segMatrix, i * 16);
      this.bolts.setMatrixAt(drawn++, tmpMatrix);
    }
    this.bolts.count = drawn;
    this.bolts.instanceMatrix.needsUpdate = true;
  }

  /** Zaps a chain of enemies. Returns false if nobody was in range. */
  private strike(): boolean {
    const { player, enemies } = this.ctx;
    // First target: a random enemy near the hero, so double strikes spread out.
    let n = enemies.inRadius(player.x, player.z, RANGE, this.found);
    if (n === 0) return false;
    let current = this.found[Math.floor(Math.random() * n)];
    let fromX = player.x;
    let fromZ = player.z;
    let fromY = player.y + 1.4;
    const links = Math.min(MAX_CHAIN, this.stat(CHAINS));
    const reach = CHAIN_RANGE * player.stats.area;

    for (let link = 0; link < links && current >= 0; link++) {
      this.chain[link] = current;
      const toX = enemies.x[current];
      const toZ = enemies.z[current];
      const toY = heightAt(toX, toZ) + 1;
      this.drawBolt(fromX, fromY, fromZ, toX, toY, toZ);
      this.ctx.damage(current, this.dmg(DAMAGE), fromX, fromZ, 0.3);
      fromX = toX;
      fromZ = toZ;
      fromY = toY;

      // Jump to the closest enemy not already zapped by this chain.
      n = enemies.inRadius(toX, toZ, reach, this.found);
      let best = -1;
      let bestD = Infinity;
      for (let k = 0; k < n; k++) {
        const slot = this.found[k];
        if (!enemies.alive[slot] || this.inChain(slot, link + 1)) continue;
        const d = (enemies.x[slot] - toX) ** 2 + (enemies.z[slot] - toZ) ** 2;
        if (d < bestD) {
          bestD = d;
          best = slot;
        }
      }
      current = best;
    }
    return true;
  }

  private inChain(slot: number, length: number): boolean {
    for (let k = 0; k < length; k++) if (this.chain[k] === slot) return true;
    return false;
  }

  private drawBolt(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    let px = ax;
    let py = ay;
    let pz = az;
    for (let j = 1; j <= JAGS; j++) {
      const t = j / JAGS;
      const jitter = j === JAGS ? 0 : 0.5;
      const qx = ax + (bx - ax) * t + (Math.random() - 0.5) * jitter;
      const qy = ay + (by - ay) * t + (Math.random() - 0.5) * jitter;
      const qz = az + (bz - az) * t + (Math.random() - 0.5) * jitter;
      tmpA.set(px, py, pz);
      tmpB.set(qx, qy, qz);
      tmpDir.subVectors(tmpB, tmpA);
      const len = tmpDir.length();
      tmpQuat.setFromUnitVectors(Z_AXIS, tmpDir.normalize());
      tmpMatrix.compose(tmpA, tmpQuat, tmpScale.set(1, 1, len));
      const i = this.nextSeg;
      this.nextSeg = (i + 1) % MAX_SEGMENTS;
      tmpMatrix.toArray(this.segMatrix, i * 16);
      this.segLife[i] = BOLT_LIFE;
      px = qx;
      py = qy;
      pz = qz;
    }
  }

  dispose(): void {
    this.ctx.scene.remove(this.bolts);
    this.bolts.geometry.dispose();
    (this.bolts.material as THREE.Material).dispose();
    this.bolts.dispose();
  }
}

export const SOUL_ZAP: WeaponDef = {
  id: 'soul-zap',
  name: 'Lantern Zap',
  icon: '⚡',
  levels: [
    'Lightning hits a nearby enemy and jumps to 2 more.',
    '+6 damage, jumps to 1 more enemy.',
    '+6 damage, jumps to 1 more, zaps faster.',
    'Two bolts at once, +8 damage, jumps to 1 more.',
    '+12 damage, jumps to 2 more, zaps faster.',
  ],
  create: (ctx) => new SoulZap(ctx),
};
