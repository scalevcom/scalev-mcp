import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMcpAuthContext } from "agents/mcp";
import { z } from "zod";
import {
  buildHtmlModeDraftPayload,
  htmlModePagesPath,
  pageDisplayCreatePath,
  pageDisplayPath,
  pageDisplayValidatePath,
  pagePath,
  type PageDetail,
  type PageDisplay,
  type PageListResponse
} from "./htmlMode";
import { nexusBusinessRequest } from "./nexusClient";
import { HTML_MODE_FIELD_NAMES, SCALEV_TOOL_NAMES } from "./toolNames";
import type { AuthContext, Env } from "./types";

export { HTML_MODE_FIELD_NAMES, SCALEV_TOOL_NAMES };

const htmlFields = {
  html_code: z
    .string()
    .optional()
    .describe("Body-only HTML. Do not include doctype, html, body, head, meta, link, title, favicon, SEO, crawler, or domain settings."),
  css_code: z.string().optional(),
  js_code: z.string().optional().describe("JavaScript for the HTML Mode page."),
  csp_policy: z.record(z.string(), z.array(z.string())).optional()
};

export function createScalevMcpServer(env: Env): McpServer {
  const server = new McpServer({ name: "scalev-html-mode", version: "0.1.0" });

  server.registerTool(
    "scalev_get_me",
    {
      title: "Get Scalev identity",
      description: "Return the authenticated Scalev user and authorized business.",
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
    "scalev_v3_request",
    {
      title: "Call Scalev v3 API",
      description:
        "Call a business-authenticated Scalev /v3 API endpoint. Nexus enforces the OAuth scopes for the requested endpoint.",
      inputSchema: {
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        path: z
          .string()
          .describe("Absolute Nexus path beginning with /v3/, including query string when needed."),
        body: z.unknown().optional().describe("JSON request body for non-GET requests.")
      }
    },
    async ({ method, path, body }) => {
      const auth = currentAuth();
      const result = await nexusBusinessRequest(env, auth, { method, path, body });
      return toolResult(result);
    }
  );

  server.registerTool(
    "scalev_list_pages",
    {
      title: "List Scalev pages",
      description: "List accessible Scalev landing pages.",
      inputSchema: {
        q: z.string().optional(),
        store_id: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).optional()
      },
      annotations: { readOnlyHint: true }
    },
    async (input) => {
      const auth = currentAuth();

      const result = await nexusBusinessRequest<PageListResponse>(env, auth, {
        method: "GET",
        path: htmlModePagesPath(input)
      });

      return toolResult(result);
    }
  );

  server.registerTool(
    "scalev_get_page_context",
    {
      title: "Get Scalev page context",
      description: "Fetch the latest page and page-display context for a Scalev page.",
      inputSchema: { page_id: z.number().int() },
      annotations: { readOnlyHint: true }
    },
    async ({ page_id }) => {
      const auth = currentAuth();
      const page = await nexusBusinessRequest<PageDetail>(env, auth, {
        method: "GET",
        path: pagePath(page_id)
      });
      return toolResult(page);
    }
  );

  server.registerTool(
    "scalev_validate_html_mode",
    {
      title: "Validate Scalev HTML Mode payload",
      description: "Validate an HTML Mode payload for a Scalev page without saving it.",
      inputSchema: {
        page_id: z.number().int(),
        ...htmlFields
      },
      annotations: { readOnlyHint: true }
    },
    async ({ page_id, ...payload }) => {
      const auth = currentAuth();
      const page = await fetchPage(env, auth, page_id);
      const result = await nexusBusinessRequest(env, auth, {
        method: "POST",
        path: pageDisplayValidatePath(page_id),
        body: buildHtmlModeDraftPayload(page, payload)
      });
      return toolResult(result);
    }
  );

  server.registerTool(
    "scalev_create_html_mode_draft",
    {
      title: "Create Scalev HTML Mode draft",
      description: "Create a new unpublished HTML Mode draft version for a Scalev page.",
      inputSchema: {
        page_id: z.number().int(),
        ...htmlFields
      }
    },
    async ({ page_id, ...payload }) => {
      const auth = currentAuth();
      const page = await fetchPage(env, auth, page_id);
      const draft = await nexusBusinessRequest<PageDisplay>(env, auth, {
        method: "POST",
        path: pageDisplayCreatePath(page_id),
        body: buildHtmlModeDraftPayload(page, payload)
      });

      return toolResult({
        page_id,
        page_display_id: draft.id,
        render_mode: draft.render_mode,
        is_published: draft.is_published,
        published_at: draft.published_at,
        draft
      });
    }
  );

  server.registerTool(
    "scalev_get_draft_status",
    {
      title: "Get Scalev HTML Mode draft status",
      description: "Return a specific HTML Mode draft page-display record.",
      inputSchema: { page_id: z.number().int(), page_display_id: z.number().int() },
      annotations: { readOnlyHint: true }
    },
    async ({ page_id, page_display_id }) => {
      const auth = currentAuth();
      const draft = await nexusBusinessRequest<PageDisplay>(env, auth, {
        method: "GET",
        path: pageDisplayPath(page_id, page_display_id)
      });

      return toolResult({
        page_id,
        page_display_id,
        render_mode: draft.render_mode,
        is_published: draft.is_published,
        published_at: draft.published_at,
        draft
      });
    }
  );

  return server;
}

async function fetchPage(env: Env, auth: AuthContext, pageId: number): Promise<PageDetail> {
  return nexusBusinessRequest<PageDetail>(env, auth, {
    method: "GET",
    path: pagePath(pageId)
  });
}

function currentAuth(): AuthContext {
  const props = getMcpAuthContext()?.props as { auth?: AuthContext } | undefined;
  if (!props?.auth) throw new Error("Missing MCP auth context");
  return props.auth;
}

function toolResult(data: unknown) {
  const structuredContent =
    data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : { data };

  return {
    structuredContent,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
  };
}
