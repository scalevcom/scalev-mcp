import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const checker = fileURLToPath(new URL("../scripts/check-catalog-risk.mjs", import.meta.url));
const discountEligibilityUpdate = {
  operationId: "updateDiscountCode",
  method: "PATCH",
  path: "/v3/discount-codes/{id}",
  summary: "Update a discount code",
  description: "Update availability and payment-method eligibility. Code, type and amount are immutable.",
  tags: ["Discounts"],
  scopes: ["discount_code:update"]
};

function checkEndpoint(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "scalev-catalog-risk-"));
  try {
    mkdirSync(join(directory, "src/generated"), { recursive: true });
    writeFileSync(
      join(directory, "src/generated/v3Catalog.ts"),
      `export const V3_ENDPOINTS = ${JSON.stringify([{ ...discountEligibilityUpdate, ...overrides }], null, 2)} as const;\n`
    );
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: "utf8" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("catalog financial-risk exceptions", () => {
  it("allows the existing scoped discount eligibility update", () => {
    const result = checkEndpoint();
    expect(result.status, result.stderr).toBe(0);
  });

  const paymentLinkReport = {
    operationId: "listWebAnalyticsPaymentLinks",
    method: "GET",
    path: "/v3/web-analytics/payment-links",
    summary: "List payment links for analytics reports",
    tags: ["Web Analytics"],
    scopes: ["web_analytics:read"]
  };

  it("allows scoped read-only analytics reporting about payment links", () => {
    const result = checkEndpoint(paymentLinkReport);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    { label: "a write method", overrides: { method: "POST" } },
    { label: "an unknown operation", overrides: { operationId: "createWebAnalyticsPaymentLink" } },
    { label: "an unknown path", overrides: { path: "/v3/web-analytics/payment-links/create" } },
    { label: "missing scope", overrides: { scopes: [] } },
    { label: "an additional write scope", overrides: { scopes: ["web_analytics:read", "payment:create"] } },
    { label: "a dashboard self-traffic route", overrides: { path: "/v3/web-analytics/self-traffic" } },
    { label: "a browser collector route", overrides: { path: "/v3/public/e" } }
  ])("rejects a reporting exception with $label", ({ overrides }) => {
    const result = checkEndpoint({ ...paymentLinkReport, ...overrides });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/financial-risk text|exposes blocked path/);
  });

  it.each([
    { label: "another method", overrides: { method: "POST" } },
    { label: "another operation ID", overrides: { operationId: "createDiscountCode" } },
    { label: "no required scope", overrides: { scopes: [] } },
    { label: "a different scope", overrides: { scopes: ["refund:create"] } },
    { label: "an expanded financial scope", overrides: { scopes: ["discount_code:update", "refund:create"] } },
    { label: "a refund route spoofing the operation ID", overrides: { path: "/v3/refunds" } },
    { label: "a suffixed route spoofing the operation ID", overrides: { path: "/v3/discount-codes/{id}/refund" } },
    { label: "a blocked payment route spoofing the operation ID", overrides: { path: "/v3/orders/{id}/payment" } },
    { label: "a financial payment action", overrides: { operationId: "createPayment", method: "POST", path: "/v3/payments", scopes: ["payment:create"] } },
    { label: "a financial refund action", overrides: { operationId: "createRefund", method: "POST", path: "/v3/refunds", scopes: ["refund:create"] } }
  ])("rejects $label", ({ overrides }) => {
    const result = checkEndpoint(overrides);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/financial-risk text|exposes blocked path/);
  });
});

describe("catalog browser and dashboard boundaries", () => {
  it("excludes collector and self-traffic routes even if a source accidentally labels them business-authenticated", () => {
    const directory = mkdtempSync(join(tmpdir(), "scalev-catalog-boundaries-"));
    try {
      mkdirSync(join(directory, "scripts"), { recursive: true });
      const generator = fileURLToPath(new URL("../scripts/generate-v3-catalog.mjs", import.meta.url));
      // Keep dependency resolution in this checkout while placing generated output in the fixture.
      const yamlModule = fileURLToPath(import.meta.resolve("yaml"));
      writeFileSync(join(directory, "scripts/generate.mjs"),
        readFileSync(generator, "utf8").replace('from "yaml"', `from ${JSON.stringify(yamlModule)}`));
      const source = join(directory, "source.json");
      const forbidden = ["/v3/web-analytics/self-traffic", "/v3/public/e", "/v3/public/privacy/choice", "/v3/public/self-traffic"];
      writeFileSync(source, JSON.stringify({
        security: [{ scalevOAuth: ["business:read"] }],
        paths: Object.fromEntries([
          ["/v3/web-analytics/traffic", { get: { operationId: "getWebAnalyticsTraffic" } }],
          ["/v3/customer-privacy", { get: { operationId: "getCustomerPrivacySettings" } }],
          ...forbidden.map((path, index) => [path, { post: { operationId: `forbidden${index}` } }])
        ])
      }));
      const result = spawnSync(process.execPath, [join(directory, "scripts/generate.mjs")], {
        encoding: "utf8", env: { ...process.env, OPENAPI_PATH: source }
      });
      expect(result.status, result.stderr).toBe(0);
      const output = readFileSync(join(directory, "src/generated/v3Catalog.ts"), "utf8");
      expect(output).toContain('"operationId": "getWebAnalyticsTraffic"');
      expect(output).toContain('"operationId": "getCustomerPrivacySettings"');
      for (const path of forbidden) expect(output).not.toContain(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
