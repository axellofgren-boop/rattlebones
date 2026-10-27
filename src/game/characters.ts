import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import type { Combat } from './Combat';
import type { Stats, Trait } from './Player';
import { BONE_TOSS } from './weapons/BoneToss';
import { CHILL_STEPS } from './weapons/ChillSteps';
import { GRAVE_BLADE } from './weapons/GraveBlade';
import { GRAVE_NOVA } from './weapons/GraveNova';
import { GRAVE_SNIPER } from './weapons/GraveSniper';
import { LUCKY_DICE } from './weapons/LuckyDice';
import { RIBARANG } from './weapons/Ribarang';
import { SKULL_ORBIT } from './weapons/SkullOrbit';
import { SOUL_VORTEX } from './weapons/SoulVortex';
import { SOUL_ZAP } from './weapons/SoulZap';
import { SWAMP_JAR } from './weapons/SwampJar';
import { TOMB_DROP } from './weapons/TombDrop';
import type { WeaponDef } from './weapons/Weapon';

export type HatKind =
  | 'bandana'
  | 'helmet'
  | 'wizard'
  | 'pirate'
  | 'beanie'
  | 'goggles'
  | 'witch'
  | 'cowboy'
  | 'tophat'
  | 'headphones'
  | 'hood'
  | 'halo';

/**
 * A playable skeleton. Each has a look (hat + accent colour), a starting weapon
 * and a passive trait. Traits are built from three hooks:
 *  - `setup`: changes starting stats once,
 *  - `perLevel`: runs on every level-up (the "+1% per level" style bonuses),
 *  - `install`: listens to combat events for special rules.
 */
export interface CharacterDef {
  id: string;
  name: string;
  icon: string;
  hat: HatKind;
  accent: number;
  weapon: WeaponDef;
  passiveName: string;
  passiveText: string;
  traits?: readonly Trait[];
  extraRerolls?: number;
  setup?(stats: Stats): void;
  perLevel?(stats: Stats): void;
  install?(combat: Combat): void;
}

