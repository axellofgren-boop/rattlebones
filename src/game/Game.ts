import * as THREE from 'three';
import { Sfx } from '../audio/Sfx';
import { CAMERA, DROPS, PLAYER, type EnemyKind } from '../config';
import { Input } from '../core/Input';
import { damp } from '../core/math';
import { heightAt } from '../core/terrain';
import { Hero } from '../render/Hero';
import { Particles } from '../render/Particles';
import { World } from '../render/World';
import { loadSave, persistSave, type SaveData } from '../save';
import { DamageNumbers } from '../ui/DamageNumbers';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { CHARACTERS, characterById, type CharacterDef } from './characters';
import { Combat } from './Combat';
import { Director } from './Director';
import { Enemies, type KillInfo } from './Enemies';
import { Pickups, type ItemKind } from './Pickups';
import { Player, baseStats, type Stats } from './Player';
import { describeOffer, rollOffers, type Offer } from './upgrades';
import type { Weapon, WeaponDef } from './weapons/Weapon';

type State = 'menu' | 'select' | 'playing' | 'choosing' | 'paused' | 'over';

/** Seconds between beating the final boss and the victory screen, to enjoy the explosion. */
const VICTORY_DELAY = 2;
/** On menus the camera looks a little past the hero so the skeleton shows above the panels. */
const MENU_CAMERA_SHIFT = 5;

const KILL_COLORS: Record<EnemyKind, THREE.Color> = {
  shambler: new THREE.Color(0x8fbf6a),
  bat: new THREE.Color(0x7a55a8),
  golem: new THREE.Color(0x7b5a3a),
  imp: new THREE.Color(0xff6a3a),
  brute: new THREE.Color(0xff8a1c),
  keeper: new THREE.Color(0x6ef3ff),
};
const HEAL_COLOR = new THREE.Color(0xff5a6e);

/**
 * Runs the whole game: menus, the run loop, levelling and saving.
 * The individual systems (combat, enemies, weapons, pickups, UI) each live in their own file;
 * this class wires them together.
 */
