/**
 * What is kept between runs. Runs themselves always start completely fresh:
 * only records, settings and the last picked character are remembered.
 */
export interface SaveData {
  bestTime: number;
  bestKills: number;
  wins: number;
  sound: boolean;
  /** Last character picked on the select screen. */
  character: string;
}

const KEY = 'rattlebones/save/v1';

function defaults(): SaveData {
  return { bestTime: 0, bestKills: 0, wins: 0, sound: true, character: 'rattles' };
}

function wholeNumber(value: unknown, fallback: number, min: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.floor(value)) : fallback;
}

export function loadSave(): SaveData {
  const data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return data;
    // Older saves also held coins and shop upgrades; those are simply ignored now.
    const parsed = JSON.parse(raw) as Partial<Record<keyof SaveData, unknown>>;
    data.bestTime = wholeNumber(parsed.bestTime, 0, 0);
    data.bestKills = wholeNumber(parsed.bestKills, 0, 0);
    data.wins = wholeNumber(parsed.wins, 0, 0);
    data.sound = typeof parsed.sound === 'boolean' ? parsed.sound : true;
    if (typeof parsed.character === 'string') data.character = parsed.character;
  } catch {
    // Corrupt or unreadable save: start fresh rather than crash.
  }
  return data;
}

export function persistSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (e.g. private browsing); the game still plays, records just aren't kept.
  }
}
