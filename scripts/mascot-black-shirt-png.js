/**
 * Transparent PNG mascots:
 * - Keep BLACK t-shirts (no teal recolor)
 * - Never touch eye blues
 * - Clear only background outside the character silhouette
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const FILES = [
  'eagle-laptop.png',
  'eagle-run.png',
  'eagle-checklist.png',
  'eagle-tablet.png',
  'eagle-book.png',
];

const DILATE = 16;

function isBgBlack(r, g, b) {
  return Math.max(r, g, b) <= 26 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}

function isContent(r, g, b) {
  // Colorful / lit character pixels — never pure black bg
  if (isBgBlack(r, g, b)) return false;
  return Math.max(r, g, b) > 38 || Math.max(r, g, b) - Math.min(r, g, b) > 16;
}

function dilate(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 0;
      for (let dy = -radius; dy <= radius && !on; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (mask[ny * width + nx]) on = 1;
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

function erode(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let on = 1;
      for (let dy = -radius; dy <= radius && on; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            on = 0;
            break;
          }
          if (!mask[ny * width + nx]) {
            on = 0;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

async function processFile(file) {
  const input = path.join(DIR, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;

  const content = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const p = i * channels;
    if (data[p + 3] < 200) continue;
    if (isContent(data[p], data[p + 1], data[p + 2])) content[i] = 1;
  }

  // Grow silhouette so black shirt interior is inside the character
  const silhouette = erode(
    dilate(content, width, height, DILATE),
    width,
    height,
    Math.max(5, DILATE - 7),
  );

  let filledShirt = 0;
  let cleared = 0;

  for (let idx = 0; idx < size; idx += 1) {
    const i = idx * channels;
    if (silhouette[idx]) {
      // Inside character: keep eyes / logo / feathers untouched.
      // If a hole was already transparent inside the shirt, fill with solid black.
      if (data[i + 3] < 40) {
        data[i] = 12;
        data[i + 1] = 12;
        data[i + 2] = 12;
        data[i + 3] = 255;
        filledShirt += 1;
      } else {
        data[i + 3] = 255;
      }
      continue;
    }

    // Outside: clear black (and near-black) background only
    if (data[i + 3] === 0 || isBgBlack(data[i], data[i + 1], data[i + 2])) {
      data[i + 3] = 0;
      cleared += 1;
    } else {
      // stray fringe outside silhouette → clear
      data[i + 3] = 0;
      cleared += 1;
    }
  }

  // Soften outer fringe: near-black rim next to transparent becomes clear
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      if (!silhouette[idx]) continue;
      const i = idx * channels;
      if (!isBgBlack(data[i], data[i + 1], data[i + 2])) continue;
      let clearN = 0;
      let contentN = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = ((y + dy) * width + (x + dx)) * channels;
        if (data[ni + 3] === 0) clearN += 1;
        else if (!isBgBlack(data[ni], data[ni + 1], data[ni + 2])) contentN += 1;
      }
      // Only peel true outer edge of shirt silhouette, not interior fabric
      if (clearN >= 2 && contentN === 0) data[i + 3] = 0;
    }
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${file}: shirt holes filled ${filledShirt}, bg cleared ${cleared}`);
}

(async () => {
  for (const file of FILES) {
    if (!fs.existsSync(path.join(DIR, file))) {
      console.log('skip missing', file);
      continue;
    }
    await processFile(file);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
