import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const BLOCKED_PATH_PATTERNS = [
  /^\/v3\/oauth(?:\/|$)/u,
  /^\/v3\/developer\/oauth-billing(?:\/|$)/u,
  /^\/v3\/stores\/\{[^}]+\}\/(?:public|customers)(?:\/|$)/u,
  /^\/v3\/orders\/\{[^}]+\}\/(?:check-payment|check-settlement|payment)$/u,
  /^\/v3\/orders\/pg-reference-id(?:s|\/|$)/u,
  /^\/v3\/stores\/\{[^}]+\}\/payment-(?:accounts|methods)$/u
];

const FINANCIAL_TEXT_PATTERN =
  /refund|withdraw|billing|payout|transfer|payment|charge|balance|settlement|reservation|wallet|invoice|bank|financial/iu;

const FINANCIAL_TEXT_ALLOWLIST = new Set(["searchCourierServices"]);

const endpoints = readGeneratedEndpoints();
const errors = [];

for (const endpoint of endpoints) {
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(endpoint.path)) {
      errors.push(`${endpoint.operationId} exposes blocked path ${endpoint.method} ${endpoint.path}`);
    }
  }

  const searchableText = [
    endpoint.operationId,
    endpoint.path,
    endpoint.summary,
    endpoint.description,
    ...(endpoint.tags || [])
  ].join(" ");

  if (FINANCIAL_TEXT_PATTERN.test(searchableText) && !FINANCIAL_TEXT_ALLOWLIST.has(endpoint.operationId)) {
    errors.push(`${endpoint.operationId} matches financial-risk text at ${endpoint.method} ${endpoint.path}`);
  }
}

if (errors.length > 0) {
  console.error("Catalog risk check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Catalog risk check passed (${endpoints.length} endpoints).`);

function readGeneratedEndpoints() {
  const source = readFileSync(join(ROOT, "src/generated/v3Catalog.ts"), "utf8");
  const marker = "export const V3_ENDPOINTS = ";
  const start = source.indexOf(marker);
  const end = source.indexOf("\n] as const", start);

  if (start === -1 || end === -1) {
    throw new Error("Unable to parse src/generated/v3Catalog.ts");
  }

  const jsonText = source.slice(start + marker.length, end + 2);
  return JSON.parse(jsonText);
}
