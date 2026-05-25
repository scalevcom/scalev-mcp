# Scalev Claude Connector Submission Package

Prepared for the Anthropic Claude connector directory submission flow.

## Connector

- Name: Scalev
- MCP URL: `https://mcp.scalev.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth 2.0 with Dynamic Client Registration primary
- Client ID Metadata Document support: advertised for compatible clients
- OAuth issuer: `https://api.scalev.com/v3/oauth`
- Protected resource metadata: `https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp`
- Connector health: `https://mcp.scalev.com/health`
- Authorization server metadata: `https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server`
- Privacy policy: `https://scalev.com/privacy`
- Terms: `https://scalev.com/terms`
- Support: `https://scalev.com/contact-us`

## Tool List

| Tool | Purpose | Annotation Class |
| --- | --- | --- |
| `get_me` | Get authenticated token identity and connected businesses | Scalev API read |
| `get_docs` | Read bundled Scalev developer docs | Local read |
| `search` | Search the local `/v3` endpoint catalog | Local read |
| `get` | Run one read-only business-authenticated `/v3` GET operation | Scalev API read |
| `execute_safe` | Run one non-destructive non-GET `/v3` operation | Non-destructive write |
| `execute_destructive` | Run one destructive non-GET `/v3` operation | Destructive write |
| `list_landing_pages` | List landing pages | Scalev API read |
| `list_landing_page_tags` | List landing page tags | Scalev API read |
| `get_landing_page` | Fetch one landing page | Scalev API read |
| `get_landing_page_public_view` | Fetch landing page public rendering data | Scalev API read |
| `create_landing_page` | Create a landing page or HTML Mode draft/published page | Non-destructive write |
| `update_landing_page` | Update landing page metadata or publishing state | Non-destructive write |
| `update_landing_page_tags` | Replace landing page tags | Non-destructive write |
| `delete_landing_page` | Delete a landing page | Destructive write |
| `list_landing_page_displays` | List saved display versions for a landing page | Scalev API read |
| `create_landing_page_display` | Create a new page display version | Non-destructive write |
| `validate_landing_page_display` | Validate a page display payload without saving | Non-destructive write |
| `get_landing_page_display` | Fetch one saved page display version | Scalev API read |
| `delete_landing_page_display` | Delete one saved page display version | Destructive write |
| `list_orders` | List orders | Scalev API read |
| `get_order` | Fetch one order | Scalev API read |
| `create_order` | Create an order | Non-destructive write |
| `update_order` | Update an order | Non-destructive write |
| `change_order_status` | Change order or payment status | Non-destructive write |
| `get_order_statistics` | Returns aggregated order statistics for the business (totals, revenue, optional time and dimensional breakdowns) | Scalev API read |

## OAuth And Data Flow

Claude connects to `mcp.scalev.com`, discovers the protected MCP resource, registers an OAuth client through DCR, redirects the merchant to Scalev OAuth, and receives an MCP-bound bearer token. The Worker forwards that bearer token unchanged to the Scalev API `/v3`. The Scalev API owns token validation, business selection, scopes, business authorization, audit logging, and rate limits.

For multi-business tokens, Claude must call `get_me`, choose one `connected_businesses[].unique_id`, and pass it as top-level `business_unique_id` for business-scoped tools. The Worker forwards that selector to the Scalev API as `b_uid`.

## Plain-English Scopes

The connector asks only for the scopes needed by the exposed tool surface:

- Landing pages: list, read, create, update, and delete landing pages.
- Orders: list, read, create, update, change status, and order statistics.

Reviewer-facing scope names:

- `page:list`, `page:read`, `page:create`, `page:update`, `page:delete`
- `order:list`, `order:read`, `order:create`, `order:update`, `order:change_status`, `order:statistics:list`

## Reviewer Prompts

1. Inspect connected businesses and summarize landing pages:

   ```text
   Show my connected Scalev businesses, choose the reviewer business, then list my landing pages and summarize which ones are published.
   ```

2. Landing page write workflow:

   ```text
   Create a review HTML Mode landing page draft named Claude Review HTML Mode, create or validate a new page display version directly, update it to publish the display, fetch it back, then delete it.
   ```

3. Order workflow:

   ```text
   List recent review-tagged orders, fetch one safe seeded order, update its review note, change its status as instructed in the seed data, then show me my order statistics broken down by day.
   ```

Negative tests:

- Run a business-scoped tool without `business_unique_id` when multiple businesses are connected; Claude should surface the selector requirement.
- Try to run a destructive operation through `execute_safe`; the connector should refuse and tell Claude to use `execute_destructive`.
- Try to run a safe write through `execute_destructive`; the connector should refuse and tell Claude to use `execute_safe`.

## Reviewer Test Data

Production reviewer data still needs to be seeded before submission:

- At least 30 non-sensitive orders across statuses.
- At least 5 landing pages, including HTML Mode and draft examples.
- At least 5 customers.
- At least 10 products or bundles sufficient for order workflows.
- One secondary selector-test business connected to the same reviewer account, used only for missing-selector negative tests.
- Use `submission/reviewer-data-seed-plan.md` for the exact seed-data contract and safety constraints.
- Verify the seeded business from a production IEx session with `Util.ReviewerSeedAudit.run("<business_unique_id>", format: :json)`; keep the summary output in the private reviewer evidence bundle.

