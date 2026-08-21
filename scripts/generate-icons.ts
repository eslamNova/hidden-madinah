/**
 * Generates the app icon set + the social share image.
 * Run: npx tsx scripts/generate-icons.ts
 *
 * Icons (heritage mark: dome + minarets in paper on a deep-green gradient,
 * gold finials, faint 8-point-star watermark):
 *   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png (manifest)
 *   src/app/icon.png (192, browser tab), src/app/apple-icon.png (180),
 *   src/app/favicon.ico (PNG-in-ICO, 48px)
 * Share image (WhatsApp / iMessage / X / Facebook read og:image):
 *   public/og-image.jpg — 1200×630 crop of a Nabawi hero photo with a soft
 *   bottom gradient and the icon badge. Kept under ~250 kB (WhatsApp limit).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const GREEN = "#1F5C3D";
const GREEN_DEEP = "#12392A";
const PAPER = "#FAF6EF";
const GOLD = "#C8A24B";

// 8-point star (same motif as the placeholder tiles), 120-unit box.
const STAR =
  "M60 6 74 24 96 24 96 46 110 60 96 74 96 96 74 96 60 114 46 96 24 96 24 74 10 60 24 46 24 24 46 24Z";

/**
 * The mark in a 100×100 box. `padded` keeps everything inside the maskable
 * 80% safe zone; `rounded` draws the iOS/Android-style squircle ourselves
 * (Apple ignores it and applies its own mask, which is fine).
 */
function brandSvg(size: number, { padded = false, rounded = true } = {}): string {
  const scale = padded ? 0.66 : 0.84;
  const s = size * scale;
  const off = (size - s) / 2;
  const rx = rounded && !padded ? size * 0.22 : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${GREEN_DEEP}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <!-- watermark star -->
  <g transform="translate(${size / 2} ${size / 2}) scale(${(size * 0.9) / 120}) translate(-60 -60)" fill="none" stroke="${GOLD}" stroke-opacity="0.14" stroke-width="1.6">
    <path d="${STAR}"/>
    <circle cx="60" cy="60" r="30"/>
  </g>
  <g transform="translate(${off} ${off}) scale(${s / 100})">
    <!-- minarets -->
    <rect x="16" y="38" width="7" height="44" rx="2" fill="${PAPER}"/>
    <rect x="77" y="38" width="7" height="44" rx="2" fill="${PAPER}"/>
    <path d="M15 38 L19.5 26 L24 38 Z" fill="${PAPER}"/>
    <path d="M76 38 L80.5 26 L85 38 Z" fill="${PAPER}"/>
    <circle cx="19.5" cy="23" r="2.6" fill="${GOLD}"/>
    <circle cx="80.5" cy="23" r="2.6" fill="${GOLD}"/>
    <!-- dome + body -->
    <path d="M29 58 C29 40 41 31 50 25 C59 31 71 40 71 58 Z" fill="${PAPER}"/>
    <rect x="29" y="56" width="42" height="26" rx="2" fill="${PAPER}"/>
    <rect x="27" y="54" width="46" height="3.5" rx="1.75" fill="${GOLD}"/>
    <!-- crescent finial -->
    <rect x="49" y="16" width="2" height="10" rx="1" fill="${GOLD}"/>
    <circle cx="50" cy="14" r="3.4" fill="${GOLD}"/>
    <!-- doorway -->
    <path d="M43 82 L43 68 C43 61 57 61 57 68 L57 82 Z" fill="${GREEN_DEEP}"/>
    <!-- ground -->
    <rect x="11" y="82" width="78" height="5" rx="2.5" fill="${PAPER}"/>
  </g>
</svg>`;
}

/** PNG-in-ICO container (supported by every modern browser). */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png]);
}

async function generateIcons(): Promise<void> {
  const iconsDir = path.join("public", "icons");
  const appDir = path.join("src", "app");
  await mkdir(iconsDir, { recursive: true });

  const png = (size: number, opts?: { padded?: boolean; rounded?: boolean }) =>
    sharp(Buffer.from(brandSvg(size, opts))).png().toBuffer();

  await writeFile(path.join(iconsDir, "icon-192.png"), await png(192));
  await writeFile(path.join(iconsDir, "icon-512.png"), await png(512));
  await writeFile(path.join(iconsDir, "icon-maskable-512.png"), await png(512, { padded: true }));
  await writeFile(path.join(appDir, "icon.png"), await png(192));
  // Apple applies its own squircle mask — supply a square.
  await writeFile(path.join(appDir, "apple-icon.png"), await png(180, { rounded: false }));
  await writeFile(path.join(appDir, "favicon.ico"), pngToIco(await png(48), 48));
  console.log("icons: public/icons/*, src/app/{icon,apple-icon}.png, favicon.ico");
}

async function generateOgImage(): Promise<void> {
  const W = 1200;
  const H = 630;
  // Dusk courtyard shot — minarets, lanterns, crowd: the app in one frame.
  const photo = path.join("public", "hero", "hero-32ea614a01-1600.webp");
  const base = await sharp(await readFile(photo))
    .resize(W, H, { fit: "cover", position: "attention" })
    .toBuffer();

  const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#141418" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#141418" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#141418" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="72" y="${H - 92}" width="220" height="3" rx="1.5" fill="${GOLD}" opacity="0.9"/>
</svg>`;

  const badge = await sharp(Buffer.from(brandSvg(132))).png().toBuffer();

  const out = await sharp(base)
    .composite([
      { input: Buffer.from(overlay), top: 0, left: 0 },
      { input: badge, top: H - 132 - 48, left: W - 132 - 56 },
    ])
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  await writeFile(path.join("public", "og-image.jpg"), out);
  console.log(`og-image.jpg: ${W}x${H}, ${(out.length / 1024).toFixed(0)} kB`);
}

async function main() {
  await generateIcons();
  await generateOgImage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
