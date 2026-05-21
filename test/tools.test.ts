import { describe, expect, it } from "vitest";
import {
  buildHtmlModeDraftPayload,
  htmlModePagesPath,
  pageDisplayCreatePath,
  pageDisplayPath,
  pageDisplayValidatePath,
  pagePath
} from "../src/htmlMode";
import { HTML_MODE_FIELD_NAMES, SCALEV_TOOL_NAMES } from "../src/toolNames";

describe("Scalev MCP tools", () => {
  it("exposes the generic v3 bridge and semantic HTML Mode helpers", () => {
    expect([...SCALEV_TOOL_NAMES]).toEqual([
      "scalev_get_me",
      "scalev_v3_request",
      "scalev_list_pages",
      "scalev_get_page_context",
      "scalev_validate_html_mode",
      "scalev_create_html_mode_draft",
      "scalev_get_draft_status"
    ]);

    expect(SCALEV_TOOL_NAMES).not.toContain("create_html_mode_page");
    expect(SCALEV_TOOL_NAMES).not.toContain("update_html_mode_draft");
  });

  it("uses Nexus HTML Mode payload field names", () => {
    expect([...HTML_MODE_FIELD_NAMES]).toEqual(["html_code", "css_code", "js_code", "csp_policy"]);
    expect(HTML_MODE_FIELD_NAMES).not.toContain("agent_html");
    expect(HTML_MODE_FIELD_NAMES).not.toContain("agent_csp_policy");
  });

  it("maps semantic page listing inputs to the normal Nexus v3 pages endpoint", () => {
    expect(htmlModePagesPath({ q: "launch", store_id: 12, limit: 20 })).toBe(
      "/v3/pages?search=launch&store_id=12&page_size=20"
    );
  });

  it("maps semantic tools to normal Nexus v3 page-display endpoints", () => {
    expect(pagePath(10)).toBe("/v3/pages/10");
    expect(pageDisplayValidatePath(10)).toBe("/v3/pages/10/page-displays/validate");
    expect(pageDisplayCreatePath(10)).toBe("/v3/pages/10/page-displays");
    expect(pageDisplayPath(10, 99)).toBe("/v3/pages/10/page-displays/99");
  });

  it("builds page-display draft payloads for the normal Nexus v3 page-display endpoint", () => {
    const payload = buildHtmlModeDraftPayload(
      {
        id: 10,
        store_id: 5,
        render_mode: "html_mode",
        page_display: {
          id: 99,
          render_mode: "html_mode",
          version: 3,
          html_code: "<section>Old</section>",
          css_code: ".old{}",
          js_code: "console.log('old')",
          csp_policy: { connect_src: ["https://api.example.test"] },
          meta: { lang: "id" },
          form_display: {
            store: { id: 5 },
            variants: [{ id: 101 }, { id: 102 }],
            bundle_price_options: [{ id: 201 }],
            handler_assignment: "rotator",
            after_submit_event: "success_page"
          }
        }
      },
      {
        html_code: "<section>New</section>"
      }
    );

    expect(payload).toMatchObject({
      render_mode: "html_mode",
      is_published: false,
      html_code: "<section>New</section>",
      css_code: ".old{}",
      js_code: "console.log('old')",
      meta: { lang: "id" },
      form_display: {
        store_id: 5,
        variant_ids: [101, 102],
        bundle_price_option_ids: [201],
        handler_assignment: "rotator",
        after_submit_event: "success_page"
      }
    });
  });
});
