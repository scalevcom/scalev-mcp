import type { AuthContext, Env } from "./types";

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function authenticate(request: Request, _env: Env): Promise<AuthContext> {
  const token = bearerToken(request);
  if (!token) throw new Error("missing_bearer_token");

  return { token };
}
