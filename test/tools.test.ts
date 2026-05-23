import { describe, expect, it, vi } from "vitest";
import { normalizeBusinessSelectorInput } from "../src/businessSelector";
import {
  buildExecuteDestructiveRequest,
  buildExecuteSafeRequest,
  buildGetRequest,
  catalogEndpointCount,
  searchEndpoints
} from "../src/catalog";
import { getDocs } from "../src/docs";
import { normalizeExecuteInput } from "../src/executeInput";
import { V3_ENDPOINTS } from "../src/generated/v3Catalog";
import { createScalevMcpServer } from "../src/tools";
import { SCALEV_TOOL_NAMES } from "../src/toolNames";
import type { Env } from "../src/types";

vi.mock("agents/mcp", () => ({
  getMcpAuthContext: () => ({ props: { auth: { token: "test-token", requestId: "req_test" } } })
}));

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("Scalev MCP tools", () => {
  it("exposes only the generic MCP tools", () => {
    expect([...SCALEV_TOOL_NAMES]).toEqual([
      "get_me",
      "get_docs",
      "search",
      "get",
      "execute_safe",
      "execute_destructive",
      "list_landing_pages",
      "get_landing_page",
      "create_landing_page",
      "update_landing_page",
      "delete_landing_page",
      "list_orders",
      "get_order",
      "create_order",
      "update_order",
      "change_order_status",
      "cancel_order_awb"
    ]);
  });

  it("registers every public tool with complete connector annotations", () => {
    const server = createScalevMcpServer(env);
    const registeredTools = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            title?: string;
            annotations?: {
              title?: string;
              readOnlyHint?: boolean;
              destructiveHint?: boolean;
              idempotentHint?: boolean;
              openWorldHint?: boolean;
            };
          }
        >;
      }
    )._registeredTools;
    const registeredToolEntries = Object.entries(registeredTools);
    const registeredToolNames = registeredToolEntries.map(([name]) => name);

    expect(registeredToolNames).toEqual([...SCALEV_TOOL_NAMES]);

    for (const [name, tool] of registeredToolEntries) {
      expect(tool.title, name).toBeTruthy();
      expect(tool.annotations?.title, name).toBe(tool.title);
      expect(typeof tool.annotations?.readOnlyHint, name).toBe("boolean");
      expect(typeof tool.annotations?.destructiveHint, name).toBe("boolean");
      expect(typeof tool.annotations?.idempotentHint, name).toBe("boolean");
      expect(typeof tool.annotations?.openWorldHint, name).toBe("boolean");
    }

    expect(registeredTools.execute_safe?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    });
    expect(registeredTools.execute_destructive?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    });
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
    expect(createLandingPage?.execution_tool).toBe("execute_safe");
    expect(createLandingPage?.is_destructive).toBe(false);
    expect(createLandingPage?.docs_url).toBe("https://docs.scalev.com/en/landing-pages-api");
    expect(createLandingPage?.docs_topic).toBe("landing_pages_api");
    expect(createLandingPage?.docs_hint).toMatch(/Landing Pages API/);

    const cancelAwb = searchEndpoints({ query: "cancel awb", method: "POST", limit: 10 });
    const cancelOrderAwb = cancelAwb.data.find((endpoint) => endpoint.operation_id === "cancelOrderAwb");
    expect(cancelOrderAwb?.execution_tool).toBe("execute_destructive");
    expect(cancelOrderAwb?.is_destructive).toBe(true);
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
    expect(paths).not.toContain("/v3/oauth/scopes");
    expect(paths).not.toContain("/v3/oauth/applications/me");
    expect(paths).not.toContain("/v3/me/connected_businesses");
    expect(paths).not.toContain("/v3/stores/{store_id}/public/items");
    expect(paths).not.toContain("/v3/stores/{store_id}/customers/me");
  });

  it("keeps OAuth billing and developer payout routes out of search", () => {
    const paths = V3_ENDPOINTS.map((endpoint) => endpoint.path);

    expect(paths.some((path) => path.startsWith("/v3/oauth/billing/"))).toBe(false);
    expect(paths.some((path) => path.startsWith("/v3/developer/oauth-billing/"))).toBe(false);
  });

  it("keeps direct payment routes out of search", () => {
    const paths = V3_ENDPOINTS.map((endpoint) => endpoint.path);

    expect(paths).not.toContain("/v3/orders/{id}/check-payment");
    expect(paths).not.toContain("/v3/orders/{id}/check-settlement");
    expect(paths).not.toContain("/v3/orders/{id}/payment");
    expect(paths).not.toContain("/v3/orders/pg-reference-id/{pg_reference_id}");
    expect(paths).not.toContain("/v3/orders/pg-reference-ids");
    expect(paths).not.toContain("/v3/stores/{store_id}/payment-accounts");
    expect(paths).not.toContain("/v3/stores/{store_id}/payment-methods");
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
    expect(() =>
      buildGetRequest({
        operation_id: "searchBusinessStoreProductKnowledge",
        path_params: { store_id: "store_123" }
      })
    ).toThrow(
      /Missing required query parameter.*search/
    );

    const { request } = buildGetRequest({
      operation_id: "searchBusinessStoreProductKnowledge",
      path_params: { store_id: "store_123" },
      query: { search: "bundle" }
    });

    expect(request.path).toBe("/v3/stores/store_123/product-knowledge?search=bundle");
  });

  it("builds execute requests for non-GET operations", () => {
    const { endpoint, request } = buildExecuteSafeRequest({
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

  it("keeps safe and destructive execute builders separated", () => {
    expect(() =>
      buildExecuteSafeRequest({
        operation_id: "deleteLandingPage",
        path_params: { id: 123 }
      })
    ).toThrow(/use execute_destructive/);

    expect(() =>
      buildExecuteDestructiveRequest({
        operation_id: "createLandingPage",
        body: { name: "Launch", slug: "launch" }
      })
    ).toThrow(/use execute_safe/);

    const { endpoint, request } = buildExecuteDestructiveRequest({
      operation_id: "deleteLandingPage",
      path_params: { id: 123 }
    });

    expect(endpoint.operationId).toBe("deleteLandingPage");
    expect(request).toEqual({
      method: "DELETE",
      path: "/v3/pages/123",
      body: undefined
    });
  });

  it("builds every semantic landing-page and order operation request", () => {
    expect(
      buildGetRequest({
        operation_id: "listLandingPages",
        business_unique_id: "BIZ123",
        query: { page_size: 10 }
      }).request
    ).toEqual({ method: "GET", path: "/v3/pages?page_size=10", businessUniqueId: "BIZ123" });

    expect(buildGetRequest({ operation_id: "getLandingPage", path_params: { id: 123 } }).request).toMatchObject({
      method: "GET",
      path: "/v3/pages/123"
    });

    expect(buildExecuteSafeRequest({ operation_id: "createLandingPage", body: { name: "Launch" } }).request).toEqual({
      method: "POST",
      path: "/v3/pages",
      body: { name: "Launch" }
    });

    expect(
      buildExecuteSafeRequest({ operation_id: "updateLandingPage", path_params: { id: 123 }, body: { name: "New" } })
        .request
    ).toEqual({ method: "PATCH", path: "/v3/pages/123", body: { name: "New" } });

    expect(buildExecuteDestructiveRequest({ operation_id: "deleteLandingPage", path_params: { id: 123 } }).request)
      .toMatchObject({ method: "DELETE", path: "/v3/pages/123" });

    expect(buildGetRequest({ operation_id: "listOrders", query: { status: "pending" } }).request).toEqual({
      method: "GET",
      path: "/v3/orders?status=pending"
    });

    expect(buildGetRequest({ operation_id: "getOrder", path_params: { id: 456 } }).request).toMatchObject({
      method: "GET",
      path: "/v3/orders/456"
    });

    expect(buildExecuteSafeRequest({ operation_id: "createOrder", body: { customer_name: "Reviewer" } }).request)
      .toMatchObject({ method: "POST", path: "/v3/orders", body: { customer_name: "Reviewer" } });

    expect(
      buildExecuteSafeRequest({ operation_id: "updateOrder", path_params: { id: 456 }, body: { notes: "Reviewed" } })
        .request
    ).toMatchObject({ method: "PATCH", path: "/v3/orders/456", body: { notes: "Reviewed" } });

    expect(buildExecuteSafeRequest({ operation_id: "changeOrderStatus", body: { ids: [456], status: "confirmed" } }).request)
      .toMatchObject({ method: "POST", path: "/v3/orders/change-status" });

    expect(buildExecuteDestructiveRequest({ operation_id: "cancelOrderAwb", body: { ids: [456] } }).request)
      .toMatchObject({ method: "POST", path: "/v3/orders/cancel-awb" });
  });

  it("runs every registered semantic tool through the intended Nexus request", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" }
      });
    });
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    try {
      const server = createScalevMcpServer(env);
      const registeredTools = (
        server as unknown as {
          _registeredTools: Record<
            string,
            {
              handler: (input: Record<string, unknown>) => Promise<unknown>;
            }
          >;
        }
      )._registeredTools;

      const cases = [
        {
          tool: "list_landing_pages",
          input: { business_unique_id: "BIZ123", page_size: 10, query: { status: "draft" } },
          method: "GET",
          url: "https://api.scalev.test/v3/pages?status=draft&page_size=10&b_uid=BIZ123"
        },
        {
          tool: "get_landing_page",
          input: { business_unique_id: "BIZ123", id: 123, include: "current_page_display", preview: true },
          method: "GET",
          url: "https://api.scalev.test/v3/pages/123?include=current_page_display&preview=true&b_uid=BIZ123"
        },
        {
          tool: "create_landing_page",
          input: { business_unique_id: "BIZ123", body: { name: "Review", is_published: true } },
          method: "POST",
          url: "https://api.scalev.test/v3/pages?b_uid=BIZ123",
          body: { name: "Review", is_published: true }
        },
        {
          tool: "update_landing_page",
          input: { business_unique_id: "BIZ123", id: 123, body: { is_published: false } },
          method: "PATCH",
          url: "https://api.scalev.test/v3/pages/123?b_uid=BIZ123",
          body: { is_published: false }
        },
        {
          tool: "delete_landing_page",
          input: { business_unique_id: "BIZ123", id: 123 },
          method: "DELETE",
          url: "https://api.scalev.test/v3/pages/123?b_uid=BIZ123"
        },
        {
          tool: "list_orders",
          input: { business_unique_id: "BIZ123", page_size: 10, status: "pending", payment_status: "paid" },
          method: "GET",
          url: "https://api.scalev.test/v3/orders?page_size=10&status=pending&payment_status=paid&b_uid=BIZ123"
        },
        {
          tool: "get_order",
          input: { business_unique_id: "BIZ123", id: 456 },
          method: "GET",
          url: "https://api.scalev.test/v3/orders/456?b_uid=BIZ123"
        },
        {
          tool: "create_order",
          input: { business_unique_id: "BIZ123", body: { customer_name: "Reviewer" } },
          method: "POST",
          url: "https://api.scalev.test/v3/orders?b_uid=BIZ123",
          body: { customer_name: "Reviewer" }
        },
        {
          tool: "update_order",
          input: { business_unique_id: "BIZ123", id: 456, body: { notes: "Reviewed" } },
          method: "PATCH",
          url: "https://api.scalev.test/v3/orders/456?b_uid=BIZ123",
          body: { notes: "Reviewed" }
        },
        {
          tool: "change_order_status",
          input: { business_unique_id: "BIZ123", body: { ids: [456], status: "confirmed" } },
          method: "POST",
          url: "https://api.scalev.test/v3/orders/change-status?b_uid=BIZ123",
          body: { ids: [456], status: "confirmed" }
        },
        {
          tool: "cancel_order_awb",
          input: { business_unique_id: "BIZ123", body: { ids: [456] } },
          method: "POST",
          url: "https://api.scalev.test/v3/orders/cancel-awb?b_uid=BIZ123",
          body: { ids: [456] }
        }
      ];

      for (const testCase of cases) {
        fetchMock.mockClear();

        const result = (await registeredTools[testCase.tool].handler(testCase.input)) as {
          structuredContent?: {
            operation_id?: string;
            method?: string;
            response?: unknown;
          };
        };
        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
        const headers = requestInit?.headers as Record<string, string> | undefined;

        expect(fetchMock, testCase.tool).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0]), testCase.tool).toBe(testCase.url);
        expect(requestInit?.method, testCase.tool).toBe(testCase.method);
        expect(headers?.authorization, testCase.tool).toBe("Bearer test-token");

        if (testCase.body) {
          expect(headers?.["content-type"], testCase.tool).toBe("application/json");
          expect(requestInit?.body, testCase.tool).toBe(JSON.stringify(testCase.body));
        } else {
          expect(headers?.["content-type"], testCase.tool).toBeUndefined();
          expect(requestInit?.body, testCase.tool).toBeUndefined();
        }

        expect(result.structuredContent?.method, testCase.tool).toBe(testCase.method);
        expect(result.structuredContent?.response, testCase.tool).toEqual({ ok: true });
      }
    } finally {
      consoleLog.mockRestore();
    }
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
    expect(() => buildExecuteSafeRequest({ operation_id: "missingOperation" })).toThrow(/Unknown v3 operation_id/);

    expect(() => buildGetRequest({ operation_id: "getLandingPage" })).toThrow(/Missing required path parameter/);

    expect(() => buildGetRequest({ operation_id: "createLandingPage" })).toThrow(/get cannot run POST/);

    expect(() => buildExecuteSafeRequest({ operation_id: "getLandingPage", path_params: { id: 123 } })).toThrow(
      /execute_safe cannot run GET/
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

    expect(() => buildExecuteSafeRequest({ path: "/v3/pages/123" })).toThrow(/Ambiguous execute_safe path/);
  });
});
