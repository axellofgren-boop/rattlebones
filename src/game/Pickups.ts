import * as THREE from 'three';
import { heightAt } from '../core/terrain';
import { chestGeometry, gemGeometry, healGeometry, magnetGeometry, toonMaterial } from '../render/models';

const MAX_GEMS = 450;
const MAX_ITEMS = 24;
const COLLECT_DISTANCE = 0.8;

export type ItemKind = 'heal' | 'magnet' | 'chest';
const ITEM_KINDS: readonly ItemKind[] = ['heal', 'magnet', 'chest'];

/** Gem tiers: bigger XP values get a different colour and size. */
const GEM_TIERS = [
  { min: 0, color: new THREE.Color(0x46d9ff), scale: 1 },
  { min: 4, color: new THREE.Color(0x6dff7a), scale: 1.25 },
  { min: 15, color: new THREE.Color(0xc46dff), scale: 1.5 },
  { min: 40, color: new THREE.Color(0xffc93c), scale: 1.8 },
];

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** XP gems and the rarer items (food, magnet, treasure chest) lying on the ground. */
export class Pickups {
  readonly group = new THREE.Group();

  private readonly gemAlive = new Uint8Array(MAX_GEMS);
  private readonly gemX = new Float32Array(MAX_GEMS);
  private readonly gemZ = new Float32Array(MAX_GEMS);
  private readonly gemValue = new Float32Array(MAX_GEMS);
  /** 0 = lying still, > 0 = flying to the hero at this speed. */
  private readonly gemPull = new Float32Array(MAX_GEMS);
  private nextGem = 0;
  private readonly gemMesh: THREE.InstancedMesh;

  private readonly itemAlive = new Uint8Array(MAX_ITEMS);
  private readonly itemKind = new Uint8Array(MAX_ITEMS);
  private readonly itemX = new Float32Array(MAX_ITEMS);
  private readonly itemZ = new Float32Array(MAX_ITEMS);
  private readonly itemMeshes: THREE.InstancedMesh[];
  private readonly itemCounts = new Int32Array(ITEM_KINDS.length);

  onXp: (amount: number) => void = () => {};
  onItem: (kind: ItemKind) => void = () => {};

  constructor() {
    this.gemMesh = new THREE.InstancedMesh(gemGeometry(), toonMaterial, MAX_GEMS);
    this.gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gemMesh.frustumCulled = false;
    this.gemMesh.setColorAt(0, GEM_TIERS[0].color);
    this.group.add(this.gemMesh);

    const geometries = { heal: healGeometry(), magnet: magnetGeometry(), chest: chestGeometry() };
    this.itemMeshes = ITEM_KINDS.map((kind) => {
      const mesh = new THREE.InstancedMesh(geometries[kind], toonMaterial, MAX_ITEMS);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.group.add(mesh);
      return mesh;
    });
    this.clear();
  }

  clear(): void {
    this.gemAlive.fill(0);
    this.itemAlive.fill(0);
    this.nextGem = 0;
  }

  dropGem(x: number, z: number, value: number): void {
    // Find a free slot, starting where we left off. If every slot is taken,
    // fold the XP into an existing gem instead so nothing is ever lost.
    for (let tries = 0; tries < MAX_GEMS; tries++) {
      const i = this.nextGem;
      this.nextGem = (i + 1) % MAX_GEMS;
      if (!this.gemAlive[i]) {
        this.gemAlive[i] = 1;
        this.gemX[i] = x + (Math.random() - 0.5) * 0.4;
        this.gemZ[i] = z + (Math.random() - 0.5) * 0.4;
        this.gemValue[i] = value;
        this.gemPull[i] = 0;
        return;
      }
    }
    this.gemValue[this.nextGem] += value;
  }

