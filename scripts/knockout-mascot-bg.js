const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const FILES = ['eagle-run.png', 'eagle-checklist.png', 'eagle-laptop.png', 'target-hit.png'];

/**
 * Conservative edge flood-fill only.
 * Strict near-black + no soft fringe peel → keeps dark shirts / eyes intact.
 */
const BG_MAX = 18;

function isBackground(r, g, b) {
  return r <= BG_MAX && g <= BG_MAX && b <= BG_MAX && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
}

async function knockOutBlack(file) {
  const input = path.join(DIR, file);
  const image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * channels;
    if (!isBackground(data[i], data[i + 1], data[i + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  let cleared = 0;
  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    const i = idx * channels;
    data[i + 3] = 0;
    cleared += 1;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log('cleared', file, `${info.width}x${info.height}`, 'px', cleared);
}

(async () => {
  for (const file of FILES) {
    if (!fs.existsSync(path.join(DIR, file))) continue;
    await knockOutBlack(file);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
