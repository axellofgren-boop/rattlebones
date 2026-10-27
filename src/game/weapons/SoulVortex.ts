import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_VORTEX = 3;
const TICK = 0.3;
const RANGE = 10;
const PULL_SPEED = 6;

const DAMAGE = [5, 7, 9, 11, 15];
const RADIUS = [4.0, 4.5, 5.0, 5.5, 6.5];
const DURATION = [2.5, 2.8, 3.1, 3.4, 4.0];
const COOLDOWN = [5.0, 4.7, 4.4, 4.0, 3.4];
const COUNT = [1, 1, 1, 1, 2];

/** Opens a swirling soul vortex that drags enemies into a clump and grinds them down. */
class SoulVortex extends Weapon {
  private readonly swirls: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly x = new Float32Array(MAX_VORTEX);
  private readonly z = new Float32Array(MAX_VORTEX);
  private readonly age = new Float32Array(MAX_VORTEX).fill(-1);
  private readonly found = new Int32Array(256);
  private cooldown = 1.5;
  private tick = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    for (let k = 0; k < MAX_VORTEX; k++) {
      // A ring with a thick wedge cut out reads as a spinning swirl.
      const geo = new THREE.RingGeometry(0.15, 1, 32, 1, 0, Math.PI * 1.6);
      geo.rotateX(-Math.PI / 2);
      const swirl = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xb46bff, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      swirl.visible = false;
      ctx.scene.add(swirl);
      this.swirls.push(swirl);
    }
  }

  update(dt: number): void {
    const { player, enemies } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const n = enemies.inRadius(player.x, player.z, RANGE, this.found);
      if (n > 0) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        for (let c = 0; c < this.stat(COUNT); c++) {
          const target = this.found[Math.floor(Math.random() * n)];
          this.open(enemies.x[target], enemies.z[target]);
        }
      }
    }

    const radius = this.stat(RADIUS) * player.stats.area;
    const duration = this.stat(DURATION) * player.stats.duration;
    this.tick -= dt;
    const hurt = this.tick <= 0;
    if (hurt) this.tick = TICK;

    for (let i = 0; i < MAX_VORTEX; i++) {
      const swirl = this.swirls[i];
      if (this.age[i] < 0) {
        swirl.visible = false;
        continue;
      }
      this.age[i] += dt;
      const age = this.age[i];
      if (age > duration) {
        this.age[i] = -1;
        swirl.visible = false;
        continue;
      }
      enemies.pull(this.x[i], this.z[i], radius, PULL_SPEED, dt, this.found);
      if (hurt) {
        const n = enemies.inRadius(this.x[i], this.z[i], radius, this.found);
        for (let k = 0; k < n; k++) this.ctx.damage(this.found[k], this.dmg(DAMAGE), this.x[i], this.z[i], 0);
      }
      swirl.visible = true;
      swirl.position.set(this.x[i], heightAt(this.x[i], this.z[i]) + 0.15, this.z[i]);
      swirl.rotation.y = -age * 6;
      swirl.scale.setScalar(radius * Math.min(1, age * 5) * Math.min(1, (duration - age) * 3));
      swirl.material.opacity = 0.5 + Math.sin(age * 12) * 0.15;
    }
  }

  private open(x: number, z: number): void {
    for (let i = 0; i < MAX_VORTEX; i++) {
      if (this.age[i] >= 0) continue;
      this.x[i] = x;
      this.z[i] = z;
      this.age[i] = 0;
      this.ctx.sfx.zap();
      return;
    }
  }

  dispose(): void {
    for (const s of this.swirls) {
      this.ctx.scene.remove(s);
      s.geometry.dispose();
      s.material.dispose();
    }
  }
}

export const SOUL_VORTEX: WeaponDef = {
  id: 'soul-vortex',
  name: 'Soul Vortex',
  icon: '🌀',
  levels: [
    'Open a vortex that pulls enemies together and grinds them.',
    '+2 damage per tick, wider pull, lasts longer.',
    '+2 damage per tick, wider pull, opens more often.',
    '+2 damage per tick, lasts longer.',
    'Two vortexes at once! Much wider and stronger.',
  ],
  create: (ctx) => new SoulVortex(ctx),
};
