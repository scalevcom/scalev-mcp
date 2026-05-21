import { createMcpHandler } from "agents/mcp";
import { authenticate } from "./auth";
import { protectedResourceMetadata, unauthorized } from "./metadata";
import { createScalevMcpServer } from "./tools";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
      return await protectedResourceMetadata(env);
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const auth = await authenticate(request, env);
      const handler = createMcpHandler(createScalevMcpServer(env), {
        route: "/mcp",
        authContext: { props: { auth } }
      });

      return handler(request, env, ctx);
    } catch (_error) {
      return await unauthorized(env);
    }
  }
};
