import { authenticate } from "./auth";
import { healthResponse } from "./health";
import { protectedResourceMetadata, unauthorized } from "./metadata";
import { validateRequestOrigin } from "./origin";
import { applySecurityHeaders, securityTxt } from "./security";
import type { Env } from "./types";

export const appHandler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();

    if (url.pathname === "/.well-known/security.txt") {
      return withRequestId(securityTxt(env), requestId);
    }

    if (url.pathname === "/health") {
      return withRequestId(healthResponse(env), requestId);
    }

    if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
      return withRequestId(await protectedResourceMetadata(env), requestId);
    }

    if (url.pathname !== "/mcp") {
      return withRequestId(new Response("Not Found", { status: 404 }), requestId);
    }

    const originError = validateRequestOrigin(request, env);
    if (originError) {
      return withRequestId(originError, requestId);
    }

    try {
      const auth = await authenticate(request, env);
      const { createMcpHandler } = await import("agents/mcp");
      const { createScalevMcpServer } = await import("./tools");
      const handler = createMcpHandler(createScalevMcpServer(env), {
        route: "/mcp",
        authContext: { props: { auth: { ...auth, requestId } } }
      });

      return withRequestId(await handler(request, env, ctx), requestId);
    } catch (_error) {
      return withRequestId(await unauthorized(env), requestId);
    }
  }
};

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  applySecurityHeaders(headers);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
