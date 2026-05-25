import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FINAL_MODE = process.argv.includes("--final");

const EXPECTED_TOOLS = [
  "get_me",
  "get_docs",
  "search",
  "get",
  "execute_safe",
  "execute_destructive",
  "list_landing_pages",
  "list_landing_page_tags",
  "get_landing_page",
  "get_landing_page_public_view",
  "create_landing_page",
  "update_landing_page",
  "update_landing_page_tags",
  "delete_landing_page",
  "list_landing_page_displays",
  "create_landing_page_display",
  "validate_landing_page_display",
  "get_landing_page_display",
  "delete_landing_page_display",
  "list_orders",
  "get_order",
  "create_order",
  "update_order",
  "change_order_status",
  "get_order_statistics"
];

const REQUIRED_FILES = [
  "README.md",
  "README.id.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "assets/logo.svg",
  "assets/logo-256.png",
  "assets/logo-1024.png",
  "assets/favicon.png",
  "assets/reviewer-evidence/prompts.md",
  "assets/reviewer-evidence/tool-exercise-matrix.md",
  "assets/reviewer-evidence/scalev-claude-landing-page-desktop.jpg",
  "assets/reviewer-evidence/scalev-claude-landing-page-mobile.jpg",
  "assets/reviewer-evidence/scalev-claude-route-desktop.jpg",
  "submission/anthropic-requirements-audit-2026-05-22.md",
  "submission/catalog-surface-report.md",
  "submission/claude-connector-submission.md",
  "submission/compliance-memo.md",
  "submission/dns-and-status-page-plan.md",
  "submission/live-checks-2026-05-22.md",
  "submission/operational-runbook.md",
  "submission/pre-feedback-email.md",
  "submission/reviewer-data-seed-plan.md",
  "submission/reviewer-test-account-instructions.md",
  "submission/scalev-claude-landing-page.html",
  "submission/submission-form-draft.json",
  "scripts/check-catalog-risk.mjs",
  "scripts/check-assets.mjs",
  "scripts/check-evidence-redaction.mjs",
  "scripts/check-reviewer-evidence.mjs",
  "scripts/check-logging-privacy.mjs",
  "scripts/check-live-readiness.mjs",
  "scripts/check-submission-workspace.mjs",
  "scripts/generate-catalog-surface-report.mjs",
  "src/app.ts",
  "src/health.ts",
  "src/logger.ts",
  "src/origin.ts",
  "src/security.ts",
  "src/semanticTools.ts",
  "src/toolAnnotations.ts",
  "src/toolRuntime.ts",
  "test/security.test.ts"
];

const REQUIRED_README_SNIPPETS = [
  "https://mcp.scalev.com/mcp",
  "https://scalev.com/privacy",
  "https://scalev.com/terms",
  "https://scalev.com/contact-us",
  "business_unique_id",
  "execute_safe",
  "execute_destructive"
];

const REQUIRED_WRANGLER_SNIPPETS = [
  'MCP_RESOURCE_URI = "https://mcp.scalev.com/mcp"',
  'NEXUS_API_BASE_URL = "https://api.scalev.com"',
  'NEXUS_OAUTH_ISSUER = "https://api.scalev.com/v3/oauth"',
  "ALLOWED_ORIGINS",
  "https://chatgpt.com",
  "SENTRY_DSN",
  "[observability]"
];

const REQUIRED_DNS_STATUS_SNIPPETS = [
  "https://status.scalev.com",
  "https://mcp.scalev.com/health",
  "pki.goog; cansignhttpexchanges=yes",
  "dig +short CAA scalev.com",
  "pnpm check:live-readiness"
];

const REQUIRED_SELECTOR_TEST_SNIPPETS = [
  ["submission/claude-connector-submission.md", "Secondary selector-test business unique id"],
  ["submission/reviewer-test-account-instructions.md", "Secondary selector-test business unique id"],
  ["submission/reviewer-test-account-instructions.md", "Use the primary business for all write/destructive tests"],
  ["submission/reviewer-data-seed-plan.md", "Claude Selector Test"],
  ["submission/reviewer-data-seed-plan.md", "Do not use it for write or destructive reviewer prompts"],
  ["assets/reviewer-evidence/prompts.md", "primary review business and secondary selector-test business"]
];

