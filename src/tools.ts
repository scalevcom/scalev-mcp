import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpAuthContext } from "agents/mcp";
import { z } from "zod";
import { buildExecuteRequest, searchEndpoints } from "./catalog";
import { nexusBusinessRequest } from "./nexusClient";
import { SCALEV_TOOL_NAMES } from "./toolNames";
import type { AuthContext, Env } from "./types";

export { SCALEV_TOOL_NAMES };

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const primitiveSchema = z.union([z.string(), z.number(), z.boolean()]);
const queryValueSchema = z.union([primitiveSchema, z.array(primitiveSchema), z.null()]);

export function createScalevMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "scalev-v3", version: "0.2.0" });

  server.registerTool(
    "get_me",
    {
      title: "Get Scalev identity",
      description: "Return the authenticated Scalev business, user, OAuth app, and effective scope context.",
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    async () => {
      const auth = currentAuth();
      const result = await nexusBusinessRequest(env, auth, { method: "GET", path: "/v3/me" });
      return toolResult(result);
    }
  );

  server.registerTool(
    "search",
    {
      title: "Search Scalev v3 endpoints",
      description:
        "Search business-authenticated Scalev /v3 endpoints available through this MCP server. Use this before execute to find the right operation_id, required path params, query params, request body, and scopes.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Free-text search across operation id, path, tags, summary, description, and scopes."),
        tag: z.string().optional().describe("Filter by OpenAPI tag, for example Orders or Landing Pages."),
        method: methodSchema.optional(),
        scope: z.string().optional().describe("Filter by required business scope, for example order:list."),
        read_only: z.boolean().optional().describe("Filter to GET endpoints when true, or write-capable endpoints when false."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum results to return. Defaults to 20.")
      },
      annotations: { readOnlyHint: true }
    },
    async (input) => {
      return toolResult(searchEndpoints(input));
    }
  );

  server.registerTool(
    "execute",
    {
      title: "Execute Scalev v3 request",
      description:
        "Execute a business-authenticated Scalev /v3 request selected from the search catalog. Prefer operation_id from search results. Nexus validates the bearer token, business access, scopes, and payload.",
      inputSchema: {
        operation_id: z
          .string()
          .optional()
          .describe("Preferred operation id from the search tool, for example listLandingPages."),
        method: methodSchema.optional().describe("HTTP method. Required only when operation_id is not supplied."),
        path: z
          .string()
          .optional()
          .describe("Catalog path template or concrete /v3 path. Required only when operation_id is not supplied."),
        path_params: z
          .record(z.string(), primitiveSchema)
          .optional()
          .describe("Path parameters for template paths, keyed by OpenAPI parameter name."),
        query: z
          .record(z.string(), queryValueSchema)
          .optional()
          .describe("Query parameters. Array values are sent as repeated query parameters. Null removes the parameter."),
        body: z.unknown().optional().describe("JSON request body for non-GET requests.")
      },
      annotations: { readOnlyHint: false }
    },
    async (input) => {
      const auth = currentAuth();
      const { endpoint, request } = buildExecuteRequest(input);
      const response = await nexusBusinessRequest(env, auth, request);

      return toolResult({
        operation_id: endpoint.operationId,
        method: request.method,
        path: request.path,
        response: response ?? null
      });
    }
  );

  return server;
}

function currentAuth(): AuthContext {
  const props = getMcpAuthContext()?.props as { auth?: AuthContext } | undefined;
  if (!props?.auth) throw new Error("Missing MCP auth context");
  return props.auth;
}

function toolResult(data: unknown) {
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
