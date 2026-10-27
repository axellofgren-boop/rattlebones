import type * as THREE from 'three';
import type { Sfx } from '../../audio/Sfx';
import type { Particles } from '../../render/Particles';
import type { Enemies } from '../Enemies';
import type { Player } from '../Player';

export const MAX_WEAPON_LEVEL = 5;

export interface HitOptions {
  /** Damage over time: no crit, no sound, scaled by the hero's DoT bonus. */
  dot?: boolean;
  canCrit?: boolean;
  /** Extra crit chance for this hit only (e.g. the sniper). */
  critBonus?: number;
}

/** What a weapon may use from the game. Keeps weapons independent of the Game class. */
export interface CombatContext {
  readonly scene: THREE.Scene;
  readonly player: Player;
  readonly enemies: Enemies;
  readonly particles: Particles;
  readonly sfx: Sfx;
  /** Seconds since the run started. */
  readonly time: number;
  /**
   * Hurts an enemy: applies the hero's damage bonus and critical hits,
   * shows the damage number and knocks it away from (fromX, fromZ).
   */
  damage(slot: number, baseDamage: number, fromX: number, fromZ: number, knockback: number, opts?: HitOptions): void;
}

/** One weapon the hero carries. Each weapon fires on its own; the player only moves. */
export abstract class Weapon {
  level = 1;
  /**
   * Damage multiplier from upgrade rarities: a Rare pick-up or upgrade adds more than a Common one.
   * Formula: each upgrade adds (rarity factor − 1) × 0.5, so a Legendary upgrade gives +50%.
   */
  power = 1;

  constructor(protected readonly ctx: CombatContext) {}

  levelUp(): void {
    this.level = Math.min(MAX_WEAPON_LEVEL, this.level + 1);
  }

  addRarityBonus(factor: number): void {
    this.power += (factor - 1) * 0.5;
  }

  /** Value for the current level from a per-level table. */
  protected stat(table: readonly number[]): number {
    return table[Math.min(this.level, table.length) - 1];
  }

  /** Damage for the current level, including the rarity bonus. */
  protected dmg(table: readonly number[]): number {
    return this.stat(table) * this.power;
  }

  abstract update(dt: number): void;
  /** Removes the weapon's 3D objects at the end of a run. */
  abstract dispose(): void;
}

export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  /** What you get at each level: index 0 describes picking it up, 1..4 the upgrades. */
  levels: readonly string[];
  create(ctx: CombatContext): Weapon;
}
