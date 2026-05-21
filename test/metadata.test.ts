import { afterEach, describe, expect, it, vi } from "vitest";
import { protectedResourceMetadata, resetMetadataCacheForTest, unauthorized } from "../src/metadata";
import type { Env } from "../src/types";

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("metadata", () => {
  afterEach(() => {
    resetMetadataCacheForTest();
    vi.unstubAllGlobals();
  });

  it("serves MCP protected resource metadata with Nexus-derived scopes", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ scopes_supported: ["page:read", "page:write"] }), {
        headers: { "content-type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await protectedResourceMetadata(env);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.scalev.test/v3/oauth/.well-known/oauth-authorization-server"
    );
    expect(payload).toMatchObject({
      resource: env.MCP_RESOURCE_URI,
      authorization_servers: [env.NEXUS_OAUTH_ISSUER],
      scopes_supported: ["page:read", "page:write"]
    });
    expect(JSON.stringify(payload)).not.toContain("/v2/");
  });

  it("caches Nexus scopes when serving protected resource metadata", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ scopes_supported: ["page:read"] }), {
        headers: { "content-type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await protectedResourceMetadata(env);
    await protectedResourceMetadata(env);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("points unauthorized clients at the protected resource metadata URL and safe scope challenge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(JSON.stringify({ scopes_supported: ["page:read", "page:write"] }), {
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await unauthorized(env);
    const header = response.headers.get("www-authenticate") || "";
    const payload = (await response.json()) as { error_description?: string };

    expect(response.status).toBe(401);
    expect(payload.error_description).toBe("Connect Scalev through your MCP client before using this MCP server.");
    expect(header).toContain("https://mcp.scalev.test/.well-known/oauth-protected-resource/mcp");
    expect(header).toContain('scope="page:read page:write"');
  });
});
