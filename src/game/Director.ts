import { ARENA_RADIUS, RUN_LENGTH, SPAWNING, type EnemyKind } from '../config';
import { randRange } from '../core/math';
import type { Enemies } from './Enemies';

/** Relative chance of each regular enemy once it has unlocked. */
const WEIGHTS: Partial<Record<EnemyKind, number>> = { shambler: 10, bat: 6, imp: 4, golem: 2.5 };
const SWARM_SIZE = 36;

export type DirectorEvent = 'miniBoss' | 'finalBoss' | 'swarm';

/**
 * Decides what spawns and when: a steady stream that keeps growing, bat swarms,
 * mini-bosses on a schedule, and the final boss at the end.
 */
export class Director {
  private budget = 0;
  private miniBossIndex = 0;
  private swarmIndex = 0;
  private finalBossSpawned = false;

  onEvent: (event: DirectorEvent) => void = () => {};

  constructor(private readonly enemies: Enemies) {}

  reset(): void {
    this.budget = 0;
    this.miniBossIndex = 0;
    this.swarmIndex = 0;
    this.finalBossSpawned = false;
  }

  /** Enemy health multiplier at a given time. */
  hpMultiplier(time: number): number {
    return 1 + (time / 60) * SPAWNING.hpPerMinute;
  }

  update(dt: number, time: number, px: number, pz: number): void {
    const minutes = time / 60;
    // After the final boss arrives the stream thins out so the fight stays readable.
    const rate = (SPAWNING.baseRate + minutes * SPAWNING.ratePerMinute) * (this.finalBossSpawned ? 0.35 : 1);
    this.budget += rate * dt;
    while (this.budget >= 1) {
      this.budget -= 1;
      const kind = this.pickKind(time);
      const [x, z] = this.spawnPoint(px, pz);
      this.enemies.spawn(kind, x, z, this.hpMultiplier(time));
    }

    if (this.swarmIndex < SPAWNING.swarmTimes.length && time >= SPAWNING.swarmTimes[this.swarmIndex]) {
      this.swarmIndex++;
      this.swarm(px, pz, time);
    }
    if (this.miniBossIndex < SPAWNING.miniBossTimes.length && time >= SPAWNING.miniBossTimes[this.miniBossIndex]) {
      this.miniBossIndex++;
      const [x, z] = this.spawnPoint(px, pz);
      // Each mini-boss is tougher than the last.
      this.enemies.spawn('brute', x, z, this.hpMultiplier(time) * (0.6 + this.miniBossIndex * 0.4));
      this.onEvent('miniBoss');
    }
    if (!this.finalBossSpawned && time >= RUN_LENGTH) {
      this.finalBossSpawned = true;
      const [x, z] = this.spawnPoint(px, pz);
      this.enemies.spawn('keeper', x, z, 1);
      this.onEvent('finalBoss');
    }
  }

  /** A full ring of bats closing in from every side. */
  private swarm(px: number, pz: number, time: number): void {
    const radius = SPAWNING.minDistance;
    for (let i = 0; i < SWARM_SIZE; i++) {
      const a = (i / SWARM_SIZE) * Math.PI * 2;
      const [x, z] = clampToArena(px + Math.cos(a) * radius, pz + Math.sin(a) * radius);
      this.enemies.spawn('bat', x, z, this.hpMultiplier(time));
    }
    this.onEvent('swarm');
  }

  private pickKind(time: number): EnemyKind {
    let total = 0;
    for (const [kind, unlock] of Object.entries(SPAWNING.unlocks) as [EnemyKind, number][]) {
      if (time >= unlock) total += WEIGHTS[kind] ?? 0;
    }
    let roll = Math.random() * total;
    for (const [kind, unlock] of Object.entries(SPAWNING.unlocks) as [EnemyKind, number][]) {
      if (time < unlock) continue;
      roll -= WEIGHTS[kind] ?? 0;
      if (roll <= 0) return kind;
    }
    return 'shambler';
  }

  /** A random point just off-screen around the hero, kept inside the arena. */
  spawnPoint(px: number, pz: number): [number, number] {
    const a = Math.random() * Math.PI * 2;
    const r = randRange(SPAWNING.minDistance, SPAWNING.maxDistance);
    return clampToArena(px + Math.cos(a) * r, pz + Math.sin(a) * r);
  }
}

function clampToArena(x: number, z: number): [number, number] {
  const d = Math.hypot(x, z);
  const limit = ARENA_RADIUS - 1;
  return d > limit ? [(x * limit) / d, (z * limit) / d] : [x, z];
}
