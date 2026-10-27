# Rattlebones

A goofy skeleton versus endless hordes. An original 3D survivors-style game for iPhone,
built as an installable web app (no ads, no tracking).

Pick one of 12 skeletons, each with their own starting weapon and passive trait. Walk with your thumb;
weapons fire on their own. Tap **JUMP** to hop over walking enemies, hold it to slide down hills and build speed.
Collect XP gems, level up, pick 1 of 3 upgrades (Common → Legendary), beat the Pumpkin Brutes for treasure,
and survive 8 minutes until **The Gravekeeper** rises. Every run starts completely fresh: nothing carries over
except your records (best time, kills, wins) and your last picked character.

### Combat rules

- **Rarities**: Common 1.0×, Uncommon 1.2×, Rare 1.4×, Epic 1.6×, Legendary 2.0× the upgrade's value.
  Luck (and treasure chests) make rarer upgrades more likely.
- **Overcrits**: crit chance can go past 100%. Every hit then crits, and the extra chance rolls for a higher tier.
  Tier multipliers: 2× for a normal crit, then (n × 0.5)² + n + 1 for tier n (4×, 6.25×, 9×…), times crit damage.
- **Overheal → shield**: healing past max health becomes a blue shield that soaks up damage first and slowly fades.
- **Status effects**: chilled enemies are slowed (blue tint); poisoned enemies take damage over time (green tint).

## Play it

**https://axellofgren-boop.github.io/rattlebones/**

Open it in Safari on the iPhone → Share → **Add to Home Screen**. It then launches full-screen with its own
icon and works offline; your computer doesn't need to be on.

### How updates go live

Every push to the `main` branch on GitHub runs `.github/workflows/deploy.yml`: it type-checks, builds and
publishes the game to GitHub Pages (about a minute). The phone picks up the new version the next time the
game is opened with an internet connection.

## Playing on your iPhone (while developing)

1. On the PC, in this folder, run `npm run dev`.
2. Make sure the iPhone is on the **same Wi-Fi** as the PC.
3. In Safari on the iPhone, open the `Network` address the command prints
   (e.g. `http://192.168.0.186:5173`). If Windows asks about the firewall, allow access on private networks.
4. Add `?fps` to the address to show a frame-rate counter.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the game for testing (PC + phones on the same Wi-Fi) |
| `npm run build` | Type-checks and builds the final version into `dist/` |
| `npm run preview` | Serves the built `dist/` version for a last check |
| `npm run typecheck` | Checks the code for type errors only |
| `npm run icons` | Regenerates the app icons from `scripts/make-icons.mjs` |

On a PC you can also play with WASD / arrow keys, and Space to jump (hold to slide).

## How the code is organised

```
src/
  main.ts              Starts the renderer and the frame loop
  config.ts            All tuning values: enemy stats, spawn rates, run length, rarities
  save.ts              Saves records, settings and the last picked character on the device
  game/Game.ts         Game flow: menu → character select → run → level-up choices → victory / defeat
  game/Combat.ts       The one damage pipeline: crits & overcrits, then "hit" and "kill" events
  game/characters.ts   The 12 skeletons: look, starting weapon, passive trait
  game/Player.ts       Hero movement (momentum, slopes, jump, slide), health, shield, stats
  game/Enemies.ts      The horde: movement, crowding, chill/poison, boss charges
  game/Director.ts     What spawns when: steady stream, bat swarms, mini-bosses, final boss
  game/Pickups.ts      XP gems, food, magnets and treasure chests
  game/upgrades.ts     The weapon list, stat boosts, rarities, and how level-up offers are picked
  game/weapons/        One file per weapon (12 in total)
  core/terrain.ts      The hills: one height function everything uses
  render/              3D models (built from simple shapes in code), hero + hats, world, particles
  ui/                  HUD, damage numbers and menu screens (HTML on top of the 3D view)
  audio/Sfx.ts         Synthesized sound effects (no audio files)
  core/                Small helpers: thumb-stick input, maths, spatial grid
```

### Adding a new weapon

1. Copy a file in `src/game/weapons/` (e.g. `GraveNova.ts`) and change its behaviour and level tables.
2. Add its definition to the `WEAPONS` list in `src/game/upgrades.ts`. It now shows up in level-up offers.
   Use `this.dmg(TABLE)` for damage so rarity bonuses apply, and send all damage through `this.ctx.damage(...)`.

### Adding a new character

Add an entry to `CHARACTERS` in `src/game/characters.ts`: name, hat, colour, starting weapon, and the passive
(`setup` for starting stats, `perLevel` for per-level bonuses, `install` to react to combat events).

### Why it runs smoothly with hundreds of enemies

- Every enemy type, projectile type and gem is one instanced mesh: one draw call however many there are.
- Enemies are stored in flat number arrays and found through a spatial grid, so collision checks stay cheap.
- Nothing is allocated during play (reused vectors and fixed pools), so there are no garbage-collection stutters.
- Rendering is capped at 2× pixel density (iPhones report 3×, which costs more and looks the same).
- All movement is time-based, and leaving the app pauses the run automatically.
