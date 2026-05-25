import type { Env } from "./types";

export function healthResponse(env: Env, now = new Date()): Response {
  const mcpUrl = new URL(env.MCP_RESOURCE_URI);
  const securityTxtUrl = new URL("/.well-known/security.txt", mcpUrl.origin).toString();
  const protectedResourceMetadataUrl = new URL(
    "/.well-known/oauth-protected-resource/mcp",
    mcpUrl.origin
  ).toString();

  return new Response(
    JSON.stringify(
      {
        service: "scalev-claude-connector",
        status: "ok",
        version: "0.3.4",
        transport: "streamable_http",
        mcp_url: env.MCP_RESOURCE_URI,
        protected_resource_metadata_url: protectedResourceMetadataUrl,
        oauth_issuer: env.NEXUS_OAUTH_ISSUER,
        scalev_api_base_url: env.NEXUS_API_BASE_URL,
        security_txt_url: securityTxtUrl,
        security_policy_url: "https://scalev.com/security",
        source_repository_url: "https://github.com/scalevcom/scalev-mcp",
        sentry_configured: Boolean(env.SENTRY_DSN),
        checked_at: now.toISOString()
      },
      null,
      2
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
