import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');
const source = join(publicDir, 'brand', 'logo-tema-claro.svg');

const BRAND_BG = '#0ea5e9';

await mkdir(iconsDir, { recursive: true });

// Rasterize the logo SVG at various sizes (transparent background).
async function render(size, output) {
  await sharp(source).resize(size, size).png().toFile(join(iconsDir, output));
}

// Maskable icon: solid brand background with the logo centered in the safe zone (~62%).
async function renderMaskable(size, output) {
  const logoSize = Math.round(size * 0.62);
  const offset = Math.round((size - logoSize) / 2);
  const logo = await sharp(source).resize(logoSize, logoSize).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(join(iconsDir, output));
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png');
await renderMaskable(192, 'icon-maskable-192.png');
await renderMaskable(512, 'icon-maskable-512.png');

console.log('Ícones gerados em public/icons/');