const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function dist2(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

async function cropToPaper(inPath, outPath) {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const idx = (x, y) => (y * w + x) * 4;
  const rgb = (x, y) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  };

  const samples = [];
  const patch = (sx, sy) => {
    const acc = [0, 0, 0];
    let n = 0;
    for (let y = sy; y < sy + 10 && y < h; y += 1) {
      for (let x = sx; x < sx + 10 && x < w; x += 1) {
        const c = rgb(x, y);
        acc[0] += c[0];
        acc[1] += c[1];
        acc[2] += c[2];
        n += 1;
      }
    }
    samples.push([acc[0] / n, acc[1] / n, acc[2] / n]);
  };
  patch(0, 0);
  patch(w - 10, 0);
  patch(0, h - 10);
  patch(w - 10, h - 10);

  const isBg = (x, y) => {
    const c = rgb(x, y);
    const yv = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (yv < 18) return true;
    if (c[1] > c[0] + 16 && c[1] > c[2] + 8) return true;
    return samples.some((s) => dist2(c, s) < 3200);
  };

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    if (!isBg(x, y)) return;
    seen[p] = 1;
    stack.push(p);
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
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  const label = new Int32Array(w * h);
  let current = 0;
  let bestId = 0;
  let bestCount = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (seen[p] || label[p]) continue;
      current += 1;
      let count = 0;
      const q = [p];
      label[p] = current;
      while (q.length) {
        const n = q.pop();
        count += 1;
        const nx = n % w;
        const ny = (n - nx) / w;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const mx = nx + dx;
          const my = ny + dy;
          if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
          const m = my * w + mx;
          if (seen[m] || label[m]) continue;
          label[m] = current;
          q.push(m);
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestId = current;
      }
    }
  }

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (label[y * w + x] !== bestId) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 2;
  minX = Math.max(0, minX + pad);
  minY = Math.max(0, minY + pad);
  maxX = Math.min(w - 1, maxX - pad);
  maxY = Math.min(h - 1, maxY - pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const area = cw * ch;
  if (cw < 80 || ch < 120 || area < w * h * 0.2) {
    await sharp(inPath).png().toFile(outPath);
    console.log(`${path.basename(inPath)} kept ${w}x${h}`);
    return;
  }
  await sharp(inPath).extract({ left: minX, top: minY, width: cw, height: ch }).png().toFile(outPath);
  console.log(`${path.basename(outPath)} ${minX},${minY} ${cw}x${ch} from ${w}x${h}`);
}

async function run() {
  const dest = path.join(__dirname, '../public/resume');
  const assets = 'C:/Users/ADMIN/.cursor/projects/c-Users-ADMIN-Desktop-CareerBridge/assets';
  const jobs = [
    [
      path.join(assets, 'c__Users_ADMIN_AppData_Roaming_Cursor_User_workspaceStorage_f9641eab9ef97b39b1004ed21c62aec3_images_image-3286f799-a1fb-4f5c-aad3-8ab9e9ae1b41.png'),
      path.join(dest, 'plain-1.png'),
    ],
    [
      path.join(assets, 'c__Users_ADMIN_AppData_Roaming_Cursor_User_workspaceStorage_f9641eab9ef97b39b1004ed21c62aec3_images_image-3e92f997-573d-4f4b-9e37-3f828226d5e7.png'),
      path.join(dest, 'plain-2.png'),
    ],
    [path.join(assets, 'plain-3.png'), path.join(dest, 'plain-3.png')],
    [path.join(assets, 'plain-4.png'), path.join(dest, 'plain-4.png')],
    [path.join(assets, 'plain-5.png'), path.join(dest, 'plain-5.png')],
  ];
  for (const [from, to] of jobs) {
    await cropToPaper(from, to);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
