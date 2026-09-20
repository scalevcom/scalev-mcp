import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const BLOCKED_PATH_PATTERNS = [
  /^\/v3\/oauth(?:\/|$)/u,
  /^\/v3\/developer\/oauth-billing(?:\/|$)/u,
  /^\/v3\/stores\/\{[^}]+\}\/(?:public|customers)(?:\/|$)/u,
  /^\/v3\/orders\/\{[^}]+\}\/(?:check-payment|check-settlement|payment)$/u,
  /^\/v3\/orders\/pg-reference-id(?:s|\/|$)/u,
  /^\/v3\/stores\/\{[^}]+\}\/payment-(?:accounts|methods)$/u,
  /^\/v3\/web-analytics\/self-traffic$/u,
  /^\/v3\/public\//u
];

const FINANCIAL_TEXT_PATTERN =
  /refund|withdraw|billing|payout|transfer|payment|charge|balance|settlement|reservation|wallet|invoice|bank|financial/iu;

const FINANCIAL_TEXT_ALLOWLIST = new Set(["searchCourierServices"]);
const WEB_ANALYTICS_REPORTS = new Map([
  ["listWebAnalyticsEntities", "entities"],
  ["listWebAnalyticsStores", "stores"],
  ["listWebAnalyticsPaymentLinks", "payment-links"],
  ["getWebAnalyticsTraffic", "traffic"],
  ["getWebAnalyticsPages", "pages"],
  ["getWebAnalyticsSources", "sources"],
  ["getWebAnalyticsAudience", "audience"],
  ["getWebAnalyticsConversion", "conversion"],
  ["getWebAnalyticsJourney", "journey"],
  ["getWebAnalyticsEntityJourney", "entity-journey"],
  ["getWebAnalyticsEntityFunnel", "entity-funnel"],
  ["getWebAnalyticsSourceRevenue", "source-revenue"],
  ["getWebAnalyticsAdClicks", "ad-clicks"],
  ["getWebAnalyticsOrderFunnel", "order-funnel"],
  ["getWebAnalyticsEngagement", "engagement"]
]);

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

  // This existing operation changes discount eligibility; code, type and amount are immutable.
  // Match its complete operation identity so the exception cannot hide a financial action.
  const isDiscountEligibilityUpdate =
    endpoint.operationId === "updateDiscountCode" &&
    endpoint.method === "PATCH" &&
    endpoint.path === "/v3/discount-codes/{id}" &&
    Array.isArray(endpoint.scopes) &&
    endpoint.scopes.length === 1 &&
    endpoint.scopes[0] === "discount_code:update";

  // Reports can mention payments and revenue, but never initiate a financial action.
  // Verify the complete identity and scope instead of exempting a whole tag or path prefix.
  const isWebAnalyticsReport =
    WEB_ANALYTICS_REPORTS.has(endpoint.operationId) &&
    endpoint.method === "GET" &&
    endpoint.path === `/v3/web-analytics/${WEB_ANALYTICS_REPORTS.get(endpoint.operationId)}` &&
    Array.isArray(endpoint.scopes) &&
    endpoint.scopes.length === 1 &&
    endpoint.scopes[0] === "web_analytics:read";

  if (
    FINANCIAL_TEXT_PATTERN.test(searchableText) &&
    !FINANCIAL_TEXT_ALLOWLIST.has(endpoint.operationId) &&
    !isDiscountEligibilityUpdate &&
    !isWebAnalyticsReport
  ) {
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
