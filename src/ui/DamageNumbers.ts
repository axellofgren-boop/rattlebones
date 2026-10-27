import * as THREE from 'three';
import { h } from './dom';

const POOL_SIZE = 40;
const LIFETIME = 0.65;
const RISE = 1.4;

const projected = new THREE.Vector3();
const TIER_CLASSES = ['dmg dot', 'dmg', 'dmg crit', 'dmg crit2', 'dmg crit3'];

/** Floating damage numbers over enemies. A fixed pool of elements is reused so the DOM never grows. */
export class DamageNumbers {
  private readonly els: HTMLDivElement[] = [];
  private readonly x = new Float32Array(POOL_SIZE);
  private readonly y = new Float32Array(POOL_SIZE);
  private readonly z = new Float32Array(POOL_SIZE);
  private readonly life = new Float32Array(POOL_SIZE);
  private next = 0;

  constructor(parent: HTMLElement) {
    const layer = h('div', 'numbers');
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = h('div', 'dmg');
      el.style.display = 'none';
      layer.appendChild(el);
      this.els.push(el);
    }
    parent.appendChild(layer);
  }

  /** `tier`: -1 = poison tick, 0 = normal, 1 = crit, 2 = overcrit, 3+ = mega crit. */
  show(x: number, y: number, z: number, amount: number, tier: number): void {
    const i = this.next;
    this.next = (i + 1) % POOL_SIZE;
    this.x[i] = x + (Math.random() - 0.5) * 0.6;
    this.y[i] = y;
    this.z[i] = z;
    this.life[i] = LIFETIME;
    const el = this.els[i];
    el.textContent = String(amount);
    el.className = TIER_CLASSES[Math.min(tier + 1, TIER_CLASSES.length - 1)];
    el.style.display = '';
  }

  clear(): void {
    this.life.fill(0);
    for (const el of this.els) el.style.display = 'none';
  }

  update(dt: number, camera: THREE.Camera, width: number, height: number): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const el = this.els[i];
      if (this.life[i] <= 0) {
        el.style.display = 'none';
        continue;
      }
      const t = 1 - this.life[i] / LIFETIME;
      projected.set(this.x[i], this.y[i] + t * RISE, this.z[i]).project(camera);
      const sx = (projected.x * 0.5 + 0.5) * width;
      const sy = (-projected.y * 0.5 + 0.5) * height;
      const pop = t < 0.15 ? 0.6 + t * 4 : 1;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${pop.toFixed(2)})`;
      el.style.opacity = t > 0.6 ? ((1 - t) / 0.4).toFixed(2) : '1';
    }
  }
}
