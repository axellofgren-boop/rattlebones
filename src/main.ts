import * as THREE from 'three';
import { Game } from './game/Game';
import './style.css';

/** Longest step the simulation takes; after a hiccup the game slows briefly instead of teleporting. */
const MAX_DT = 1 / 30;
/** Phones report 3x pixel density; rendering at 2x looks the same and is far cheaper. */
const MAX_PIXEL_RATIO = 2;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ui = document.querySelector<HTMLDivElement>('#ui');
if (!canvas || !ui) throw new Error('Missing #game canvas or #ui root');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

const game = new Game(renderer, ui);
// While developing, expose the game in the browser console for testing (never included in the real build).
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  game.resize(width, height);
}
window.addEventListener('resize', resize);
resize();

// Compile every shader now, so the first enemy or bolt on screen doesn't cause a stutter.
renderer.compile(game.scene, game.camera);

// Block iOS pinch-zoom and long-press menus so play is never interrupted.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Optional frame-rate readout for testing: open the game with ?fps at the end of the address.
const fpsEl = new URLSearchParams(location.search).has('fps') ? document.createElement('div') : null;
if (fpsEl) {
  fpsEl.className = 'fps';
  document.body.appendChild(fpsEl);
}
let fpsFrames = 0;
let fpsTime = 0;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_DT);
  last = now;
  game.update(dt);
  game.render();

  if (fpsEl) {
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} fps`;
      fpsFrames = 0;
      fpsTime = 0;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame((now) => {
  last = now;
  frame(now);
});

// Coming back from the background must not count as one giant frame.
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
