export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Frame-rate independent smoothing towards a target.
 * `lambda` is responsiveness: higher reaches the target faster.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Smoothly turn an angle towards a target the short way round. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 125 -> "2:05" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Picks one entry at random, using each entry's weight as its relative chance. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of items) total += weight(item);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}
