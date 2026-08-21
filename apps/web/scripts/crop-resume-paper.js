const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function isBg(r, g, b, samples) {
  if (g > r + 18 && g > b + 8) return true;
  for (const s of samples) {
    const dr = r - s[0];
    const dg = g - s[1];
    const db = b - s[2];
    if (dr * dr + dg * dg + db * db < 2200) return true;
  }
  return false;
}

async function cropPaper(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const samples = [];
  const stepX = Math.max(1, Math.floor(w / 40));
  const stepY = Math.max(1, Math.floor(h / 40));
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  for (let x = 0; x < w; x += stepX) {
    samples.push(px(x, 2), px(x, h - 3));
  }
  for (let y = 0; y < h; y += stepY) {
    samples.push(px(2, y), px(w - 3, y));
  }

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    const c = px(x, y);
    if (!isBg(c[0], c[1], c[2], samples)) return;
    seen[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!seen[y * w + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = Math.max(2, Math.floor(Math.min(w, h) * 0.008));
  minX = Math.max(0, minX + pad);
  minY = Math.max(0, minY + pad);
  maxX = Math.min(w - 1, maxX - pad);
  maxY = Math.min(h - 1, maxY - pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const area = cw * ch;
  if (area < w * h * 0.28 || area > w * h * 0.97) {
    await sharp(inPath).png().toFile(outPath);
    console.log(`${path.basename(inPath)} kept as-is (${w}x${h})`);
    return;
  }

  await sharp(inPath)
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toFile(outPath);
  console.log(`${path.basename(inPath)} -> ${path.basename(outPath)} ${cw}x${ch} from ${w}x${h}`);
}

async function run() {
  const dest = path.join(__dirname, '../public/resume');
  const src3 =
    'C:/Users/ADMIN/.cursor/projects/c-Users-ADMIN-Desktop-CareerBridge/assets/c__Users_ADMIN_AppData_Roaming_Cursor_User_workspaceStorage_f9641eab9ef97b39b1004ed21c62aec3_images_image-dc7ef800-5d7d-4b0d-b3e8-b70d2b64e8e8.png';
  await cropPaper(src3, path.join(dest, 'photo-3.png'));
  for (const name of ['photo-1.png', 'photo-2.png', 'photo-4.png', 'photo-5.png']) {
    const file = path.join(dest, name);
    const tmp = path.join(require('os').tmpdir(), `crop-${name}`);
    fs.copyFileSync(file, tmp);
    await cropPaper(tmp, file);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
