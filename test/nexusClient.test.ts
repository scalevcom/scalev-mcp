import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusError, nexusBusinessRequest, nexusBusinessUrl, nexusUrl } from "../src/nexusClient";
import type { Env } from "../src/types";

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("nexusUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds /v3 Nexus URLs", () => {
    const url = nexusUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/pages");

    expect(url.href).toBe("https://api.scalev.test/v3/pages");
  });

  it("rejects non-/v3 paths", () => {
    expect(() =>
      nexusUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v2/oauth/introspect")
    ).toThrow(/must use \/v3/);
  });

  it("rejects base URLs that smuggle /v2", () => {
    expect(() =>
      nexusUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test/v2" }, "/v3/oauth/introspect")
    ).toThrow(/never use \/v2/);
  });

  it("forwards the OAuth bearer token to normal business-authenticated v3 endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { "content-type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await nexusBusinessRequest(
      env,
      { token: "raw-oauth-token" },
      {
        method: "GET",
        path: "/v3/pages?limit=10"
      }
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.scalev.test/v3/pages?limit=10");
    expect(headers).toMatchObject({
      authorization: "Bearer raw-oauth-token"
    });
    expect(JSON.stringify(headers)).not.toContain("x-scalev-mcp-internal-token");
    expect(JSON.stringify(headers)).not.toContain("x-scalev-business-id");
    expect(JSON.stringify(headers)).not.toContain("x-scalev-user-id");
  });

  it("forwards business_unique_id to Nexus as b_uid without adding business headers", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { "content-type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await nexusBusinessRequest(
      env,
      { token: "raw-oauth-token" },
      {
        method: "GET",
        path: "/v3/pages?limit=10",
        businessUniqueId: "BIZ123"
      }
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.scalev.test/v3/pages?limit=10&b_uid=BIZ123");
    expect(headers).toMatchObject({
      authorization: "Bearer raw-oauth-token"
    });
    expect(JSON.stringify(headers)).not.toContain("x-scalev-business-id");
  });

  it("forwards JSON bodies for non-GET business-authenticated v3 endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ id: 1 }), {
        headers: { "content-type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await nexusBusinessRequest(
      env,
      { token: "raw-oauth-token" },
      {
        method: "POST",
        path: "/v3/bundles",
        body: { name: "MCP Test Bundle", public_name: "MCP Test Bundle" }
      }
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.scalev.test/v3/bundles");
    expect(headers).toMatchObject({
      authorization: "Bearer raw-oauth-token",
      "content-type": "application/json"
    });
    expect(init.body).toBe(JSON.stringify({ name: "MCP Test Bundle", public_name: "MCP Test Bundle" }));
  });

  it("surfaces Nexus request errors with request ids without exposing raw bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: "validation_failed",
            error: {
              customer_email: "buyer@example.com",
              customer_phone: "628123456789",
              order_number: "ORD-SECRET-123"
            }
          }),
          {
            status: 422,
            headers: { "content-type": "application/json", "x-request-id": "req_test" }
          }
        );
      })
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "POST", path: "/v3/bundles", body: {} })
    ).rejects.toMatchObject({
      status: 422,
      message:
        "Scalev API rejected the request validation_failed (request_id: req_test): check operation_id, path_params, query, and body against search metadata and get_docs before retrying."
    });

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "POST", path: "/v3/bundles", body: {} })
    ).rejects.not.toThrow(/buyer@example\.com|628123456789|ORD-SECRET-123/);
  });

  it("surfaces sanitized Nexus validation details when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: "validation_failed",
            errors: {
              base: [
                "This order update includes fields that require full order validation and recalculation: product_discount."
              ],
              customer_email: ["has invalid format buyer@example.com"]
            }
          }),
          {
            status: 422,
            headers: { "content-type": "application/json", "x-request-id": "req_validation" }
          }
        );
      })
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "PATCH", path: "/v3/orders/123", body: {} })
    ).rejects.toMatchObject({
      status: 422,
      message:
        "Scalev API rejected the request validation_failed (request_id: req_validation): Validation failed. base: This order update includes fields that require full order validation and recalculation: product_discount.; customer_email: has invalid format [email]."
    });

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "PATCH", path: "/v3/orders/123", body: {} })
    ).rejects.not.toThrow(/buyer@example\.com/);
  });

  it("does not attach raw Nexus payloads to thrown error objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: "validation_failed",
            error: {
              customer_email: "buyer@example.com",
              customer_phone: "628123456789",
              order_number: "ORD-SECRET-123"
            }
          }),
          {
            status: 422,
            headers: { "content-type": "application/json", "x-request-id": "req_test" }
          }
        );
      })
    );

    let thrown: unknown;

    try {
      await nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "POST", path: "/v3/bundles", body: {} });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(NexusError);
    expect(thrown).toMatchObject({
      status: 422,
      errorCode: "validation_failed"
    });
    expect(Object.keys(thrown as object)).not.toContain("payload");
    expect(JSON.stringify(thrown)).not.toContain("buyer@example.com");
    expect(JSON.stringify(thrown)).not.toContain("628123456789");
    expect(JSON.stringify(thrown)).not.toContain("ORD-SECRET-123");
  });

  it("surfaces empty Nexus error responses with request ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("", {
          status: 400,
          headers: { "x-request-id": "req_test" }
        });
      })
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "POST", path: "/v3/bundles", body: {} })
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Scalev API rejected the request (request_id: req_test): check operation_id, path_params, query, and body against search metadata and get_docs before retrying."
    });
  });

  it("surfaces Nexus business selection errors clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: "business_selection_required",
            error: "business_unique_id is required when this OAuth token is connected to multiple businesses"
          }),
          {
            status: 400,
            headers: { "content-type": "application/json", "x-request-id": "req_selection" }
          }
        );
      })
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "GET", path: "/v3/pages" })
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Scalev API business_selection_required (request_id: req_selection): choose one business from get_me.connected_businesses and pass its unique_id as top-level business_unique_id."
    });
  });

  it("maps common Nexus authorization and rate limit failures to Claude-friendly messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: "insufficient_scope",
            error: "Order 123 for buyer@example.com requires order:update"
          }),
          {
            status: 403,
            headers: { "content-type": "application/json", "x-request-id": "req_forbidden" }
          }
        );
      })
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "PATCH", path: "/v3/orders/123", body: {} })
    ).rejects.toThrow(
      "Scalev API authorization failed insufficient_scope (request_id: req_forbidden): the OAuth token, selected business, or approved scopes do not allow this action. Use get_me to inspect connected businesses and scopes, then reconnect if a scope is missing."
    );

    await expect(
      nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "PATCH", path: "/v3/orders/123", body: {} })
    ).rejects.not.toThrow(/buyer@example\.com|Order 123/);
  });

  it.each([
    {
      status: 401,
      errorCode: "invalid_token",
      expected:
        "Scalev API authentication failed invalid_token (request_id: req_status): the OAuth token is missing, expired, revoked, or not accepted for this connector. Reconnect Scalev in Claude and retry."
    },
    {
      status: 404,
      errorCode: "not_found",
      expected:
        "Scalev API resource not found not_found (request_id: req_status): the requested Scalev resource does not exist or is not visible to the selected business."
    },
    {
      status: 409,
      errorCode: "state_conflict",
      expected:
        "Scalev API state conflict state_conflict (request_id: req_status): refresh the resource, confirm the latest state, and retry only if the requested change still applies."
    },
    {
      status: 429,
      errorCode: "rate_limited",
      expected:
        "Scalev API rate limit reached rate_limited (request_id: req_status): wait before retrying this Scalev action."
    },
    {
      status: 500,
      errorCode: "server_error",
      expected:
        "Scalev API service error server_error (request_id: req_status): Scalev could not complete the request. Retry later or contact Scalev support with the request_id."
    }
  ])("maps Nexus $status responses without exposing raw payload data", async ({ status, errorCode, expected }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: errorCode,
            error: "Order ORD-SECRET-123 for buyer@example.com failed",
            customer_phone: "628123456789"
          }),
          {
            status,
            headers: { "content-type": "application/json", "x-request-id": "req_status" }
          }
        );
      })
    );

    let thrown: unknown;

    try {
      await nexusBusinessRequest(env, { token: "raw-oauth-token" }, { method: "GET", path: "/v3/orders/123" });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(NexusError);
    expect(thrown).toMatchObject({ status, errorCode, message: expected });
    expect((thrown as Error).message).not.toMatch(/buyer@example\.com|628123456789|ORD-SECRET-123/);
    expect(JSON.stringify(thrown)).not.toMatch(/buyer@example\.com|628123456789|ORD-SECRET-123/);
  });

  it.each([
    ["business_not_found", 404],
    ["business_access_denied", 403]
  ])("maps %s to the business selector guidance without raw payload data", async (errorCode, status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error_code: errorCode,
            error: "Business Store Secret for buyer@example.com is not accessible"
          }),
          {
            status,
            headers: { "content-type": "application/json", "x-request-id": "req_business" }
          }
        );
      })
    );

    let thrown: unknown;

    try {
      await nexusBusinessRequest(
        env,
        { token: "raw-oauth-token" },
        { method: "GET", path: "/v3/orders", businessUniqueId: "BIZ123" }
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(NexusError);
    expect(thrown).toMatchObject({
      status,
      errorCode,
      message:
        `Scalev API ${errorCode} (request_id: req_business): the selected business_unique_id is not connected to this OAuth token or is no longer active.`
    });
    expect((thrown as Error).message).not.toMatch(/buyer@example\.com|Store Secret/);
    expect(JSON.stringify(thrown)).not.toMatch(/buyer@example\.com|Store Secret/);
  });

  it("blocks OAuth flow and storefront client paths from execute transport", () => {
    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/oauth/authorize")
    ).toThrow(/OAuth flow/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/oauth/token")
    ).toThrow(/OAuth flow/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/oauth/billing/refunds")
    ).toThrow(/OAuth billing/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/developer/oauth-billing/withdrawals")
    ).toThrow(/OAuth billing/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/orders/123/payment")
    ).toThrow(/payment routes/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/orders/123/check-settlement")
    ).toThrow(/payment routes/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/orders/pg-reference-id/pg_123")
    ).toThrow(/payment routes/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/stores/store_123/payment-accounts")
    ).toThrow(/payment routes/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/stores/store_123/public/items")
    ).toThrow(/Storefront public/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/stores/store_123/customers/me")
    ).toThrow(/Storefront public/);
  });
});
