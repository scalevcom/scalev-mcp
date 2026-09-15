import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildGetRequest, searchEndpoints } from "../src/catalog";
import { V3_ENDPOINTS } from "../src/generated/v3Catalog";

const endpoint = V3_ENDPOINTS.find((entry) => entry.operationId === "getWebAnalyticsSourceRevenue");

function riskCheck(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "scalev-revenue-catalog-"));
  try {
    mkdirSync(join(directory, "src/generated"), { recursive: true });
    writeFileSync(join(directory, "src/generated/v3Catalog.ts"),
      `export const V3_ENDPOINTS = ${JSON.stringify([{ ...endpoint, ...overrides }], null, 2)} as const`);
    return spawnSync(process.execPath, [resolve("scripts/check-catalog-risk.mjs")], { cwd: directory, encoding: "utf8" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("linked analytics revenue catalog", () => {
  it("discovers a scoped reporting read and builds its cohort filters", () => {
    const search = searchEndpoints({ query: "linked paid", scope: "web_analytics:read", method: "GET" });
    expect(search.data.map((entry) => entry.operation_id)).toContain("getWebAnalyticsSourceRevenue");
    const result = buildGetRequest({ operation_id: "getWebAnalyticsSourceRevenue", query: {
      from: "2026-08-17", to: "2026-09-15", timezone: "Asia/Jakarta", entity_type: "landing_page", entity_id: "42", utm_type: "source"
    } });
    expect(result.endpoint.readOnly).toBe(true);
    expect(result.endpoint.scopes).toEqual(["web_analytics:read"]);
    expect(result.request.path).toContain("/v3/web-analytics/source-revenue?");
    expect(result.request.path).toContain("from=2026-08-17");
    expect(result.request.path).toContain("entity_id=42");
  });

  it("allows snapshot reporting language only for the exact read-only report", () => {
    expect(riskCheck().status).toBe(0);
    expect(riskCheck({ method: "POST", readOnly: false }).status).toBe(1);
    expect(riskCheck({ path: "/v3/orders/{id}/payment" }).status).toBe(1);
    expect(riskCheck({ operationId: "unreviewedFinancialReport" }).status).toBe(1);
  });
});