Final reviewer credentials and business unique ids:

- Reviewer account: `tester@scalev.com` (password delivered via single-use 1Password share link in the submission form's reviewer-credentials notes field at submission time)
- Reviewer business unique id: `NNY34GV8VWBL2KSH` (legal name `ICA Testing Account`)
- Secondary selector-test business unique id: `KJKODFJYD4RGFE9N`
- Seed-data reset instructions: from a production IEx session run `Util.ReviewerSeed.run("NNY34GV8VWBL2KSH")` to reseed all 30 orders, 5 landing pages, 10 products, 5 customers, and the three named order fixtures (`CR212101` update, `CR212102` status, `CR212103` AWB cancel). Verify with `Util.ReviewerSeedAudit.run("NNY34GV8VWBL2KSH", format: :json)`; the audit should return zero warnings, zero failures, and zero unlabeled records.

## Evidence To Attach Or Keep Ready

- `assets/logo.svg`
- `assets/logo-256.png`
- `assets/logo-1024.png`
- `assets/favicon.png`
- Three reviewer prompt transcripts or screenshots under `assets/reviewer-evidence/`
- Tool-by-tool MCP Inspector or equivalent evidence in `assets/reviewer-evidence/tool-exercise-matrix.md`
- English README: `README.md`
- Indonesian README: `README.id.md`
- Curl output for:
  - `https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp`
  - `https://mcp.scalev.com/health`
  - `https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server`
  - `https://mcp.scalev.com/.well-known/security.txt`
  - `https://api.scalev.com/.well-known/security.txt`
  - unauthenticated `https://mcp.scalev.com/mcp` showing `WWW-Authenticate`
- Operational runbook: `submission/operational-runbook.md`
- Anthropic requirements audit: `submission/anthropic-requirements-audit-2026-05-22.md`
- Live readiness verifier: `scripts/check-live-readiness.mjs`
- Cross-repo workspace verifier: `scripts/check-submission-workspace.mjs`
- Optional pre-submission outreach/escalation draft: `submission/pre-feedback-email.md`
- Reviewer data seed plan: `submission/reviewer-data-seed-plan.md`
- Reviewer test account instructions: `submission/reviewer-test-account-instructions.md`
- Catalog surface report: `submission/catalog-surface-report.md`
- DNS and status-page setup: `submission/dns-and-status-page-plan.md`
- Submission form draft: `submission/submission-form-draft.json`
- Live `scalev.com/claude` (EN) source: `submission/scalev-claude-landing-page.html`
- Live `scalev.com/claude-id` (ID) source: `submission/scalev-claude-landing-page-id.html`

## Submission Notes For Review Risk

- The generic tools are retained for catalog coverage, but `execute_safe` and `execute_destructive` are split by generated `isDestructive` metadata and reject wrong-tool calls.
- `execute_safe` is a non-destructive write/action tool. It is not described as read-only or risk-free.
- The generated catalog snapshot currently contains 223 approved business-authenticated `/v3` endpoints: 98 read-only GET endpoints, 94 non-destructive write/action endpoints, and 31 destructive write/action endpoints. Keep `submission/catalog-surface-report.md` attached or ready for reviewer questions about breadth.
- Claude-visible semantic tools cover the full public Landing Pages operation set plus the focused Orders review workflow. Generic catalog tools are retained for broader approved `/v3` coverage and are guarded by generated `execution_tool` routing plus wrong-tool rejection.
- OAuth billing, developer payout, and direct payment-gateway endpoints are excluded from the generated MCP catalog and blocked at the runtime transport boundary.
- Write tools advise Claude to consult `search` metadata and `get_docs` before constructing request bodies.
- All business behavior is enforced in the Scalev API; the Worker is a protocol boundary and bearer-token forwarder.
- `wait_for_completion` is intentionally deferred until the Scalev API exposes a durable completion/status API for write operations; adding it in the Worker alone would be endpoint-specific guessing.
- Legal/support links return `200` on the latest `pnpm check:live-readiness` run: `https://scalev.com/privacy`, `https://scalev.com/privacy-en`, `https://scalev.com/terms`, `https://scalev.com/contact-us`, plus the dedicated security commitments at `https://scalev.com/security` and `https://scalev.com/security-en`.
- Both marketing landing pages are live and return `200`: `https://scalev.com/claude` (EN) and `https://scalev.com/claude-id` (ID). Source HTML is kept at `submission/scalev-claude-landing-page.html` and `submission/scalev-claude-landing-page-id.html` for reviewer reference; reviewers verify the live URLs directly.
- Plain remote MCP review does not require a walkthrough video; reviewer evidence consists of static screenshots in `assets/reviewer-evidence/` covering 6 reviewer prompts, the OAuth flow, and the 5 negative checks.
- Scalev stores and processes merchant data primarily for Indonesian businesses; include the current data-residency wording from legal before final submission.
