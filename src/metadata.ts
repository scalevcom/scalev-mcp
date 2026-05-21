import type { Env } from "./types";

const METADATA_CACHE_MS = 5 * 60 * 1000;
const MAX_WWW_AUTHENTICATE_LENGTH = 7_000;

const scopesCache = new Map<string, { expiresAt: number; scopes: string[] }>();

export async function protectedResourceMetadata(env: Env): Promise<Response> {
  const scopes = await nexusScopesSupported(env);
  const payload: Record<string, unknown> = {
    resource: env.MCP_RESOURCE_URI,
    authorization_servers: [env.NEXUS_OAUTH_ISSUER],
    bearer_methods_supported: ["header"]
  };

  if (scopes.length > 0) {
    payload.scopes_supported = scopes;
  }

  return json(payload);
}

export async function unauthorized(env: Env): Promise<Response> {
  const scopes = await nexusScopesSupported(env).catch(() => []);
  const metadataUrl = protectedResourceMetadataUrl(env);
  const challenge = bearerChallenge(metadataUrl, scopes);

  return json(
    {
      error: "unauthorized",
      error_description: "Connect Scalev through your MCP client before using this MCP server."
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": challenge
      }
    }
  );
}

export function resetMetadataCacheForTest(): void {
  scopesCache.clear();
}

async function nexusScopesSupported(env: Env): Promise<string[]> {
  const metadataUrl = oauthAuthorizationServerMetadataUrl(env);
  const cached = scopesCache.get(metadataUrl);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.scopes;
  }

  const response = await fetch(metadataUrl, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    scopesCache.set(metadataUrl, { expiresAt: now + METADATA_CACHE_MS, scopes: [] });
    return [];
  }

  const payload = (await response.json().catch(() => undefined)) as { scopes_supported?: unknown } | undefined;
  const scopes = Array.isArray(payload?.scopes_supported)
    ? payload.scopes_supported.filter((scope): scope is string => typeof scope === "string" && scope.length > 0)
    : [];

  scopesCache.set(metadataUrl, { expiresAt: now + METADATA_CACHE_MS, scopes });
  return scopes;
}

function oauthAuthorizationServerMetadataUrl(env: Env): string {
  return `${env.NEXUS_OAUTH_ISSUER.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`;
}

function protectedResourceMetadataUrl(env: Env): string {
  return env.MCP_RESOURCE_URI.replace(/\/mcp$/, "/.well-known/oauth-protected-resource/mcp");
}

function bearerChallenge(metadataUrl: string, scopes: string[]): string {
  const base = `Bearer resource_metadata="${escapeHeaderValue(metadataUrl)}"`;

  if (scopes.length === 0) {
    return base;
  }

  const scoped = `${base}, scope="${escapeHeaderValue(scopes.join(" "))}"`;
  return scoped.length <= MAX_WWW_AUTHENTICATE_LENGTH ? scoped : base;
}

function escapeHeaderValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
