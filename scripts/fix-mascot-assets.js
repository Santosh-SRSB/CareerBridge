/**
 * Fix mascot PNGs the right way:
 * 1) Build silhouette from colorful (non-black) pixels
 * 2) Recolor near-black INSIDE silhouette → solid teal shirt
 * 3) Clear black OUTSIDE silhouette → transparent
 * Keeps eyes (blue) and avoids eating the shirt.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const WS = path.join(
  process.env.USERPROFILE || '',
  'AppData/Roaming/Cursor/User/workspaceStorage/empty-window/images',
);

const SOURCES = {
  'eagle-laptop.png': 'mascot_04-c017b471-9843-4162-a38b-386956092598.png',
  'eagle-run.png': 'mascot_07-1c47e791-03c4-49b5-b1a7-9e5479f3b4af.png',
  'eagle-checklist.png': 'mascot_16-222c0706-41cd-4108-acef-8372ee1216c3.png',
  'target-hit.png': 'mascot_24-23d86f81-c980-444a-8fc9-4e7820d370ee.png',
};

const SHIRT = { r: 22, g: 112, b: 100 };
const DILATE = 14;

function isBgBlack(r, g, b) {
  return Math.max(r, g, b) <= 28 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;
}

function isContent(r, g, b) {
  if (isBgBlack(r, g, b)) return false;
  // Any non-black opaque color counts as character/prop
  return Math.max(r, g, b) > 40 || Math.max(r, g, b) - Math.min(r, g, b) > 18;
}

function isBlueish(r, g, b) {
  return b > 105 && b > r + 28 && b > g + 12;
}

function shade(r, g, b) {
  const lum = (r + g + b) / 3 / 255;
  const t = Math.max(0.8, Math.min(1.18, 0.85 + lum * 0.9));
  return [
    Math.min(255, Math.round(SHIRT.r * t)),
    Math.min(255, Math.round(SHIRT.g * t)),
    Math.min(255, Math.round(SHIRT.b * t)),
  ];
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

async function processEagle(file) {
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

  // Close gaps so black shirt interior is inside silhouette
  const silhouette = erode(dilate(content, width, height, DILATE), width, height, Math.max(4, DILATE - 6));

  let shirt = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (!silhouette[idx]) continue;
      const i = idx * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip eyes
      let nearBlue = false;
      for (let dy = -5; dy <= 5 && !nearBlue; dy += 1) {
        for (let dx = -5; dx <= 5; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width + nx) * channels;
          if (data[ni + 3] > 180 && isBlueish(data[ni], data[ni + 1], data[ni + 2])) {
            nearBlue = true;
            break;
          }
        }
      }
      if (nearBlue && isBgBlack(r, g, b)) continue;

      // Recolor dark fabric / fill black holes inside silhouette
      if (data[i + 3] < 40 || isBgBlack(r, g, b) || (Math.max(r, g, b) <= 70 && Math.max(r, g, b) - Math.min(r, g, b) <= 18)) {
        // Don't recolor logo yellow/blue/white — already skipped by isBgBlack/content
        // Only dark neutrals
        if (data[i + 3] >= 40 && !isBgBlack(r, g, b) && Math.max(r, g, b) > 70) continue;
        const [nr, ng, nb] = shade(Math.max(r, 12), Math.max(g, 12), Math.max(b, 12));
        data[i] = nr;
        data[i + 1] = ng;
        data[i + 2] = nb;
        data[i + 3] = 255;
        shirt += 1;
      }
    }
  }

  // Clear outside silhouette (and remaining pure black outside)
  let cleared = 0;
  for (let idx = 0; idx < size; idx += 1) {
    const i = idx * channels;
    if (silhouette[idx]) continue;
    if (data[i + 3] === 0 || isBgBlack(data[i], data[i + 1], data[i + 2])) {
      data[i + 3] = 0;
      cleared += 1;
    }
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${file}: shirt/fill ${shirt}, cleared ${cleared}`);
}

async function processTarget(file) {
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
  const silhouette = erode(dilate(content, width, height, 10), width, height, 4);

  // Fill black holes inside target
  for (let idx = 0; idx < size; idx += 1) {
    if (!silhouette[idx]) continue;
    const i = idx * channels;
    if (!isBgBlack(data[i], data[i + 1], data[i + 2]) && data[i + 3] >= 40) continue;
    const x = idx % width;
    const y = (idx / width) | 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = (ny * width + nx) * channels;
        if (data[ni + 3] < 200 || isBgBlack(data[ni], data[ni + 1], data[ni + 2])) continue;
        r += data[ni];
        g += data[ni + 1];
        b += data[ni + 2];
        n += 1;
      }
    }
    if (!n) {
      data[i] = 245;
      data[i + 1] = 245;
      data[i + 2] = 245;
    } else {
      data[i] = Math.round(r / n);
      data[i + 1] = Math.round(g / n);
      data[i + 2] = Math.round(b / n);
    }
    data[i + 3] = 255;
  }

  for (let idx = 0; idx < size; idx += 1) {
    if (silhouette[idx]) continue;
    data[idx * channels + 3] = 0;
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${file}: target cleaned`);
}

(async () => {
  for (const [dest, srcName] of Object.entries(SOURCES)) {
    const src = path.join(WS, srcName);
    fs.copyFileSync(src, path.join(DIR, dest));
    console.log('restored', dest);
  }
  await processEagle('eagle-laptop.png');
  await processEagle('eagle-run.png');
  await processEagle('eagle-checklist.png');
  await processTarget('target-hit.png');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
