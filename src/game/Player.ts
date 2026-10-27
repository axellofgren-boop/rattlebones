import { ARENA_RADIUS, MOVEMENT, PLAYER, SHIELD, xpForLevel } from '../config';
import { damp } from '../core/math';
import { heightAt, slopeAt } from '../core/terrain';

/** Everything upgrades and characters can change. Multipliers start at 1. */
export interface Stats {
  maxHp: number;
  speed: number;
  /** Damage multiplier for every hit. */
  damage: number;
  /** Size multiplier for areas, orbits and projectiles. */
  area: number;
  /** Cooldown multiplier: lower means attacking more often. */
  cooldown: number;
  /** Extra projectiles added to every throwing weapon. */
  projectiles: number;
  pickupRadius: number;
  /** Flat damage removed from each hit taken. */
  armor: number;
  /** Multiplier on damage taken after armor (0.8 = take 20% less). */
  damageTaken: number;
  /** Health restored per second. */
  regen: number;
  xpGain: number;
  /** Critical hit chance. Above 1.0 every hit crits and the rest rolls for a stronger tier ("overcrit"). */
  crit: number;
  /** Multiplier on critical hit damage. */
  critDamage: number;
  /** Shifts upgrade rarity odds upwards. */
  luck: number;
  /** Multiplier for poison and other damage-over-time. */
  dot: number;
  /** Multiplier for how long slows and poison last. */
  duration: number;
  /** Shield capacity as a fraction of max health. */
  shieldCapacity: number;
  /** Health restored per kill. */
  lifesteal: number;
  /** Times the hero gets back up after falling. */
  revives: number;
}

export function baseStats(): Stats {
  return {
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    damage: 1,
    area: 1,
    cooldown: 1,
    projectiles: 0,
    pickupRadius: PLAYER.pickupRadius,
    armor: 0,
    damageTaken: 1,
    regen: 0,
    xpGain: 1,
    crit: PLAYER.critChance,
    critDamage: 1,
    luck: 0,
    dot: 1,
    duration: 1,
    shieldCapacity: SHIELD.capacity,
    lifesteal: 0,
    revives: 0,
  };
}

/** Special rules switched on by characters, checked by weapons and combat. */
export type Trait = 'steadyAim' | 'stickyPoison' | 'encore';

const slope = { x: 0, z: 0 };

/** The hero's position, movement, health and progression during a run (no rendering here). */
export class Player {
  x = 0;
  z = 0;
  /** Height of the feet in the world (ground height when standing). */
  y = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  /** Direction the hero faces, radians around the vertical axis (0 = towards +Z). */
  facing = Math.PI;
  /** 0 when standing still, 1 at full walking speed (more while sliding fast). */
  speed01 = 0;
  grounded = true;
  sliding = false;
  /** Seconds spent standing still (used by the Steady Aim trait). */
  stillTime = 0;
  hp = PLAYER.maxHp;
  shield = 0;
  level = 1;
  xp = 0;
  xpToNext = xpForLevel(1);
  kills = 0;
  stats: Stats = baseStats();
  readonly traits = new Set<Trait>();
  /** Set when a revive was used this frame, so the game can celebrate it. */
  revivedNow = false;
  private invulnerable = 0;

  reset(stats: Stats, traits: readonly Trait[]): void {
    this.stats = stats;
    this.traits.clear();
    for (const t of traits) this.traits.add(t);
    this.x = this.z = this.y = 0;
    this.vx = this.vz = this.vy = 0;
    this.facing = Math.PI;
    this.speed01 = 0;
    this.grounded = true;
    this.sliding = false;
    this.stillTime = 0;
    this.hp = stats.maxHp;
    this.shield = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.kills = 0;
    this.invulnerable = 0;
    this.revivedNow = false;
  }

  /** Height above the ground under the hero (0 when standing). */
  get airHeight(): number {
    return this.y - heightAt(this.x, this.z);
  }

