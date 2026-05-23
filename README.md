# Scalev Claude Connector

Indonesian version: [README.id.md](README.id.md)

Remote MCP server for the Scalev API v3, hosted at:

```text
https://mcp.scalev.com/mcp
```

The Worker is a thin MCP wrapper. It does not inspect token claims, store selected-business state, or authorize business actions locally. It forwards the merchant's OAuth bearer token to the Scalev API `/v3`; the Scalev API owns token validation, business selection, scope checks, audit logs, rate limits, and endpoint behavior.

## Install In Claude

1. Open Claude settings.
2. Go to Connectors.
3. Add a custom connector with `https://mcp.scalev.com/mcp`.
4. Complete the Scalev OAuth consent flow.
5. In chat, enable the Scalev connector from the tools/connectors menu.

OAuth uses Dynamic Client Registration as the primary path. Scalev also advertises Client ID Metadata Document support for compatible MCP clients. Tokens must be bound to the MCP resource:

```text
https://mcp.scalev.com/mcp
```

## Local Development

```bash
pnpm install
pnpm dev
```

Required local variables can be placed in `.dev.vars`:

```bash
NEXUS_API_BASE_URL=https://api.scalev.test
NEXUS_OAUTH_ISSUER=https://api.scalev.test/v3/oauth
MCP_RESOURCE_URI=https://mcp.scalev.test/mcp
ALLOWED_ORIGINS=http://localhost:6274,https://claude.ai,https://claude.com,https://chatgpt.com,https://chat.openai.com,https://platform.openai.com
```

Browser-origin validation allows known Claude, ChatGPT, and OpenAI origins by
default. Requests without an `Origin` header are allowed for server-to-server
MCP clients.

Optional Sentry:

```bash
SENTRY_DSN=...
SENTRY_ENVIRONMENT=development
```

`SENTRY_DSN` is public routing configuration, not a bearer credential. Keep
Sentry auth tokens out of Worker vars.

No bearer tokens, request bodies, customer records, order payloads, or landing page payloads are logged.
Production responses include HSTS, `x-content-type-options: nosniff`, and `x-frame-options: DENY`.
The security contact file is published at `https://mcp.scalev.com/.well-known/security.txt`.
The public health check for uptime/status monitoring is `https://mcp.scalev.com/health`.

## Data Flow

```text
Claude -> mcp.scalev.com/mcp -> api.scalev.com/v3 -> Scalev business data
```

- Claude discovers protected-resource metadata at `/.well-known/oauth-protected-resource/mcp`.
- The Scalev API publishes OAuth authorization-server metadata at `/v3/oauth/.well-known/oauth-authorization-server`.
- Claude obtains a merchant OAuth token from the Scalev API.
- The Worker receives the token and forwards it unchanged to the Scalev API `/v3`.
- For business-scoped tools, `business_unique_id` is forwarded to the Scalev API as `b_uid`.

Call `get_me` first. If `connected_businesses` has more than one entry, choose one `connected_businesses[].unique_id` and pass it as top-level `business_unique_id` to business tools.

## Tools

| Tool | Type | Description |
| --- | --- | --- |
| `get_me` | Read | Returns token-level identity and connected businesses. |
| `get_docs` | Local read | Reads bundled Scalev developer docs without calling the Scalev API or changing business data. |
| `search` | Local read | Searches the generated business-authenticated `/v3` catalog. |
| `get` | Read | Runs one catalog-approved GET operation. |
| `execute_safe` | Non-destructive write | Runs one non-destructive non-GET catalog operation. |
| `execute_destructive` | Destructive write | Runs one destructive catalog operation such as delete, cancel, revoke, remove, or disconnect. |
| `list_landing_pages` | Read | Lists business landing pages. |
| `get_landing_page` | Read | Gets one business landing page. |
| `create_landing_page` | Non-destructive write | Creates a landing page. For HTML Mode publish-in-one-call, include `is_published: true` with `page_display`. |
| `update_landing_page` | Non-destructive write | Updates landing page metadata or publishing state. |
| `delete_landing_page` | Destructive write | Soft-deletes a landing page. |
| `list_orders` | Read | Lists business orders with filters and cursor pagination. |
| `get_order` | Read | Gets one business order. |
| `create_order` | Non-destructive write | Creates a business order. |
| `update_order` | Non-destructive write | Updates one business order. |
| `change_order_status` | Non-destructive write | Changes order status or payment status after explicit user intent. |
| `cancel_order_awb` | Destructive write | Cancels airway bills for orders. |

