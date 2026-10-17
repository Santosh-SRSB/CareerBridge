const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function trimRightExtras(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const scores = [];
  for (let x = 0; x < w; x += 1) {
    let paper = 0;
    let green = 0;
    let n = 0;
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const yv = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n += 1;
      if (g > r + 16 && g > b + 8) green += 1;
      else if (yv > 205 || yv < 70) paper += 1;
    }
    scores.push(paper / n - green * 1.4);
  }

  let inside = false;
  let left = 0;
  let right = w - 1;
  for (let x = 0; x < w; x += 1) {
    if (!inside && scores[x] > 0.5) {
      inside = true;
      left = x;
    }
    if (inside && scores[x] < 0.32) {
      right = x - 1;
      break;
    }
  }
  if (right <= left + 80) {
    const a4 = Math.round(h * (210 / 297));
    left = 0;
    right = Math.min(w - 1, a4);
  }

  left = Math.max(0, left);
  right = Math.min(w - 1, Math.max(left + 80, right));
  const top = 0;
  const bottom = h - 1;
  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const tmp = file.replace(/\.png$/, '-cut.png');
  await sharp(file).extract({ left, top, width: cw, height: ch }).png().toFile(tmp);
  fs.copyFileSync(tmp, file);
  fs.unlinkSync(tmp);
  console.log(`${path.basename(file)} right-trim ${left}-${right} ${cw}x${ch}`);
}

async function trimBlackBars(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const luma = (x, y) => {
    const i = (y * w + x) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };
  const rowBlack = (y) => {
    let n = 0;
    for (let x = 0; x < w; x += 2) if (luma(x, y) < 28) n += 1;
    return n / (w / 2) > 0.88;
  };
  const colBlack = (x) => {
    let n = 0;
    for (let y = 0; y < h; y += 2) if (luma(x, y) < 28) n += 1;
    return n / (h / 2) > 0.88;
  };
  let minY = 0;
  while (minY < h - 2 && rowBlack(minY)) minY += 1;
  let maxY = h - 1;
  while (maxY > minY + 2 && rowBlack(maxY)) maxY -= 1;
  let minX = 0;
  while (minX < w - 2 && colBlack(minX)) minX += 1;
  let maxX = w - 1;
  while (maxX > minX + 2 && colBlack(maxX)) maxX -= 1;
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const tmp = file.replace(/\.png$/, '-cut.png');
  await sharp(file).extract({ left: minX, top: minY, width: cw, height: ch }).png().toFile(tmp);
  fs.copyFileSync(tmp, file);
  fs.unlinkSync(tmp);
  console.log(`${path.basename(file)} black-trim ${minX},${minY} ${cw}x${ch} from ${w}x${h}`);
}

async function run() {
  const dir = path.join(__dirname, '../public/resume');
  await trimRightExtras(path.join(dir, 'photo-1.png'));
  await trimRightExtras(path.join(dir, 'photo-2.png'));
  await trimBlackBars(path.join(dir, 'photo-4.png'));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
