/**
 * All tuning values in one place. Change numbers here to rebalance the game
 * without touching game logic.
 */

/** Playable area is a circle of this radius (world units ≈ metres). */
export const ARENA_RADIUS = 55;

/** Seconds until the final boss shows up. Beat it to win the run. */
export const RUN_LENGTH = 8 * 60;

export const CAMERA = {
  fov: 50,
  /** Height and distance behind the hero at the closest zoom. */
  height: 15,
  back: 9,
  /** The camera pulls back until at least this much ground (world units) is visible left-to-right. */
  minVisibleWidth: 13,
};

export const PLAYER = {
  maxHp: 100,
  speed: 6.2,
  radius: 0.55,
  pickupRadius: 3.2,
  /** Seconds of invulnerability after being hit, so a crowd can't drain you in one frame. */
  invulnerable: 0.55,
  critChance: 0.05,
  /** Max weapons carried at once. */
  weaponSlots: 4,
  /** Level-up rerolls every run starts with (some characters get more). */
  rerolls: 1,
};

/** How the hero moves: momentum, jumping and sliding on the hills. */
export const MOVEMENT = {
  /** How quickly the hero reaches the stick's speed on the ground, in the air and while sliding. */
  groundGrip: 12,
  airGrip: 3,
  slideGrip: 0.8,
  /** How strongly hills speed you up downhill / slow you uphill (sliding feels it the most). */
  slopePull: 9,
  walkSlopeShare: 0.25,
  /** Sliding can build up to this multiple of normal speed. */
  slideMaxSpeed: 2.3,
  jumpVelocity: 9,
  gravity: 26,
  /** Higher than this above the ground, walking enemies can't reach you (bats still can). */
  dodgeHeight: 1.0,
};

/** Overheal turns into a temporary shield that absorbs damage first. */
export const SHIELD = {
  /** Shield can hold up to this fraction of max health. */
  capacity: 0.5,
  /** Shield points lost per second. */
  decay: 2,
};

export const CRIT = {
  /** Damage multiplier for a normal (tier 1) critical hit. */
  baseMultiplier: 2,
};

/** Upgrade rarities: higher rarities multiply the upgrade's value. Luck shifts the odds upwards. */
export const RARITIES = [
  { id: 'common', name: 'Common', factor: 1.0, weight: 100, color: '#5fd068' },
  { id: 'uncommon', name: 'Uncommon', factor: 1.2, weight: 42, color: '#4aa8ff' },
  { id: 'rare', name: 'Rare', factor: 1.4, weight: 18, color: '#e64ad8' },
  { id: 'epic', name: 'Epic', factor: 1.6, weight: 7, color: '#9b5cff' },
  { id: 'legendary', name: 'Legendary', factor: 2.0, weight: 2.5, color: '#ffc93c' },
] as const;

export type Rarity = (typeof RARITIES)[number];

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.floor(4 + level * 4 + Math.pow(level, 1.6));
}

export type EnemyKind = 'shambler' | 'bat' | 'golem' | 'imp' | 'brute' | 'keeper';

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  /** Damage per touch. */
  damage: number;
  radius: number;
  xp: number;
  /** How far knockback pushes it (0 = immovable). */
  knockback: number;
  /** Mini-boss / final boss get a health bar and drop treasure. */
  boss?: 'mini' | 'final';
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  shambler: { name: 'Shambler', hp: 14, speed: 2.6, damage: 8, radius: 0.5, xp: 1, knockback: 1 },
  bat: { name: 'Gloom Bat', hp: 7, speed: 4.6, damage: 5, radius: 0.45, xp: 1, knockback: 1.3 },
  golem: { name: 'Mud Golem', hp: 55, speed: 1.9, damage: 14, radius: 0.85, xp: 4, knockback: 0.4 },
  imp: { name: 'Candle Imp', hp: 22, speed: 3.6, damage: 10, radius: 0.5, xp: 2, knockback: 0.9 },
  brute: { name: 'Pumpkin Brute', hp: 900, speed: 2.5, damage: 22, radius: 1.5, xp: 40, knockback: 0.1, boss: 'mini' },
  keeper: { name: 'The Gravekeeper', hp: 9000, speed: 2.9, damage: 30, radius: 2.2, xp: 0, knockback: 0, boss: 'final' },
};

export const SPAWNING = {
  maxEnemies: 320,
  /** Enemies per second at the start and how much that grows each minute. */
  baseRate: 1.4,
  ratePerMinute: 2.1,
  /** Spawn ring around the hero: just outside what the camera shows. */
  minDistance: 19,
  maxDistance: 24,
  /** Enemy health multiplier grows by this much per minute. */
  hpPerMinute: 0.32,
  /** Seconds into the run when each enemy type starts appearing. */
  unlocks: { shambler: 0, bat: 35, imp: 100, golem: 150 } as Partial<Record<EnemyKind, number>>,
  miniBossTimes: [150, 300, 420],
  /** Seconds when a ring of bats surrounds you. */
  swarmTimes: [75, 195, 330, 450],
};

export const DROPS = {
  healChance: 0.012,
  healAmount: 25,
  magnetChance: 0.003,
};

export const COLORS = {
  sky: 0x3b2a5c,
  ground: 0x5d8a3c,
  groundDark: 0x4e7833,
  bone: 0xf3ead2,
  xp: 0x46d9ff,
  heal: 0xff5a6e,
};
