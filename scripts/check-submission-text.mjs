import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_PATHS = [
  "README.md",
  "README.id.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "assets/reviewer-evidence",
  "submission",
  "src",
];

const TEXT_EXTENSIONS = new Set([".html", ".json", ".md", ".ts"]);
const GENERATED_TEXT_FILES = new Set([
  "src/generated/docsCatalog.ts",
  "src/generated/v3Catalog.ts",
]);

const HIDDEN_UNICODE = /[\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/gu;
const PROMPT_INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|messages?)\b/iu,
  /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/iu,
  /\bjailbreak\b/iu,
  /\bdo\s+not\s+follow\s+(?:the\s+)?(?:tool|system|developer|user)\s+(?:instructions?|messages?)\b/iu,
];

function listFiles(path) {
  const fullPath = join(ROOT, path);
  const stat = statSync(fullPath);

  if (stat.isFile()) return [path];

  return readdirSync(fullPath)
    .flatMap((entry) => listFiles(join(path, entry)))
    .sort();
}

function shouldScan(path) {
  if (GENERATED_TEXT_FILES.has(path)) return true;
  if (path.startsWith("src/generated/")) return false;

  const ext = path.slice(path.lastIndexOf("."));
  return TEXT_EXTENSIONS.has(ext);
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\n/u);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function visibleChar(char) {
  return `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
}

const findings = [];

for (const path of SCAN_PATHS.flatMap(listFiles).filter(shouldScan)) {
  const text = readFileSync(join(ROOT, path), "utf8");

  for (const match of text.matchAll(HIDDEN_UNICODE)) {
    const location = lineColumn(text, match.index);
    findings.push(
      `${path}:${location.line}:${location.column} hidden Unicode ${visibleChar(match[0])}`
    );
  }

  for (const [index, char] of Array.from(text).entries()) {
    const codePoint = char.codePointAt(0);
    const isAllowedControl = codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d;

    if ((codePoint < 0x20 && !isAllowedControl) || codePoint === 0x7f) {
      const location = lineColumn(text, index);
      findings.push(
        `${path}:${location.line}:${location.column} control character ${visibleChar(char)}`
      );
    }
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match && typeof match.index === "number") {
      const location = lineColumn(text, match.index);
      findings.push(
        `${path}:${location.line}:${location.column} suspicious prompt-injection phrase: ${JSON.stringify(match[0])}`
      );
    }
  }
}

if (findings.length > 0) {
  console.error("Submission text safety check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Submission text safety check passed.");
