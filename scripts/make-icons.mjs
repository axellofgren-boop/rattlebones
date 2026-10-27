// Renders the app icon from the SVG below into the PNG sizes iOS and the web manifest need.
// Run with: npm run icons
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a5fa8"/>
      <stop offset="1" stop-color="#2a1f3d"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="420" r="150" fill="#5d8a3c"/>
  <!-- skull -->
  <ellipse cx="256" cy="230" rx="150" ry="140" fill="#f3ead2" stroke="#2a1f3d" stroke-width="12"/>
  <rect x="176" y="300" width="160" height="80" rx="24" fill="#f3ead2" stroke="#2a1f3d" stroke-width="12"/>
  <rect x="186" y="300" width="140" height="40" fill="#f3ead2"/>
  <ellipse cx="200" cy="235" rx="44" ry="50" fill="#2a1f3d"/>
  <ellipse cx="312" cy="235" rx="44" ry="50" fill="#2a1f3d"/>
  <circle cx="212" cy="222" r="12" fill="#ffffff"/>
  <circle cx="324" cy="222" r="12" fill="#ffffff"/>
  <path d="M256 280 L240 310 L272 310 Z" fill="#2a1f3d"/>
  <line x1="226" y1="340" x2="226" y2="378" stroke="#2a1f3d" stroke-width="10"/>
  <line x1="256" y1="340" x2="256" y2="378" stroke="#2a1f3d" stroke-width="10"/>
  <line x1="286" y1="340" x2="286" y2="378" stroke="#2a1f3d" stroke-width="10"/>
  <!-- bandana -->
  <path d="M110 170 Q256 60 402 170 L398 140 Q256 30 114 140 Z" fill="#e23d4b" stroke="#2a1f3d" stroke-width="10" stroke-linejoin="round"/>
  <path d="M398 150 L460 120 L450 190 Z" fill="#e23d4b" stroke="#2a1f3d" stroke-width="10" stroke-linejoin="round"/>
</svg>`;

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const sizes = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

for (const [name, size] of sizes) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(fileURLToPath(new URL(name, outDir)));
  console.log(`wrote public/icons/${name}`);
}
