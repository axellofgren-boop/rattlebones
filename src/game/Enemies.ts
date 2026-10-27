import * as THREE from 'three';
import { ARENA_RADIUS, ENEMIES, MOVEMENT, PLAYER, SPAWNING, type EnemyDef, type EnemyKind } from '../config';
import { SpatialGrid } from '../core/SpatialGrid';
import { heightAt } from '../core/terrain';
import { ENEMY_SCALE, enemyGeometry, groundQuad, shadowMaterial, toonMaterial } from '../render/models';

export const ENEMY_KINDS: readonly EnemyKind[] = ['shambler', 'bat', 'golem', 'imp', 'brute', 'keeper'];

/** Regular enemies plus room for a few bosses. */
const CAPACITY = SPAWNING.maxEnemies + 8;
const BOSS_CAPACITY = 4;
/** Enemies further than this from the hero get moved back in front of them so the pressure never drops. */
const LEASH_DISTANCE = 34;
const SPAWN_GROW_TIME = 0.35;

/** Boss charge attack timings (seconds). */
const BOSS_CHARGE_EVERY = 5;
const BOSS_WINDUP = 0.7;
const BOSS_CHARGE_TIME = 0.75;
const BOSS_CHARGE_SPEED = 4;

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const respawnSpot = { x: 0, z: 0 };

export interface KillInfo {
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  z: number;
  chilled: boolean;
  poisoned: boolean;
}

/** Chilled enemies move at this fraction of their speed. */
const CHILL_SLOW = 0.5;
const POISON_SLOW = 0.7;
const POISON_TICK = 0.5;
const CHILL_TINT = new THREE.Color(0.55, 0.85, 1.6);
const POISON_TINT = new THREE.Color(0.6, 1.4, 0.5);

/**
 * The whole horde, stored as flat arrays ("structure of arrays") so hundreds of
 * enemies update without creating garbage. Each enemy lives in a numbered slot.
 */
export class Enemies {
  readonly capacity = CAPACITY;
  readonly alive = new Uint8Array(CAPACITY);
  readonly kind = new Uint8Array(CAPACITY);
  readonly x = new Float32Array(CAPACITY);
  readonly z = new Float32Array(CAPACITY);
  readonly hp = new Float32Array(CAPACITY);
  readonly maxHp = new Float32Array(CAPACITY);
  readonly radius = new Float32Array(CAPACITY);
  private readonly speed = new Float32Array(CAPACITY);
  private readonly damage = new Float32Array(CAPACITY);
  private readonly knockX = new Float32Array(CAPACITY);
  private readonly knockZ = new Float32Array(CAPACITY);
  private readonly flash = new Float32Array(CAPACITY);
  private readonly facing = new Float32Array(CAPACITY);
  private readonly age = new Float32Array(CAPACITY);
  private readonly phase = new Float32Array(CAPACITY);
  private readonly chargeTimer = new Float32Array(CAPACITY);
  private readonly chargeX = new Float32Array(CAPACITY);
  private readonly chargeZ = new Float32Array(CAPACITY);
  /** Seconds of chill left (chilled enemies move slower and show blue). */
  readonly chill = new Float32Array(CAPACITY);
  /** Seconds of poison left, and its damage per second. */
  readonly poison = new Float32Array(CAPACITY);
  private readonly poisonDps = new Float32Array(CAPACITY);
  private readonly poisonTick = new Float32Array(CAPACITY);
  private readonly drawCounts = new Int32Array(ENEMY_KINDS.length);
  private readonly free: number[] = [];
  private regularCount = 0;
  private highWater = 0;

  readonly group = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[];
  private readonly shadows: THREE.InstancedMesh;
  private readonly grid = new SpatialGrid(ARENA_RADIUS + 12, 3, CAPACITY);
  private readonly near = new Int32Array(256);

  /** Called when an enemy dies, so the game can drop loot and count kills. */
  onKilled: (info: KillInfo) => void = () => {};
  /** Called for each poison tick; combat turns it into real damage (numbers, kills, events). */
  onDot: (slot: number, amount: number) => void = () => {};
  /** Poisoned enemies are also slowed (a character trait). */
  poisonSlows = false;

