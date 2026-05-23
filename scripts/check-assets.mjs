import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const imageExpectations = [
  { path: "assets/logo-256.png", format: "png", width: 256, height: 256 },
  { path: "assets/logo-1024.png", format: "png", width: 1024, height: 1024 },
  { path: "assets/favicon.png", format: "png", width: 64, height: 64 },
  {
    path: "assets/reviewer-evidence/scalev-claude-landing-page-desktop.jpg",
    format: "jpeg",
    width: 1280,
    height: 720
  },
  {
    path: "assets/reviewer-evidence/scalev-claude-landing-page-mobile.jpg",
    format: "jpeg",
    width: 390,
    height: 844
  },
  {
    path: "assets/reviewer-evidence/scalev-claude-route-desktop.jpg",
    format: "jpeg",
    width: 1280,
    height: 720
  }
];

const errors = [];

checkSvg();

for (const expected of imageExpectations) {
  const buffer = readFileSync(join(ROOT, expected.path));
  const actual =
    expected.format === "png" ? pngDimensions(buffer, expected.path) : jpegDimensions(buffer, expected.path);

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

function jpegDimensions(buffer, path) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`${path} is not a JPEG file`);
  }

  let offset = 2;

  while (offset < buffer.length) {
    while (buffer[offset] !== 0xff && offset < buffer.length) offset += 1;
    while (buffer[offset] === 0xff) offset += 1;

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    const dataOffset = offset + 2;

    if (isStartOfFrameMarker(marker)) {
      return {
        height: buffer.readUInt16BE(dataOffset + 1),
        width: buffer.readUInt16BE(dataOffset + 3)
      };
    }

    offset = dataOffset + segmentLength - 2;
  }

  throw new Error(`${path} is missing a JPEG size marker`);
}

function isStartOfFrameMarker(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}
