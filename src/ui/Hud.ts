import { formatTime } from '../core/math';
import { h, TextSlot } from './dom';

export interface WeaponBadge {
  icon: string;
  level: number;
}

/** In-run overlay: XP bar, health, timer, kills, weapons, boss health and announcements. */
export class Hud {
  readonly root = h('div', 'hud');
  private readonly xpFill = h('div', 'bar-fill xp');
  private readonly hpFill = h('div', 'bar-fill hp');
  private readonly shieldFill = h('div', 'bar-fill shield');
  private readonly level = new TextSlot(h('div', 'pill level'));
  private readonly hpText = new TextSlot(h('div', 'bar-text'));
  private readonly timer = new TextSlot(h('div', 'timer'));
  private readonly kills = new TextSlot(h('div', 'pill'));
  private readonly weapons = h('div', 'weapons');
  private readonly boss = h('div', 'boss');
  private readonly bossName = new TextSlot(h('div', 'boss-name'));
  private readonly bossFill = h('div', 'bar-fill boss-fill');
  private readonly banner = h('div', 'announce');
  private weaponsKey = '';
  private lastXp = -1;
  private lastHp = -1;
  private lastShield = -1;
  private lastBoss = -1;

  constructor(parent: HTMLElement, onPause: () => void) {
    const xpBar = h('div', 'bar xp-bar');
    xpBar.appendChild(this.xpFill);

    const hpBar = h('div', 'bar hp-bar');
    hpBar.append(this.hpFill, this.shieldFill, this.hpText.el);

    const pause = h('button', 'icon-btn', 'II');
    pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', onPause);

    const row = h('div', 'hud-row');
    row.append(this.level.el, hpBar, this.timer.el, this.kills.el, pause);

    const bossBar = h('div', 'bar boss-bar');
    bossBar.appendChild(this.bossFill);
    this.boss.append(this.bossName.el, bossBar);

    const top = h('div', 'hud-top');
    top.append(xpBar, row, this.weapons, this.boss);
    this.root.append(top, this.banner);
    this.root.style.display = 'none';
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  update(state: {
    xp: number;
    xpToNext: number;
    level: number;
    hp: number;
    maxHp: number;
    shield: number;
    time: number;
    kills: number;
  }): void {
    const shield = Math.min(1, state.shield / state.maxHp);
    if (Math.abs(shield - this.lastShield) > 0.002) {
      this.lastShield = shield;
      this.shieldFill.style.transform = `scaleX(${shield.toFixed(3)})`;
    }
    const xp = Math.min(1, state.xp / state.xpToNext);
    if (Math.abs(xp - this.lastXp) > 0.002) {
      this.lastXp = xp;
      this.xpFill.style.transform = `scaleX(${xp.toFixed(3)})`;
    }
    const hp = Math.max(0, state.hp / state.maxHp);
    if (Math.abs(hp - this.lastHp) > 0.002) {
      this.lastHp = hp;
      this.hpFill.style.transform = `scaleX(${hp.toFixed(3)})`;
      this.hpFill.classList.toggle('low', hp < 0.3);
    }
    const shieldText = state.shield >= 1 ? ` +${Math.floor(state.shield)}` : '';
    this.hpText.set(`${Math.ceil(state.hp)}/${Math.round(state.maxHp)}${shieldText}`);
    this.level.set(`LV ${state.level}`);
    this.timer.set(formatTime(state.time));
    this.kills.set(`💀 ${state.kills}`);
  }

  setWeapons(list: readonly WeaponBadge[]): void {
    const key = list.map((w) => `${w.icon}${w.level}`).join();
    if (key === this.weaponsKey) return;
    this.weaponsKey = key;
    this.weapons.replaceChildren(
      ...list.map((w) => {
        const badge = h('div', 'badge', w.icon);
        badge.appendChild(h('span', 'badge-level', String(w.level)));
        return badge;
      }),
    );
  }

  /** Shows the boss health bar, or hides it when `fraction` is null. */
  setBoss(name: string, fraction: number | null): void {
    if (fraction === null) {
      if (this.lastBoss !== -1) this.boss.classList.remove('visible');
      this.lastBoss = -1;
      return;
    }
    if (this.lastBoss === -1) this.boss.classList.add('visible');
    this.bossName.set(name);
    if (Math.abs(fraction - this.lastBoss) > 0.002) {
      this.lastBoss = fraction;
      this.bossFill.style.transform = `scaleX(${Math.max(0, fraction).toFixed(3)})`;
    }
  }

  /** Big text that pops up mid-screen for a moment ("A swarm approaches!"). */
  announce(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the CSS animation
    this.banner.classList.add('show');
  }
}
