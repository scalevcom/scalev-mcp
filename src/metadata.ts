import type { Env } from "./types";

export function protectedResourceMetadata(env: Env): Response {
  return json({
    resource: env.MCP_RESOURCE_URI,
    authorization_servers: [env.NEXUS_OAUTH_ISSUER],
    bearer_methods_supported: ["header"]
  });
}

export function unauthorized(env: Env): Response {
  return json(
    {
      error: "unauthorized",
      error_description: "Connect Scalev to ChatGPT before using this MCP server."
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${env.MCP_RESOURCE_URI.replace(
          /\/mcp$/,
          "/.well-known/oauth-protected-resource/mcp"
        )}"`
      }
    }
  );
}

function json(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}
