import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildExecuteDestructiveRequest, buildExecuteSafeRequest, buildGetRequest, searchEndpoints } from "./catalog";
import { getDocs } from "./docs";
import { normalizeExecuteInput } from "./executeInput";
import { nexusBusinessRequest } from "./nexusClient";
import { registerSemanticTools } from "./semanticTools";
import { toolAnnotations } from "./toolAnnotations";
import { SCALEV_TOOL_NAMES } from "./toolNames";
import { currentAuth, runLoggedTool, toolResult } from "./toolRuntime";
import type { Env } from "./types";

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
  business_unique_id: z
    .string()
    .optional()
    .describe(
      "Canonical top-level business selector for this get/execute tool call. Copy one value from get_me.connected_businesses[].unique_id. Required when get_me returns more than one connected business. Preferred example: {\"business_unique_id\":\"ABC123\"}. For robustness, the connector also recovers this exact key if a client accidentally places it under body, query, query_params, header_params, headers, or the concrete path query string."
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
  const server = new McpServer({ name: "scalev-v3", version: "0.3.0" });

  server.registerTool(
    "get_me",
    {
      title: "Get Scalev identity",
      description:
        "Returns token-level Nexus identity for the current MCP OAuth token: authenticated user, OAuth application, auth method, and connected_businesses. For tokens with more than one connected business, business-scoped tools require the chosen connected_businesses[].unique_id as the top-level business_unique_id argument.",
      inputSchema: {},
      annotations: toolAnnotations("Get Scalev identity", "nexus_read")
    },
    async () => {
      const auth = currentAuth();
      return runLoggedTool(env, auth, { toolName: "get_me", operationId: "getAuthenticatedIdentity" }, async () => {
        const result = await nexusBusinessRequest(env, auth, { method: "GET", path: "/v3/me" });
        return toolResult(result);
      });
    }
  );

  server.registerTool(
    "get_docs",
    {
      title: "Read Scalev docs",
      description:
        "Reads Scalev Developers documentation bundled into MCP from the docs repo navigation. Relevant for request payload fields and write action details when search returns docs_topic/docs_url/docs_hint. Topics are generated from Developers-tab slugs, for example landing_pages_api, storefront_api_introduction, oauth_authorization, and scalev_mcp_connector.",
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe("Preferred docs topic. Use search result docs_topic when present, for example landing_pages_api."),
        url: z
          .string()
          .optional()
          .describe("Public docs URL from search result docs_url. Used when topic is not supplied."),
        language: z.string().optional().describe("Optional docs language filter, for example en or id."),
        nav_group: z
          .string()
          .optional()
          .describe("Optional Developers navigation group filter, for example Storefront API, Webhooks, or Landing pages."),
        query: z.string().optional().describe("Optional docs search query, for example landing pages html mode."),
        limit: z.number().int().min(1).max(20).optional().describe("Maximum docs to return for query/list mode.")
      },
      annotations: toolAnnotations("Read Scalev docs", "local_read")
    },
    async (input) => {
      const auth = currentAuth();
      return runLoggedTool(env, auth, { toolName: "get_docs" }, async () => toolResult(getDocs(input)));
    }
  );

  server.registerTool(
    "search",
    {
      title: "Search Scalev v3 endpoints",
      description:
        "Searches the local catalog of business-authenticated Scalev API v3 operations for use with get, execute_safe, or execute_destructive. This tool discovers API capabilities only; it does not read or change business records. Results include operation_id, method, execution_tool, path template, required path params, optional query params, request body summary, tags, scopes, whether the operation is read-only, and whether it is destructive. Results can include docs_topic, docs_url, and docs_hint for related get_docs lookups.",
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
      annotations: toolAnnotations("Search Scalev v3 endpoints", "local_read")
    },
    async (input) => {
      const auth = currentAuth();
      return runLoggedTool(env, auth, { toolName: "search" }, async () => toolResult(searchEndpoints(input)));
    }
  );

  server.registerTool(
    "get",
    {
      title: "Get Scalev v3 resource",
      description:
        "Runs one read-only GET operation from the business-authenticated Scalev API v3 search catalog. For tokens with more than one get_me.connected_businesses entry, the chosen connected_businesses[].unique_id must be included as the top-level business_unique_id argument. Top-level business_unique_id is canonical: {\"operation_id\":\"listOrders\",\"business_unique_id\":\"ABC123\",\"query\":{\"page_size\":10}}. If a client accidentally puts the exact business_unique_id key in query, query_params, header_params, headers, body, or the concrete path query string, Scalev MCP recovers it, strips it from the API payload/query, and forwards it to Nexus as b_uid. Accepts operation_id plus path_params/query from a search result, or a catalog-matching concrete /v3 path. Search results may include docs_topic/docs_url for related get_docs lookups. This tool only runs GET operations, never accepts a request body, and forwards the user's OAuth bearer token unchanged to Nexus.",
      inputSchema: catalogOperationSchema,
      annotations: toolAnnotations("Get Scalev v3 resource", "nexus_read")
    },
    async (input) => {
      const auth = currentAuth();
      const operationId = requestedOperationId(input);

      return runLoggedTool(env, auth, { toolName: "get", operationId }, async () => {
        const { endpoint, request } = buildGetRequest(input);
        const response = await nexusBusinessRequest(env, auth, request);

        return toolResult({
          operation_id: endpoint.operationId,
          method: request.method,
          path: request.path,
          response: response ?? null
        });
      });
    }
  );

  server.registerTool(
    "execute_safe",
    {
      title: "Execute non-destructive Scalev v3 action",
      description:
        "Runs one non-destructive non-GET operation from the business-authenticated Scalev API v3 search catalog, such as create, update, validation, or status-changing actions whose search result execution_tool is execute_safe. This is a write/API action, not a read-only tool. For tokens with more than one get_me.connected_businesses entry, the chosen connected_businesses[].unique_id must be included as the top-level business_unique_id argument. Top-level business_unique_id is canonical: {\"operation_id\":\"createLandingPage\",\"business_unique_id\":\"ABC123\",\"body\":{...}}. If a client accidentally puts the exact business_unique_id key in body, query, query_params, header_params, headers, or the concrete path query string, Scalev MCP recovers it, strips it from the API payload/query, and forwards it to Nexus as b_uid. Accepts operation_id plus path_params/query/body from a search result. Search results may include docs_topic/docs_url for related get_docs lookups. If body is omitted, extra top-level fields are treated as the JSON request body. This tool cannot run GET operations or destructive operations. Nexus validates the OAuth bearer token, business access, scopes, request payload, and endpoint authorization.",
      inputSchema: executeInputSchema,
      annotations: toolAnnotations("Execute non-destructive Scalev v3 action", "safe_write")
    },
    async (input) => {
      const auth = currentAuth();
      const operationId = requestedOperationId(input);

      return runLoggedTool(env, auth, { toolName: "execute_safe", operationId }, async () => {
        const { endpoint, request } = buildExecuteSafeRequest(normalizeExecuteInput(input));
        const response = await nexusBusinessRequest(env, auth, request);

        return toolResult({
          operation_id: endpoint.operationId,
          method: request.method,
          path: request.path,
          response: response ?? null
        });
      });
    }
  );

  server.registerTool(
    "execute_destructive",
    {
      title: "Execute destructive Scalev v3 action",
      description:
        "Runs one destructive non-GET operation from the business-authenticated Scalev API v3 search catalog when the search result execution_tool is execute_destructive. Destructive operations include delete, cancel, revoke, remove, and disconnect actions. For tokens with more than one get_me.connected_businesses entry, the chosen connected_businesses[].unique_id must be included as the top-level business_unique_id argument. Top-level business_unique_id is canonical: {\"operation_id\":\"deleteLandingPage\",\"business_unique_id\":\"ABC123\",\"path_params\":{\"id\":123}}. If a client accidentally puts the exact business_unique_id key in body, query, query_params, header_params, headers, or the concrete path query string, Scalev MCP recovers it, strips it from the API payload/query, and forwards it to Nexus as b_uid. Accepts operation_id plus path_params/query/body from a search result. Search results may include docs_topic/docs_url for related get_docs lookups. If body is omitted, extra top-level fields are treated as the JSON request body. This tool cannot run GET operations or non-destructive write actions. Nexus validates the OAuth bearer token, business access, scopes, request payload, and endpoint authorization.",
      inputSchema: executeInputSchema,
      annotations: toolAnnotations("Execute destructive Scalev v3 action", "destructive_write")
    },
    async (input) => {
      const auth = currentAuth();
      const operationId = requestedOperationId(input);

      return runLoggedTool(env, auth, { toolName: "execute_destructive", operationId }, async () => {
        const { endpoint, request } = buildExecuteDestructiveRequest(normalizeExecuteInput(input));
        const response = await nexusBusinessRequest(env, auth, request);

        return toolResult({
          operation_id: endpoint.operationId,
          method: request.method,
          path: request.path,
          response: response ?? null
        });
      });
    }
  );

  registerSemanticTools(server, env);

  return server;
}

function requestedOperationId(input: { operation_id?: unknown }): string | undefined {
  return typeof input.operation_id === "string" ? input.operation_id : undefined;
}
