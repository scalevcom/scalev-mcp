# nexus-mcp

Cloudflare Worker MCP gateway for Scalev Nexus.

Hard boundary: this Worker only calls Nexus `/v3` endpoints. Any configured Nexus URL containing `/v2/` is rejected before a request is sent. Browser approval UI traffic outside the Worker is not part of this boundary, but the MCP OAuth flow still needs the `resource` value preserved through approval and token exchange.

## Local Development

```bash
npm install
npm run dev
```

Required local secrets can be placed in `.dev.vars`:

```bash
NEXUS_API_BASE_URL=https://api.scalev.test
NEXUS_OAUTH_ISSUER=https://api.scalev.test/v3/oauth
MCP_RESOURCE_URI=https://mcp.scalev.test/mcp
```

## OAuth

The Worker serves MCP protected-resource metadata and points clients to the Nexus `/v3/oauth` authorization server. ChatGPT obtains a merchant OAuth token from Nexus, then sends it to `/mcp`. The Worker only checks that a bearer token is present and forwards that exact token to normal business-authenticated Nexus `/v3` endpoints.

Tokens must use the MCP resource/audience value for this Worker, for example:

```text
https://mcp.scalev.com/mcp
```

## Tools

The Worker exposes a generic business-authenticated v3 bridge plus semantic HTML Mode helpers:

- `scalev_get_me`
- `scalev_v3_request`
- `scalev_list_pages`
- `scalev_get_page_context`
- `scalev_validate_html_mode`
- `scalev_create_html_mode_draft`
- `scalev_get_draft_status`

`scalev_v3_request` forwards the user's OAuth bearer token to normal Nexus `/v3` API endpoints so Nexus remains the source of truth for endpoint behavior and scope enforcement. It does not expose OAuth token-management routes, storefront public/customer browser routes, or legacy internal MCP route names.

Draft creation creates unpublished Nexus page display versions only. Publishing stays in the Scalev dashboard.
HTML Mode write tools use the Nexus payload field names: `html_code`, `css_code`, `js_code`, and `csp_policy`.
The semantic HTML Mode tools use the normal Nexus `/v3/pages` and `/v3/pages/:page_id/page-displays` API. Nexus does not need a separate `/v3/mcp` or `/v3/chatgpt` controller surface.

## Cloudflare Variables

Configure these Worker variables in Cloudflare:

- `NEXUS_API_BASE_URL`
- `NEXUS_OAUTH_ISSUER`
- `MCP_RESOURCE_URI`

The Worker uses the merchant OAuth bearer token for Nexus `/v3` API requests. Nexus remains responsible for scope enforcement and endpoint behavior.
