import { getMcpAuthContext } from "agents/mcp";
import { captureMcpError, logMcpEvent } from "./logger";
import { nexusErrorCode } from "./nexusClient";
import type { AuthContext, Env } from "./types";

export interface ToolLogContext {
  toolName: string;
  operationId?: string;
}

export function currentAuth(): AuthContext {
  const props = getMcpAuthContext()?.props as { auth?: AuthContext } | undefined;
  if (!props?.auth) throw new Error("Missing MCP auth context");
  return props.auth;
}

export async function runLoggedTool<T>(
  env: Env,
  auth: AuthContext | undefined,
  context: ToolLogContext,
  callback: () => Promise<T> | T
): Promise<T> {
  try {
    const result = await callback();

    logMcpEvent(env, {
      requestId: auth?.requestId,
      toolName: context.toolName,
      operationId: context.operationId,
      status: "ok"
    });

    return result;
  } catch (error) {
    const errorCode = nexusErrorCode(error);

    logMcpEvent(env, {
      requestId: auth?.requestId,
      toolName: context.toolName,
      operationId: context.operationId,
      status: "error",
      errorCode
    });

    await captureMcpError(env, {
      requestId: auth?.requestId,
      toolName: context.toolName,
      operationId: context.operationId,
      errorCode
    });

    throw error;
  }
}

export function toolResult(data: unknown) {
  const normalizedData = typeof data === "undefined" ? null : data;
  const structuredContent =
    normalizedData && typeof normalizedData === "object" && !Array.isArray(normalizedData)
      ? (normalizedData as Record<string, unknown>)
      : { data: normalizedData };

  return {
    structuredContent,
    content: [{ type: "text" as const, text: JSON.stringify(normalizedData, null, 2) }]
  };
}
