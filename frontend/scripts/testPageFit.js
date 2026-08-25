import { pickDensityLevel, RESUME_PAGE } from "../src/templates/pageFit.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const short = pickDensityLevel({
  normal: 900,
  compact: 820,
  tight: 760,
  min: 700,
});
assert(short.density === "normal" && short.overfull === false, "Short content should stay normal");

const medium = pickDensityLevel({
  normal: 1200,
  compact: 1050,
  tight: 980,
  min: 900,
});
assert(medium.density === "compact" && medium.overfull === false, "Medium overflow should compact spacing before changing type");

const long = pickDensityLevel({
  normal: 1600,
  compact: 1400,
  tight: 1250,
  min: 1100,
});
assert(long.density === "min" && long.overfull === false, "Long content should use minimum readable density when it fits");

const tooLong = pickDensityLevel({
  normal: 2200,
  compact: 1900,
  tight: 1600,
  min: 1400,
});
assert(tooLong.density === "min" && tooLong.overfull === true, "Extreme content must warn instead of deleting");

assert(RESUME_PAGE.width === 794 && RESUME_PAGE.height === 1123, "A4 preview size changed");

console.log("Page-fit density checks passed.");
console.log("A4 page:", RESUME_PAGE.width, "x", RESUME_PAGE.height);
console.log("Short:", short.density, "Medium:", medium.density, "Long:", long.density, "Too long overfull:", tooLong.overfull);
