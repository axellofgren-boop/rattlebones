import { formatTime } from '../core/math';
import type { SaveData } from '../save';
import type { CharacterDef } from '../game/characters';
import type { OfferView } from '../game/upgrades';
import { button, h } from './dom';

export interface RunSummary {
  won: boolean;
  time: number;
  kills: number;
  level: number;
  newBest: boolean;
}

/** Full-screen menus: title, character select, level-up choice, pause and end-of-run results. */
export class Screens {
  private readonly menu = h('div', 'screen menu');
  private readonly select = h('div', 'screen select');
  private readonly levelUp = h('div', 'screen levelup');
  private readonly pause = h('div', 'screen dim');
  private readonly result = h('div', 'screen dim');
  private readonly all = [this.menu, this.select, this.levelUp, this.pause, this.result];

  constructor(
    parent: HTMLElement,
    private readonly click: () => void,
  ) {
    parent.append(...this.all);
  }

  hideAll(): void {
    for (const s of this.all) s.classList.remove('visible');
  }

  private show(screen: HTMLElement): void {
    this.hideAll();
    screen.classList.add('visible');
  }

  private btn(className: string, text: string, onTap: () => void): HTMLButtonElement {
    return button(className, text, () => {
      this.click();
      onTap();
    });
  }

  showMenu(save: SaveData, actions: { play(): void; toggleSound(): void }): void {
    const sound = this.btn(`icon-btn corner${save.sound ? '' : ' muted'}`, '♪', actions.toggleSound);
    sound.setAttribute('aria-label', 'Sound on or off');

    const title = h('div', 'title');
    title.append(h('div', '', 'RATTLE'), h('span', '', 'BONES'));
    const tagline = h('div', 'subtitle', 'Survive the horde. Grab XP. Get ridiculous.');

    const hint = h('div', 'best', 'Move with your thumb. Weapons fire on their own. Every run starts fresh.');
    const best = h(
      'div',
      'pill',
      save.bestTime > 0 ? `🏆 Best ${formatTime(save.bestTime)} · ${save.bestKills} kills · ${save.wins} wins` : '🏆 No runs yet',
    );

    const play = this.btn('btn big', 'PLAY', actions.play);
    const top = h('div', 'menu-top');
    top.append(title, tagline);
    const bottom = h('div', 'menu-bottom');
    bottom.append(best, hint, play);
    this.menu.replaceChildren(sound, top, bottom);
    this.show(this.menu);
  }

  /** Grid of characters; tapping one previews it, START begins the run with it. */
  showCharacterSelect(
    characters: readonly CharacterDef[],
    selectedId: string,
    actions: { select(id: string): void; start(): void; back(): void },
  ): void {
    const selected = characters.find((c) => c.id === selectedId) ?? characters[0];
    const grid = h('div', 'char-grid');
    for (const c of characters) {
      const tile = this.btn(`char-tile${c.id === selected.id ? ' selected' : ''}`, '', () => actions.select(c.id));
      tile.style.setProperty('--accent', `#${c.accent.toString(16).padStart(6, '0')}`);
      tile.append(h('div', 'char-icon', c.icon), h('div', 'char-name', c.name));
      grid.appendChild(tile);
    }

    const info = h('div', 'char-info');
    const weapon = h('div', 'char-line');
    weapon.append(h('span', 'char-label', 'Starts with'), h('b', '', `${selected.weapon.icon} ${selected.weapon.name}`));
    const passive = h('div', 'char-line');
    passive.append(h('span', 'char-label', 'Passive'), h('b', '', selected.passiveName));
    info.append(
      h('div', 'char-title', selected.name),
      weapon,
      h('div', 'char-text', selected.weapon.levels[0]),
      passive,
      h('div', 'char-text', selected.passiveText),
    );

    const back = this.btn('icon-btn corner left', '‹', actions.back);
    back.setAttribute('aria-label', 'Back');
    const panel = h('div', 'select-panel');
    panel.append(h('div', 'select-heading', 'CHOOSE YOUR SKELETON'), info, grid, this.btn('btn big', 'START', actions.start));
    this.select.replaceChildren(back, panel);
    this.show(this.select);
  }

  showLevelUp(
    heading: string,
    offers: readonly OfferView[],
    rerolls: number,
    onPick: (index: number) => void,
    onReroll: () => void,
  ): void {
    const cards = h('div', 'offers');
    offers.forEach((offer, i) => {
      const card = this.btn('offer', '', () => onPick(i));
      const text = h('div', 'offer-body');
      const head = h('div', 'offer-head');
      head.append(h('span', 'offer-title', offer.title), h('span', `tag${offer.tag === 'NEW' ? ' new' : ''}`, offer.tag));
      const rarity = h('div', 'rarity', offer.rarityName);
      rarity.style.color = offer.rarityColor;
      text.append(rarity, head, h('div', 'offer-text', offer.text));
      card.append(h('div', 'offer-icon', offer.icon), text);
      card.style.borderColor = offer.rarityColor;
      card.style.setProperty('--glow', offer.rarityColor);
      // Small delay before cards accept taps, so a thumb still moving the hero doesn't pick by accident.
      card.disabled = true;
      setTimeout(() => (card.disabled = false), 350);
      cards.appendChild(card);
    });
    const children: HTMLElement[] = [h('div', 'banner', heading), cards];
    if (rerolls > 0) children.push(this.btn('btn small', `🎲 Reroll (${rerolls})`, onReroll));
    this.levelUp.replaceChildren(...children);
    this.show(this.levelUp);
  }

  showPause(onResume: () => void, onQuit: () => void): void {
    this.pause.replaceChildren(
      h('div', 'banner', 'Paused'),
      this.btn('btn big', 'RESUME', onResume),
      this.btn('btn small grey', 'Give up', onQuit),
    );
    this.show(this.pause);
  }

  showResult(summary: RunSummary, onContinue: () => void): void {
    const stats = h('div', 'stats');
    const row = (label: string, value: string) => {
      const r = h('div', 'stat');
      r.append(h('span', '', label), h('b', '', value));
      stats.appendChild(r);
    };
    row('Survived', formatTime(summary.time));
    row('Kills', String(summary.kills));
    row('Level', String(summary.level));
    this.result.replaceChildren(
      h('div', `banner ${summary.won ? 'win' : 'lose'}`, summary.won ? 'VICTORY!' : 'CRUMBLED!'),
      h('div', 'subtitle', summary.won ? 'The Gravekeeper is no more.' : 'Your bones scattered everywhere.'),
      stats,
      ...(summary.newBest ? [h('div', 'subtitle gold', 'New best!')] : []),
      this.btn('btn big', 'CONTINUE', onContinue),
    );
    this.show(this.result);
  }
}
