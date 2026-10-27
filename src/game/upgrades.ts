import { PLAYER, RARITIES, type Rarity } from '../config';
import { weightedPick } from '../core/math';
import type { Stats } from './Player';
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
import { MAX_WEAPON_LEVEL, type WeaponDef } from './weapons/Weapon';

export const WEAPONS: readonly WeaponDef[] = [
  BONE_TOSS,
  SKULL_ORBIT,
  GRAVE_NOVA,
  SOUL_ZAP,
  TOMB_DROP,
  GRAVE_BLADE,
  CHILL_STEPS,
  SWAMP_JAR,
  RIBARANG,
  GRAVE_SNIPER,
  SOUL_VORTEX,
  LUCKY_DICE,
];

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Stat boosts ("trinkets"). Each can be taken up to `max` times.
 * `base` is the Common value; higher rarities multiply it (see RARITIES in config.ts).
 */
export interface PassiveDef {
  id: string;
  name: string;
  icon: string;
  max: number;
  base: number;
  /** Whole-number boosts (like +1 projectile) don't scale with rarity. */
  fixed?: boolean;
  text(value: number): string;
  apply(stats: Stats, value: number): void;
}

export const PASSIVES: readonly PassiveDef[] = [
  { id: 'marrow', name: 'Marrow Milk', icon: '🥛', max: 5, base: 20, text: (v) => `+${Math.round(v)} max health`, apply: (s, v) => void (s.maxHp += Math.round(v)) },
  { id: 'calcium', name: 'Extra Calcium', icon: '🦷', max: 5, base: 0.12, text: (v) => `+${pct(v)} damage`, apply: (s, v) => void (s.damage += v) },
  { id: 'shins', name: 'Swift Shins', icon: '🦵', max: 5, base: 0.08, text: (v) => `+${pct(v)} move speed`, apply: (s, v) => void (s.speed *= 1 + v) },
  { id: 'skull', name: 'Thick Skull', icon: '🪖', max: 5, base: 2, text: (v) => `Take ${v.toFixed(1)} less damage per hit`, apply: (s, v) => void (s.armor += v) },
  { id: 'wrists', name: 'Wiggly Wrists', icon: '🤸', max: 5, base: 0.08, text: (v) => `Attack ${pct(v)} more often`, apply: (s, v) => void (s.cooldown /= 1 + v) },
  { id: 'bigbones', name: 'Big Bones', icon: '🎈', max: 5, base: 0.12, text: (v) => `+${pct(v)} attack size`, apply: (s, v) => void (s.area += v) },
  { id: 'magnet', name: 'Soul Sponge', icon: '🧲', max: 5, base: 0.3, text: (v) => `+${pct(v)} pickup range`, apply: (s, v) => void (s.pickupRadius *= 1 + v) },
  { id: 'luckyRib', name: 'Lucky Rib', icon: '🍀', max: 8, base: 0.08, text: (v) => `+${pct(v)} crit chance (over 100% = overcrits!)`, apply: (s, v) => void (s.crit += v) },
  { id: 'sharp', name: 'Sharpened Bones', icon: '🗡️', max: 5, base: 0.15, text: (v) => `+${pct(v)} critical damage`, apply: (s, v) => void (s.critDamage += v) },
  { id: 'snack', name: 'Ghost Snack', icon: '👻', max: 5, base: 0.6, text: (v) => `Heal ${v.toFixed(1)} health per second`, apply: (s, v) => void (s.regen += v) },
  { id: 'fangs', name: 'Vampire Fangs', icon: '🧛', max: 5, base: 0.6, text: (v) => `Heal ${v.toFixed(1)} per kill (overheal becomes shield)`, apply: (s, v) => void (s.lifesteal += v) },
  { id: 'elbow', name: 'Extra Elbow', icon: '💪', max: 2, base: 1, fixed: true, text: () => '+1 projectile for throwing weapons', apply: (s) => void (s.projectiles += 1) },
  { id: 'study', name: 'Night School', icon: '📚', max: 5, base: 0.12, text: (v) => `+${pct(v)} XP`, apply: (s, v) => void (s.xpGain += v) },
  { id: 'clover', name: 'Four-Leaf Clover', icon: '☘️', max: 5, base: 0.15, text: (v) => `+${pct(v)} luck (rarer upgrades)`, apply: (s, v) => void (s.luck += v) },
  { id: 'toxin', name: 'Swamp Juice', icon: '🧪', max: 5, base: 0.15, text: (v) => `+${pct(v)} poison damage and effect duration`, apply: (s, v) => void ((s.dot += v), (s.duration += v)) },
];

