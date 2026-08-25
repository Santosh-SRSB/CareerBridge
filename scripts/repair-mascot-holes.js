/**
 * Fill enclosed transparent holes created when edge flood-fill
 * ate into dark shirt pixels. Edge-connected transparency stays.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const FILES = ['eagle-run.png', 'eagle-checklist.png', 'eagle-laptop.png', 'target-hit.png'];

async function repair(file) {
  const input = path.join(DIR, file);
  const image = sharp(input).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;
  const edgeClear = new Uint8Array(size);

  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (edgeClear[idx]) return;
    if (data[idx * channels + 3] !== 0) return;
    edgeClear[idx] = 1;
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

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  let filled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const i = idx * channels;
      if (data[i + 3] !== 0) continue;
      if (edgeClear[idx]) continue;

      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * channels;
          if (data[ni + 3] < 200) continue;
          r += data[ni];
          g += data[ni + 1];
          b += data[ni + 2];
          n += 1;
        }
      }
      if (n === 0) {
        data[i] = 18;
        data[i + 1] = 18;
        data[i + 2] = 18;
        data[i + 3] = 255;
      } else {
        data[i] = Math.round(r / n);
        data[i + 1] = Math.round(g / n);
        data[i + 2] = Math.round(b / n);
        data[i + 3] = 255;
      }
      filled += 1;
    }
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`repaired ${file} (+${filled} hole pixels)`);
}

(async () => {
  for (const file of FILES) {
    if (!fs.existsSync(path.join(DIR, file))) continue;
    await repair(file);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
