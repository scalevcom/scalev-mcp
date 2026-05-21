import { describe, expect, it } from "vitest";
import { buildExecuteRequest, buildGetRequest, catalogEndpointCount, searchEndpoints } from "../src/catalog";
import { normalizeExecuteInput } from "../src/executeInput";
import { V3_ENDPOINTS } from "../src/generated/v3Catalog";
import { SCALEV_TOOL_NAMES } from "../src/toolNames";

describe("Scalev MCP tools", () => {
  it("exposes only the four generic tools", () => {
    expect([...SCALEV_TOOL_NAMES]).toEqual(["get_me", "search", "get", "execute"]);
  });

  it("generates a broad business-authenticated v3 endpoint catalog", () => {
    expect(catalogEndpointCount()).toBeGreaterThan(200);
  });

  it("searches business v3 endpoints by keyword, tag, method, and scope", () => {
    const pages = searchEndpoints({ query: "landing page", method: "GET", limit: 5 });
    expect(pages.data.map((endpoint) => endpoint.operation_id)).toContain("listLandingPages");
    expect(pages.data.find((endpoint) => endpoint.operation_id === "listLandingPages")?.execution_tool).toBe("get");

    const orders = searchEndpoints({ tag: "Orders", method: "GET", scope: "order:list", limit: 10 });
    expect(orders.data.some((endpoint) => endpoint.path_template.startsWith("/v3/orders"))).toBe(true);

    const waba = searchEndpoints({ query: "waba account", scope: "waba_account:read", limit: 10 });
    expect(waba.data.some((endpoint) => endpoint.scopes.includes("waba_account:read"))).toBe(true);

    const createPage = searchEndpoints({ query: "create landing page", method: "POST", limit: 10 });
    expect(createPage.data.find((endpoint) => endpoint.operation_id === "createLandingPage")?.execution_tool).toBe(
      "execute"
    );
  });

  it("keeps OAuth flow routes and storefront browser routes out of search", () => {
    const paths = V3_ENDPOINTS.map((endpoint) => endpoint.path);

    expect(paths).not.toContain("/v3/oauth/authorize");
    expect(paths).not.toContain("/v3/oauth/token");
    expect(paths).not.toContain("/v3/oauth/register");
    expect(paths).not.toContain("/v3/stores/{store_id}/public/items");
    expect(paths).not.toContain("/v3/stores/{store_id}/customers/me");
  });

  it("builds get requests from operation_id", () => {
    const { endpoint, request } = buildGetRequest({
      operation_id: "getLandingPage",
      path_params: { id: 123 },
      query: { include: ["current_page_display", "store"], preview: true }
    });

    expect(endpoint.operationId).toBe("getLandingPage");
    expect(request).toEqual({
      method: "GET",
      path: "/v3/pages/123?include=current_page_display&include=store&preview=true"
    });
  });

  it("builds get requests from catalog-matching concrete paths", () => {
    const { endpoint, request } = buildGetRequest({
      path: "/v3/pages/123?page_size=10",
      query: { page_size: 20 }
    });

    expect(endpoint.operationId).toBe("getLandingPage");
    expect(request.path).toBe("/v3/pages/123?page_size=20");
  });

  it("validates required query parameters from the catalog", () => {
    expect(() => buildGetRequest({ operation_id: "listOrdersByPgReferenceIds" })).toThrow(
      /Missing required query parameter.*pg_reference_ids/
    );

    const { request } = buildGetRequest({
      operation_id: "listOrdersByPgReferenceIds",
      query: { pg_reference_ids: ["pg_1", "pg_2"] }
    });

    expect(request.path).toBe("/v3/orders/pg-reference-ids?pg_reference_ids=pg_1&pg_reference_ids=pg_2");
  });

  it("builds execute requests for non-GET operations", () => {
    const { endpoint, request } = buildExecuteRequest({
      operation_id: "createLandingPage",
      body: { name: "Launch", slug: "launch", page_display: { type: "html_mode" } }
    });

    expect(endpoint.operationId).toBe("createLandingPage");
    expect(request).toEqual({
      method: "POST",
      path: "/v3/pages",
      body: { name: "Launch", slug: "launch", page_display: { type: "html_mode" } }
    });
  });

  it("treats extra execute fields as the request body when body is omitted", () => {
    expect(
      normalizeExecuteInput({
        operation_id: "createBundle",
        name: "MCP Test Bundle",
        public_name: "MCP Test Bundle"
      })
    ).toEqual({
      operation_id: "createBundle",
      path: undefined,
      path_params: undefined,
      query: undefined,
      body: { name: "MCP Test Bundle", public_name: "MCP Test Bundle" }
    });
  });

  it("parses JSON-string execute bodies when clients serialize the body field", () => {
    expect(
      normalizeExecuteInput({
        operation_id: "createBundle",
        body: "{\"name\":\"MCP Test Bundle\",\"public_name\":\"MCP Test Bundle\"}"
      })
    ).toEqual({
      operation_id: "createBundle",
      body: { name: "MCP Test Bundle", public_name: "MCP Test Bundle" }
    });
  });

  it("rejects unknown, malformed, or unsafe catalog requests", () => {
    expect(() => buildExecuteRequest({ operation_id: "missingOperation" })).toThrow(/Unknown v3 operation_id/);

    expect(() => buildGetRequest({ operation_id: "getLandingPage" })).toThrow(/Missing required path parameter/);

    expect(() => buildGetRequest({ operation_id: "createLandingPage" })).toThrow(/get cannot run POST/);

    expect(() => buildExecuteRequest({ operation_id: "getLandingPage", path_params: { id: 123 } })).toThrow(
      /execute cannot run GET/
    );

    expect(() =>
      buildGetRequest({
        operation_id: "getLandingPage",
        path_params: { id: 123 },
        body: { not: "allowed" }
      })
    ).toThrow(/get does not accept a request body/);

    expect(() =>
      buildGetRequest({
        path: "/v3/oauth/authorize"
      })
    ).toThrow(/No get-compatible business-authenticated v3 catalog operation/);

    expect(() =>
      buildGetRequest({
        path: "/v3/stores/store_123/public/items"
      })
    ).toThrow(/No get-compatible business-authenticated v3 catalog operation/);

    expect(() => buildExecuteRequest({ path: "/v3/pages/123" })).toThrow(/Ambiguous execute path/);
  });
});
