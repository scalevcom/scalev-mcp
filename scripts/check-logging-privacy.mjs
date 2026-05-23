import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_ROOT = "src";
const LOGGER_PATH = "src/logger.ts";
const NEXUS_CLIENT_PATH = "src/nexusClient.ts";
const ALLOWED_LOG_PAYLOAD_KEYS = new Set([
  "request_id",
  "tool_name",
  "operation_id",
  "status",
  "error_code"
]);

const errors = [];

const loggerText = readText(LOGGER_PATH);
const nexusClientText = readText(NEXUS_CLIENT_PATH);

requireSnippet(LOGGER_PATH, loggerText, "sendDefaultPii: false");
requireSnippet(LOGGER_PATH, loggerText, "tracesSampleRate: 0");
requireSnippet(LOGGER_PATH, loggerText, 'captureMessage("Scalev MCP tool error"');
requireSnippet(NEXUS_CLIENT_PATH, nexusClientText, "public readonly errorCode?: string;");
requireSnippet(NEXUS_CLIENT_PATH, nexusClientText, "return error.errorCode;");

if (/public\s+readonly\s+payload/u.test(nexusClientText) || /\bthis\.payload\b/u.test(nexusClientText)) {
  errors.push(`${NEXUS_CLIENT_PATH} must not attach raw Nexus payloads to thrown errors`);
}

for (const match of loggerText.matchAll(/payload\.([a-zA-Z0-9_]+)/gu)) {
  const key = camelToSnake(match[1]);
  if (!ALLOWED_LOG_PAYLOAD_KEYS.has(key)) {
    errors.push(`${LOGGER_PATH} emits unexpected log field: ${match[1]}`);
  }
}

for (const match of loggerText.matchAll(/payload\s*=\s*\{\s*([a-zA-Z0-9_]+)\s*:/gu)) {
  const key = camelToSnake(match[1]);
  if (!ALLOWED_LOG_PAYLOAD_KEYS.has(key)) {
    errors.push(`${LOGGER_PATH} emits unexpected log field: ${match[1]}`);
  }
}

for (const path of listFiles(SRC_ROOT).filter((path) => path.endsWith(".ts") && !path.startsWith("src/generated/"))) {
  const text = readText(path);

  if (path !== LOGGER_PATH && /\bconsole\.(?:log|error|warn|info|debug)\s*\(/u.test(text)) {
    errors.push(`${path} must use src/logger.ts instead of direct console logging`);
  }

  const allowedSentryEntrypoint =
    path === "src/index.ts" &&
    /import\s+\{\s*withSentry\s*\}\s+from\s+"@sentry\/cloudflare"/u.test(text) &&
    !/captureException|captureMessage/u.test(text);

  if (path !== LOGGER_PATH && !allowedSentryEntrypoint && /@sentry\/cloudflare|captureException|captureMessage/u.test(text)) {
    errors.push(`${path} must not call Sentry directly; use src/logger.ts`);
  }
}

if (errors.length > 0) {
  console.error("Logging privacy check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Logging privacy check passed.");

function requireSnippet(path, text, snippet) {
  if (!text.includes(snippet)) {
    errors.push(`${path} missing required snippet: ${snippet}`);
  }
}

function readText(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function listFiles(path) {
  const fullPath = join(ROOT, path);
  const stat = statSync(fullPath);

  if (stat.isFile()) return [path];

  return readdirSync(fullPath)
    .flatMap((entry) => listFiles(join(path, entry)))
    .sort();
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/gu, (char) => `_${char.toLowerCase()}`);
}
