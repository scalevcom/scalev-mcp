import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = "submission/catalog-surface-report.md";
const CHECK_MODE = process.argv.includes("--check");

const { sourceHash, endpoints } = readGeneratedCatalog();
const report = renderReport(sourceHash, endpoints);

if (CHECK_MODE) {
  const current = readFileSync(join(ROOT, OUTPUT_PATH), "utf8");

  if (current !== report) {
    console.error(`${OUTPUT_PATH} is stale. Run pnpm generate:catalog-surface-report.`);
    process.exit(1);
  }

  console.log(`${OUTPUT_PATH} is up to date.`);
} else {
  writeFileSync(join(ROOT, OUTPUT_PATH), report);
  console.log(`Generated ${OUTPUT_PATH}`);
}

function readGeneratedCatalog() {
  const source = readFileSync(join(ROOT, "src/generated/v3Catalog.ts"), "utf8");
  const hashMatch = source.match(/V3_CATALOG_SOURCE_SHA256 = "([^"]+)"/u);
  const marker = "export const V3_ENDPOINTS = ";
  const start = source.indexOf(marker);
  const end = source.indexOf("\n] as const", start);

  if (!hashMatch || start === -1 || end === -1) {
    throw new Error("Unable to parse src/generated/v3Catalog.ts");
  }

  return {
    sourceHash: hashMatch[1],
    endpoints: JSON.parse(source.slice(start + marker.length, end + 2))
  };
}

function renderReport(sourceHash, endpoints) {
  const reads = endpoints.filter((endpoint) => endpoint.method === "GET");
  const writes = endpoints.filter((endpoint) => endpoint.method !== "GET");
  const safeWrites = writes.filter((endpoint) => !endpoint.isDestructive);
  const destructiveWrites = writes.filter((endpoint) => endpoint.isDestructive);
  const tagRows = [...writeCountsByTag(writes).entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
  );

  return [
    "# Catalog Surface Report",
    "",
    "Generated from `src/generated/v3Catalog.ts`.",
    "",
    `- Source OpenAPI SHA-256: \`${sourceHash}\``,
    `- Total catalog endpoints: ${endpoints.length}`,
    `- Read-only GET endpoints: ${reads.length}`,
    `- Non-destructive write/action endpoints: ${safeWrites.length}`,
    `- Destructive write/action endpoints: ${destructiveWrites.length}`,
    "",
    "## Submission Posture",
    "",
    "- Claude-visible semantic tools stay focused on Landing Pages and Orders.",
    "- Generic catalog tools remain available for approved business-authenticated `/v3` coverage.",
    "- `search` returns `execution_tool`, so write calls are split between `execute_safe` and `execute_destructive`.",
    "- Destructive operations require the destructive tool annotation and are rejected by `execute_safe`.",
    "- OAuth flow, storefront browser, OAuth billing, developer payout, and direct payment-gateway routes are excluded by generation and runtime checks.",
    "- Nexus remains the authority for OAuth token validation, selected-business authorization, scopes, audit logs, and rate limits.",
    "",
    "## Write Endpoints By Tag",
    "",
    "| Tag | Write endpoints |",
    "| --- | ---: |",
    ...tagRows.map(([tag, count]) => `| ${escapeCell(tag)} | ${count} |`),
    "",
    "## Destructive Endpoints",
    "",
    "| Method | Path | Operation | Summary |",
    "| --- | --- | --- | --- |",
    ...destructiveWrites.map((endpoint) =>
      `| ${endpoint.method} | \`${endpoint.path}\` | \`${endpoint.operationId}\` | ${escapeCell(endpoint.summary)} |`
    ),
    ""
  ].join("\n");
}

function writeCountsByTag(writes) {
  const counts = new Map();

  for (const endpoint of writes) {
    const tags = endpoint.tags.length > 0 ? endpoint.tags : ["<untagged>"];

    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return counts;
}

function escapeCell(value) {
  return String(value || "").replace(/\|/gu, "\\|");
}
