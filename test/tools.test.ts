import { describe, expect, it } from "vitest";
import { normalizeBusinessSelectorInput } from "../src/businessSelector";
import { buildExecuteRequest, buildGetRequest, catalogEndpointCount, searchEndpoints } from "../src/catalog";
import { getDocs } from "../src/docs";
import { normalizeExecuteInput } from "../src/executeInput";
import { V3_ENDPOINTS } from "../src/generated/v3Catalog";
import { SCALEV_TOOL_NAMES } from "../src/toolNames";

describe("Scalev MCP tools", () => {
  it("exposes only the generic MCP tools", () => {
    expect([...SCALEV_TOOL_NAMES]).toEqual(["get_me", "get_docs", "search", "get", "execute"]);
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
    const createLandingPage = createPage.data.find((endpoint) => endpoint.operation_id === "createLandingPage");
    expect(createLandingPage?.execution_tool).toBe("execute");
    expect(createLandingPage?.docs_url).toBe("https://docs.scalev.com/en/landing-pages-api");
    expect(createLandingPage?.docs_topic).toBe("landing_pages_api");
    expect(createLandingPage?.docs_hint).toMatch(/Landing Pages API/);
  });

  it("reads bundled Scalev docs by topic or URL", () => {
    const byTopic = getDocs({ topic: "landing_pages_api" });
    expect(byTopic.data).toHaveLength(1);
    expect(byTopic.data[0].url).toBe("https://docs.scalev.com/en/landing-pages-api");
    expect(byTopic.data[0]).toMatchObject({
      language: "en",
      slug: "en/landing-pages-api",
      nav_group: "Landing pages",
      nav_path: ["Developers", "Landing pages"]
    });
    expect(byTopic.data[0].content).toContain("## HTML Mode display payload");
    expect(byTopic.catalog.docs_count).toBe(38);
    expect(byTopic.catalog.available_languages).toEqual(["en", "id"]);
    expect(byTopic.catalog.available_nav_groups).toContain("Storefront API");

    const byUrl = getDocs({ url: "https://docs.scalev.com/en/landing-pages-api/" });
    expect(byUrl.data[0].topic).toBe("landing_pages_api");

    const storefront = getDocs({ query: "introduction", language: "en", nav_group: "Storefront API", limit: 5 });
    expect(storefront.data.map((doc) => doc.topic)).toContain("storefront_api_introduction");
    expect(storefront.data.every((doc) => doc.language === "en" && doc.nav_group === "Storefront API")).toBe(true);

    const indonesianOauth = getDocs({ topic: "otorisasi_dengan_o_auth", language: "id" });
    expect(indonesianOauth.data[0].url).toBe("https://docs.scalev.com/id/otorisasi-dengan-o-auth");
  });

  it("keeps OAuth flow routes and storefront browser routes out of search", () => {
    const paths = V3_ENDPOINTS.map((endpoint) => endpoint.path);

    expect(paths).not.toContain("/v3/me");
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
      business_unique_id: "BIZ123",
      query: { page_size: 20 }
    });

    expect(endpoint.operationId).toBe("getLandingPage");
    expect(request.path).toBe("/v3/pages/123?page_size=20");
    expect(request.businessUniqueId).toBe("BIZ123");
  });

  it("recovers misplaced business selectors for get requests", () => {
    expect(
      buildGetRequest({
        operation_id: "listLandingPages",
        query: { business_unique_id: "BIZ123", page_size: 10 }
      }).request
    ).toEqual({
      method: "GET",
      path: "/v3/pages?page_size=10",
      businessUniqueId: "BIZ123"
    });

    expect(
      buildGetRequest({
        path: "/v3/pages?business_unique_id=BIZ123&page_size=20"
      }).request
    ).toEqual({
      method: "GET",
      path: "/v3/pages?page_size=20",
      businessUniqueId: "BIZ123"
    });

    expect(
      buildGetRequest({
        operation_id: "listLandingPages",
        query_params: { business_unique_id: "BIZ123", page_size: 30 },
        header_params: { business_unique_id: "BIZ123" }
      }).request
    ).toEqual({
      method: "GET",
      path: "/v3/pages?page_size=30",
      businessUniqueId: "BIZ123"
    });
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
        business_unique_id: "BIZ123",
        name: "MCP Test Bundle",
        public_name: "MCP Test Bundle"
      })
    ).toEqual({
      operation_id: "createBundle",
      path: undefined,
      business_unique_id: "BIZ123",
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

  it("recovers misplaced business selectors for execute requests", () => {
    expect(
      normalizeExecuteInput({
        operation_id: "createLandingPage",
        body: { business_unique_id: "BIZ123", name: "Launch", slug: "launch" }
      })
    ).toEqual({
      operation_id: "createLandingPage",
      path: undefined,
      business_unique_id: "BIZ123",
      path_params: undefined,
      query: undefined,
      body: { name: "Launch", slug: "launch" }
    });

    expect(
      normalizeExecuteInput({
        operation_id: "createLandingPage",
        body: "{\"business_unique_id\":\"BIZ123\",\"name\":\"Launch\"}"
      })
    ).toEqual({
      operation_id: "createLandingPage",
      path: undefined,
      business_unique_id: "BIZ123",
      path_params: undefined,
      query: undefined,
      body: { name: "Launch" }
    });

    expect(
      normalizeExecuteInput({
        operation_id: "createBundle",
        query_params: { business_unique_id: "BIZ123" },
        header_params: { business_unique_id: "BIZ123" },
        name: "MCP Test Bundle"
      })
    ).toEqual({
      operation_id: "createBundle",
      path: undefined,
      business_unique_id: "BIZ123",
      path_params: undefined,
      query: undefined,
      body: { name: "MCP Test Bundle" }
    });
  });

  it("rejects conflicting business selectors instead of guessing", () => {
    expect(() =>
      normalizeBusinessSelectorInput({
        operation_id: "listLandingPages",
        business_unique_id: "BIZ123",
        query: { business_unique_id: "BIZ456" }
      })
    ).toThrow(/Conflicting business_unique_id values/);
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
