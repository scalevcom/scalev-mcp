import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildExecuteDestructiveRequest,
  buildExecuteSafeRequest,
  buildGetRequest,
  type CatalogQueryValue
} from "./catalog";
import { nexusBusinessRequest } from "./nexusClient";
import { toolAnnotations } from "./toolAnnotations";
import { currentAuth, runLoggedTool, toolResult } from "./toolRuntime";
import type { Env } from "./types";

const primitiveSchema = z.union([z.string(), z.number(), z.boolean()]);
const queryValueSchema = z.union([primitiveSchema, z.array(primitiveSchema), z.null()]);
const querySchema = z.record(z.string(), queryValueSchema);
const bodySchema = z.record(z.string(), z.unknown());

const businessUniqueIdSchema = z
  .string()
  .optional()
  .describe(
    "Top-level business selector. Copy one value from get_me.connected_businesses[].unique_id when the OAuth token is connected to more than one business."
  );

const paginationSchema = {
  page_size: z.number().int().min(1).max(25).optional().describe("Number of records to return. Nexus caps this at 25."),
  next_cursor: z.string().optional().describe("Cursor for the next page."),
  previous_cursor: z.string().optional().describe("Cursor for the previous page.")
};

export function registerSemanticTools(server: McpServer, env: Env): void {
  server.registerTool(
    "list_landing_pages",
    {
      title: "List landing pages",
      description:
        "Lists business landing pages from Scalev API v3. Returns Builder and HTML Mode pages visible to the selected business. For tokens connected to multiple businesses, business_unique_id selects the business.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        ...paginationSchema,
        query: querySchema.optional().describe("Additional documented query parameters for listLandingPages.")
      },
      annotations: toolAnnotations("List landing pages", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "list_landing_pages", "listLandingPages", () =>
        buildGetRequest({
          operation_id: "listLandingPages",
          business_unique_id: input.business_unique_id,
          query: queryWith(input.query, {
            page_size: input.page_size,
            next_cursor: input.next_cursor,
            previous_cursor: input.previous_cursor
          })
        })
      )
  );

  server.registerTool(
    "get_landing_page",
    {
      title: "Get landing page",
      description:
        "Gets one business landing page from Scalev API v3, including the current published display when one is selected. The landing_pages_api docs topic describes display fields.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: z.union([z.string(), z.number()]).describe("Landing page id."),
        include: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe("Optional include values supported by getLandingPage."),
        preview: z.boolean().optional().describe("Optional preview flag."),
        query: querySchema.optional().describe("Additional documented query parameters for getLandingPage.")
      },
      annotations: toolAnnotations("Get landing page", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "get_landing_page", "getLandingPage", () =>
        buildGetRequest({
          operation_id: "getLandingPage",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id },
          query: queryWith(input.query, { include: input.include, preview: input.preview })
        })
      )
  );

  server.registerTool(
    "create_landing_page",
    {
      title: "Create landing page",
      description:
        "Creates a business landing page using the Scalev API v3 createLandingPage body. The landing_pages_api docs topic describes HTML Mode payload fields. To publish a nested page_display in one call, include is_published: true; without it, the display is saved as an unpublished draft.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        body: bodySchema.describe("LandingPageCreateRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Create landing page", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "create_landing_page", "createLandingPage", () =>
        buildExecuteSafeRequest({
          operation_id: "createLandingPage",
          business_unique_id: input.business_unique_id,
          body: input.body
        })
      )
  );

  server.registerTool(
    "update_landing_page",
    {
      title: "Update landing page",
      description:
        "Update landing page metadata or publishing state using the Scalev API v3 updateLandingPage body. Send is_published: true with current_page_display_id to publish a display, or is_published: false with current_page_display_id: null to unpublish.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: z.union([z.string(), z.number()]).describe("Landing page id."),
        body: bodySchema.describe("LandingPageUpdateRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Update landing page", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "update_landing_page", "updateLandingPage", () =>
        buildExecuteSafeRequest({
          operation_id: "updateLandingPage",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id },
          body: input.body
        })
      )
  );

  server.registerTool(
    "delete_landing_page",
    {
      title: "Delete landing page",
      description:
        "Soft-delete one business landing page using Scalev API v3 deleteLandingPage. This removes the page from the business landing page list.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: z.union([z.string(), z.number()]).describe("Landing page id.")
      },
      annotations: toolAnnotations("Delete landing page", "destructive_write")
    },
    async (input) =>
      runCatalogTool(env, "delete_landing_page", "deleteLandingPage", () =>
        buildExecuteDestructiveRequest({
          operation_id: "deleteLandingPage",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id }
        })
      )
  );

  server.registerTool(
    "list_orders",
    {
      title: "List orders",
      description:
        "Lists business orders from Scalev API v3 with cursor pagination and optional filters for order review, search, and status-specific summaries.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        ...paginationSchema,
        search: z.string().optional().describe("Optional order search term."),
        search_field: z.string().optional().describe("Optional documented listOrders search_field."),
        status: z.string().optional().describe("Optional order status filter."),
        payment_status: z.string().optional().describe("Optional payment status filter."),
        query: querySchema.optional().describe("Additional documented query parameters for listOrders.")
      },
      annotations: toolAnnotations("List orders", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "list_orders", "listOrders", () =>
        buildGetRequest({
          operation_id: "listOrders",
          business_unique_id: input.business_unique_id,
          query: queryWith(input.query, {
            page_size: input.page_size,
            next_cursor: input.next_cursor,
            previous_cursor: input.previous_cursor,
            search: input.search,
            search_field: input.search_field,
            status: input.status,
            payment_status: input.payment_status
          })
        })
      )
  );

  server.registerTool(
    "get_order",
    {
      title: "Get order",
      description:
        "Gets one business order from Scalev API v3. Order ids can come from list_orders results when the user refers to an order by customer, status, or other search criteria.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: z.union([z.string(), z.number()]).describe("Order id.")
      },
      annotations: toolAnnotations("Get order", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "get_order", "getOrder", () =>
        buildGetRequest({
          operation_id: "getOrder",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id }
        })
      )
  );

  server.registerTool(
    "create_order",
    {
      title: "Create order",
      description:
        "Creates a business order using the Scalev API v3 createOrder body. Search results and get_docs provide request-body metadata for this endpoint.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        body: bodySchema.describe("CreateOrderRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Create order", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "create_order", "createOrder", () =>
        buildExecuteSafeRequest({
          operation_id: "createOrder",
          business_unique_id: input.business_unique_id,
          body: input.body
        })
      )
  );

  server.registerTool(
    "update_order",
    {
      title: "Update order",
      description:
        "Updates one business order using the Scalev API v3 updateOrder body. This is for ordinary order edits, not destructive AWB cancellation.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: z.union([z.string(), z.number()]).describe("Order id."),
        body: bodySchema.describe("UpdateOrderRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Update order", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "update_order", "updateOrder", () =>
        buildExecuteSafeRequest({
          operation_id: "updateOrder",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id },
          body: input.body
        })
      )
  );

  server.registerTool(
    "change_order_status",
    {
      title: "Change order status",
      description:
        "Change status or payment status for one or more orders using Scalev API v3 changeOrderStatus. This is a non-destructive write/API action but still mutates order state and should match explicit user intent.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        body: bodySchema.describe("ChangeOrderStatusRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Change order status", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "change_order_status", "changeOrderStatus", () =>
        buildExecuteSafeRequest({
          operation_id: "changeOrderStatus",
          business_unique_id: input.business_unique_id,
          body: input.body
        })
      )
  );

  server.registerTool(
    "cancel_order_awb",
    {
      title: "Cancel order AWB",
      description:
        "Cancel airway bills for one or more orders using Scalev API v3 cancelOrderAwb. This is destructive because it cancels shipment/AWB state.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        body: bodySchema.describe("CancelOrderAwbRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Cancel order AWB", "destructive_write")
    },
    async (input) =>
      runCatalogTool(env, "cancel_order_awb", "cancelOrderAwb", () =>
        buildExecuteDestructiveRequest({
          operation_id: "cancelOrderAwb",
          business_unique_id: input.business_unique_id,
          body: input.body
        })
      )
  );
}

async function runCatalogTool(
  env: Env,
  toolName: string,
  operationId: string,
  buildRequest: () => ReturnType<typeof buildGetRequest>
) {
  const auth = currentAuth();

  return runLoggedTool(env, auth, { toolName, operationId }, async () => {
    const { endpoint, request } = buildRequest();
    const response = await nexusBusinessRequest(env, auth, request);

    return toolResult({
      operation_id: endpoint.operationId,
      method: request.method,
      path: request.path,
      response: response ?? null
    });
  });
}

function queryWith(
  baseQuery: Record<string, CatalogQueryValue> | undefined,
  fields: Record<string, CatalogQueryValue | undefined>
): Record<string, CatalogQueryValue> | undefined {
  const query: Record<string, CatalogQueryValue> = { ...(baseQuery || {}) };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "undefined") query[key] = value;
  }

  return Object.keys(query).length > 0 ? query : undefined;
}
