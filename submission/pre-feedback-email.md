# Pre-Feedback Email Draft

To: `mcp-review@anthropic.com`

Contact source checked on 2026-05-22 from `https://claude.com/docs/connectors/building/submission`.
The current Anthropic page lists this address for form-access problems and
review escalations. Use this draft as optional early outreach or escalation
prep, not as a replacement for the MCP directory submission form.

Subject: Optional pre-submission risk questions for Scalev remote MCP connector

Hello Anthropic MCP review team,

Scalev is preparing to submit a production remote MCP connector for Claude.
We will submit through the MCP directory submission form, but wanted to ask
whether you can accept early feedback questions for a few review-risk areas
before the formal submission.

Connector details:

- Name: Scalev
- MCP URL: `https://mcp.scalev.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth Dynamic Client Registration primary, Client ID Metadata Document fallback
- Protected resource: `https://mcp.scalev.com/mcp`
- OAuth issuer: `https://api.scalev.com/v3/oauth`
- Tool count: 17 total, with 6 generic tools and 11 semantic tools for Landing Pages and Orders
- Generic catalog snapshot: 218 approved business-authenticated `/v3` endpoints, with 96 read-only GET endpoints, 92 non-destructive write/action endpoints, and 30 destructive write/action endpoints
- Legal: `https://scalev.com/privacy`, `https://scalev.com/terms`
- Support: `https://scalev.com/contact-us`

The connector uses Nexus-owned OAuth, business selection, scopes, audit logging, and rate limits. The MCP Worker is a thin wrapper that forwards the merchant bearer token to Nexus `/v3` and forwards selected business context as `b_uid`.

Review-risk mitigations already implemented:

- `execute_safe` and `execute_destructive` are split by generated `isDestructive` metadata; wrong-tool calls are refused before any Nexus request is sent.
- `search` returns the required execution tool for each catalog entry, plus docs hints for request shaping.
- OAuth flow, storefront browser, OAuth billing, developer payout, and direct payment-gateway routes are excluded from the generated catalog and blocked again at runtime.
- The 11 semantic tools cover the intended first-review workflows for Landing Pages and Orders; the generic tools are retained for broader approved `/v3` coverage.
- Every tool has `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` annotations.
- Worker/Sentry logs are restricted to request id, tool name, operation id, status, and Nexus `error_code`; tokens, request bodies, customer data, order data, and landing page payloads are not logged.

We would appreciate early feedback on these review-risk areas before the formal submission:

- whether the split generic tools plus catalog exclusions are acceptable for directory review, or whether the initial listing should reduce the generic catalog further
- scope-count optics for the exposed business operations
- ID/US data-residency disclosure expectations for reviewer notes
- breadth of the generic write/action surface, especially the 92 non-destructive and 30 destructive catalog entries

We can provide a seeded review business, a secondary selector-test business, test credentials, screenshots/transcripts, and OAuth revoke/reconnect evidence when the formal submission is ready.

If this address is reserved for form-access support or post-submission
escalations only, please ignore this pre-submission request or point us to the
current partner path. We will keep the directory submission form as the source
of truth for the formal review package.

Thank you,

Scalev Engineering
