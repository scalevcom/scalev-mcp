import { afterEach, describe, expect, it, vi } from "vitest";
import { nexusBusinessRequest, nexusBusinessUrl, nexusUrl } from "../src/nexusClient";
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
      message: "Nexus request failed with 400 (request_id: req_test): empty response body"
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
        "Nexus business_selection_required (request_id: req_selection): business_unique_id is required when this OAuth token is connected to multiple businesses"
    });
  });

  it("blocks OAuth flow and storefront client paths from execute transport", () => {
    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/oauth/authorize")
    ).toThrow(/OAuth flow/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/oauth/token")
    ).toThrow(/OAuth flow/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/stores/store_123/public/items")
    ).toThrow(/Storefront public/);

    expect(() =>
      nexusBusinessUrl({ NEXUS_API_BASE_URL: "https://api.scalev.test" }, "/v3/stores/store_123/customers/me")
    ).toThrow(/Storefront public/);
  });
});