const REQUIRED_SUBMISSION_CONTACT_SNIPPETS = [
  ["submission/pre-feedback-email.md", "not as a replacement for the MCP directory submission form"],
  ["submission/pre-feedback-email.md", "reserved for form-access support"],
  ["submission/compliance-memo.md", "Submit through the MCP directory submission form"],
  ["submission/operational-runbook.md", "use `mcp-review@anthropic.com` only for form-access problems"],
  ["submission/anthropic-requirements-audit-2026-05-22.md", "Use the MCP directory submission form"]
];

const NO_OPEN_LINK_SCAN_PATHS = ["src", "test", "wrangler.toml", "package.json"];
const OPEN_LINK_PATTERNS = [/ui\/open-link/iu, /openLink/iu, /open_link/iu];

const errors = [];
const warnings = [];

for (const path of REQUIRED_FILES) {
  const fullPath = join(ROOT, path);

  if (!existsSync(fullPath)) {
    errors.push(`missing required file: ${path}`);
    continue;
  }

  if (statSync(fullPath).size === 0) {
    errors.push(`empty required file: ${path}`);
  }
}

const packageJson = readJson("package.json");
if (packageJson) {
  if (packageJson.version !== "0.3.0") {
    errors.push(`package.json version must be 0.3.0, got ${packageJson.version || "missing"}`);
  }

  if (!packageJson.dependencies?.["@sentry/cloudflare"]) {
    errors.push("package.json must include @sentry/cloudflare");
  }

  for (const script of [
    "check:catalogs",
    "check:assets",
    "check:catalog-risk",
    "check:catalog-surface-report",
    "check:evidence-redaction",
    "check:reviewer-evidence",
    "check:reviewer-evidence:final",
    "check:logging-privacy",
    "check:submission-text",
    "check:submission-package",
    "check:submission-workspace",
    "check:submission-package:final",
    "check:submission-local",
    "check:submission-final",
    "check:live-readiness",
    "typecheck",
    "test"
  ]) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`package.json missing script: ${script}`);
    }
  }
}

const toolNames = parseToolNames(readText("src/toolNames.ts"));
if (JSON.stringify(toolNames) !== JSON.stringify(EXPECTED_TOOLS)) {
  errors.push(`tool list mismatch: expected ${EXPECTED_TOOLS.join(", ")}, got ${toolNames.join(", ")}`);
}

const readme = readText("README.md");
for (const snippet of REQUIRED_README_SNIPPETS) {
  if (!readme.includes(snippet)) {
    errors.push(`README.md missing required snippet: ${snippet}`);
  }
}

for (const toolName of EXPECTED_TOOLS) {
  if (!readme.includes(`\`${toolName}\``)) {
    errors.push(`README.md missing tool table entry: ${toolName}`);
  }
}

const wrangler = readText("wrangler.toml");
for (const snippet of REQUIRED_WRANGLER_SNIPPETS) {
  if (!wrangler.includes(snippet)) {
    errors.push(`wrangler.toml missing required snippet: ${snippet}`);
  }
}

const generatedV3Catalog = readText("src/generated/v3Catalog.ts");
for (const blockedCatalogPath of [
  "/v3/oauth/billing/",
  "/v3/developer/oauth-billing/",
  "/v3/orders/{id}/check-payment",
  "/v3/orders/{id}/check-settlement",
  "/v3/orders/{id}/payment",
  "/v3/orders/pg-reference-id/",
  "/v3/orders/pg-reference-ids",
  "/v3/stores/{store_id}/payment-accounts",
  "/v3/stores/{store_id}/payment-methods"
]) {
  if (generatedV3Catalog.includes(blockedCatalogPath)) {
    errors.push(`src/generated/v3Catalog.ts must not expose ${blockedCatalogPath} endpoints`);
  }
}

const dnsStatusPlan = readText("submission/dns-and-status-page-plan.md");
for (const snippet of REQUIRED_DNS_STATUS_SNIPPETS) {
  if (!dnsStatusPlan.includes(snippet)) {
    errors.push(`submission/dns-and-status-page-plan.md missing required snippet: ${snippet}`);
  }
}

for (const [path, snippet] of REQUIRED_SELECTOR_TEST_SNIPPETS) {
  if (!readText(path).includes(snippet)) {
    errors.push(`${path} missing selector-test snippet: ${snippet}`);
  }
}

for (const [path, snippet] of REQUIRED_SUBMISSION_CONTACT_SNIPPETS) {
  if (!readText(path).includes(snippet)) {
    errors.push(`${path} missing submission-contact snippet: ${snippet}`);
  }
}

