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
    "Top-level business selector. Copy one value from get_me.connected_businesses[].unique_id when the OAuth token is connected to more than one business. If this exact key is accidentally placed in this tool's body or query object, the connector recovers it and forwards it to the Scalev API as b_uid."
  );
const landingPageIdSchema = z.union([z.string(), z.number()]).describe("Landing page id.");
const landingPageDisplayIdSchema = z.union([z.string(), z.number()]).describe("Landing page display id.");

const paginationSchema = {
  page_size: z.number().int().min(1).max(25).optional().describe("Number of records to return. Scalev caps this at 25."),
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
    "list_landing_page_tags",
    {
      title: "List landing page tags",
      description:
        "Lists landing page tags visible to the selected business. Use with update_landing_page_tags when assigning or replacing page tags.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema
      },
      annotations: toolAnnotations("List landing page tags", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "list_landing_page_tags", "listLandingPageTags", () =>
        buildGetRequest({
          operation_id: "listLandingPageTags",
          business_unique_id: input.business_unique_id
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
        id: landingPageIdSchema,
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
    "get_landing_page_public_view",
    {
      title: "Get landing page public view",
      description:
        "Gets the authenticated public rendering payload for one landing page. Use this to inspect what the published page view needs without using the generic get tool.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: landingPageIdSchema
      },
      annotations: toolAnnotations("Get landing page public view", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "get_landing_page_public_view", "getLandingPagePublicView", () =>
        buildGetRequest({
          operation_id: "getLandingPagePublicView",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id }
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
        id: landingPageIdSchema,
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
    "update_landing_page_tags",
    {
      title: "Update landing page tags",
      description:
        "Replaces the tags assigned to one business landing page. Pass the complete desired tag list in tags.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        id: landingPageIdSchema,
        tags: z.array(z.string()).describe("Complete tag list to assign to the landing page.")
      },
      annotations: toolAnnotations("Update landing page tags", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "update_landing_page_tags", "updateLandingPageTags", () =>
        buildExecuteSafeRequest({
          operation_id: "updateLandingPageTags",
          business_unique_id: input.business_unique_id,
          path_params: { id: input.id },
          body: { tags: input.tags }
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
        id: landingPageIdSchema
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
    "list_landing_page_displays",
    {
      title: "List landing page displays",
      description:
        "Lists saved displays for one landing page, including draft and published display versions. Use before selecting a display to publish with update_landing_page.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        page_id: landingPageIdSchema,
        ...paginationSchema,
        query: querySchema.optional().describe("Additional documented query parameters for listLandingPageDisplays.")
      },
      annotations: toolAnnotations("List landing page displays", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "list_landing_page_displays", "listLandingPageDisplays", () =>
        buildGetRequest({
          operation_id: "listLandingPageDisplays",
          business_unique_id: input.business_unique_id,
          path_params: { page_id: input.page_id },
          query: queryWith(input.query, {
            page_size: input.page_size,
            next_cursor: input.next_cursor,
            previous_cursor: input.previous_cursor
          })
        })
      )
  );

  server.registerTool(
    "create_landing_page_display",
    {
      title: "Create landing page display",
      description:
        "Creates a new display version for an existing landing page. Use this direct tool to update HTML/CSS/JS, analytics pixels, or checkout form_display data; then publish the returned display id with update_landing_page and current_page_display_id.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        page_id: landingPageIdSchema,
        body: bodySchema.describe("LandingPageDisplayRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Create landing page display", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "create_landing_page_display", "createLandingPageDisplay", () =>
        buildExecuteSafeRequest({
          operation_id: "createLandingPageDisplay",
          business_unique_id: input.business_unique_id,
          path_params: { page_id: input.page_id },
          body: input.body
        })
      )
  );

  server.registerTool(
    "validate_landing_page_display",
    {
      title: "Validate landing page display",
      description:
        "Validates a landing page display payload without saving it. Use before create_landing_page_display when checking HTML Mode display fields or checkout form_display data.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        page_id: landingPageIdSchema,
        body: bodySchema.describe("LandingPageDisplayRequestBody from the public OpenAPI contract.")
      },
      annotations: toolAnnotations("Validate landing page display", "safe_write")
    },
    async (input) =>
      runCatalogTool(env, "validate_landing_page_display", "validateLandingPageDisplay", () =>
        buildExecuteSafeRequest({
          operation_id: "validateLandingPageDisplay",
          business_unique_id: input.business_unique_id,
          path_params: { page_id: input.page_id },
          body: input.body
        })
      )
  );

  server.registerTool(
    "get_landing_page_display",
    {
      title: "Get landing page display",
      description:
        "Gets one saved display for a landing page. Use this direct tool to inspect HTML Mode code, pixels, and checkout form_display fields for a specific display id.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        page_id: landingPageIdSchema,
        display_id: landingPageDisplayIdSchema
      },
      annotations: toolAnnotations("Get landing page display", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "get_landing_page_display", "getLandingPageDisplay", () =>
        buildGetRequest({
          operation_id: "getLandingPageDisplay",
          business_unique_id: input.business_unique_id,
          path_params: { page_id: input.page_id, display_id: input.display_id }
        })
      )
  );

  server.registerTool(
    "delete_landing_page_display",
    {
      title: "Delete landing page display",
      description:
        "Deletes one saved landing page display. This is destructive and cannot delete the page's current published display.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        page_id: landingPageIdSchema,
        display_id: landingPageDisplayIdSchema
      },
      annotations: toolAnnotations("Delete landing page display", "destructive_write")
    },
    async (input) =>
      runCatalogTool(env, "delete_landing_page_display", "deleteLandingPageDisplay", () =>
        buildExecuteDestructiveRequest({
          operation_id: "deleteLandingPageDisplay",
          business_unique_id: input.business_unique_id,
          path_params: { page_id: input.page_id, display_id: input.display_id }
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
    "get_order_statistics",
    {
      title: "Get order statistics",
      description:
        "Retrieves aggregated order statistics for the selected business from Scalev API v3: total orders, total revenue, and aggregate counts with optional time and dimensional breakdowns. Useful for merchant performance summaries and answering questions like 'how did sales do last week broken down by city'. Requires the order:statistics:list scope.",
      inputSchema: {
        business_unique_id: businessUniqueIdSchema,
        breakdown_date: z
          .enum(["off", "day", "week", "month"])
          .optional()
          .describe("Time breakdown granularity. Defaults to 'off' (single aggregate)."),
        custom_breakdown_key: z
          .enum(["off", "handler_id", "advertiser_id", "page_id", "city", "province"])
          .optional()
          .describe("Optional dimensional breakdown (e.g. by city, province, or landing page)."),
        datetime_type: z
          .string()
          .optional()
          .describe(
            "Which order timestamp to aggregate on. Examples: created_at, pending_time, confirmed_time, shipped_time, completed_time. Defaults to created_at."
          ),
        is_breakdown_status: z
          .boolean()
          .optional()
          .describe("Include per-status counts alongside the aggregate totals."),
        status: z.string().optional().describe("Optional order status filter (same values as list_orders)."),
        payment_status: z.string().optional().describe("Optional payment status filter."),
        query: querySchema
          .optional()
          .describe("Additional documented query parameters for getOrderStatistics (e.g. date range filters).")
      },
      annotations: toolAnnotations("Get order statistics", "nexus_read")
    },
    async (input) =>
      runCatalogTool(env, "get_order_statistics", "getOrderStatistics", () =>
        buildGetRequest({
          operation_id: "getOrderStatistics",
          business_unique_id: input.business_unique_id,
          query: queryWith(input.query, {
            breakdown_date: input.breakdown_date,
            custom_breakdown_key: input.custom_breakdown_key,
            datetime_type: input.datetime_type,
            is_breakdown_status: input.is_breakdown_status,
            status: input.status,
            payment_status: input.payment_status
          })
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
