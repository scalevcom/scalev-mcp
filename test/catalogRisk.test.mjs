import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