const submissionDraft = readJson("submission/submission-form-draft.json");
if (submissionDraft) {
  if (submissionDraft.name !== "Scalev") errors.push("submission draft name must be Scalev");
  if (submissionDraft.mcp_url !== "https://mcp.scalev.com/mcp") errors.push("submission draft MCP URL mismatch");
  if (submissionDraft.auth !== "oauth_dcr") errors.push("submission draft auth must be oauth_dcr");
  if (submissionDraft.transport !== "streamable_http") errors.push("submission draft transport must be streamable_http");
  if (submissionDraft.tool_count !== EXPECTED_TOOLS.length) errors.push("submission draft tool_count mismatch");
  if (JSON.stringify(submissionDraft.tools) !== JSON.stringify(EXPECTED_TOOLS)) {
    errors.push("submission draft tools do not match expected tool list");
  }

  const reviewerTestData = submissionDraft.reviewer_test_data || {};

  for (const [field, minimum] of [
    ["minimum_orders", 30],
    ["minimum_landing_pages", 5],
    ["minimum_customers", 5],
    ["minimum_products", 10]
  ]) {
    if (typeof reviewerTestData[field] !== "number" || reviewerTestData[field] < minimum) {
      errors.push(`submission draft reviewer_test_data.${field} must be at least ${minimum}`);
    }
  }

  for (const field of [
    "status",
    "reviewer_account",
    "reviewer_business_unique_id",
    "secondary_selector_test_business_unique_id"
  ]) {
    if (!Object.hasOwn(reviewerTestData, field)) {
      errors.push(`submission draft reviewer_test_data missing ${field}`);
    } else if (typeof reviewerTestData[field] !== "string" || reviewerTestData[field].trim().length === 0) {
      errors.push(`submission draft reviewer_test_data.${field} must be a non-empty string`);
    }
  }

  if (FINAL_MODE) {
    if (reviewerTestData.status === "pending_production_seed") {
      errors.push("submission draft reviewer_test_data.status must not be pending_production_seed in final mode");
    }

    for (const field of [
      "reviewer_account",
      "reviewer_business_unique_id",
      "secondary_selector_test_business_unique_id"
    ]) {
      if (reviewerTestData[field] === "TBD" || reviewerTestData[field]?.startsWith?.("PENDING_")) {
        errors.push(`submission draft reviewer_test_data.${field} must be populated in final mode`);
      }
    }
  }

  if (Object.hasOwn(submissionDraft, "allowed_link_uris")) {
    errors.push("submission draft must omit allowed_link_uris because the connector does not expose ui/open-link");
  }
}

for (const path of NO_OPEN_LINK_SCAN_PATHS.flatMap(listFiles)) {
  const text = readText(path);
  for (const pattern of OPEN_LINK_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`${path} references ${pattern}; declare allowed link URIs only if ui/open-link is intentionally added`);
    }
  }
}

for (const pendingCheck of [
  ["submission/submission-form-draft.json", /\bTBD\b|pending_production_seed/u],
  ["submission/claude-connector-submission.md", /\bTBD\b/u],
  ["submission/compliance-memo.md", /Remaining Before Submission/u],
  ["submission/live-checks-2026-05-22.md", /Pending Deployment|DNS Follow-Up/u],
  ["submission/reviewer-test-account-instructions.md", /PENDING_PRODUCTION_REVIEWER_ACCOUNT|\bTBD\b/u],
  ["assets/reviewer-evidence/prompts.md", /Capture final Claude custom-connector/u],
  ["assets/reviewer-evidence/tool-exercise-matrix.md", /PENDING_FINAL_CLAUDE_RUN/u]
]) {
  const [path, pattern] = pendingCheck;
  if (pattern.test(readText(path))) {
    warnings.push(`${path} still records external submission work`);
  }
}

if (FINAL_MODE) {
  errors.push(...warnings.map((warning) => `final mode unresolved: ${warning}`));
}

if (errors.length > 0) {
  console.error("Submission package check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Submission package check passed (${EXPECTED_TOOLS.length} tools).`);

if (warnings.length > 0) {
  console.warn("External work still pending:");
  for (const warning of warnings) console.warn(`- ${warning}`);
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

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    errors.push(`invalid JSON in ${path}: ${error.message}`);
    return undefined;
  }
}

function parseToolNames(text) {
  const match = text.match(/SCALEV_TOOL_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/u);
  if (!match) return [];

  return Array.from(match[1].matchAll(/"([^"]+)"/gu), (item) => item[1]);
}
