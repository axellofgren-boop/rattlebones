import { clamp } from './math';

/** The middle of the arena stays flat so every run starts calm; hills grow outwards from there. */
const FLAT_RADIUS = 6;
const HILL_START = 16;

/**
 * Ground height at a point. A pure function of position, so the world mesh, the hero,
 * enemies, pickups and weapons all agree on where the ground is without sharing any data.
 */
export function heightAt(x: number, z: number): number {
  const hills =
    Math.sin(x * 0.075) * Math.cos(z * 0.068) * 1.8 +
    Math.sin(x * 0.043 + z * 0.057 + 1.3) * 1.5 +
    Math.sin(z * 0.12 - x * 0.05) * 0.45;
  const t = clamp((Math.hypot(x, z) - FLAT_RADIUS) / (HILL_START - FLAT_RADIUS), 0, 1);
  // Smoothstep so the flat centre blends into the hills without a crease.
  return (hills + 1.2) * t * t * (3 - 2 * t);
}

const EPS = 0.25;

/** Uphill direction and steepness: (dh/dx, dh/dz). Written into `out` to avoid allocations. */
export function slopeAt(x: number, z: number, out: { x: number; z: number }): void {
  out.x = (heightAt(x + EPS, z) - heightAt(x - EPS, z)) / (2 * EPS);
  out.z = (heightAt(x, z + EPS) - heightAt(x, z - EPS)) / (2 * EPS);
}
