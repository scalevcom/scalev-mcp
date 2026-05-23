import type { Env } from "./types";

export interface McpLogContext {
  requestId?: string;
  toolName?: string;
  operationId?: string;
  status: "ok" | "error";
  errorCode?: string;
}

export function sentryOptions(env: Env) {
  if (!env.SENTRY_DSN) return undefined;

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    sendDefaultPii: false,
    tracesSampleRate: 0
  };
}

export function logMcpEvent(env: Env, context: McpLogContext): void {
  const payload = compactLogContext(context);

  console.log(JSON.stringify({ event: "scalev_mcp_tool", ...payload }));
}

export async function captureMcpError(env: Env, context: Omit<McpLogContext, "status">): Promise<void> {
  if (!env.SENTRY_DSN) return;

  const payload = compactLogContext({ ...context, status: "error" });

  console.error(JSON.stringify({ event: "scalev_mcp_error", ...payload }));

  const { captureMessage } = await import("@sentry/cloudflare");

  captureMessage("Scalev MCP tool error", {
    level: "error",
    tags: sentryTags(payload),
    contexts: {
      scalev_mcp: payload
    }
  });
}

function sentryTags(payload: Record<string, string>): Record<string, string> {
  const tags: Record<string, string> = {};

  for (const key of ["status", "tool_name", "operation_id", "error_code"]) {
    if (payload[key]) tags[key] = payload[key];
  }

  return tags;
}

function compactLogContext(context: McpLogContext): Record<string, string> {
  const payload: Record<string, string> = {
    status: context.status
  };

  if (context.requestId) payload.request_id = context.requestId;
  if (context.toolName) payload.tool_name = context.toolName;
  if (context.operationId) payload.operation_id = context.operationId;
  if (context.errorCode) payload.error_code = context.errorCode;

  return payload;
}
