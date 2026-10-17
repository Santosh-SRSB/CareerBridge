const path = require('path');
const sharp = require('sharp');

async function tightCrop(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const luma = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const isBrown = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r > 70 && r > b + 12 && g > b && r - b < 90 && luma(i) < 170 && luma(i) > 45;
  };
  const isPaper = (i) => {
    const y = luma(i);
    return y < 70 || y > 185;
  };

  const colScore = (x) => {
    let paper = 0;
    let brown = 0;
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + x) * 4;
      if (isBrown(i)) brown += 1;
      else if (isPaper(i)) paper += 1;
    }
    return { paper, brown };
  };

  const rowScore = (y) => {
    let paper = 0;
    let brown = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (isBrown(i)) brown += 1;
      else if (isPaper(i)) paper += 1;
    }
    return { paper, brown };
  };

  let minX = 0;
  for (let x = 0; x < w; x += 1) {
    const s = colScore(x);
    if (s.paper > s.brown * 1.6 && s.paper > 20) {
      minX = x;
      break;
    }
  }
  let maxX = w - 1;
  for (let x = w - 1; x >= 0; x -= 1) {
    const s = colScore(x);
    if (s.paper > s.brown * 1.6 && s.paper > 20) {
      maxX = x;
      break;
    }
  }
  let minY = 0;
  for (let y = 0; y < h; y += 1) {
    const s = rowScore(y);
    if (s.paper > s.brown * 1.6 && s.paper > 20) {
      minY = y;
      break;
    }
  }
  let maxY = h - 1;
  for (let y = h - 1; y >= 0; y -= 1) {
    const s = rowScore(y);
    if (s.paper > s.brown * 1.6 && s.paper > 20) {
      maxY = y;
      break;
    }
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const tmp = file.replace(/\.png$/, '-tight.png');
  await sharp(file)
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .png()
    .toFile(tmp);
  const fs = require('fs');
  fs.copyFileSync(tmp, file);
  fs.unlinkSync(tmp);
  console.log(`tight ${minX},${minY} ${cw}x${ch}`);
}

tightCrop(path.join(__dirname, '../public/resume/photo-3.png')).catch((error) => {
  console.error(error);
  process.exit(1);
});