const ICE = new THREE.Color(0xbff3ff);
const SHATTER_RADIUS = 2.6;

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'rattles',
    name: 'Rattles',
    icon: '🦴',
    hat: 'bandana',
    accent: 0xe23d4b,
    weapon: BONE_TOSS,
    passiveName: 'Funny Bone',
    passiveText: '+1% crit chance per level.',
    perLevel: (s) => void (s.crit += 0.01),
  },
  {
    id: 'clank',
    name: 'Sir Clank',
    icon: '🛡️',
    hat: 'helmet',
    accent: 0x3d7bff,
    weapon: GRAVE_BLADE,
    passiveName: 'Tin Can',
    passiveText: 'Starts with 1 armor. Takes 1% less damage per level (up to 40%).',
    setup: (s) => void (s.armor += 1),
    perLevel: (s) => void (s.damageTaken = Math.max(0.6, s.damageTaken - 0.01)),
  },
  {
    id: 'wisp',
    name: 'Wisp',
    icon: '⚡',
    hat: 'wizard',
    accent: 0x4a7bff,
    weapon: SOUL_ZAP,
    passiveName: 'Overcharge',
    passiveText: 'Attacks 1% more often per level.',
    perLevel: (s) => void (s.cooldown /= 1.01),
  },
  {
    id: 'marrow',
    name: "Cap'n Marrow",
    icon: '🏴‍☠️',
    hat: 'pirate',
    accent: 0xffc93c,
    weapon: RIBARANG,
    passiveName: 'Plunder',
    passiveText: '+3% XP and +2% pickup range per level.',
    perLevel: (s) => {
      s.xpGain += 0.03;
      s.pickupRadius *= 1.02;
    },
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    icon: '❄️',
    hat: 'beanie',
    accent: 0x6fd6ff,
    weapon: CHILL_STEPS,
    passiveName: 'Shatter',
    passiveText: 'Chilled enemies burst into ice when they die, hurting and chilling others. +1% size per level.',
    perLevel: (s) => void (s.area += 0.01),
    install: (combat) =>
      combat.onKill((info) => {
        if (!info.chilled) return;
        // Deferred so a chain of shatters runs one after another instead of nesting.
        combat.defer(() => {
          const { enemies, player } = combat;
          const found = shatterBuffer;
          const n = enemies.inRadius(info.x, info.z, SHATTER_RADIUS * player.stats.area, found);
          for (let k = 0; k < n; k++) {
            enemies.applyChill(found[k], 1.5 * player.stats.duration);
            combat.damage(found[k], 4 + player.level, info.x, info.z, 0.6, { canCrit: false });
          }
          combat.particles.burst(info.x, heightAt(info.x, info.z) + 0.8, info.z, ICE, 8, 6, 0.8);
        });
      }),
  },
  {
    id: 'gloop',
    name: 'Doc Gloop',
    icon: '🧪',
    hat: 'goggles',
    accent: 0x6bdc3a,
    weapon: SWAMP_JAR,
    passiveName: 'Sticky Ooze',
    passiveText: 'Poisoned enemies are slowed by 30%. +2% poison damage per level.',
    traits: ['stickyPoison'],
    perLevel: (s) => void (s.dot += 0.02),
  },
  {
    id: 'hexley',
    name: 'Hexley',
    icon: '🔮',
    hat: 'witch',
    accent: 0x9b5cff,
    weapon: SOUL_VORTEX,
    passiveName: 'Gravity Well',
    passiveText: '+1% size and +2% pickup range per level.',
    perLevel: (s) => {
      s.area += 0.01;
      s.pickupRadius *= 1.02;
    },
  },
  {
    id: 'deadeye',
    name: 'Deadeye Dot',
    icon: '🤠',
    hat: 'cowboy',
    accent: 0xb5753a,
    weapon: GRAVE_SNIPER,
    passiveName: 'Steady Aim',
    passiveText: 'Stand still for 1 second: your next hit gets an extra crit tier. +2% crit damage per level.',
    traits: ['steadyAim'],
    perLevel: (s) => void (s.critDamage += 0.02),
  },
  {
    id: 'lou',
    name: 'Lucky Lou',
    icon: '🎩',
    hat: 'tophat',
    accent: 0x2fbf71,
    weapon: LUCKY_DICE,
    passiveName: 'High Roller',
    passiveText: 'Starts with 2 extra rerolls. +1.5% luck (rarer upgrades) per level.',
    extraRerolls: 2,
    perLevel: (s) => void (s.luck += 0.015),
  },
  {
    id: 'bonnie',
    name: 'Bonnie Bellow',
    icon: '🎧',
    hat: 'headphones',
    accent: 0xff5fa8,
    weapon: GRAVE_NOVA,
    passiveName: 'Encore',
    passiveText: 'Spooky Shout always blasts twice. +1% damage per level.',
    traits: ['encore'],
    perLevel: (s) => void (s.damage += 0.01),
  },
  {
    id: 'grim',
    name: 'Brother Grim',
    icon: '🪦',
    hat: 'hood',
    accent: 0x4a4458,
    weapon: TOMB_DROP,
    passiveName: 'Undying',
    passiveText: 'Gets back up once per run with half health. +2 max health per level.',
    setup: (s) => void (s.revives += 1),
    perLevel: (s) => void (s.maxHp += 2),
  },
  {
    id: 'saint',
    name: 'Saint Spook',
    icon: '😇',
    hat: 'halo',
    accent: 0xffe27a,
    weapon: SKULL_ORBIT,
    passiveName: 'Blessed',
    passiveText: 'Shields from overhealing hold twice as much. +0.15 health regen per level.',
    setup: (s) => void (s.shieldCapacity *= 2),
    perLevel: (s) => void (s.regen += 0.15),
  },
];

const shatterBuffer = new Int32Array(64);

export function characterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
