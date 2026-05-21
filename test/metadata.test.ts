import { describe, expect, it } from "vitest";
import { protectedResourceMetadata, unauthorized } from "../src/metadata";
import type { Env } from "../src/types";

const env: Env = {
  NEXUS_API_BASE_URL: "https://api.scalev.test",
  NEXUS_OAUTH_ISSUER: "https://api.scalev.test/v3/oauth",
  MCP_RESOURCE_URI: "https://mcp.scalev.test/mcp"
};

describe("metadata", () => {
  it("serves MCP protected resource metadata with only v3 OAuth metadata", async () => {
    const response = protectedResourceMetadata(env);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      resource: env.MCP_RESOURCE_URI,
      authorization_servers: [env.NEXUS_OAUTH_ISSUER]
    });
    expect(payload).not.toHaveProperty("scopes_supported");
    expect(JSON.stringify(payload)).not.toContain("/v2/");
  });

  it("points unauthorized clients at the protected resource metadata URL", () => {
    const response = unauthorized(env);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "https://mcp.scalev.test/.well-known/oauth-protected-resource/mcp"
    );
  });
});
