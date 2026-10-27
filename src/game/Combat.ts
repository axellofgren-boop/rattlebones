import type * as THREE from 'three';
import type { Sfx } from '../audio/Sfx';
import { CRIT } from '../config';
import { heightAt } from '../core/terrain';
import type { Particles } from '../render/Particles';
import type { DamageNumbers } from '../ui/DamageNumbers';
import type { Enemies, KillInfo } from './Enemies';
import type { Player } from './Player';
import type { CombatContext, HitOptions } from './weapons/Weapon';

export interface HitEvent {
  slot: number;
  amount: number;
  /** 0 = normal hit, 1 = critical, 2+ = overcrit tiers. */
  critTier: number;
  x: number;
  z: number;
  dot: boolean;
  killed: boolean;
}

type Listener<T> = (event: T) => void;

/**
 * Damage multiplier for a crit tier. Tier 1 is a normal crit; every tier above that
 * grows faster, so stacking crit chance past 100% keeps paying off instead of hitting a cap.
 */
export function critMultiplier(tier: number, critDamage: number): number {
  if (tier <= 0) return 1;
  if (tier === 1) return CRIT.baseMultiplier * critDamage;
  return ((tier * 0.5) ** 2 + tier + 1) * critDamage;
}

/** Rolls how many crit tiers a hit gets: 130% chance = always 1, plus a 30% chance of tier 2. */
export function rollCritTier(chance: number): number {
  const whole = Math.floor(chance);
  return whole + (Math.random() < chance - whole ? 1 : 0);
}

/**
 * The single path every bit of damage goes through. Weapons call `damage()`; it works out
 * the final number (base × damage bonuses × crit), applies it, then announces "hit" and "kill"
 * events. Character traits and loot listen to those events instead of being wired into weapons.
 */
export class Combat implements CombatContext {
  time = 0;
  private readonly hitListeners: Listener<HitEvent>[] = [];
  private readonly killListeners: Listener<KillInfo>[] = [];
  /** Work requested during a hit (e.g. chain explosions), run after the current hit finishes. */
  private readonly deferred: (() => void)[] = [];
  private flushing = false;

  constructor(
    readonly scene: THREE.Scene,
    readonly player: Player,
    readonly enemies: Enemies,
    readonly particles: Particles,
    readonly sfx: Sfx,
    private readonly numbers: DamageNumbers,
  ) {
    enemies.onKilled = (info) => {
      for (const fn of this.killListeners) fn(info);
    };
    enemies.onDot = (slot, amount) =>
      this.damage(slot, amount, enemies.x[slot], enemies.z[slot], 0, { dot: true, canCrit: false });
  }

  onHit(fn: Listener<HitEvent>): void {
    this.hitListeners.push(fn);
  }

  onKill(fn: Listener<KillInfo>): void {
    this.killListeners.push(fn);
  }

  /** Removes all listeners (between runs, since each character installs its own). */
  clearListeners(): void {
    this.hitListeners.length = 0;
    this.killListeners.length = 0;
    this.deferred.length = 0;
  }

  /** Runs `fn` once the current damage event is fully handled; avoids deep chains of nested hits. */
  defer(fn: () => void): void {
    this.deferred.push(fn);
  }

  damage(slot: number, baseDamage: number, fromX: number, fromZ: number, knockback: number, opts?: HitOptions): void {
    const { enemies, player } = this;
    if (!enemies.alive[slot]) return;
    const stats = player.stats;
    const dot = opts?.dot ?? false;

    let tier = 0;
    if (opts?.canCrit ?? true) {
      tier = rollCritTier(stats.crit + (opts?.critBonus ?? 0));
      // Steady Aim: after standing still for a second, the next hit gets an extra crit tier.
      if (player.traits.has('steadyAim') && player.stillTime >= 1) {
        tier++;
        player.stillTime = 0;
      }
    }
    const multiplier = stats.damage * (dot ? stats.dot : 1) * critMultiplier(tier, stats.critDamage);
    const amount = Math.max(1, Math.round(baseDamage * multiplier));

    const x = enemies.x[slot];
    const z = enemies.z[slot];
    const numberHeight = heightAt(x, z) + 1.4 + enemies.radius[slot];
    const killed = enemies.hit(slot, amount, fromX, fromZ, knockback);
    this.numbers.show(x, numberHeight, z, amount, dot ? -1 : tier);
    if (!dot) this.sfx.hit();

    const event: HitEvent = { slot, amount, critTier: tier, x, z, dot, killed };
    for (const fn of this.hitListeners) fn(event);
    this.flush();
  }

  private flush(): void {
    if (this.flushing) return;
    this.flushing = true;
    // Deferred work may itself defer more work; keep going until the queue is empty.
    for (let i = 0; i < this.deferred.length; i++) this.deferred[i]();
    this.deferred.length = 0;
    this.flushing = false;
  }
}
