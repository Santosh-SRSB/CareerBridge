const path = require("path");
const sharp = require("sharp");

const srcName = process.argv[2] || "srsb-eagle.png";
const outName = process.argv[3] || "srsb-eagle-cut.png";
const mode = process.argv[4] || "white";
const file = path.join(__dirname, "../public/mascots", srcName);
const out = path.join(__dirname, "../public/mascots", outName);

function isBg(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  if (mode === "black") {
    return r < 28 && g < 28 && b < 28;
  }
  if (mode === "gray") {
    return max < 92 && max - min < 28;
  }
  return min > 232 && max - min < 18;
}

async function run() {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const seen = new Uint8Array(width * height);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!isBg(data[i], data[i + 1], data[i + 2])) return;
    seen[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    data[idx * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
    push(x + 1, y + 1);
    push(x - 1, y - 1);
    push(x + 1, y - 1);
    push(x - 1, y + 1);
  }

  await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(out);

  console.log("knocked out", out);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