  constructor() {
    this.meshes = ENEMY_KINDS.map((kind) => {
      const isBoss = ENEMIES[kind].boss !== undefined;
      const mesh = new THREE.InstancedMesh(enemyGeometry(kind), toonMaterial, isBoss ? BOSS_CAPACITY : CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      // Instance colours tint the model; values above 1 make the white hit-flash.
      mesh.setColorAt(0, tmpColor.setRGB(1, 1, 1));
      this.group.add(mesh);
      return mesh;
    });
    this.shadows = new THREE.InstancedMesh(groundQuad(), shadowMaterial(), CAPACITY);
    this.shadows.frustumCulled = false;
    this.shadows.count = 0;
    this.group.add(this.shadows);
    this.clear();
  }

  get count(): number {
    return this.regularCount;
  }

  clear(): void {
    this.alive.fill(0);
    this.free.length = 0;
    for (let i = CAPACITY - 1; i >= 0; i--) this.free.push(i);
    this.regularCount = 0;
    this.highWater = 0;
  }

  spawn(kind: EnemyKind, x: number, z: number, hpMultiplier: number): number {
    const def = ENEMIES[kind];
    if (!def.boss && this.regularCount >= SPAWNING.maxEnemies) return -1;
    const slot = this.free.pop();
    if (slot === undefined) return -1;
    this.alive[slot] = 1;
    this.kind[slot] = ENEMY_KINDS.indexOf(kind);
    this.x[slot] = x;
    this.z[slot] = z;
    this.maxHp[slot] = this.hp[slot] = def.hp * hpMultiplier;
    this.radius[slot] = def.radius;
    this.speed[slot] = def.speed * (0.9 + Math.random() * 0.2);
    this.damage[slot] = def.damage;
    this.knockX[slot] = this.knockZ[slot] = 0;
    this.flash[slot] = 0;
    this.age[slot] = 0;
    this.phase[slot] = Math.random() * Math.PI * 2;
    this.chargeTimer[slot] = BOSS_CHARGE_EVERY;
    this.chill[slot] = this.poison[slot] = 0;
    if (!def.boss) this.regularCount++;
    if (slot >= this.highWater) this.highWater = slot + 1;
    return slot;
  }

  /** Deals damage and knocks the enemy away from (fromX, fromZ). Returns true if it died. */
  hit(slot: number, amount: number, fromX: number, fromZ: number, knock: number): boolean {
    if (!this.alive[slot]) return false;
    const def = ENEMIES[ENEMY_KINDS[this.kind[slot]]];
    this.hp[slot] -= amount;
    this.flash[slot] = 0.12;
    if (knock > 0 && def.knockback > 0) {
      const dx = this.x[slot] - fromX;
      const dz = this.z[slot] - fromZ;
      const len = Math.hypot(dx, dz) || 1;
      const push = knock * def.knockback * 9;
      this.knockX[slot] += (dx / len) * push;
      this.knockZ[slot] += (dz / len) * push;
    }
    if (this.hp[slot] > 0) return false;
    this.kill(slot);
    return true;
  }

  /** Removes every regular enemy (used when the final boss is beaten). */
  killAllRegular(): void {
    for (let i = 0; i < this.highWater; i++) {
      if (this.alive[i] && !ENEMIES[ENEMY_KINDS[this.kind[i]]].boss) this.kill(i);
    }
  }

  private kill(slot: number): void {
    const kind = ENEMY_KINDS[this.kind[slot]];
    const def = ENEMIES[kind];
    this.alive[slot] = 0;
    this.free.push(slot);
    if (!def.boss) this.regularCount--;
    this.onKilled({
      kind,
      def,
      x: this.x[slot],
      z: this.z[slot],
      chilled: this.chill[slot] > 0,
      poisoned: this.poison[slot] > 0,
    });
  }

  /** Slows the enemy for `seconds` (bosses are only chilled briefly). */
  applyChill(slot: number, seconds: number): void {
    if (!this.alive[slot]) return;
    const limit = this.defOf(slot).boss ? 0.5 : seconds;
    this.chill[slot] = Math.max(this.chill[slot], limit);
  }

  /** Poisons the enemy; a stronger poison replaces a weaker one, and the timer refreshes. */
  applyPoison(slot: number, dps: number, seconds: number): void {
    if (!this.alive[slot]) return;
    if (this.poison[slot] <= 0) this.poisonTick[slot] = POISON_TICK;
    this.poison[slot] = Math.max(this.poison[slot], seconds);
    this.poisonDps[slot] = Math.max(this.poison[slot] > 0 ? this.poisonDps[slot] : 0, dps);
  }

  /** Drags regular enemies within `radius` towards a point (bosses resist). */
  pull(cx: number, cz: number, radius: number, strength: number, dt: number, out: Int32Array): void {
    const n = this.inRadius(cx, cz, radius, out);
    for (let k = 0; k < n; k++) {
      const i = out[k];
      if (this.defOf(i).boss) continue;
      const dx = cx - this.x[i];
      const dz = cz - this.z[i];
      const d = Math.hypot(dx, dz);
      if (d < 0.3) continue;
      this.x[i] += (dx / d) * Math.min(d, strength * dt);
      this.z[i] += (dz / d) * Math.min(d, strength * dt);
    }
  }

  /** Nearest living enemy within `maxRange`, or -1. */
  nearest(x: number, z: number, maxRange: number): number {
    let best = -1;
    let bestD = maxRange * maxRange;
    for (let i = 0; i < this.highWater; i++) {
      if (!this.alive[i]) continue;
      const dx = this.x[i] - x;
      const dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Writes the slots of enemies whose body overlaps the circle into `out`; returns how many. */
  inRadius(x: number, z: number, r: number, out: Int32Array): number {
    // Grid query uses the circle plus the largest enemy radius so big bosses are found too.
    const n = this.grid.query(x, z, r + 2.5, this.near);
    let found = 0;
    for (let k = 0; k < n && found < out.length; k++) {
      const i = this.near[k];
      if (!this.alive[i]) continue;
      const reach = r + this.radius[i];
      const dx = this.x[i] - x;
      const dz = this.z[i] - z;
      if (dx * dx + dz * dz <= reach * reach) out[found++] = i;
    }
    return found;
  }

  /** Slot of the living boss with the most health, or -1. */
  bossSlot(): number {
    let best = -1;
    for (let i = 0; i < this.highWater; i++) {
      if (this.alive[i] && ENEMIES[ENEMY_KINDS[this.kind[i]]].boss && (best === -1 || this.hp[i] > this.hp[best])) {
        best = i;
      }
    }
    return best;
  }

  defOf(slot: number): EnemyDef {
    return ENEMIES[ENEMY_KINDS[this.kind[slot]]];
  }

  /**
   * Moves everyone towards the hero, keeps them from stacking up, and returns the
   * biggest contact damage dealt to the hero this frame (0 if nobody touched them).
   */
  update(
    dt: number,
    time: number,
    px: number,
    pz: number,
    heroAir: number,
    respawnAt: (out: { x: number; z: number }) => void,
  ): number {
    const { alive, x, z } = this;
    const spot = respawnSpot;
    let contact = 0;
    const knockDecay = Math.exp(-9 * dt);

    this.grid.clear();
    for (let i = 0; i < this.highWater; i++) if (alive[i]) this.grid.insert(i, x[i], z[i]);

    for (let i = 0; i < this.highWater; i++) {
      if (!alive[i]) continue;
      const def = ENEMIES[ENEMY_KINDS[this.kind[i]]];
      this.age[i] += dt;
      if (this.flash[i] > 0) this.flash[i] -= dt;

      let dx = px - x[i];
      let dz = pz - z[i];
      const dist = Math.hypot(dx, dz) || 0.001;
      dx /= dist;
      dz /= dist;

      if (!def.boss && dist > LEASH_DISTANCE) {
        respawnAt(spot);
        x[i] = spot.x;
        z[i] = spot.z;
        continue;
      }

      let speed = this.speed[i];
      // Freshly spawned enemies climb out of the ground before chasing.
      if (this.age[i] < SPAWN_GROW_TIME) speed = 0;
      if (this.chill[i] > 0) {
        this.chill[i] -= dt;
        speed *= CHILL_SLOW;
      }
      if (this.poison[i] > 0) {
        this.poison[i] -= dt;
        if (this.poisonSlows) speed *= POISON_SLOW;
        this.poisonTick[i] -= dt;
        if (this.poisonTick[i] <= 0) {
          this.poisonTick[i] += POISON_TICK;
          this.onDot(i, this.poisonDps[i] * POISON_TICK);
          if (!alive[i]) continue; // the poison finished it off
        }
      }

      let mx = dx * speed;
      let mz = dz * speed;
      if (def.boss) {
        const phase = this.bossPhase(i, dt);
        if (phase === 'windup') {
          // Aim is locked at the end of the wind-up, so a quick sidestep dodges the charge.
          this.chargeX[i] = dx;
          this.chargeZ[i] = dz;
          mx = mz = 0;
        } else if (phase === 'charge') {
          mx = this.chargeX[i] * speed * BOSS_CHARGE_SPEED;
          mz = this.chargeZ[i] * speed * BOSS_CHARGE_SPEED;
        }
      } else if (ENEMY_KINDS[this.kind[i]] === 'bat') {
        // Bats flutter sideways as they fly in.
        const wobble = Math.sin(time * 4 + this.phase[i]) * 2.2;
        mx += -dz * wobble;
        mz += dx * wobble;
      }
      if (mx !== 0 || mz !== 0) this.facing[i] = Math.atan2(mx, mz);

      x[i] += (mx + this.knockX[i]) * dt;
      z[i] += (mz + this.knockZ[i]) * dt;
      this.knockX[i] *= knockDecay;
      this.knockZ[i] *= knockDecay;

      this.separate(i);

      const r = Math.hypot(x[i], z[i]);
      if (r > ARENA_RADIUS) {
        x[i] *= ARENA_RADIUS / r;
        z[i] *= ARENA_RADIUS / r;
      }

      if (dist < this.radius[i] + PLAYER.radius && this.age[i] > SPAWN_GROW_TIME) {
        // Jumping clears walkers; flying bats and towering bosses can still reach you.
        const reach = def.boss ? 3 : ENEMY_KINDS[this.kind[i]] === 'bat' ? 2.2 : MOVEMENT.dodgeHeight;
        if (heroAir < reach) contact = Math.max(contact, this.damage[i]);
      }
    }
    return contact;
  }

  /** Bosses walk, then stop and blink (wind-up), then charge in a straight line. */
  private bossPhase(i: number, dt: number): 'walk' | 'windup' | 'charge' {
    this.chargeTimer[i] -= dt;
    const t = this.chargeTimer[i];
    if (t <= 0) {
      this.chargeTimer[i] = BOSS_CHARGE_EVERY;
      return 'walk';
    }
    if (t < BOSS_CHARGE_TIME) return 'charge';
    if (t < BOSS_CHARGE_TIME + BOSS_WINDUP) {
      if (Math.sin(t * 40) > 0) this.flash[i] = 0.03; // blinking warns that a charge is coming
      return 'windup';
    }
    return 'walk';
  }

  /** Pushes overlapping neighbours apart so the horde spreads into a crowd instead of one blob. */
  private separate(i: number): void {
    const { x, z } = this;
    const n = this.grid.query(x[i], z[i], this.radius[i] + 1, this.near);
    for (let k = 0; k < n; k++) {
      const j = this.near[k];
      if (j === i || !this.alive[j]) continue;
      const dx = x[i] - x[j];
      const dz = z[i] - z[j];
      const minD = (this.radius[i] + this.radius[j]) * 0.9;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      // Heavier (bigger) enemies get pushed less.
      const share = this.radius[j] / (this.radius[i] + this.radius[j]);
      const push = (minD - d) * share * 0.6;
      x[i] += (dx / d) * push;
      z[i] += (dz / d) * push;
    }
  }

  /** Copies positions into the instanced meshes for drawing. */
  render(time: number): void {
    const counts = this.drawCounts;
    counts.fill(0);
    let shadowCount = 0;
    for (let i = 0; i < this.highWater; i++) {
      if (!this.alive[i]) continue;
      const k = this.kind[i];
      const kind = ENEMY_KINDS[k];
      const mesh = this.meshes[k];
      const idx = counts[k]++;
      let s = ENEMY_SCALE[kind];
      const grow = Math.min(1, this.age[i] / SPAWN_GROW_TIME);
      // Waddle: a little bounce and squash while walking.
      const bounce = Math.abs(Math.sin(time * 9 + this.phase[i]));
      let sx = s * grow;
      let sy = s * grow * (1 - bounce * 0.06);
      if (kind === 'bat') {
        sx *= 0.75 + Math.abs(Math.sin(time * 14 + this.phase[i])) * 0.45; // wing flap
        sy = s * grow;
      }
      const ground = heightAt(this.x[i], this.z[i]);
      const y = ground + (grow - 1) * 1.5 + (kind === 'bat' ? Math.sin(time * 3 + this.phase[i]) * 0.2 : bounce * 0.08);
      tmpQuat.setFromAxisAngle(UP, this.facing[i] + Math.sin(time * 9 + this.phase[i]) * 0.08);
      tmpMatrix.compose(tmpPos.set(this.x[i], y, this.z[i]), tmpQuat, tmpScale.set(sx, sy, sx));
      mesh.setMatrixAt(idx, tmpMatrix);
      // Instance colour: white flash when hit, otherwise tinted by status effects.
      if (this.flash[i] > 0) tmpColor.setRGB(3, 3, 3);
      else if (this.chill[i] > 0) tmpColor.copy(CHILL_TINT);
      else if (this.poison[i] > 0) tmpColor.copy(POISON_TINT);
      else tmpColor.setRGB(1, 1, 1);
      mesh.setColorAt(idx, tmpColor);

      s = this.radius[i] * 2.4 * grow;
      tmpMatrix.makeScale(s, 1, s).setPosition(this.x[i], ground + 0.08, this.z[i]);
      this.shadows.setMatrixAt(shadowCount++, tmpMatrix);
    }
    this.meshes.forEach((mesh, k) => {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
}
