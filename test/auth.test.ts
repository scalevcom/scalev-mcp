import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate, bearerToken } from "../src/auth";
import type { Env } from "../src/types";

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("auth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts bearer tokens", () => {
    const request = new Request("https://mcp.scalev.test/mcp", {
      headers: { authorization: "Bearer token-value" }
    });

    expect(bearerToken(request)).toBe("token-value");
  });

  it("accepts present bearer tokens without introspection", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://mcp.scalev.test/mcp", {
      headers: {
        authorization: "Bearer access-token"
      }
    });

    const auth = await authenticate(request, env);

    expect(auth).toEqual({ token: "access-token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing bearer tokens", async () => {
    const request = new Request("https://mcp.scalev.test/mcp", {
      headers: {}
    });

    await expect(authenticate(request, env)).rejects.toThrow("missing_bearer_token");
  });
});