export class Game {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.5, 140);
  private readonly player = new Player();
  private readonly enemies = new Enemies();
  private readonly particles = new Particles();
  private readonly sfx = new Sfx();
  private readonly hero = new Hero();
  private readonly pickups = new Pickups();
  private readonly director = new Director(this.enemies);
  private readonly combat: Combat;
  private readonly input: Input;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly numbers: DamageNumbers;
  private readonly save: SaveData = loadSave();

  private state: State = 'menu';
  private character: CharacterDef = characterById(this.save.character);
  /** Weapons in the order they were picked up. */
  private weapons: { def: WeaponDef; weapon: Weapon }[] = [];
  private readonly passiveLevels = new Map<string, number>();
  private pendingLevelUps = 0;
  private pendingChests = 0;
  private offers: Offer[] = [];
  private rerolls = 0;
  private victoryTimer = 0;
  private shake = 0;
  private camX = 0;
  private camY = 0;
  private camZ = 0;
  private zoom = 1;
  private width = 1;
  private height = 1;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    ui: HTMLElement,
  ) {
    this.scene = new World().scene;
    this.scene.add(this.hero.root, this.enemies.group, this.pickups.group, this.particles.mesh);

    this.numbers = new DamageNumbers(ui);
    this.hud = new Hud(ui, () => this.pause());
    this.input = new Input(renderer.domElement, ui);
    this.screens = new Screens(ui, () => this.sfx.click());
    this.combat = new Combat(this.scene, this.player, this.enemies, this.particles, this.sfx, this.numbers);
    this.sfx.enabled = this.save.sound;
    this.hero.setLook(this.character.hat, this.character.accent);

    this.pickups.onXp = (amount) => this.onXp(amount);
    this.pickups.onItem = (kind) => this.onItem(kind);
    this.director.onEvent = (event) => {
      if (event === 'swarm') this.hud.announce('Bat swarm!');
      if (event === 'miniBoss') this.hud.announce('Pumpkin Brute!');
      if (event === 'finalBoss') this.hud.announce('The Gravekeeper rises!');
      if (event !== 'swarm') this.sfx.bossAlarm();
    };

    // Leaving the app mid-run pauses it instead of letting the horde win.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    this.showMenu();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Narrow (portrait) screens see less to the sides, so pull the camera back until enough ground fits.
    const distance = Math.hypot(CAMERA.height, CAMERA.back);
    const halfFovX = Math.atan(Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2)) * this.camera.aspect);
    this.zoom = Math.max(1, CAMERA.minVisibleWidth / (2 * distance * Math.tan(halfFovX)));
    // Fog is measured from the camera, so it moves back with it: clear around the hero, misty at the edges.
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance * this.zoom + 8;
      this.scene.fog.far = distance * this.zoom + 40;
    }
  }

  // ── Frame loop ─────────────────────────────────────────────

  update(dt: number): void {
    this.input.update();
    if (this.state === 'playing') this.step(dt);

    const { player } = this;
    const playing = this.state === 'playing';
    const pose = !playing ? 'stand' : player.sliding ? 'slide' : player.grounded ? 'stand' : 'air';
    this.hero.root.position.set(player.x, player.y, player.z);
    this.hero.update(dt, playing ? player.speed01 : 0, player.facing, pose, player.airHeight);
    this.enemies.render(this.combat.time);
    this.pickups.render(performance.now() / 1000);
    this.updateCamera(dt);
    this.numbers.update(playing ? dt : 0, this.camera, this.width, this.height);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private step(dt: number): void {
    const { player, input } = this;
    this.combat.time += dt;
    const time = this.combat.time;
    player.update(dt, input.move.x, input.move.y, input.jumpPressed, input.jumpHeld);

    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) this.endRun(true);
    } else {
      this.director.update(dt, time, player.x, player.z);
    }

    const contact = this.enemies.update(dt, time, player.x, player.z, player.airHeight, this.respawnAt);
    if (contact > 0 && this.victoryTimer <= 0 && player.takeDamage(contact)) {
      this.hero.hurt();
      this.sfx.hurt();
      this.shake = 0.25;
    }
    if (player.revivedNow) {
      player.revivedNow = false;
      this.hud.announce('Back from the grave!');
      this.sfx.levelUp();
    }

    for (const w of this.weapons) w.weapon.update(dt);
    this.pickups.update(dt, player.x, player.z, player.stats.pickupRadius);
    this.particles.update(dt);

    this.hud.update({
      xp: player.xp,
      xpToNext: player.xpToNext,
      level: player.level,
      hp: player.hp,
      maxHp: player.stats.maxHp,
      shield: player.shield,
      time,
      kills: player.kills,
    });
    const boss = this.enemies.bossSlot();
    if (boss >= 0) this.hud.setBoss(this.enemies.defOf(boss).name, this.enemies.hp[boss] / this.enemies.maxHp[boss]);
    else this.hud.setBoss('', null);

    if (this.state !== 'playing') return; // endRun may have been called above
    if (player.dead) this.endRun(false);
    // Once the final boss is beaten, skip any remaining upgrades and head to the victory screen.
    else if (this.victoryTimer <= 0 && (this.pendingChests > 0 || this.pendingLevelUps > 0)) this.openChoice();
  }

  private updateCamera(dt: number): void {
    const zoom = this.zoom;
    const { player } = this;
    const shift = this.state === 'menu' || this.state === 'select' ? MENU_CAMERA_SHIFT : 0;
    this.camX = damp(this.camX, player.x, 8, dt);
    this.camZ = damp(this.camZ, player.z + shift, 6, dt);
    // Follow the ground height smoothly, ignoring jumps so the view doesn't bounce.
    this.camY = damp(this.camY, heightAt(player.x, player.z), 4, dt);
    let sx = 0;
    let sz = 0;
    if (this.shake > 0) {
      this.shake -= dt;
      sx = (Math.random() - 0.5) * this.shake * 1.2;
      sz = (Math.random() - 0.5) * this.shake * 1.2;
    }
    this.camera.position.set(this.camX + sx, this.camY + CAMERA.height * zoom, this.camZ + CAMERA.back * zoom + sz);
    this.camera.lookAt(this.camX + sx, this.camY, this.camZ + sz);
  }

  private respawnAt = (out: { x: number; z: number }): void => {
    const [x, z] = this.director.spawnPoint(this.player.x, this.player.z);
    out.x = x;
    out.z = z;
  };

  // ── Loot & progression (driven by combat events) ──────────

  private onEnemyKilled({ kind, def, x, z }: KillInfo): void {
    const { player } = this;
    player.kills++;
    if (player.stats.lifesteal > 0) player.heal(player.stats.lifesteal);
    const big = def.boss !== undefined;
    this.particles.burst(x, heightAt(x, z) + 0.8, z, KILL_COLORS[kind], big ? 40 : 6, big ? 10 : 5, big ? 1.8 : 1);
    this.sfx.kill();

    if (def.boss === 'final') {
      this.victoryTimer = VICTORY_DELAY;
      this.shake = 0.6;
      this.combat.defer(() => this.enemies.killAllRegular());
      this.hud.announce('VICTORY!');
      return;
    }
    if (def.boss === 'mini') {
      this.pickups.dropItem('chest', x, z);
      this.shake = 0.4;
    }
    if (def.xp > 0) this.pickups.dropGem(x, z, def.xp);
    // Luck makes food and magnets show up a bit more often.
    const luck = 1 + player.stats.luck;
    const roll = Math.random();
    if (roll < DROPS.magnetChance * luck) this.pickups.dropItem('magnet', x, z);
    else if (roll < (DROPS.magnetChance + DROPS.healChance) * luck) this.pickups.dropItem('heal', x, z);
  }

  private onXp(amount: number): void {
    const gained = this.player.addXp(amount);
    for (let i = 0; i < gained; i++) this.applyCharacterLevel();
    this.pendingLevelUps += gained;
    this.sfx.gem();
  }

  /** The character's "+X per level" passive. */
  private applyCharacterLevel(): void {
    const stats = this.player.stats;
    const oldMax = stats.maxHp;
    this.character.perLevel?.(stats);
    if (stats.maxHp > oldMax) this.player.heal(stats.maxHp - oldMax, false);
  }

  private onItem(kind: ItemKind): void {
    const { player } = this;
    if (kind === 'heal') {
      player.heal(DROPS.healAmount);
      this.particles.burst(player.x, player.y + 1.2, player.z, HEAL_COLOR, 8, 3, 0.7);
      this.sfx.heal();
    } else if (kind === 'magnet') {
      this.pickups.magnetAll();
      this.sfx.heal();
    } else {
      this.pendingChests++;
    }
  }

  /** Pauses the action and offers three upgrades (from a level-up or a treasure chest). */
  private openChoice(): void {
    this.state = 'choosing';
    this.input.release();
    this.sfx.levelUp();
    this.rollNewOffers();
    this.showOffers();
  }

  private rollNewOffers(): void {
    // Chests are lucky: they roll rarities with extra luck.
    const luck = this.player.stats.luck + (this.pendingChests > 0 ? 0.6 : 0);
    this.offers = rollOffers(this.weaponLevels(), this.passiveLevels, luck);
  }

  private showOffers(): void {
    const heading = this.pendingChests > 0 ? 'TREASURE!' : 'LEVEL UP!';
    this.screens.showLevelUp(
      heading,
      this.offers.map(describeOffer),
      this.rerolls,
      (index) => this.pickOffer(this.offers[index]),
      () => {
        this.rerolls--;
        this.rollNewOffers();
        this.showOffers();
      },
    );
  }

  private pickOffer(offer: Offer): void {
    this.applyOffer(offer);
    if (this.pendingChests > 0) this.pendingChests--;
    else this.pendingLevelUps--;

    if (this.pendingChests > 0 || this.pendingLevelUps > 0) {
      this.rollNewOffers();
      this.showOffers();
    } else {
      this.screens.hideAll();
      this.state = 'playing';
    }
  }

  private applyOffer(offer: Offer): void {
    if (offer.type === 'weapon') {
      const owned = this.weapons.find((w) => w.def.id === offer.def.id);
      if (owned) owned.weapon.levelUp();
      else this.addWeapon(offer.def);
      (owned ?? this.weapons[this.weapons.length - 1]).weapon.addRarityBonus(offer.rarity.factor);
      this.refreshWeaponBadges();
    } else if (offer.type === 'passive') {
      const stats = this.player.stats;
      const oldMax = stats.maxHp;
      offer.def.apply(stats, offer.value);
      if (stats.maxHp > oldMax) this.player.heal(stats.maxHp - oldMax, false);
      this.passiveLevels.set(offer.def.id, offer.level);
    } else {
      this.player.heal(40);
    }
  }

  private addWeapon(def: WeaponDef): void {
    this.weapons.push({ def, weapon: def.create(this.combat) });
  }

  private weaponLevels(): Map<string, number> {
    return new Map(this.weapons.map((w) => [w.def.id, w.weapon.level]));
  }

  private refreshWeaponBadges(): void {
    this.hud.setWeapons(this.weapons.map((w) => ({ icon: w.def.icon, level: w.weapon.level })));
  }

  // ── Run lifecycle & menus ──────────────────────────────────

  private startRun(): void {
    this.sfx.unlock();
    this.resetWorld();
    const character = this.character;
    this.hero.setLook(character.hat, character.accent);
    this.player.reset(this.startingStats(character), character.traits ?? []);
    this.enemies.poisonSlows = this.player.traits.has('stickyPoison');

    // Event-driven combat: loot and character traits subscribe to kill events.
    this.combat.onKill((info) => this.onEnemyKilled(info));
    character.install?.(this.combat);

    this.rerolls = PLAYER.rerolls + (character.extraRerolls ?? 0);
    this.addWeapon(character.weapon);
    this.refreshWeaponBadges();
    this.screens.hideAll();
    this.hud.setVisible(true);
    this.input.setJumpVisible(true);
    this.hud.announce('Survive!');
    this.state = 'playing';
  }

  /** Every run starts from the same base stats plus the character's own starting bonus. Nothing carries over. */
  private startingStats(character: CharacterDef): Stats {
    const stats = baseStats();
    character.setup?.(stats);
    return stats;
  }

  private resetWorld(): void {
    for (const w of this.weapons) w.weapon.dispose();
    this.weapons = [];
    this.passiveLevels.clear();
    this.combat.clearListeners();
    this.enemies.clear();
    this.pickups.clear();
    this.particles.clear();
    this.numbers.clear();
    this.director.reset();
    this.combat.time = 0;
    this.pendingLevelUps = 0;
    this.pendingChests = 0;
    this.victoryTimer = 0;
    this.shake = 0;
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.release();
    this.screens.showPause(
      () => {
        this.screens.hideAll();
        this.state = 'playing';
      },
      () => this.endRun(false),
    );
  }

  private endRun(won: boolean): void {
    this.state = 'over';
    this.input.release();
    this.input.setJumpVisible(false);
    const { player, save } = this;
    const time = this.combat.time;
    const newBest = save.bestTime > 0 && time > save.bestTime;
    save.bestTime = Math.max(save.bestTime, Math.floor(time));
    save.bestKills = Math.max(save.bestKills, player.kills);
    if (won) save.wins++;
    persistSave(save);

    if (won) this.sfx.win();
    else this.sfx.lose();
    this.screens.showResult({ won, time, kills: player.kills, level: player.level, newBest }, () => this.showMenu());
  }

  private enterIdle(state: 'menu' | 'select'): void {
    this.state = state;
    this.resetWorld();
    this.player.reset(baseStats(), []);
    this.hud.setVisible(false);
    this.input.setJumpVisible(false);
  }

  private showMenu(): void {
    this.enterIdle('menu');
    this.screens.showMenu(this.save, {
      play: () => this.showCharacterSelect(),
      toggleSound: () => {
        this.save.sound = !this.save.sound;
        this.sfx.enabled = this.save.sound;
        persistSave(this.save);
        this.showMenu();
      },
    });
  }

  private showCharacterSelect(): void {
    this.enterIdle('select');
    this.screens.showCharacterSelect(CHARACTERS, this.character.id, {
      select: (id) => {
        this.character = characterById(id);
        this.hero.setLook(this.character.hat, this.character.accent);
        this.save.character = id;
        persistSave(this.save);
        this.showCharacterSelect();
      },
      start: () => this.startRun(),
      back: () => this.showMenu(),
    });
  }
}
