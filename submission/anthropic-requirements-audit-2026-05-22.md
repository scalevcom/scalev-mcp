# Anthropic Requirements Audit

Date: 2026-05-22

This audit maps the current Claude connector directory guidance to the Scalev
connector package. It is reviewer-facing evidence, not a substitute for the
final live Claude custom-connector run.

Sources checked on 2026-05-22:

- https://claude.com/docs/connectors/building/submission
- https://claude.com/docs/connectors/building/review-criteria
- https://claude.com/docs/connectors/building/testing
- https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations

## Current Evidence

| Requirement | Evidence |
| --- | --- |
| Remote MCP URL over HTTPS | Submission draft uses `https://mcp.scalev.com/mcp`; live protected-resource metadata check is recorded in `submission/live-checks-2026-05-22.md`. |
| Formal submission path | Use the MCP directory submission form. `submission/pre-feedback-email.md` is only optional outreach/escalation prep because the current Anthropic page lists `mcp-review@anthropic.com` for form-access problems and review escalations. |
| OAuth for authenticated services | `wrangler.toml`, `README.md`, and `submission/claude-connector-submission.md` document OAuth DCR primary with CIMD advertised. The Scalev API owns token validation and refresh rotation. |
| Origin-header validation | `src/origin.ts` validates browser `Origin` against Claude, ChatGPT/OpenAI, and configured local/test origins, and allows missing `Origin` for server-to-server clients. Covered by `test/security.test.ts`. |
| Tool annotations | `src/toolAnnotations.ts` provides title, read-only, destructive, idempotent, and open-world hints for every tool class. `test/tools.test.ts` checks the public 17-tool list and annotation completeness. |
| Separate read and write tools | `execute` is split into `get`, `execute_safe`, and `execute_destructive`; semantic write/delete tools are separate. `src/toolRuntime.ts`, `src/catalog.ts`, and tests reject wrong-tool calls. |
| No catch-all unsafe method tool | The generic tools do not accept an arbitrary HTTP method. `search` returns `execution_tool` so Claude must choose `get`, `execute_safe`, or `execute_destructive`. |
| API docs for generic endpoint tools | `search` returns `docs_topic`, `docs_url`, and `docs_hint`; `get_docs` exposes bundled Scalev Developers docs. |
| Write-surface transparency | `submission/catalog-surface-report.md` records the generated catalog counts by read/write/destructive class, write endpoint tags, and every destructive operation. The current generated snapshot is 218 approved business-authenticated `/v3` endpoints: 96 reads, 92 non-destructive writes/actions, and 30 destructive writes/actions. |
| Short tool names | `scripts/check-submission-package.mjs` verifies the exact 17-tool list from `src/toolNames.ts`; all names are under 64 characters. |
| Narrow descriptions | Tool descriptions in `src/tools.ts` and `src/semanticTools.ts` describe the specific Scalev action and required business selector. |
| Prompt-injection and hidden Unicode scan | `scripts/check-submission-text.mjs` scans README files, SECURITY, CHANGELOG, submission docs, source, and generated catalogs for hidden/control Unicode and common prompt-injection phrases. |
| Reviewer evidence redaction | `scripts/check-evidence-redaction.mjs` scans reviewer evidence and submission files for actual bearer tokens, OAuth token fields, API keys, cookie headers, passwords, private keys, credential-bearing URLs, and JWTs. |
| No-PII logging | `src/logger.ts` logs request id, tool name, operation id, status, and Scalev API `error_code` only. `scripts/check-logging-privacy.mjs` enforces central logging, Sentry `sendDefaultPii: false`, and the allowed log-field set. |
| Public documentation | English and Indonesian docs are live: `https://docs.scalev.com/en/scalev-mcp-connector` and `https://docs.scalev.com/id/konektor-scalev-mcp` returned `200` on 2026-05-22. |
| Legal and support links | `https://scalev.com/privacy`, `https://scalev.com/terms`, and `https://scalev.com/contact-us` returned `200` on 2026-05-22. |
| Reviewer setup instructions | `submission/reviewer-test-account-instructions.md` provides the step-by-step custom connector setup path and points to the seeded evidence checks. |
| Reviewer evidence structure | `scripts/check-reviewer-evidence.mjs` verifies the three reviewer prompts, all 26 tool rows, and required negative evidence rows are present. Final mode fails while reviewer evidence still contains pending markers. |
| Branding assets | Required local assets are present under `assets/`. `scripts/check-assets.mjs` verifies the SVG logo metadata plus PNG/JPEG image formats and dimensions, and `scripts/check-submission-package.mjs` requires those assets and scripts. |
| Post-deploy live verification | `scripts/check-live-readiness.mjs` checks metadata, health, `security.txt`, `WWW-Authenticate`, allowed and disallowed `Origin`, public docs/legal/support links, strict HSTS preload headers, `status.scalev.com`, effective CAA, and `https://scalev.com/claude`. |
| Final go/no-go gate | `pnpm check:submission-final` reruns the local submission package checks, fails on unresolved reviewer placeholders or pending evidence through final mode, and then requires live readiness to pass. |
| DNS and status-page setup | `submission/dns-and-status-page-plan.md` records CAA records, status monitor checks, and final evidence required before submission. |
| Plain remote MCP screenshots | Plain remote MCP does not require MCP Apps carousel assets. Reviewer evidence screenshots are kept under `assets/reviewer-evidence/`. |
| Allowed link URIs | Submission notes omit allowed link URIs because the connector does not expose `ui/open-link`; `scripts/check-submission-package.mjs` scans source/test/config files and fails if open-link support appears without updating the submission package. |
| API ownership | The connector Worker forwards to first-party Scalev API `/v3` only. |
| No unsupported financial-transfer surface | The exposed semantic tools cover Landing Pages and Orders. The order tools do not transfer money or financial assets. The catalog generator, catalog-risk check, the Scalev API client wrapper, and tests exclude OAuth billing, developer payout, and direct payment-gateway routes from generic catalog execution. |

## Remaining Proof Before Final Submission

| Requirement | Missing Proof |
| --- | --- |
| Fully populated test account | Production reviewer business still needs seeded orders, landing pages, customers, products, and final reviewer account details. Verify it from a production IEx session with the Scalev API `Util.ReviewerSeedAudit` before submission. |
| Final reviewer credentials | `submission/reviewer-test-account-instructions.md` still needs the reviewer account identifier, out-of-band password delivery channel, business unique ids, seed audit evidence, and reset timestamp. |
| Every tool tested in Claude | Three Claude reviewer prompt transcripts or screenshots remain pending under `assets/reviewer-evidence/`. |
| Every tool exercised through MCP Inspector or equivalent | `assets/reviewer-evidence/tool-exercise-matrix.md` now tracks all 26 tools and required negative checks. Local automated tests cover routing, annotations, origin, and safety. The newly added direct landing-page display tools still need post-deploy Inspector evidence before final submission. |
| Live `scalev.com/claude` landing page | HTML Mode source exists in `submission/scalev-claude-landing-page.html`; production `https://scalev.com/claude` still needs publishing and verification from the Scalev-owned business page. |
| Live security.txt on both hosts | Local implementations exist. Post-deploy checks for `https://mcp.scalev.com/.well-known/security.txt` and `https://api.scalev.com/.well-known/security.txt` remain pending. |
| Live status page | `status.scalev.com` still needs production verification and should monitor `https://mcp.scalev.com/health` after deploy. |
| Final recorded walkthrough video | The local landing page includes the walkthrough placement and storyboard; the final recorded production video remains pending. |
