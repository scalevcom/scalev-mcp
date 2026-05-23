import type { Env } from "./types";

export const HSTS_HEADER = "max-age=31536000; includeSubDomains; preload";

export function applySecurityHeaders(headers: Headers): Headers {
  headers.set("strict-transport-security", HSTS_HEADER);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  return headers;
}

export function securityTxt(env: Env, now = new Date()): Response {
  const canonical = new URL("/.well-known/security.txt", env.MCP_RESOURCE_URI).toString();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    "Contact: https://scalev.com/contact-us",
    "Policy: https://scalev.com/privacy",
    "Preferred-Languages: en, id",
    `Canonical: ${canonical}`,
    `Expires: ${expires}`,
    ""
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400"
    }
  });
}
