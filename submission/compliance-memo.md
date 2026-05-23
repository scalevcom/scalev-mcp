# Scalev Claude Connector Compliance Memo

Date: 2026-05-22

## Scope

This memo covers the `nexus-mcp` Worker at `https://mcp.scalev.com/mcp` and the Nexus `/v3` API surfaces it calls for the Claude connector directory submission.

## Security Controls

- HTTPS is required on the production MCP and Nexus hosts.
- MCP and Nexus responses include HSTS with `includeSubDomains; preload`, `x-content-type-options: nosniff`, and `x-frame-options: DENY`.
- Both hosts publish `/.well-known/security.txt` with contact, policy, language, canonical, and expiry fields.
- `/mcp` validates browser `Origin` against a Claude plus ChatGPT/OpenAI allowlist while allowing missing `Origin` for server-to-server clients.
- Unauthenticated `/mcp` returns `401` and a `WWW-Authenticate` header pointing at the protected-resource metadata URL.
- OAuth uses DCR as the primary registration path and still supports Client ID Metadata Documents.
- OAuth uses PKCE S256 and MCP `resource` binding.
- Refresh tokens rotate on refresh; refresh reloads only active/enabled connected business installations.
- Nexus owns token validation, scopes, business authorization, audit logging, and rate limits.
- Worker logs contain only request id, tool name, operation id, status, and Nexus `error_code`.
- Worker logs and Sentry events must not include bearer tokens, request bodies, customer data, order data, landing page payloads, or raw Nexus response payloads.
- Cloudflare Workers observability is enabled in `wrangler.toml`; `/health` is available for status checks after deployment.

## Tool Safety

- Every public tool has a top-level `title` and matching `annotations.title`.
- Local read tools set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.
- Nexus read tools set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`.
- Non-destructive writes set `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`.
- Destructive writes set `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`.
- Claude-visible semantic tools cover Landing Pages and Orders. Generic catalog tools cover approved business-authenticated `/v3` endpoints and are documented separately in `submission/catalog-surface-report.md`.
- The current generated catalog contains 218 endpoints: 96 read-only GET endpoints, 92 non-destructive write/action endpoints, and 30 destructive write/action endpoints.
- The catalog generator marks destructive operations when the method is `DELETE` or the operation id, path, or summary matches `cancel`, `revoke`, `delete`, `remove`, or `disconnect`.
- `execute_safe` refuses destructive operations and all `GET` operations.
- `execute_destructive` refuses non-destructive operations and all `GET` operations.

## Privacy Notes

- The connector forwards the merchant OAuth bearer token to Nexus and does not persist tool request bodies.
- `get_me` returns token identity and connected business summaries so Claude can ask the user to choose the correct business.
- Business-scoped tools require top-level `business_unique_id` when a token is connected to multiple businesses.
- Friendly error mapping avoids echoing raw Nexus payloads to Claude, and thrown MCP error objects keep only safe status plus Nexus `error_code` telemetry.
- OAuth billing, developer payout, and direct payment-gateway endpoints are excluded from the generated MCP catalog and blocked by runtime path checks.
- Connector setup and reviewer prompts are documented in English and Indonesian README files.
- The stretch `wait_for_completion` control is deferred until Nexus exposes a durable write-completion/status API. The Worker does not invent completion semantics from endpoint-specific guesses.

## Current Verification Evidence

Local checks:

- `pnpm check:submission-local` runs the local preflight below.
- `pnpm install --frozen-lockfile`
- `pnpm check:v3-catalog`
- `pnpm check:docs-catalog`
- `pnpm check:catalog-risk`
- `pnpm check:catalog-surface-report`
- `pnpm check:logging-privacy`
- `pnpm check:evidence-redaction`
- `pnpm check:submission-text`
- `pnpm check:submission-package`
- `pnpm typecheck`
- `pnpm test`
- `pnpm wrangler deploy --dry-run`

Live checks performed on 2026-05-22:

- `GET https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp` returned `200`.
- `GET https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server` returned `200`.
- Unauthenticated `GET https://mcp.scalev.com/mcp` returned `401` with `WWW-Authenticate`.
- `GET https://scalev.com/privacy`, `GET https://scalev.com/terms`, and `GET https://scalev.com/contact-us` returned `200`.
- `GET https://scalev.com/claude` returned `404` before publishing; use `submission/scalev-claude-landing-page.html` as the HTML Mode source for the Scalev-owned business landing page.
- Draft landing-page QA screenshots are saved at `assets/reviewer-evidence/scalev-claude-landing-page-desktop.jpg` and `assets/reviewer-evidence/scalev-claude-landing-page-mobile.jpg`.
- Local public-route browser QA is saved at `assets/reviewer-evidence/scalev-claude-route-desktop.jpg`; final recorded production video is still pending.
- `dig +short CAA scalev.com`, `dig +short CAA mcp.scalev.com`, and `dig +short CAA api.scalev.com` returned no CAA records.
- DNS CAA and status-page setup instructions are tracked in `submission/dns-and-status-page-plan.md`.
- Detailed live edge notes are in `submission/live-checks-2026-05-22.md`.
- Anthropic connector-directory requirements are mapped to local evidence in `submission/anthropic-requirements-audit-2026-05-22.md`.
- Post-deploy live verification is automated by `pnpm check:live-readiness`; `pnpm check:live-readiness:report` records current external gaps without failing the shell. The live check includes allowed/disallowed browser `Origin`, strict HSTS preload header checks, `status.scalev.com`, and effective CAA records for the connector/API hostnames.
- Pending after deploy: `GET https://mcp.scalev.com/.well-known/security.txt` and `GET https://api.scalev.com/.well-known/security.txt`.

## Remaining Before Submission

- Seed and verify the production reviewer business with non-sensitive test data using `submission/reviewer-data-seed-plan.md` and the Nexus `Util.ReviewerSeedAudit` one-off function from a production IEx session.
- Import and publish `submission/scalev-claude-landing-page.html` as the Scalev-owned landing page so `https://scalev.com/claude` returns `200`.
- Capture three Claude reviewer prompt transcripts or screenshots.
- Run OAuth revoke and reconnect tests in Claude.
- Confirm final legal wording for privacy, terms, support, data residency, and subprocessors.
- Add and verify DNS CAA records if CAA remains in the final hardening scope.
- Wire `https://mcp.scalev.com/health` into `status.scalev.com` or the chosen production status monitor after deployment.
- Submit through the MCP directory submission form. Optionally use `submission/pre-feedback-email.md` for early outreach or escalation prep, noting that the current Anthropic page lists `mcp-review@anthropic.com` for form-access problems and review escalations rather than as a guaranteed pre-review channel.
