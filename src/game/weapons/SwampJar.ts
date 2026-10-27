import * as THREE from 'three';
import { heightAt } from '../../core/terrain';
import { ModelBuilder, toonMaterial } from '../../render/models';
import { Weapon, type CombatContext, type WeaponDef } from './Weapon';

const MAX_JARS = 8;
const MAX_PUDDLES = 12;
const FLIGHT_TIME = 0.6;
const ARC_HEIGHT = 3.5;
const RANGE = 9;
const PUDDLE_TICK = 0.3;
const POISON_SECONDS = 3;

const IMPACT = [10, 12, 15, 18, 24];
const POISON_DPS = [7, 9, 11, 14, 19];
const COUNT = [1, 1, 2, 2, 3];
const RADIUS = [1.9, 2.1, 2.2, 2.4, 2.8];
const PUDDLE_LIFE = [3, 3.5, 3.5, 4, 4.5];
const COOLDOWN = [2.6, 2.4, 2.3, 2.1, 1.8];

const SPLASH = new THREE.Color(0x7bff5a);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const AXIS = new THREE.Vector3(1, 0, 0);

/** Lobs jars of swamp goo that leave poisonous puddles. Poisoned enemies take damage over time. */
class SwampJar extends Weapon {
  private readonly jarMesh: THREE.InstancedMesh;
  private readonly puddleMesh: THREE.InstancedMesh;
  private readonly jarAge = new Float32Array(MAX_JARS).fill(-1);
  private readonly fromX = new Float32Array(MAX_JARS);
  private readonly fromZ = new Float32Array(MAX_JARS);
  private readonly toX = new Float32Array(MAX_JARS);
  private readonly toZ = new Float32Array(MAX_JARS);
  private readonly puddleAge = new Float32Array(MAX_PUDDLES).fill(-1);
  private readonly puddleX = new Float32Array(MAX_PUDDLES);
  private readonly puddleZ = new Float32Array(MAX_PUDDLES);
  private readonly found = new Int32Array(64);
  private nextJar = 0;
  private nextPuddle = 0;
  private cooldown = 1;
  private tick = 0;

