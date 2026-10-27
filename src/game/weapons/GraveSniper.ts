import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

/** Bullets fly this far... */
const RANGE = 28;
/** ...but targets are only picked from enemies you can see on screen. */
const AIM_RANGE = 13;
const STEP = 0.7;
const TRACER_LIFE = 0.18;
const CRIT_BONUS = 0.25;
const MAX_HITS = 10;

const DAMAGE = [60, 80, 100, 130, 180];
const PIERCE = [3, 4, 4, 5, 7];
const COOLDOWN = [1.6, 1.5, 1.4, 1.25, 1.1];
const SHOTS = [1, 1, 2, 2, 2];

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Aims at the toughest enemy on screen and fires an instant piercing shot.
 * Slow, but each hit is huge and has extra crit chance.
 */
class GraveSniper extends Weapon {
  private readonly tracers: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly tracerAge: number[] = [];
  private readonly found = new Int32Array(512);
  private readonly near = new Int32Array(16);
  private readonly hit = new Int32Array(MAX_HITS);
  private cooldown = 1;

  constructor(ctx: CombatContext) {
    super(ctx);
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 1);
      geo.translate(0, 0, 0.5);
      const tracer = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      tracer.visible = false;
      ctx.scene.add(tracer);
      this.tracers.push(tracer);
      this.tracerAge.push(99);
    }
  }

  update(dt: number): void {
    const { player } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      let fired = false;
      for (let s = 0; s < this.stat(SHOTS); s++) fired = this.shoot(s) || fired;
      if (fired) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        this.ctx.sfx.boom();
      }
    }
    this.tracers.forEach((tracer, k) => {
      this.tracerAge[k] += dt;
      tracer.visible = this.tracerAge[k] < TRACER_LIFE;
      if (tracer.visible) tracer.material.opacity = 1 - this.tracerAge[k] / TRACER_LIFE;
    });
  }

  /** Fires one shot (the second shot picks a different target). Returns false if no target. */
  private shoot(index: number): boolean {
    const { player, enemies } = this.ctx;
    const n = enemies.inRadius(player.x, player.z, AIM_RANGE, this.found);
    let best = -1;
    let second = -1;
    for (let k = 0; k < n; k++) {
      const slot = this.found[k];
      if (best === -1 || enemies.hp[slot] > enemies.hp[best]) {
        second = best;
        best = slot;
      } else if (second === -1 || enemies.hp[slot] > enemies.hp[second]) {
        second = slot;
      }
    }
    const target = index === 0 ? best : second;
    if (target < 0) return false;

    const dx = enemies.x[target] - player.x;
    const dz = enemies.z[target] - player.z;
    const len = Math.hypot(dx, dz) || 1;
    const dirX = dx / len;
    const dirZ = dz / len;

    // Walk along the line, hitting enemies until the pierce count runs out.
    const pierce = Math.min(MAX_HITS, this.stat(PIERCE));
    let hits = 0;
    let endDist = RANGE;
    for (let d = 0; d < RANGE && hits < pierce; d += STEP) {
      const x = player.x + dirX * d;
      const z = player.z + dirZ * d;
      const m = enemies.inRadius(x, z, 0.4 * player.stats.area, this.near);
      for (let k = 0; k < m && hits < pierce; k++) {
        const slot = this.near[k];
        if (this.alreadyHit(slot, hits)) continue;
        this.hit[hits++] = slot;
        this.ctx.damage(slot, this.dmg(DAMAGE), player.x, player.z, 1.5, { critBonus: CRIT_BONUS });
        endDist = d;
      }
    }
    // A shot that still had pierce left flies on to full range.
    if (hits < pierce) endDist = RANGE;

    const tracer = this.tracers[index];
    tmpA.set(player.x, player.y + 1.2, player.z);
    const ex = player.x + dirX * endDist;
    const ez = player.z + dirZ * endDist;
    tmpB.set(ex, heightAt(ex, ez) + 1, ez).sub(tmpA);
    tracer.position.copy(tmpA);
    tracer.scale.set(1, 1, tmpB.length());
    tracer.quaternion.setFromUnitVectors(Z_AXIS, tmpB.normalize());
    this.tracerAge[index] = 0;
    return true;
  }

  private alreadyHit(slot: number, count: number): boolean {
    for (let k = 0; k < count; k++) if (this.hit[k] === slot) return true;
    return false;
  }

  dispose(): void {
    for (const t of this.tracers) {
      this.ctx.scene.remove(t);
      t.geometry.dispose();
      t.material.dispose();
    }
  }
}

export const GRAVE_SNIPER: WeaponDef = {
  id: 'grave-sniper',
  name: 'Grave Sniper',
  icon: '🎯',
  levels: [
    'Snipe the toughest enemy on screen; the bullet pierces 3 enemies. +25% crit chance.',
    '+20 damage, pierces 1 more enemy.',
    'Fire 2 shots at the two toughest enemies. +20 damage.',
    '+30 damage, pierces 1 more, fires faster.',
    '+50 damage, pierces 2 more, fires faster.',
  ],
  create: (ctx) => new GraveSniper(ctx),
};
