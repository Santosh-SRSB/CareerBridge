/**
 * Close silhouette notches (shirt bites from black-bg knockout)
 * without restoring the outer background.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const FILES = ['eagle-run.png', 'eagle-checklist.png', 'eagle-laptop.png'];
const RADIUS = 10;

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
          if (mask[ny * width + nx]) {
            on = 1;
            break;
          }
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

async function closeShirt(file) {
  const input = path.join(DIR, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = data[i * channels + 3] > 32 ? 1 : 0;
  }

  const closed = erode(dilate(mask, width, height, RADIUS), width, height, RADIUS);

  // Only fill pixels that were transparent but are inside the closed silhouette
  // AND are not part of the outer background (must be near existing opaque pixels).
  let filled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const i = idx * channels;
      if (mask[idx]) continue;
      if (!closed[idx]) continue;

      // Must be close to original opaque content (true notch, not outer bg)
      let nearOpaque = false;
      for (let dy = -RADIUS; dy <= RADIUS && !nearOpaque; dy += 1) {
        for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (mask[ny * width + nx]) {
            nearOpaque = true;
            break;
          }
        }
      }
      if (!nearOpaque) continue;

      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      let darkN = 0;
      let darkR = 0;
      let darkG = 0;
      let darkB = 0;
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * channels;
          if (data[ni + 3] < 180) continue;
          r += data[ni];
          g += data[ni + 1];
          b += data[ni + 2];
          n += 1;
          const lum = (data[ni] + data[ni + 1] + data[ni + 2]) / 3;
          if (lum < 55) {
            darkR += data[ni];
            darkG += data[ni + 1];
            darkB += data[ni + 2];
            darkN += 1;
          }
        }
      }

      // Prefer dark neighbor color so shirt stays matte black, not bright
      if (darkN >= 3) {
        data[i] = Math.round(darkR / darkN);
        data[i + 1] = Math.round(darkG / darkN);
        data[i + 2] = Math.round(darkB / darkN);
      } else if (n > 0) {
        data[i] = Math.round(r / n);
        data[i + 1] = Math.round(g / n);
        data[i + 2] = Math.round(b / n);
      } else {
        data[i] = 22;
        data[i + 1] = 22;
        data[i + 2] = 22;
      }
      data[i + 3] = 255;
      filled += 1;
    }
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`closed ${file} (+${filled} pixels)`);
}

(async () => {
  for (const file of FILES) {
    await closeShirt(file);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
