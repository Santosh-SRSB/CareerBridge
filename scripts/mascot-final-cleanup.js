/**
 * Mascot cleanup:
 * - Solid black t-shirt (not faded / mottled)
 * - Remove black outline stroke
 * - Transparent background (no dark plate)
 * - Recolor eyes to warm amber (keeps pupils + highlights)
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

const SHIRT = { r: 14, g: 14, b: 14 };
const EYE = { r: 217, g: 119, b: 20 }; // warm amber

function isNearBlack(r, g, b, max = 55) {
  const m = Math.max(r, g, b);
  return m <= max && m - Math.min(r, g, b) <= 22;
}

function isBlueIris(r, g, b) {
  return b > 85 && b > r + 18 && b >= g - 15 && Math.max(r, g, b) < 250;
}

function isWhiteHighlight(r, g, b) {
  return r > 210 && g > 210 && b > 210;
}

function isPupil(r, g, b) {
  return Math.max(r, g, b) <= 45;
}

function isContent(r, g, b, a) {
  if (a < 200) return false;
  if (isNearBlack(r, g, b, 28)) return false;
  return Math.max(r, g, b) > 34 || Math.max(r, g, b) - Math.min(r, g, b) > 12;
}

function isLogoColor(r, g, b) {
  // yellow / orange / blue logo accents on shirt — keep
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 40) return false;
  if (b > 120 && b > r + 20) return true; // blue swirl
  if (r > 140 && g > 90 && b < 90) return true; // yellow/orange
  if (r > 180 && g > 180 && b > 180) return true; // white text
  return false;
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

async function processFile(dest, src) {
  fs.copyFileSync(src, path.join(DIR, dest));
  const input = path.join(DIR, dest);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;

  let alreadyClear = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] === 0) alreadyClear += 1;
  const mostlyCut = alreadyClear / size > 0.35;

  const content = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const p = i * channels;
    if (isContent(data[p], data[p + 1], data[p + 2], data[p + 3])) content[i] = 1;
  }

  const silhouette = erode(
    dilate(content, width, height, mostlyCut ? 12 : 30),
    width,
    height,
    mostlyCut ? 3 : 7,
  );

  let shirt = 0;
  let eyes = 0;
  let cleared = 0;

  // Pass 1: transparency + solid shirt + eye recolor inside silhouette
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const p = idx * channels;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];

      if (!silhouette[idx]) {
        if (a === 0) continue;
        data[p + 3] = 0;
        cleared += 1;
        continue;
      }

      // Eyes: blue iris → amber; keep pupils + white highlights
      if (a > 180 && isBlueIris(r, g, b) && !isWhiteHighlight(r, g, b)) {
        const lum = (r + g + b) / 3 / 255;
        const t = Math.max(0.75, Math.min(1.15, 0.85 + lum * 0.5));
        data[p] = Math.min(255, Math.round(EYE.r * t));
        data[p + 1] = Math.min(255, Math.round(EYE.g * t));
        data[p + 2] = Math.min(255, Math.round(EYE.b * t));
        data[p + 3] = 255;
        eyes += 1;
        continue;
      }

      if (isWhiteHighlight(r, g, b) || isPupil(r, g, b)) {
        data[p + 3] = 255;
        continue;
      }

      // Solid black shirt (skip logo colors)
      if ((a < 40 || isNearBlack(r, g, b, 70)) && !isLogoColor(r, g, b)) {
        // Only torso-ish mid body for shirt fill; also fill holes
        const cy = y / height;
        const cx = x / width;
        const likelyShirt = cy > 0.22 && cy < 0.72 && cx > 0.2 && cx < 0.8;
        const hole = a < 40;
        if (likelyShirt || hole || isNearBlack(r, g, b, 48)) {
          data[p] = SHIRT.r;
          data[p + 1] = SHIRT.g;
          data[p + 2] = SHIRT.b;
          data[p + 3] = 255;
          shirt += 1;
          continue;
        }
      }

      if (a > 0) data[p + 3] = 255;
    }
  }

  // Pass 2: remove black outline (rim against transparent)
  for (let pass = 0; pass < 10; pass += 1) {
    const kill = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = (y * width + x) * channels;
        if (data[p + 3] < 200) continue;
        if (!isNearBlack(data[p], data[p + 1], data[p + 2], 50)) continue;
        // Don't peel logo / pupils deep inside — only outline rim
        let clearN = 0;
        let colorN = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ]) {
          const ni = ((y + dy) * width + (x + dx)) * channels;
          if (data[ni + 3] < 40) clearN += 1;
          else if (!isNearBlack(data[ni], data[ni + 1], data[ni + 2], 50)) colorN += 1;
        }
        if (clearN >= 2 && colorN <= 3) kill.push(p);
      }
    }
    for (const p of kill) data[p + 3] = 0;
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } })
    .png({ force: true, compressionLevel: 9 })
    .toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${dest}: shirt ${shirt}, eyes ${eyes}, cleared ${cleared}`);
}

(async () => {
  for (const [dest, src] of Object.entries(SOURCES)) {
    if (!fs.existsSync(src)) {
      console.error('missing', src);
      continue;
    }
    await processFile(dest, src);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
