/**
 * Restore eagle-checklist from source using edge flood-fill only.
 * Keeps black shirt / dark details; removes outer black background only.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(
  process.env.USERPROFILE || '',
  'AppData/Roaming/Cursor/User/workspaceStorage/empty-window/images/mascot_16-222c0706-41cd-4108-acef-8372ee1216c3.png',
);
const OUT = path.join(__dirname, '../apps/web/public/mascots/eagle-checklist.png');

function isOuterBlack(r, g, b, a) {
  if (a < 16) return true;
  return Math.max(r, g, b) <= 24 && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source missing:', SRC);
    process.exit(1);
  }

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;
  const bg = new Uint8Array(size);
  const queue = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
      const idx = y * width + x;
      const p = idx * channels;
      if (isOuterBlack(data[p], data[p + 1], data[p + 2], data[p + 3])) {
        bg[idx] = 1;
        queue.push(idx);
      }
    }
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (bg[nIdx]) continue;
      const p = nIdx * channels;
      if (!isOuterBlack(data[p], data[p + 1], data[p + 2], data[p + 3])) continue;
      bg[nIdx] = 1;
      queue.push(nIdx);
    }
  }

  let cleared = 0;
  for (let idx = 0; idx < size; idx += 1) {
    if (!bg[idx]) continue;
    data[idx * channels + 3] = 0;
    cleared += 1;
  }

  await sharp(data, { raw: { width, height, channels } }).png({ force: true }).toFile(OUT);
  console.log(`Restored ${OUT}; cleared ${cleared} background pixels`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
