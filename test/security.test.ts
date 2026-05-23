import { describe, expect, it } from "vitest";
import { appHandler } from "../src/app";
import { healthResponse } from "../src/health";
import { applySecurityHeaders, HSTS_HEADER, securityTxt } from "../src/security";
import type { Env } from "../src/types";

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("security", () => {
  it("renders MCP security.txt", async () => {
    const response = securityTxt(env, new Date("2026-05-22T00:00:00.000Z"));
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(body).toContain("Contact: https://scalev.com/contact-us");
    expect(body).toContain("Policy: https://scalev.com/privacy");
    expect(body).toContain("Preferred-Languages: en, id");
    expect(body).toContain("Canonical: https://mcp.scalev.test/.well-known/security.txt");
    expect(body).toContain("Expires: 2027-05-22T00:00:00.000Z");
  });

  it("applies common security headers", () => {
    const headers = applySecurityHeaders(new Headers());

    expect(headers.get("strict-transport-security")).toBe(HSTS_HEADER);
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
  });

  it("renders a public connector health response without secrets", async () => {
    const response = healthResponse(
      { ...env, SENTRY_DSN: "https://public@example.invalid/1" },
      new Date("2026-05-22T00:00:00.000Z")
    );
    const body = await response.json();

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      service: "scalev-claude-connector",
      status: "ok",
      version: "0.3.0",
      transport: "streamable_http",
      mcp_url: "https://mcp.scalev.test/mcp",
      protected_resource_metadata_url: "https://mcp.scalev.test/.well-known/oauth-protected-resource/mcp",
      oauth_issuer: "https://api.scalev.test/v3/oauth",
      scalev_api_base_url: "https://api.scalev.test",
      security_txt_url: "https://mcp.scalev.test/.well-known/security.txt",
      sentry_configured: true,
      checked_at: "2026-05-22T00:00:00.000Z"
    });

    expect(JSON.stringify(body)).not.toContain("https://public@example.invalid/1");
  });

  it("serves /health through the Worker with security headers", async () => {
    const response = await appHandler.fetch!(
      new Request("https://mcp.scalev.test/health"),
      env,
      {} as ExecutionContext
    );
    const body = (await response.json()) as { status?: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(response.headers.get("strict-transport-security")).toBe(HSTS_HEADER);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("serves unauthenticated MCP challenges for missing and allowed Origins", async () => {
    const missingOriginResponse = await appHandler.fetch!(
      new Request("https://mcp.scalev.test/mcp"),
      env,
      {} as ExecutionContext
    );
    const allowedClaudeOriginResponse = await appHandler.fetch!(
      new Request("https://mcp.scalev.test/mcp", {
        headers: { Origin: "https://claude.ai" }
      }),
      env,
      {} as ExecutionContext
    );
    const allowedOpenAiOriginResponse = await appHandler.fetch!(
      new Request("https://mcp.scalev.test/mcp", {
        headers: { Origin: "https://chatgpt.com" }
      }),
      env,
      {} as ExecutionContext
    );

    for (const response of [missingOriginResponse, allowedClaudeOriginResponse, allowedOpenAiOriginResponse]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toContain(
        'resource_metadata="https://mcp.scalev.test/.well-known/oauth-protected-resource/mcp"'
      );
      expect(response.headers.get("strict-transport-security")).toBe(HSTS_HEADER);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-request-id")).toBeTruthy();
    }
  });

  it("rejects disallowed browser Origins before MCP authentication", async () => {
    const response = await appHandler.fetch!(
      new Request("https://mcp.scalev.test/mcp", {
        headers: { Origin: "https://example.invalid" }
      }),
      env,
      {} as ExecutionContext
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ error: "forbidden_origin" });
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(response.headers.get("strict-transport-security")).toBe(HSTS_HEADER);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });
});
