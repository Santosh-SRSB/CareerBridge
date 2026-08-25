/**
 * Transparent PNGs with ORIGINAL colors (black shirt, blue eyes).
 * Dilate covers the shirt, but black pixels far from colorful content
 * stay transparent — so no black outline plate around the eagle.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const WS = path.join(
  process.env.USERPROFILE || '',
  'AppData/Roaming/Cursor/User/workspaceStorage/empty-window/images',
);
const ASSETS = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-SRSB-HR-SOLUTIONS-careerbridge-CareerBridge/assets',
);

const SOURCES = {
  'eagle-laptop.png': path.join(WS, 'mascot_04-c017b471-9843-4162-a38b-386956092598.png'),
  'eagle-run.png': path.join(WS, 'mascot_07-1c47e791-03c4-49b5-b1a7-9e5479f3b4af.png'),
  'eagle-checklist.png': path.join(WS, 'mascot_16-222c0706-41cd-4108-acef-8372ee1216c3.png'),
  'eagle-tablet.png': path.join(
    ASSETS,
    'c__Users_SRSB_HR_SOLUTIONS_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_mascot_02-1baf73a3-28c7-4c76-b6de-c87b8b3e9c7e.png',
  ),
  'eagle-book.png': path.join(
    ASSETS,
    'c__Users_SRSB_HR_SOLUTIONS_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_mascot_03-728faa0c-f75c-4de3-9ec1-aba6bea142ce.png',
  ),
};

function isBgBlack(r, g, b) {
  return Math.max(r, g, b) <= 28 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}

function isContent(r, g, b, a) {
  if (a < 128) return false;
  if (isBgBlack(r, g, b)) return false;
  return Math.max(r, g, b) > 32 || Math.max(r, g, b) - Math.min(r, g, b) > 12;
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

function nearContent(content, width, height, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (content[ny * width + nx]) return true;
    }
  }
  return false;
}

async function processFile(dest, src) {
  const outPath = path.join(DIR, dest);
  fs.copyFileSync(src, outPath);
  const { data, info } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;

  let transparentAlready = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] === 0) transparentAlready += 1;
  const alreadyCut = transparentAlready / size > 0.3;

  const content = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const p = i * channels;
    if (isContent(data[p], data[p + 1], data[p + 2], data[p + 3])) content[i] = 1;
  }

  // Shirt coverage radius — black must be near colorful body parts to stay
  const coverR = alreadyCut ? 10 : 22;
  const keepBlackR = alreadyCut ? 8 : 16;
  const covered = dilate(content, width, height, coverR);

  let kept = 0;
  let cleared = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const p = idx * channels;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];

      if (!covered[idx]) {
        data[p + 3] = 0;
        cleared += 1;
        continue;
      }

      // Colorful character pixel — keep as-is
      if (!isBgBlack(r, g, b)) {
        if (a > 0 || !alreadyCut) data[p + 3] = Math.max(a, 255);
        kept += 1;
        continue;
      }

      // Black pixel: keep only if close to colorful content (shirt / dark detail)
      // otherwise it is dilate-halo / outline plate → transparent
      if (nearContent(content, width, height, x, y, keepBlackR)) {
        data[p + 3] = 255;
        kept += 1;
      } else {
        data[p + 3] = 0;
        cleared += 1;
      }
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png({ force: true })
    .toFile(outPath + '.tmp.png');
  fs.renameSync(outPath + '.tmp.png', outPath);
  console.log(`${dest}: kept ${kept}, cleared ${cleared}`);
}

(async () => {
  for (const [dest, src] of Object.entries(SOURCES)) {
    if (!fs.existsSync(src)) {
      console.error('missing', src);
      continue;
    }
    await processFile(dest, src);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
