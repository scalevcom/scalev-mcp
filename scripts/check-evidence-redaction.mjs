import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCAN_PATHS = ["assets/reviewer-evidence", "submission"];
const TEXT_EXTENSIONS = new Set([".html", ".json", ".log", ".md", ".txt"]);

const REDACTED_VALUES = /^(?:TBD|PENDING|REDACTED|redacted|<[^>]+>|send out of band)/iu;

const SECRET_ASSIGNMENT_KEYS = [
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "api_key",
  "secret_key",
  "private_key",
  "password"
].join("|");

const FINDING_PATTERNS = [
  {
    label: "Authorization bearer token",
    pattern: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}/giu
  },
  {
    label: "Bearer token",
    pattern: /\bBearer\s+(?:eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9._~+/-]{32,})\b/gu
  },
  {
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu
  },
  {
    label: "private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu
  },
  {
    label: "cookie header",
    pattern: /\b(?:Cookie|Set-Cookie)\s*:\s*[^\n=;]{2,}=[^\n;]{8,}/giu
  },
  {
    label: "credential in URL",
    pattern: /\bhttps?:\/\/[^/\s:@]+:[^/\s:@]+@/giu
  },
  {
    label: "secret assignment",
    pattern: new RegExp(
      `\\b(?:${SECRET_ASSIGNMENT_KEYS})\\b\\s*[:=]\\s*["']?([^"'\\s,}]+|[^"'\\n]+)`,
      "giu"
    ),
    validate: (match) => !REDACTED_VALUES.test((match[1] || "").trim())
  }
];

const findings = [];

for (const path of SCAN_PATHS.flatMap(listFiles).filter(shouldScan)) {
  const text = readFileSync(join(ROOT, path), "utf8");

  for (const { label, pattern, validate } of FINDING_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (validate && !validate(match)) continue;

      const { line, column } = lineColumn(text, match.index);
      findings.push(`${path}:${line}:${column} ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Evidence redaction check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Evidence redaction check passed.");

function listFiles(path) {
  const fullPath = join(ROOT, path);
  const stat = statSync(fullPath);

  if (stat.isFile()) return [path];

  return readdirSync(fullPath)
    .flatMap((entry) => listFiles(join(path, entry)))
    .sort();
}

function shouldScan(path) {
  const dotIndex = path.lastIndexOf(".");
  const extension = dotIndex === -1 ? "" : path.slice(dotIndex);
  return TEXT_EXTENSIONS.has(extension);
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\n/u);
  return { line: lines.length, column: lines.at(-1).length + 1 };
}
