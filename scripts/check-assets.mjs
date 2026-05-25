import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const imageExpectations = [
  { path: "assets/logo-256.png", width: 256, height: 256 },
  { path: "assets/logo-1024.png", width: 1024, height: 1024 },
  { path: "assets/favicon.png", width: 64, height: 64 }
];

const errors = [];

checkSvg();

for (const expected of imageExpectations) {
  const buffer = readFileSync(join(ROOT, expected.path));
  const actual = pngDimensions(buffer, expected.path);

  if (actual.width !== expected.width || actual.height !== expected.height) {
    errors.push(
      `${expected.path} must be ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`
    );
  }
}

if (errors.length > 0) {
  console.error("Asset check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Asset check passed (${imageExpectations.length + 1} assets).`);

function checkSvg() {
  const svg = readFileSync(join(ROOT, "assets/logo.svg"), "utf8");

  for (const snippet of [
    "<svg",
    'width="1024"',
    'height="1024"',
    'viewBox="0 0 1024 1024"',
    "<title",
    "<desc",
    "Scalev connector logo"
  ]) {
    if (!svg.includes(snippet)) {
      errors.push(`assets/logo.svg missing required snippet: ${snippet}`);
    }
  }
}

function pngDimensions(buffer, path) {
  const signature = "89504e470d0a1a0a";

  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error(`${path} is not a PNG file`);
  }

  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${path} is missing a PNG IHDR chunk`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