  /**
   * `dirX/dirZ` is the stick direction (length 0..1). `jumpPressed` is true on the frame the button
   * goes down; holding it while on the ground slides.
   */
  update(dt: number, dirX: number, dirZ: number, jumpPressed: boolean, jumpHeld: boolean): void {
    const { speed } = this.stats;

    if (jumpPressed && this.grounded) {
      this.vy = MOVEMENT.jumpVelocity;
      this.grounded = false;
    }
    this.sliding = this.grounded && jumpHeld && !jumpPressed;

    // Momentum: velocity eases towards what the stick asks for; how fast depends on grip.
    const grip = this.sliding ? MOVEMENT.slideGrip : this.grounded ? MOVEMENT.groundGrip : MOVEMENT.airGrip;
    const steer = this.sliding ? 1.4 : 1;
    this.vx = damp(this.vx, dirX * speed * steer, grip, dt);
    this.vz = damp(this.vz, dirZ * speed * steer, grip, dt);

    // Hills pull you downhill. Sliding feels it fully; walking only a little.
    if (this.grounded) {
      slopeAt(this.x, this.z, slope);
      const share = this.sliding ? 1 : MOVEMENT.walkSlopeShare;
      this.vx -= slope.x * MOVEMENT.slopePull * share * dt;
      this.vz -= slope.z * MOVEMENT.slopePull * share * dt;
    }
    const maxSpeed = speed * (this.sliding || !this.grounded ? MOVEMENT.slideMaxSpeed : 1.35);
    const horiz = Math.hypot(this.vx, this.vz);
    if (horiz > maxSpeed) {
      this.vx *= maxSpeed / horiz;
      this.vz *= maxSpeed / horiz;
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const dist = Math.hypot(this.x, this.z);
    const limit = ARENA_RADIUS - 0.5;
    if (dist > limit) {
      this.x *= limit / dist;
      this.z *= limit / dist;
    }

    // Vertical: jump arcs, otherwise stick to the ground so walking downhill never "floats".
    const newGround = heightAt(this.x, this.z);
    if (!this.grounded) {
      this.vy -= MOVEMENT.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= newGround) {
        this.y = newGround;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.y = newGround;
    }

    const moving = Math.hypot(this.vx, this.vz);
    this.speed01 = moving / speed;
    if (moving > 0.4) this.facing = Math.atan2(this.vx, this.vz);
    this.stillTime = Math.hypot(dirX, dirZ) < 0.05 && this.grounded ? this.stillTime + dt : 0;

    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt, false);
    if (this.shield > 0) this.shield = Math.max(0, this.shield - SHIELD.decay * dt);
  }

  /** Returns true if the hit landed (not blocked by the short invulnerability window). */
  takeDamage(amount: number): boolean {
    if (this.invulnerable > 0 || this.hp <= 0) return false;
    let dmg = Math.max(1, (amount - this.stats.armor) * this.stats.damageTaken);
    const absorbed = Math.min(this.shield, dmg);
    this.shield -= absorbed;
    dmg -= absorbed;
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnerable = PLAYER.invulnerable;
    if (this.hp <= 0 && this.stats.revives > 0) {
      this.stats.revives--;
      this.hp = this.stats.maxHp * 0.5;
      this.invulnerable = 2.5;
      this.revivedNow = true;
    }
    return true;
  }

  /** Heals; anything above max health becomes shield (unless `overheal` is false, e.g. for regen). */
  heal(amount: number, overheal = true): void {
    const room = this.stats.maxHp - this.hp;
    if (amount <= room) {
      this.hp += amount;
      return;
    }
    this.hp = this.stats.maxHp;
    if (overheal) {
      this.shield = Math.min(this.stats.maxHp * this.stats.shieldCapacity, this.shield + (amount - room));
    }
  }

  /** Adds XP and returns how many levels were gained. */
  addXp(amount: number): number {
    this.xp += amount * this.stats.xpGain;
    let gained = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      gained++;
    }
    return gained;
  }

  get dead(): boolean {
    return this.hp <= 0;
  }
}
