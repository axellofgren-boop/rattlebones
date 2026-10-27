import * as THREE from 'three';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const SWING_TIME = 0.22;
/** Half of the swing's width, in radians (≈ 130° total). */
const HALF_ARC = 1.15;

const DAMAGE = [22, 28, 34, 42, 58];
const RADIUS = [3.2, 3.4, 3.6, 3.8, 4.2];
const COOLDOWN = [1.1, 1.0, 0.95, 0.85, 0.75];
/** From level 4 the blade also swings behind you. */
const BOTH_WAYS_LEVEL = 4;

/** A big rusty sword sweeps an arc towards the nearest enemy. Short reach, big damage. */
class GraveBlade extends Weapon {
  private readonly arcs: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly found = new Int32Array(128);
  private cooldown = 0.4;
  private sinceSwing = 99;
  /** Direction of the last swing. */
  private aim = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.RingGeometry(0.35, 1, 24, 1, -HALF_ARC, HALF_ARC * 2);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(-Math.PI / 2); // so the arc's centre points along +Z (the hero's facing)
      const arc = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      arc.visible = false;
      ctx.scene.add(arc);
      this.arcs.push(arc);
    }
  }

  update(dt: number): void {
    const { player, enemies } = this.ctx;
    const radius = this.stat(RADIUS) * player.stats.area;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      // Swing at the nearest enemy in reach, not where the hero walks (players usually walk away
      // from the horde). With nobody in reach the sword stays ready instead of wasting a swing.
      const target = enemies.nearest(player.x, player.z, radius + 0.5);
      if (target >= 0) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        this.sinceSwing = 0;
        this.aim = Math.atan2(enemies.x[target] - player.x, enemies.z[target] - player.z);
        this.swing(this.aim);
        if (this.level >= BOTH_WAYS_LEVEL) this.swing(this.aim + Math.PI);
        this.ctx.sfx.throwBone();
      }
    }

    this.sinceSwing += dt;
    const t = this.sinceSwing / SWING_TIME;
    this.arcs.forEach((arc, k) => {
      arc.visible = t < 1 && (k === 0 || this.level >= BOTH_WAYS_LEVEL);
      if (!arc.visible) return;
      arc.position.set(player.x, player.y + 0.8, player.z);
      arc.rotation.y = this.aim + (k === 1 ? Math.PI : 0) + (t - 0.5) * 0.6;
      arc.scale.setScalar(radius * (0.8 + t * 0.2));
      arc.material.opacity = 0.85 * (1 - t);
    });
  }

  private swing(angle: number): void {
    const { player, enemies } = this.ctx;
    const radius = this.stat(RADIUS) * player.stats.area;
    const n = enemies.inRadius(player.x, player.z, radius, this.found);
    for (let k = 0; k < n; k++) {
      const slot = this.found[k];
      const toEnemy = Math.atan2(enemies.x[slot] - player.x, enemies.z[slot] - player.z);
      const diff = Math.atan2(Math.sin(toEnemy - angle), Math.cos(toEnemy - angle));
      // Enemies right on top of the hero always get hit, wherever they stand.
      const close = Math.hypot(enemies.x[slot] - player.x, enemies.z[slot] - player.z) < 1;
      if (close || Math.abs(diff) <= HALF_ARC) this.ctx.damage(slot, this.dmg(DAMAGE), player.x, player.z, 1.1);
    }
  }

  dispose(): void {
    for (const arc of this.arcs) {
      this.ctx.scene.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
  }
}

export const GRAVE_BLADE: WeaponDef = {
  id: 'grave-blade',
  name: 'Graveblade',
  icon: '⚔️',
  levels: [
    'Swing a huge rusty sword at the nearest enemy.',
    '+6 damage, longer reach, faster swings.',
    '+6 damage, longer reach.',
    'Also swings behind you. +8 damage.',
    '+16 damage, much longer reach, faster swings.',
  ],
  create: (ctx) => new GraveBlade(ctx),
};