  dropItem(kind: ItemKind, x: number, z: number): void {
    for (let i = 0; i < MAX_ITEMS; i++) {
      if (this.itemAlive[i]) continue;
      this.itemAlive[i] = 1;
      this.itemKind[i] = ITEM_KINDS.indexOf(kind);
      this.itemX[i] = x;
      this.itemZ[i] = z;
      return;
    }
  }

  /** Every gem on the map starts flying to the hero. */
  magnetAll(): void {
    for (let i = 0; i < MAX_GEMS; i++) if (this.gemAlive[i] && this.gemPull[i] === 0) this.gemPull[i] = 6;
  }

  update(dt: number, px: number, pz: number, pickupRadius: number): void {
    const r2 = pickupRadius * pickupRadius;
    for (let i = 0; i < MAX_GEMS; i++) {
      if (!this.gemAlive[i]) continue;
      const dx = px - this.gemX[i];
      const dz = pz - this.gemZ[i];
      const d2 = dx * dx + dz * dz;
      if (this.gemPull[i] === 0) {
        if (d2 > r2) continue;
        this.gemPull[i] = 4;
      }
      const d = Math.sqrt(d2);
      if (d < COLLECT_DISTANCE) {
        this.gemAlive[i] = 0;
        this.onXp(this.gemValue[i]);
        continue;
      }
      // Accelerate so the gem always catches up, even with a fast hero.
      this.gemPull[i] += 45 * dt;
      const step = Math.min(d, this.gemPull[i] * dt);
      this.gemX[i] += (dx / d) * step;
      this.gemZ[i] += (dz / d) * step;
    }

    for (let i = 0; i < MAX_ITEMS; i++) {
      if (!this.itemAlive[i]) continue;
      const dx = px - this.itemX[i];
      const dz = pz - this.itemZ[i];
      if (dx * dx + dz * dz < 1.3 * 1.3) {
        this.itemAlive[i] = 0;
        this.onItem(ITEM_KINDS[this.itemKind[i]]);
      }
    }
  }

  render(time: number): void {
    let n = 0;
    for (let i = 0; i < MAX_GEMS; i++) {
      if (!this.gemAlive[i]) continue;
      const tier = gemTier(this.gemValue[i]);
      const s = tier.scale;
      tmpQuat.setFromAxisAngle(UP, time * 2 + i);
      const gy = heightAt(this.gemX[i], this.gemZ[i]) + 0.45 + Math.sin(time * 3 + i) * 0.1;
      tmpMatrix.compose(tmpPos.set(this.gemX[i], gy, this.gemZ[i]), tmpQuat, tmpScale.set(s, s, s));
      this.gemMesh.setMatrixAt(n, tmpMatrix);
      this.gemMesh.setColorAt(n, tier.color);
      n++;
    }
    this.gemMesh.count = n;
    this.gemMesh.instanceMatrix.needsUpdate = true;
    if (this.gemMesh.instanceColor) this.gemMesh.instanceColor.needsUpdate = true;

    const counts = this.itemCounts;
    counts.fill(0);
    for (let i = 0; i < MAX_ITEMS; i++) {
      if (!this.itemAlive[i]) continue;
      const k = this.itemKind[i];
      const s = ITEM_KINDS[k] === 'chest' ? 1.3 : 1.2;
      tmpQuat.setFromAxisAngle(UP, time * 1.5);
      const iy = heightAt(this.itemX[i], this.itemZ[i]) + 0.5 + Math.sin(time * 3) * 0.12;
      tmpMatrix.compose(tmpPos.set(this.itemX[i], iy, this.itemZ[i]), tmpQuat, tmpScale.set(s, s, s));
      this.itemMeshes[k].setMatrixAt(counts[k]++, tmpMatrix);
    }
    this.itemMeshes.forEach((mesh, k) => {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}

function gemTier(value: number): (typeof GEM_TIERS)[number] {
  for (let t = GEM_TIERS.length - 1; t > 0; t--) if (value >= GEM_TIERS[t].min) return GEM_TIERS[t];
  return GEM_TIERS[0];
}
