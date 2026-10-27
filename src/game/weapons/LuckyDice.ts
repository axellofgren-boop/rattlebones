import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { ModelBuilder, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_DICE = 40;
const SPEED = 13;
const LIFETIME = 1.4;
const RANGE = 12;
const JACKPOT_RADIUS = 2.4;

/** Damage per pip: a roll of 4 deals 4× this. */
const PIP_DAMAGE = [5, 6, 7, 9, 11];
const COUNT = [2, 2, 3, 3, 4];
const COOLDOWN = [1.15, 1.1, 1.0, 0.95, 0.85];

const BOOM = new THREE.Color(0xffd23f);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

function diceGeometry(): THREE.BufferGeometry {
  const b = new ModelBuilder().add(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xfdf8ec);
  const pip = () => new THREE.IcosahedronGeometry(0.06, 0);
  // A few pips on three faces is enough to read as a die while spinning.
  b.add(pip(), 0x1d1426, [0, 0, 0.26]);
  b.add(pip(), 0xd8453a, [0.26, 0.12, 0.12]).add(pip(), 0xd8453a, [0.26, -0.12, -0.12]);
  b.add(pip(), 0x1d1426, [0.12, 0.26, 0.12]).add(pip(), 0x1d1426, [0, 0.26, 0]).add(pip(), 0x1d1426, [-0.12, 0.26, -0.12]);
  return b.build();
}

/** Throws dice that roll on impact: the number decides the damage, and a 6 explodes. */
class LuckyDice extends Weapon {
  private readonly mesh = new THREE.InstancedMesh(diceGeometry(), toonMaterial, MAX_DICE);
  private readonly alive = new Uint8Array(MAX_DICE);
  private readonly x = new Float32Array(MAX_DICE);
  private readonly z = new Float32Array(MAX_DICE);
  private readonly vx = new Float32Array(MAX_DICE);
  private readonly vz = new Float32Array(MAX_DICE);
  private readonly life = new Float32Array(MAX_DICE);
  private readonly found = new Int32Array(64);
  private next = 0;
  private cooldown = 0.5;

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
        const count = this.stat(COUNT) + player.stats.projectiles;
        for (let k = 0; k < count; k++) {
          const target = this.found[Math.floor(Math.random() * n)];
          this.launch(Math.atan2(enemies.x[target] - player.x, enemies.z[target] - player.z));
        }
        this.ctx.sfx.throwBone();
      }
    }

    const area = player.stats.area;
    let drawn = 0;
    for (let i = 0; i < MAX_DICE; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alive[i] = 0;
        continue;
      }
      this.x[i] += this.vx[i] * dt;
      this.z[i] += this.vz[i] * dt;
      const n = enemies.inRadius(this.x[i], this.z[i], 0.4 * area, this.found);
      if (n > 0) {
        this.alive[i] = 0;
        this.roll(this.found[0], this.x[i], this.z[i]);
        continue;
      }
      const spin = this.life[i] * 14;
      tmpQuat.setFromEuler(tmpEuler.set(spin, spin * 0.7, 0));
      const s = area;
      tmpMatrix.compose(tmpPos.set(this.x[i], heightAt(this.x[i], this.z[i]) + 1, this.z[i]), tmpQuat, tmpScale.set(s, s, s));
      this.mesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.mesh.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private roll(slot: number, x: number, z: number): void {
    const { player, enemies } = this.ctx;
    // Luck nudges the roll upwards a little.
    const face = Math.min(6, 1 + Math.floor(Math.random() * 6 + player.stats.luck * 2 * Math.random()));
    this.ctx.damage(slot, this.dmg(PIP_DAMAGE) * face, x, z, 0.5);
    if (face < 6) return;
    // Jackpot: a 6 explodes and hurts everything around it.
    const n = enemies.inRadius(x, z, JACKPOT_RADIUS * player.stats.area, this.found);
    for (let k = 0; k < n; k++) this.ctx.damage(this.found[k], this.dmg(PIP_DAMAGE) * 3, x, z, 1.2);
    this.ctx.particles.burst(x, heightAt(x, z) + 1, z, BOOM, 12, 7, 0.9);
    this.ctx.sfx.boom();
  }

  private launch(angle: number): void {
    const i = this.next;
    this.next = (i + 1) % MAX_DICE;
    this.alive[i] = 1;
    this.x[i] = this.ctx.player.x;
    this.z[i] = this.ctx.player.z;
    this.vx[i] = Math.sin(angle) * SPEED;
    this.vz[i] = Math.cos(angle) * SPEED;
    this.life[i] = LIFETIME;
  }

  dispose(): void {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export const LUCKY_DICE: WeaponDef = {
  id: 'lucky-dice',
  name: 'Lucky Dice',
  icon: '🎲',
  levels: [
    'Throw 2 dice: damage depends on the roll. Rolling a 6 explodes!',
    'More damage per pip, throw faster.',
    'Throw 3 dice. More damage per pip, throw faster.',
    'More damage per pip, throw faster.',
    'Throw 4 dice. Much more damage per pip.',
  ],
  create: (ctx) => new LuckyDice(ctx),
};
