import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate, bearerToken } from "../src/auth";
import { validateRequestOrigin } from "../src/origin";
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

  it("allows missing Origin and known Claude and OpenAI origins", () => {
    expect(validateRequestOrigin(new Request("https://mcp.scalev.test/mcp"), env)).toBeUndefined();

    expect(
      validateRequestOrigin(
        new Request("https://mcp.scalev.test/mcp", {
          headers: { origin: "https://claude.ai" }
        }),
        env
      )
    ).toBeUndefined();

    expect(
      validateRequestOrigin(
        new Request("https://mcp.scalev.test/mcp", {
          headers: { origin: "https://claude.com" }
        }),
        env
      )
    ).toBeUndefined();

    expect(
      validateRequestOrigin(
        new Request("https://mcp.scalev.test/mcp", {
          headers: { origin: "https://chatgpt.com" }
        }),
        env
      )
    ).toBeUndefined();

    expect(
      validateRequestOrigin(
        new Request("https://mcp.scalev.test/mcp", {
          headers: { origin: "https://platform.openai.com" }
        }),
        env
      )
    ).toBeUndefined();
  });

  it("rejects unexpected browser origins unless configured", async () => {
    const rejected = validateRequestOrigin(
      new Request("https://mcp.scalev.test/mcp", {
        headers: { origin: "https://evil.example" }
      }),
      env
    );

    expect(rejected?.status).toBe(403);
    await expect(rejected?.json()).resolves.toMatchObject({ error: "forbidden_origin" });

    expect(
      validateRequestOrigin(
        new Request("https://mcp.scalev.test/mcp", {
          headers: { origin: "https://partner.example/" }
        }),
        { ...env, ALLOWED_ORIGINS: "https://partner.example" }
      )
    ).toBeUndefined();
  });
});
