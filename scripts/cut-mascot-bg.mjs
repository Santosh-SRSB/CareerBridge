import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.resolve('scripts/.tools/package.json'));
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

const names = ['mascot-coach.png', 'mascot-guide.png', 'mascot-graduate.png', 'mascot-idea.png'];
const srcDir = path.resolve('scripts/.tools/mascot-src');
const outDir = path.resolve('apps/web/public/brand');
const files = names.map((name) => ({
  src: fs.existsSync(path.join(srcDir, name)) ? path.join(srcDir, name) : path.join(outDir, name),
  dest: path.join(outDir, name),
}));

function lum(r, g, b) {
  return (r + g + b) / 3;
}

function sat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function dist(r, g, b, br, bg, bb) {
  return Math.hypot(r - br, g - bg, b - bb);
}

function readRgba(file) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const raw = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { width: raw.width, height: raw.height, data: raw.data };
  }
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

function cut(file, dest) {
  const { width, height, data } = readRgba(file);
  const idx = (x, y) => (y * width + x) * 4;
  const sample = (x, y) => {
    const i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  };

  const corners = [
    sample(2, 2),
    sample(width - 3, 2),
    sample(2, height - 3),
    sample(width - 3, height - 3),
    sample((width / 2) | 0, 2),
    sample(2, (height / 2) | 0),
  ];
  const br = Math.round(corners.reduce((s, p) => s + p[0], 0) / corners.length);
  const bg = Math.round(corners.reduce((s, p) => s + p[1], 0) / corners.length);
  const bb = Math.round(corners.reduce((s, p) => s + p[2], 0) / corners.length);

  const mask = new Uint8Array(width * height);
  const queue = [];

  const strictBg = (r, g, b) =>
    lum(r, g, b) >= 244 && sat(r, g, b) <= 12 && dist(r, g, b, br, bg, bb) <= 22;

  const nearBg = (r, g, b) =>
    lum(r, g, b) >= 222 && sat(r, g, b) <= 22 && dist(r, g, b, br, bg, bb) <= 42;

  const push = (x, y, test) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (mask[p]) return;
    const i = p * 4;
    if (!test(data[i], data[i + 1], data[i + 2])) return;
    mask[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0, strictBg);
    push(x, height - 1, strictBg);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y, strictBg);
    push(width - 1, y, strictBg);
  }

  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y, strictBg);
    push(x - 1, y, strictBg);
    push(x, y + 1, strictBg);
    push(x, y - 1, strictBg);
  }

  for (let pass = 0; pass < 3; pass += 1) {
    const extra = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x;
        if (mask[p]) continue;
        const i = p * 4;
        if (!nearBg(data[i], data[i + 1], data[i + 2])) continue;
        const neighbor =
          (x > 0 && mask[p - 1]) ||
          (x + 1 < width && mask[p + 1]) ||
          (y > 0 && mask[p - width]) ||
          (y + 1 < height && mask[p + width]);
        if (neighbor) extra.push(p);
      }
    }
    for (const p of extra) mask[p] = 1;
  }

  for (let p = 0; p < mask.length; p += 1) {
    if (!mask[p]) continue;
    data[p * 4 + 3] = 0;
  }

  const seen = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start += 1) {
    const si = start * 4;
    if (data[si + 3] === 0 || seen[start]) continue;
    const sr = data[si];
    const sg = data[si + 1];
    const sb = data[si + 2];
    if (lum(sr, sg, sb) < 228 || sat(sr, sg, sb) > 18 || Math.max(sr, sg) - sb > 28) continue;
    const blob = [];
    let touchesClear = false;
    let minYb = height;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      blob.push(p);
      const x = p % width;
      const y = (p / width) | 0;
      if (y < minYb) minYb = y;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        const ni = np * 4;
        if (data[ni + 3] === 0) {
          touchesClear = true;
          continue;
        }
        if (seen[np]) continue;
        const rr = data[ni];
        const gg = data[ni + 1];
        const bb = data[ni + 2];
        if (lum(rr, gg, bb) < 228 || sat(rr, gg, bb) > 18 || Math.max(rr, gg) - bb > 28) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
    if (touchesClear && blob.length < 22000 && (minYb > height * 0.7 || blob.length < 9000)) {
      for (const p of blob) data[p * 4 + 3] = 0;
    }
  }

  const floorY = Math.floor(height * 0.66);
  const floorMask = new Uint8Array(width * height);
  const floorQueue = [];
  const isFloor = (r, g, b) => {
    if (Math.max(r, g) - b > 40) return false;
    if (b > g + 22 && b > r + 22) return false;
    return lum(r, g, b) >= 168 && sat(r, g, b) <= 38;
  };
  for (let y = floorY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      if (data[i + 3] !== 0) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || ny < floorY) continue;
        const np = ny * width + nx;
        const ni = np * 4;
        if (data[ni + 3] === 0 || floorMask[np]) continue;
        if (!isFloor(data[ni], data[ni + 1], data[ni + 2])) continue;
        floorMask[np] = 1;
        floorQueue.push(np);
      }
    }
  }
  while (floorQueue.length) {
    const p = floorQueue.pop();
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || ny < floorY) continue;
      const np = ny * width + nx;
      if (floorMask[np]) continue;
      const ni = np * 4;
      if (data[ni + 3] === 0) continue;
      if (!isFloor(data[ni], data[ni + 1], data[ni + 2])) continue;
      floorMask[np] = 1;
      floorQueue.push(np);
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      let clear = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (data[idx(x + dx, y + dy) + 3] === 0) clear += 1;
      }
      if (!clear) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const white = Math.min(1, Math.max(0, (lum(r, g, b) - 200) / 55));
      const fade = Math.min(1, clear / 3) * white * 0.92;
      data[i + 3] = Math.max(0, Math.round(data[i + 3] * (1 - fade)));
      data[i] = Math.max(0, Math.round(r - (255 - r) * fade * 0.35));
      data[i + 1] = Math.max(0, Math.round(g - (255 - g) * fade * 0.35));
      data[i + 2] = Math.max(0, Math.round(b - (255 - b) * fade * 0.35));
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 12) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const out = new PNG({ width: outW, height: outH });
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const src = idx(minX + x, minY + y);
      const dst = (y * outW + x) * 4;
      out.data[dst] = data[src];
      out.data[dst + 1] = data[src + 1];
      out.data[dst + 2] = data[src + 2];
      out.data[dst + 3] = data[src + 3];
    }
  }

  fs.writeFileSync(dest, PNG.sync.write(out));
  const kept = out.data.filter((_, i) => i % 4 === 3 && out.data[i] > 12).length;
  console.log(`${path.basename(dest)} ${width}x${height} -> ${outW}x${outH} opaque~${kept}`);
}

for (const file of files) cut(file.src, file.dest);
