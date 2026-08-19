const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const input = path.join(__dirname, "..", "public", "srsb-logo-raw.png");
const outputs = [
  path.join(__dirname, "..", "public", "srsb-wordmark.png"),
  path.join(__dirname, "..", "public", "srsb-mark.png"),
];

function isBg(r, g, b, a) {
  if (a < 16) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const white = r > 228 && g > 228 && b > 228 && sat < 0.08;
  const black = max < 28 && sat < 0.15;
  return white || black;
}

(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;
  const seen = new Uint8Array(width * height);
  const q = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = idx(x, y);
    if (!isBg(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    seen[p] = 1;
    q.push([x, y]);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (q.length) {
    const [x, y] = q.pop();
    data[idx(x, y) + 3] = 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  const tmp = path.join(__dirname, "..", "public", "_logo-tmp.png");
  await sharp(data, { raw: { width, height, channels } }).png().toFile(tmp);
  const trimmed = await sharp(tmp).trim().png().toBuffer();
  fs.unlinkSync(tmp);

  for (const output of outputs) {
    fs.writeFileSync(output, trimmed);
  }

  const meta = await sharp(trimmed).metadata();
  console.log("Wrote wordmark", meta.width, "x", meta.height);
})();
