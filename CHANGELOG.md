# Changelog

## 0.3.0 - 2026-05-22

- Added full MCP tool annotations with titles, read-only/destructive hints, idempotency hints, and open-world hints.
- Split the generic write tool into `execute_safe` and `execute_destructive`.
- Added semantic Landing Pages and Orders tools for Claude Connector Directory review.
- Added destructive-operation metadata to the generated Scalev API `/v3` catalog.
- Added Origin validation for browser requests to `/mcp`.
- Added metadata-only MCP logging and optional Sentry configuration.
- Added connector submission assets and reviewer prompt evidence placeholders.
- Expanded README with installation, OAuth data flow, tool table, reviewer prompts, scope descriptions, and legal/support links.
- Added workspace submission verification for required Scalev API, OpenAPI, frontend, and docs artifacts.
- Added a reviewer evidence matrix for every tool and required negative MCP checks.
- Added reviewer test-account setup instructions for final Anthropic review credentials.
- Tightened review-risk checks for allowed-link URI omission and made tool descriptions more declarative.
- Added a logging privacy check that enforces central no-PII MCP logging.
- Kept raw Scalev API error payloads off thrown MCP error objects while preserving safe `error_code` telemetry.
- Excluded OAuth billing, developer payout, and direct payment-gateway endpoints from generated MCP catalog execution.
- Added a catalog risk check to keep financial-transfer and OAuth flow surfaces out of generic MCP catalog execution.
- Added a generated catalog surface report for read/write/destructive endpoint review evidence.
- Tightened live readiness checks for HSTS preload, allowed Claude Origin behavior, and `status.scalev.com`.
- Added `pnpm check:submission-local` as the consolidated local preflight for connector submission readiness.
- Added DNS CAA and status-page setup evidence for final live submission readiness.

## 0.1.0 - 2026-05-21

- Initial Cloudflare Worker MCP gateway for Scalev API v3.
- Added generic `get_me`, `get_docs`, `search`, `get`, and `execute` tools.
- Added generated endpoint and docs catalogs.
