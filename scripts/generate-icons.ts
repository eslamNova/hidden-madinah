/**
 * Generates the PWA icons referenced by src/app/manifest.ts.
 * Run: npx tsx scripts/generate-icons.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Simple heritage mark: sand dome + gold crescent on Green-Dome green.
// The maskable variant keeps the mark inside the 80% safe zone.
function brandSvg(size: number, padded: boolean): string {
  const scale = padded ? 0.62 : 0.8;
  const s = size * scale;
  const off = (size - s) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${padded ? 0 : size * 0.18}" fill="#1F5C3D"/>
  <g transform="translate(${off} ${off}) scale(${s / 100})">
    <path d="M50 12 C56 22 74 30 74 48 L74 78 L64 78 L64 52 C64 40 56 34 50 28 C44 34 36 40 36 52 L36 78 L26 78 L26 48 C26 30 44 22 50 12 Z" fill="#FAF6EF"/>
    <rect x="22" y="78" width="56" height="8" rx="4" fill="#FAF6EF"/>
    <circle cx="50" cy="8" r="4" fill="#C8A24B"/>
  </g>
</svg>`;
}

async function main() {
  const outDir = path.join(process.cwd(), "public", "icons");
  await mkdir(outDir, { recursive: true });

  const jobs: Array<[string, number, boolean]> = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true],
  ];

  for (const [name, size, padded] of jobs) {
    await sharp(Buffer.from(brandSvg(size, padded))).png().toFile(path.join(outDir, name));
    console.log(`generated ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