export type Offer =
  | { type: 'weapon'; def: WeaponDef; level: number; rarity: Rarity }
  | { type: 'passive'; def: PassiveDef; level: number; rarity: Rarity; value: number }
  | { type: 'heal'; rarity: Rarity };

export interface OfferView {
  icon: string;
  title: string;
  tag: string;
  text: string;
  rarityName: string;
  rarityColor: string;
}

/** Damage bonus a weapon gains from an upgrade of this rarity (matches Weapon.addRarityBonus). */
function weaponBonusText(rarity: Rarity): string {
  return rarity.factor > 1 ? ` +${Math.round((rarity.factor - 1) * 50)}% weapon damage.` : '';
}

export function describeOffer(offer: Offer): OfferView {
  const rarity = { rarityName: offer.rarity.name, rarityColor: offer.rarity.color };
  switch (offer.type) {
    case 'weapon':
      return {
        icon: offer.def.icon,
        title: offer.def.name,
        tag: offer.level === 1 ? 'NEW' : `LV ${offer.level}`,
        text: offer.def.levels[offer.level - 1] + weaponBonusText(offer.rarity),
        ...rarity,
      };
    case 'passive':
      return { icon: offer.def.icon, title: offer.def.name, tag: `LV ${offer.level}`, text: offer.def.text(offer.value), ...rarity };
    case 'heal':
      return { icon: '🍖', title: 'Bone Broth', tag: 'HEAL', text: 'Restore 40 health (extra becomes shield).', ...rarity };
  }
}

/**
 * Rolls a rarity. Luck makes the rarer tiers more likely: at luck 0.5 a Legendary is
 * about 4× as likely as with no luck.
 */
export function rollRarity(luck: number): Rarity {
  return (
    weightedPick(RARITIES, (r) => {
      const tier = RARITIES.indexOf(r);
      return r.weight * (1 + Math.max(0, luck) * tier * 1.5);
    }) ?? RARITIES[0]
  );
}

/**
 * Picks up to `count` different upgrades the hero can still take, each with its own rarity.
 * Upgrading what you already own is slightly favoured so builds come together.
 */
export function rollOffers(
  weaponLevels: ReadonlyMap<string, number>,
  passiveLevels: ReadonlyMap<string, number>,
  luck: number,
  count = 3,
): Offer[] {
  type Candidate = { make: (rarity: Rarity) => Offer; weight: number };
  const pool: Candidate[] = [];
  const slotsFree = weaponLevels.size < PLAYER.weaponSlots;
  for (const def of WEAPONS) {
    const level = weaponLevels.get(def.id);
    if (level === undefined) {
      if (slotsFree) pool.push({ make: (rarity) => ({ type: 'weapon', def, level: 1, rarity }), weight: 0.7 });
    } else if (level < MAX_WEAPON_LEVEL) {
      pool.push({ make: (rarity) => ({ type: 'weapon', def, level: level + 1, rarity }), weight: 1.6 });
    }
  }
  for (const def of PASSIVES) {
    const level = passiveLevels.get(def.id) ?? 0;
    if (level < def.max) {
      pool.push({
        make: (rarity) => ({ type: 'passive', def, level: level + 1, rarity, value: def.fixed ? def.base : def.base * rarity.factor }),
        weight: 0.8,
      });
    }
  }

  const picked: Offer[] = [];
  while (picked.length < count && pool.length > 0) {
    const choice = weightedPick(pool, (p) => p.weight);
    if (!choice) break;
    picked.push(choice.make(rollRarity(luck)));
    pool.splice(pool.indexOf(choice), 1);
  }
  // Everything maxed out: still give something useful.
  if (picked.length === 0) picked.push({ type: 'heal', rarity: RARITIES[0] });
  return picked;
}
