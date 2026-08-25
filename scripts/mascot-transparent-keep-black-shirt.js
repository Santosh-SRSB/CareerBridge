/**
 * Transparent PNG, BLACK shirt kept solid, eyes untouched.
 * 1) Seed silhouette from colorful pixels
 * 2) Dilate enough to cover black t-shirt
 * 3) Clear black ONLY outside silhouette (no black plate)
 * 4) Peel thin outer black fringe (looks like dark box on green UI)
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

function isBlueEye(r, g, b) {
  return b > 95 && b > r + 22 && b >= g - 8;
}

function isContent(r, g, b, a) {
  if (a < 200) return false;
  if (isBgBlack(r, g, b)) return false;
  return Math.max(r, g, b) > 34 || Math.max(r, g, b) - Math.min(r, g, b) > 12;
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

async function processFile(dest, src, dilateR = 26) {
  fs.copyFileSync(src, path.join(DIR, dest));
  const input = path.join(DIR, dest);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;

  // If source already mostly transparent, only clear residual near-black outside
  let alreadyClear = 0;
  for (let i = 3; i < data.length; i += channels) if (data[i] === 0) alreadyClear += 1;
  const mostlyCut = alreadyClear / size > 0.35;

  const content = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    const p = i * channels;
    if (isContent(data[p], data[p + 1], data[p + 2], data[p + 3])) content[i] = 1;
  }

  const silhouette = erode(
    dilate(content, width, height, mostlyCut ? 10 : dilateR),
    width,
    height,
    mostlyCut ? 2 : 6,
  );

  let cleared = 0;
  for (let i = 0; i < size; i += 1) {
    const p = i * channels;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const a = data[p + 3];

    if (isBlueEye(r, g, b) && a > 0) {
      data[p + 3] = 255;
      continue;
    }

    if (silhouette[i]) {
      // Character body (includes black shirt) — keep opaque as-is
      if (a > 0) data[p + 3] = 255;
      continue;
    }

    // Outside character
    if (a === 0) continue;
    if (isBgBlack(r, g, b) || Math.max(r, g, b) < 45) {
      data[p + 3] = 0;
      cleared += 1;
    } else if (!mostlyCut) {
      // Solid-bg sources: drop any leftover outside pixels
      data[p + 3] = 0;
      cleared += 1;
    }
  }

  // Peel dark fringe that creates a "black plate" look (only rim touching transparency)
  for (let pass = 0; pass < 3; pass += 1) {
    const kill = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * channels;
        if (data[i + 3] < 200) continue;
        if (!isBgBlack(data[i], data[i + 1], data[i + 2])) continue;
        if (isBlueEye(data[i], data[i + 1], data[i + 2])) continue;
        let clearN = 0;
        let colorfulN = 0;
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
          else if (!isBgBlack(data[ni], data[ni + 1], data[ni + 2])) colorfulN += 1;
        }
        // Outer plate fringe: mostly against clear air, not deep in shirt
        if (clearN >= 3 && colorfulN <= 1) kill.push(i);
      }
    }
    for (const i of kill) data[i + 3] = 0;
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } })
    .png({ force: true, compressionLevel: 9 })
    .toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${dest}: cleared ${cleared} (cutout=${mostlyCut})`);
}

(async () => {
  for (const [dest, src] of Object.entries(SOURCES)) {
    if (!fs.existsSync(src)) {
      console.error('missing', src);
      continue;
    }
    await processFile(dest, src, 28);
  }

  // Refresh lime previews
  for (const f of ['eagle-laptop.png', 'eagle-run.png']) {
    const src = path.join(DIR, f);
    const meta = await sharp(src).metadata();
    const lime = await sharp({
      create: {
        width: meta.width,
        height: meta.height,
        channels: 3,
        background: { r: 0, g: 255, b: 120 },
      },
    })
      .png()
      .toBuffer();
    await sharp(lime)
      .composite([{ input: await sharp(src).png().toBuffer(), blend: 'over' }])
      .png()
      .toFile(path.join(DIR, `_preview-${f}`));
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
