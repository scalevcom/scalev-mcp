import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpAuthContext } from "agents/mcp";
import { z } from "zod";
import { buildExecuteRequest, buildGetRequest, searchEndpoints } from "./catalog";
import { normalizeExecuteInput } from "./executeInput";
import { nexusBusinessRequest } from "./nexusClient";
import { SCALEV_TOOL_NAMES } from "./toolNames";
import type { AuthContext, Env } from "./types";

export { SCALEV_TOOL_NAMES };

const methodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const primitiveSchema = z.union([z.string(), z.number(), z.boolean()]);
const queryValueSchema = z.union([primitiveSchema, z.array(primitiveSchema), z.null()]);
const catalogOperationSchema = {
  operation_id: z
    .string()
    .optional()
    .describe("Preferred operation id returned by search, for example listLandingPages or createOrder."),
  path: z
    .string()
    .optional()
    .describe(
      "Catalog path template or concrete /v3 path. Required only when operation_id is not supplied. The path must match a catalog operation."
    ),
  path_params: z
    .record(z.string(), primitiveSchema)
    .optional()
    .describe(
      "Values for required path template parameters, keyed by OpenAPI parameter name. Example: {\"id\": 123, \"page_id\": 456}."
    ),
  query: z
    .record(z.string(), queryValueSchema)
    .optional()
    .describe(
      "Query parameters for the API call. Array values are sent as repeated query parameters. Null removes a parameter from a concrete path query string."
    )
};
const executeInputSchema = z
  .object({
    ...catalogOperationSchema,
    body: z
      .unknown()
      .optional()
      .describe("JSON request body for non-GET operations when the selected API endpoint accepts one.")
  })
  .catchall(z.unknown());

export function createScalevMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "scalev-v3", version: "0.2.0" });

  server.registerTool(
    "get_me",
    {
      title: "Get Scalev identity",
      description:
        "Use first when you need to know which Scalev business is connected. Returns the Nexus-authenticated business, user, OAuth application, authorized business record, auth method, and effective scopes for the current MCP OAuth token.",
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
        "Search the local catalog of business-authenticated Scalev API v3 operations. Use this before get or execute unless you already know the exact operation_id. This tool discovers API capabilities only; it does not read or change business records. Results include operation_id, method, execution_tool, path template, required path params, optional query params, request body summary, tags, scopes, and whether the operation is read-only.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Free-text search across operation id, /v3 path, OpenAPI tags, summary, description, and scopes. Examples: landing pages, list orders, waba account, page:create."
          ),
        tag: z
          .string()
          .optional()
          .describe("Filter by API area/tag from the catalog, for example Orders, Landing Pages, or Business Products."),
        method: methodSchema.optional().describe("Filter by HTTP method."),
        scope: z.string().optional().describe("Filter by required business scope, for example order:list or page:create."),
        read_only: z
          .boolean()
          .optional()
          .describe("Set true for read-only GET operations. Set false for operations that may create, update, or delete data."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum number of matching operations to return. Defaults to 20 and caps at 50.")
      },
      annotations: { readOnlyHint: true }
    },
    async (input) => {
      return toolResult(searchEndpoints(input));
    }
  );

  server.registerTool(
    "get",
    {
      title: "Get Scalev v3 resource",
      description:
        "Run one read-only GET operation from the business-authenticated Scalev API v3 search catalog. Use operation_id plus path_params/query from a search result, or a catalog-matching concrete /v3 path. This tool only runs GET operations, never accepts a request body, and forwards the user's OAuth bearer token unchanged to Nexus.",
      inputSchema: catalogOperationSchema,
      annotations: { readOnlyHint: true }
    },
    async (input) => {
      const auth = currentAuth();
      const { endpoint, request } = buildGetRequest(input);
      const response = await nexusBusinessRequest(env, auth, request);

      return toolResult({
        operation_id: endpoint.operationId,
        method: request.method,
        path: request.path,
        response: response ?? null
      });
    }
  );

  server.registerTool(
    "execute",
    {
      title: "Execute Scalev v3 request",
      description:
        "Run one non-GET operation from the business-authenticated Scalev API v3 search catalog. Use this for create, update, delete, validation, and other action endpoints after confirming the user's intent. Prefer operation_id plus path_params/query/body from a search result. If body is omitted, extra top-level fields are treated as the JSON request body. This tool cannot run GET operations. Nexus validates the OAuth bearer token, business access, scopes, request payload, and endpoint authorization.",
      inputSchema: executeInputSchema,
      annotations: { readOnlyHint: false }
    },
    async (input) => {
      const auth = currentAuth();
      const { endpoint, request } = buildExecuteRequest(normalizeExecuteInput(input));
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