`search` returns `execution_tool` as `get`, `execute_safe`, or `execute_destructive`. Use that value. The Worker rejects safe/destructive mismatches.
OAuth flow, storefront browser, OAuth billing, developer payout, and direct payment-gateway endpoints are intentionally excluded from the generated MCP catalog.

Older clients may still remember a single `execute` tool from an early connector build. Refresh the connector tool list and use `execute_safe` or `execute_destructive` according to the `search.execution_tool` value.

## Scopes In Plain English

Scalev OAuth consent groups scopes by the business data or action they unlock:

- `page:list` and `page:read`: view landing pages.
- `page:create`, `page:update`, and `page:delete`: create, edit, publish, unpublish, or delete landing pages.
- `order:list` and `order:read`: view orders.
- `order:create` and `order:update`: create or edit orders.
- `order:change_status`: change order or payment status.
- `order:create_awb`: generate or cancel shipment airway bills.

The connector never grants more access than the merchant approved in Scalev. The Scalev API enforces scopes per selected business on every call.

## Reviewer Prompts

Use a populated review business with at least 30 orders, 5 landing pages, 5 customers, and 10 products.

1. "Use Scalev to list my connected businesses, choose the review business, and summarize my landing pages."
2. "Create a draft HTML Mode landing page called Claude Review Draft, update it to publish with `is_published: true`, fetch it, then delete it."
3. "Find pending review orders, fetch one order, update its notes, change its status to confirmed, and cancel AWB only on the seeded safe AWB test order."

Negative checks:

- Ask Claude to run a destructive operation with `execute_safe`; it should refuse or receive a wrong-tool error.
- Omit `business_unique_id` when multiple businesses are connected; the Scalev API should return a friendly selector-required error.
- Revoke the OAuth grant in Scalev, reconnect, and repeat the identity and list flow.

Submission package drafts live in `submission/claude-connector-submission.md`,
`submission/compliance-memo.md`, `submission/operational-runbook.md`, and
`submission/pre-feedback-email.md`.

## Catalog Sync

The endpoint catalog is generated from the sibling OpenAPI repo:

```bash
pnpm generate:v3-catalog
pnpm check:v3-catalog
pnpm generate:catalog-surface-report
pnpm check:catalog-surface-report
```

The docs catalog is generated from the sibling docs repo:

```bash
pnpm generate:docs-catalog
pnpm check:docs-catalog
```

When Scalev API business-authenticated `/v3` behavior changes, update the Scalev API backend, `../api-openapi/specs/v3/openapi.yaml`, and the generated catalog in the same work.

## Deployment

Deployments run from GitHub Actions on pushes to `main`, or manually through the `Deploy` workflow.

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Required API token permission:

- `Account: Workers Scripts: Edit`

The `mcp.scalev.com` custom domain is managed in Cloudflare dashboard. CI intentionally does not manage Worker routes.

Before merging:

```bash
pnpm check:submission-local
```

This local preflight runs the generated catalog checks, asset integrity check,
catalog risk scan, catalog surface report check, logging privacy guard,
evidence redaction and reviewer-evidence structure checks, submission
text/package/workspace checks, TypeScript typecheck, Vitest suite, and Wrangler
dry-run.

After production deploy, run the live readiness check:

```bash
pnpm check:live-readiness
```

Immediately before submission, run the final gate:

```bash
pnpm check:submission-final
```

This reruns the local package checks, fails on unresolved reviewer placeholders
or pending evidence, requires reviewer-evidence final mode to pass, and then
requires the live readiness checks to pass.

While deployment work is still pending, use the report-only form to capture
current live gaps without failing the shell:

```bash
pnpm check:live-readiness:report
```

## Legal And Support

- Privacy Policy: https://scalev.com/privacy
- Terms: https://scalev.com/terms
- Support: https://scalev.com/contact-us
- Security Contact: https://mcp.scalev.com/.well-known/security.txt
