import * as THREE from 'three';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const EXPAND_TIME = 0.3;
const FADE_TIME = 0.25;
const ECHO_DELAY = 0.4;

const DAMAGE = [22, 28, 34, 42, 56];
const RADIUS = [4.6, 5.0, 5.4, 5.9, 6.6];
const COOLDOWN = [2.5, 2.3, 2.1, 1.9, 1.6];

const BLAST_COLOR = new THREE.Color(0x9cf6ff);

/** A ghostly shockwave bursts out of the hero, hurting and shoving back everything nearby. */
class GraveNova extends Weapon {
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly found = new Int32Array(256);
  private cooldown = 1;
  /** Seconds since the last blast (drives the ring animation). */
  private sinceBlast = 99;
  private blastRadius = 1;
  private echoIn = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    const geo = new THREE.RingGeometry(0.82, 1, 48);
    geo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: BLAST_COLOR,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.ring.visible = false;
    ctx.scene.add(this.ring);
  }

  update(dt: number): void {
    const { player } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
      this.blast();
      // Encore trait: an echo blast follows shortly after.
      if (player.traits.has('encore')) this.echoIn = ECHO_DELAY;
    }
    if (this.echoIn > 0) {
      this.echoIn -= dt;
      if (this.echoIn <= 0) this.blast();
    }

    this.sinceBlast += dt;
    const t = this.sinceBlast;
    this.ring.visible = t < EXPAND_TIME + FADE_TIME;
    if (!this.ring.visible) return;
    const grow = Math.min(1, t / EXPAND_TIME);
    const s = this.blastRadius * (1 - Math.pow(1 - grow, 3));
    this.ring.scale.set(s, 1, s);
    this.ring.position.set(player.x, player.y + 0.3, player.z);
    this.ring.material.opacity = t < EXPAND_TIME ? 0.9 : 0.9 * (1 - (t - EXPAND_TIME) / FADE_TIME);
  }

  private blast(): void {
    const { player, enemies } = this.ctx;
    this.blastRadius = this.stat(RADIUS) * player.stats.area;
    this.sinceBlast = 0;
    const n = enemies.inRadius(player.x, player.z, this.blastRadius, this.found);
    for (let k = 0; k < n; k++) this.ctx.damage(this.found[k], this.dmg(DAMAGE), player.x, player.z, 1.6);
    this.ctx.sfx.boom();
  }

  dispose(): void {
    this.ctx.scene.remove(this.ring);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}

export const GRAVE_NOVA: WeaponDef = {
  id: 'grave-nova',
  name: 'Spooky Shout',
  icon: '📣',
  levels: [
    'Every few seconds a ghostly blast shoves back everything around you.',
    '+6 damage, bigger blast.',
    '+6 damage, blast more often.',
    '+8 damage, bigger blast.',
    '+14 damage, much bigger and faster.',
  ],
  create: (ctx) => new GraveNova(ctx),
};
