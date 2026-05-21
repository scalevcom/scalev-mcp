import { describe, expect, it } from "vitest";
import { buildExecuteRequest, catalogEndpointCount, searchEndpoints } from "../src/catalog";
import { V3_ENDPOINTS } from "../src/generated/v3Catalog";
import { SCALEV_TOOL_NAMES } from "../src/toolNames";

describe("Scalev MCP tools", () => {
  it("exposes only the three generic tools", () => {
    expect([...SCALEV_TOOL_NAMES]).toEqual(["get_me", "search", "execute"]);
  });

  it("generates a broad business-authenticated v3 endpoint catalog", () => {
    expect(catalogEndpointCount()).toBeGreaterThan(200);
  });

  it("searches business v3 endpoints by keyword, tag, method, and scope", () => {
    const pages = searchEndpoints({ query: "landing page", method: "GET", limit: 5 });
    expect(pages.data.map((endpoint) => endpoint.operation_id)).toContain("listLandingPages");

    const orders = searchEndpoints({ tag: "Orders", method: "GET", scope: "order:list", limit: 10 });
    expect(orders.data.some((endpoint) => endpoint.path_template.startsWith("/v3/orders"))).toBe(true);

    const waba = searchEndpoints({ query: "waba account", scope: "waba_account:read", limit: 10 });
    expect(waba.data.some((endpoint) => endpoint.scopes.includes("waba_account:read"))).toBe(true);
  });

  it("keeps OAuth flow routes and storefront browser routes out of search", () => {
    const paths = V3_ENDPOINTS.map((endpoint) => endpoint.path);

    expect(paths).not.toContain("/v3/oauth/authorize");
    expect(paths).not.toContain("/v3/oauth/token");
    expect(paths).not.toContain("/v3/oauth/register");
    expect(paths).not.toContain("/v3/stores/{store_id}/public/items");
    expect(paths).not.toContain("/v3/stores/{store_id}/customers/me");
  });

  it("builds execute requests from operation_id", () => {
    const { endpoint, request } = buildExecuteRequest({
      operation_id: "getLandingPage",
      path_params: { id: 123 },
      query: { include: ["current_page_display", "store"], preview: true }
    });

    expect(endpoint.operationId).toBe("getLandingPage");
    expect(request).toEqual({
      method: "GET",
      path: "/v3/pages/123?include=current_page_display&include=store&preview=true",
      body: undefined
    });
  });

  it("builds execute requests from catalog-matching concrete paths", () => {
    const { endpoint, request } = buildExecuteRequest({
      method: "GET",
      path: "/v3/pages/123?page_size=10",
      query: { page_size: 20 }
    });

    expect(endpoint.operationId).toBe("getLandingPage");
    expect(request.path).toBe("/v3/pages/123?page_size=20");
  });

  it("rejects unknown, malformed, or unsafe execute requests", () => {
    expect(() => buildExecuteRequest({ operation_id: "missingOperation" })).toThrow(/Unknown v3 operation_id/);

    expect(() => buildExecuteRequest({ operation_id: "getLandingPage" })).toThrow(/Missing required path parameter/);

    expect(() =>
      buildExecuteRequest({
        operation_id: "getLandingPage",
        path_params: { id: 123 },
        body: { not: "allowed" }
      })
    ).toThrow(/GET requests must not include a body/);

    expect(() =>
      buildExecuteRequest({
        method: "GET",
        path: "/v3/oauth/authorize"
      })
    ).toThrow(/No business-authenticated v3 catalog operation/);

    expect(() =>
      buildExecuteRequest({
        method: "GET",
        path: "/v3/stores/store_123/public/items"
      })
    ).toThrow(/No business-authenticated v3 catalog operation/);
  });
});