  constructor(ctx: CombatContext) {
    super(ctx);
    const jar = new ModelBuilder()
      .add(new THREE.IcosahedronGeometry(0.26, 1), 0x5fbf3a)
      .add(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 6), 0x9fe07a, [0, 0.28, 0])
      .add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), 0x8a5a2b, [0, 0.4, 0])
      .build();
    this.jarMesh = new THREE.InstancedMesh(jar, toonMaterial, MAX_JARS);
    const puddle = new THREE.CircleGeometry(1, 9);
    puddle.rotateX(-Math.PI / 2);
    this.puddleMesh = new THREE.InstancedMesh(
      puddle,
      new THREE.MeshBasicMaterial({ color: 0x6bdc3a, transparent: true, opacity: 0.6, depthWrite: false }),
      MAX_PUDDLES,
    );
    for (const m of [this.jarMesh, this.puddleMesh]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      ctx.scene.add(m);
    }
  }

  update(dt: number): void {
    const { player, enemies } = this.ctx;
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      const n = enemies.inRadius(player.x, player.z, RANGE, this.found);
      if (n > 0) {
        this.cooldown = this.stat(COOLDOWN) * player.stats.cooldown;
        for (let k = 0; k < this.stat(COUNT); k++) {
          const target = this.found[Math.floor(Math.random() * n)];
          this.throwJar(enemies.x[target], enemies.z[target]);
        }
      }
    }

    // Jars in flight follow an arc.
    let drawn = 0;
    for (let i = 0; i < MAX_JARS; i++) {
      if (this.jarAge[i] < 0) continue;
      this.jarAge[i] += dt;
      const t = this.jarAge[i] / FLIGHT_TIME;
      const x = this.fromX[i] + (this.toX[i] - this.fromX[i]) * t;
      const z = this.fromZ[i] + (this.toZ[i] - this.fromZ[i]) * t;
      if (t >= 1) {
        this.jarAge[i] = -1;
        this.splash(this.toX[i], this.toZ[i]);
        continue;
      }
      const y = heightAt(x, z) + 1 + Math.sin(t * Math.PI) * ARC_HEIGHT;
      tmpQuat.setFromAxisAngle(AXIS, t * 9);
      tmpMatrix.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(1, 1, 1));
      this.jarMesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.jarMesh.count = drawn;
    this.jarMesh.instanceMatrix.needsUpdate = true;

    // Puddles poison whatever stands in them.
    const life = this.stat(PUDDLE_LIFE) * player.stats.duration;
    const radius = this.stat(RADIUS) * player.stats.area;
    this.tick -= dt;
    const poisonNow = this.tick <= 0;
    if (poisonNow) this.tick = PUDDLE_TICK;
    drawn = 0;
    for (let i = 0; i < MAX_PUDDLES; i++) {
      if (this.puddleAge[i] < 0) continue;
      this.puddleAge[i] += dt;
      const age = this.puddleAge[i];
      if (age > life) {
        this.puddleAge[i] = -1;
        continue;
      }
      if (poisonNow) {
        const n = enemies.inRadius(this.puddleX[i], this.puddleZ[i], radius, this.found);
        for (let k = 0; k < n; k++) {
          enemies.applyPoison(this.found[k], this.dmg(POISON_DPS), POISON_SECONDS * player.stats.duration);
        }
      }
      const s = radius * Math.min(1, age * 8) * Math.min(1, (life - age) * 2);
      tmpMatrix.makeScale(s, 1, s).setPosition(this.puddleX[i], heightAt(this.puddleX[i], this.puddleZ[i]) + 0.07, this.puddleZ[i]);
      this.puddleMesh.setMatrixAt(drawn++, tmpMatrix);
    }
    this.puddleMesh.count = drawn;
    this.puddleMesh.instanceMatrix.needsUpdate = true;
  }

  private throwJar(x: number, z: number): void {
    const i = this.nextJar;
    this.nextJar = (i + 1) % MAX_JARS;
    this.fromX[i] = this.ctx.player.x;
    this.fromZ[i] = this.ctx.player.z;
    this.toX[i] = x + (Math.random() - 0.5);
    this.toZ[i] = z + (Math.random() - 0.5);
    this.jarAge[i] = 0;
  }

  private splash(x: number, z: number): void {
    const { player, enemies } = this.ctx;
    const n = enemies.inRadius(x, z, this.stat(RADIUS) * player.stats.area, this.found);
    for (let k = 0; k < n; k++) this.ctx.damage(this.found[k], this.dmg(IMPACT), x, z, 0.4);
    const i = this.nextPuddle;
    this.nextPuddle = (i + 1) % MAX_PUDDLES;
    this.puddleX[i] = x;
    this.puddleZ[i] = z;
    this.puddleAge[i] = 0;
    this.tick = 0; // poison right away
    this.ctx.particles.burst(x, heightAt(x, z) + 0.4, z, SPLASH, 8, 5, 0.8);
    this.ctx.sfx.boom();
  }

  dispose(): void {
    for (const m of [this.jarMesh, this.puddleMesh]) {
      this.ctx.scene.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    (this.puddleMesh.material as THREE.Material).dispose();
  }
}

export const SWAMP_JAR: WeaponDef = {
  id: 'swamp-jar',
  name: 'Swamp Jar',
  icon: '🫙',
  levels: [
    'Lob jars of goo that leave poison puddles.',
    'Stronger poison, puddles last longer.',
    'Throw 2 jars. Stronger poison.',
    'Stronger poison, bigger puddles.',
    'Throw 3 jars. Much stronger, bigger poison.',
  ],
  create: (ctx) => new SwampJar(ctx),
};
