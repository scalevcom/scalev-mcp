# Scalev Claude Connector Compliance Memo

Date: 2026-05-22

## Scope

This memo covers the connector Worker at `https://mcp.scalev.com/mcp` and the Scalev API `/v3` surfaces it calls for the Claude connector directory submission.

## Security Controls

- HTTPS is required on the production MCP and Scalev API hosts.
- MCP and Scalev API responses include HSTS with `includeSubDomains; preload`, `x-content-type-options: nosniff`, and `x-frame-options: DENY`.
- Both hosts publish `/.well-known/security.txt` with contact, policy, language, canonical, and expiry fields.
- `/mcp` validates browser `Origin` against a Claude plus ChatGPT/OpenAI allowlist while allowing missing `Origin` for server-to-server clients.
- Unauthenticated `/mcp` returns `401` and a `WWW-Authenticate` header pointing at the protected-resource metadata URL.
- OAuth uses DCR as the primary registration path and still supports Client ID Metadata Documents.
- OAuth uses PKCE S256 and MCP `resource` binding.
- Refresh tokens rotate on refresh; refresh reloads only active/enabled connected business installations.
- The Scalev API owns token validation, scopes, business authorization, audit logging, and rate limits.
- Worker logs contain only request id, tool name, operation id, status, and Scalev API `error_code`.
- Worker logs and Sentry events must not include bearer tokens, request bodies, customer data, order data, landing page payloads, or raw Scalev API response payloads.
- Cloudflare Workers observability is enabled in `wrangler.toml`; `/health` is available for status checks after deployment.

## Tool Safety

- Every public tool has a top-level `title` and matching `annotations.title`.
- Local read tools set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.
- Scalev API read tools set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`.
- Non-destructive writes set `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`.
- Destructive writes set `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`.
- Claude-visible semantic tools cover Landing Pages and Orders. Generic catalog tools cover approved business-authenticated `/v3` endpoints and are documented separately in `submission/catalog-surface-report.md`.
- The current generated catalog contains 218 endpoints: 96 read-only GET endpoints, 92 non-destructive write/action endpoints, and 30 destructive write/action endpoints.
- The catalog generator marks destructive operations when the method is `DELETE` or the operation id, path, or summary matches `cancel`, `revoke`, `delete`, `remove`, or `disconnect`.
- `execute_safe` refuses destructive operations and all `GET` operations.
- `execute_destructive` refuses non-destructive operations and all `GET` operations.

## Privacy Notes

- The connector forwards the merchant OAuth bearer token to the Scalev API and does not persist tool request bodies.
- `get_me` returns token identity and connected business summaries so Claude can ask the user to choose the correct business.
- Business-scoped tools require top-level `business_unique_id` when a token is connected to multiple businesses.
- Friendly error mapping avoids echoing raw Scalev API payloads to Claude, and thrown MCP error objects keep only safe status plus Scalev API `error_code` telemetry.
- OAuth billing, developer payout, and direct payment-gateway endpoints are excluded from the generated MCP catalog and blocked by runtime path checks.
- Connector setup and reviewer prompts are documented in English and Indonesian README files.
- The stretch `wait_for_completion` control is deferred until the Scalev API exposes a durable write-completion/status API. The Worker does not invent completion semantics from endpoint-specific guesses.

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
- Both security.txt endpoints are live and verified by `pnpm check:live-readiness`: `https://mcp.scalev.com/.well-known/security.txt` and `https://api.scalev.com/.well-known/security.txt`.

## Pre-Submission Verification (Complete)

- Reviewer business `NNY34GV8VWBL2KSH` (ICA Testing Account) seeded and audited with non-sensitive test data using `submission/reviewer-data-seed-plan.md` and the Scalev API `Util.ReviewerSeedAudit` one-off function. Audit JSON embedded in `submission/reviewer-test-account-instructions.md` (zero warnings, zero failures, zero unlabeled records).
- `submission/scalev-claude-landing-page.html` and `submission/scalev-claude-landing-page-id.html` are published as the Scalev-owned landing pages at `https://scalev.com/claude` and `https://scalev.com/claude-id`.
- Three Claude reviewer prompt transcripts captured and saved under `assets/reviewer-evidence/prompt-{1,2,3}-*.png`.
- OAuth revoke and reconnect verified end-to-end; evidence at `assets/reviewer-evidence/negative-4-oauth-revoke-reconnect.png`.
- Final legal wording for privacy, terms, support, data residency, and subprocessors confirmed at `https://scalev.com/privacy`, `https://scalev.com/terms`, `https://scalev.com/contact-us`.
- DNS CAA records added on the `scalev.com` zone (Google Trust Services + Let's Encrypt for both `issue` and `issuewild`, plus an `iodef` mailto), verified by `pnpm check:live-readiness`.
- `https://mcp.scalev.com/health` is monitored by `https://status.scalev.com`.
- Pre-feedback email prepared at `submission/pre-feedback-email.md` for optional outreach to `mcp-review@anthropic.com`.
- Submit through the MCP directory submission form at `https://claude.com/docs/connectors/building/submission` once outreach (if any) is complete.
