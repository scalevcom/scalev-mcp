import type { Env } from "./types";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://claude.ai",
  "https://www.claude.ai",
  "https://claude.com",
  "https://www.claude.com",
  "https://console.anthropic.com",
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:6274",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:6274",
  "https://mcp.scalev.test"
]);

export function validateRequestOrigin(request: Request, env: Env): Response | undefined {
  const origin = request.headers.get("origin");
  if (!origin) return undefined;

  if (allowedOrigins(env).has(normalizeOrigin(origin))) return undefined;

  return new Response(
    JSON.stringify({
      error: "forbidden_origin",
      error_description: "This MCP endpoint does not accept browser requests from the supplied Origin."
    }),
    {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" }
    }
  );
}

function allowedOrigins(env: Env): Set<string> {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS);

  for (const origin of (env.ALLOWED_ORIGINS || "").split(",")) {
    const normalized = normalizeOrigin(origin);
    if (normalized) origins.add(normalized);
  }

  return origins;
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}
