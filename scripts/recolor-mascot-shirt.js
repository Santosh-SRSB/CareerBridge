/**
 * Recolor black t-shirts → solid forest teal, then clear black backgrounds.
 * Large dark regions only (shirt), not tiny eye pupils.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../apps/web/public/mascots');
const FILES = ['eagle-run.png', 'eagle-checklist.png', 'eagle-laptop.png'];

const SHIRT_R = 18;
const SHIRT_G = 98;
const SHIRT_B = 88;
const BG_MAX = 18;
const SHIRT_MAX = 70;
const MIN_COMPONENT = 1800;

function isNearBlack(r, g, b, max) {
  const m = Math.max(r, g, b);
  const n = Math.min(r, g, b);
  return m <= max && m - n <= 22;
}

function isBlueish(r, g, b) {
  return b > 95 && b > r + 28 && b > g + 12;
}

function mapShirtShade(r, g, b) {
  const lum = (r + g + b) / 3 / 255;
  const t = Math.max(0.75, Math.min(1.22, 0.8 + lum * 1.05));
  return [
    Math.min(255, Math.round(SHIRT_R * t)),
    Math.min(255, Math.round(SHIRT_G * t)),
    Math.min(255, Math.round(SHIRT_B * t)),
  ];
}

async function processFile(file) {
  const input = path.join(DIR, file);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const size = width * height;
  const isBg = new Uint8Array(size);
  const queue = [];

  const pushBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (isBg[idx]) return;
    const i = idx * channels;
    if (data[i + 3] === 0) {
      isBg[idx] = 1;
      queue.push(idx);
      return;
    }
    if (!isNearBlack(data[i], data[i + 1], data[i + 2], BG_MAX)) return;
    isBg[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushBg(x, 0);
    pushBg(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushBg(0, y);
    pushBg(width - 1, y);
  }
  while (queue.length) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx / width) | 0;
    pushBg(x + 1, y);
    pushBg(x - 1, y);
    pushBg(x, y + 1);
    pushBg(x, y - 1);
  }

  // Mark dark non-bg candidates
  const dark = new Uint8Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    if (isBg[idx]) continue;
    const i = idx * channels;
    if (data[i + 3] < 200) continue;
    if (isNearBlack(data[i], data[i + 1], data[i + 2], SHIRT_MAX)) dark[idx] = 1;
  }

  // Connected components — only recolor large blobs (shirt), skip pupils
  const seen = new Uint8Array(size);
  const shirtMask = new Uint8Array(size);
  let recoloured = 0;

  for (let start = 0; start < size; start += 1) {
    if (!dark[start] || seen[start]) continue;
    const comp = [];
    const q = [start];
    seen[start] = 1;
    let touchesBlue = false;

    while (q.length) {
      const idx = q.pop();
      comp.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nidx = ny * width + nx;
        const ni = nidx * channels;
        if (data[ni + 3] > 180 && isBlueish(data[ni], data[ni + 1], data[ni + 2])) {
          touchesBlue = true;
        }
        if (!dark[nidx] || seen[nidx]) continue;
        seen[nidx] = 1;
        q.push(nidx);
      }
    }

    // Skip tiny dark spots (pupils / lash) even if they didn't touch blue
    if (comp.length < MIN_COMPONENT) continue;
    // Skip if component is mostly eye-adjacent tiny — already handled by size
    if (touchesBlue && comp.length < MIN_COMPONENT * 2) continue;

    for (const idx of comp) {
      shirtMask[idx] = 1;
      const i = idx * channels;
      const [nr, ng, nb] = mapShirtShade(data[i], data[i + 1], data[i + 2]);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
      data[i + 3] = 255;
      recoloured += 1;
    }
  }

  let cleared = 0;
  for (let idx = 0; idx < size; idx += 1) {
    if (!isBg[idx]) continue;
    data[idx * channels + 3] = 0;
    cleared += 1;
  }

  const temp = `${input}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
  fs.renameSync(temp, input);
  console.log(`${file}: shirt px ${recoloured}, bg ${cleared} (${width}x${height})`);
}

(async () => {
  for (const file of FILES) {
    if (!fs.existsSync(path.join(DIR, file))) continue;
    await processFile(file);
  }
  // Target: background only
  const target = path.join(DIR, 'target-hit.png');
  if (fs.existsSync(target)) {
    const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const isBg = new Uint8Array(width * height);
    const queue = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = y * width + x;
      if (isBg[idx]) return;
      const i = idx * channels;
      if (data[i + 3] === 0 || isNearBlack(data[i], data[i + 1], data[i + 2], BG_MAX)) {
        isBg[idx] = 1;
        queue.push(idx);
      }
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
    for (let idx = 0; idx < width * height; idx += 1) {
      if (isBg[idx]) data[idx * channels + 3] = 0;
    }
    const temp = `${target}.tmp.png`;
    await sharp(data, { raw: { width, height, channels } }).png().toFile(temp);
    fs.renameSync(temp, target);
    console.log('target-hit.png: bg cleared');
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
