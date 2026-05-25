# Anthropic Requirements Audit

Audit started: 2026-05-22
Last refreshed: 2026-05-25 (all "Remaining Proof" items resolved)

This audit maps the current Claude connector directory guidance to the Scalev
connector package. It is reviewer-facing evidence, not a substitute for the
final live Claude custom-connector run.

Sources checked:

- https://claude.com/docs/connectors/building/submission
- https://claude.com/docs/connectors/building/review-criteria
- https://claude.com/docs/connectors/building/testing
- https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations

## Current Evidence

| Requirement | Evidence |
| --- | --- |
| Remote MCP URL over HTTPS | Submission draft uses `https://mcp.scalev.com/mcp`; live protected-resource metadata check is recorded in `submission/live-checks-2026-05-25.md`. |
| Formal submission path | Use the MCP directory submission form. `submission/pre-feedback-email.md` is only optional outreach/escalation prep because the current Anthropic page lists `mcp-review@anthropic.com` for form-access problems and review escalations. |
| OAuth for authenticated services | `wrangler.toml`, `README.md`, and `submission/claude-connector-submission.md` document OAuth DCR primary with CIMD advertised. The Scalev API owns token validation and refresh rotation. |
| Origin-header validation | `src/origin.ts` validates browser `Origin` against Claude, ChatGPT/OpenAI, and configured local/test origins, and allows missing `Origin` for server-to-server clients. Covered by `test/security.test.ts`. |
| Tool annotations | `src/toolAnnotations.ts` provides title, read-only, destructive, idempotent, and open-world hints for every tool class. `test/tools.test.ts` checks the public 25-tool list and annotation completeness. |
| Separate read and write tools | `execute` is split into `get`, `execute_safe`, and `execute_destructive`; semantic write/delete tools are separate. `src/toolRuntime.ts`, `src/catalog.ts`, and tests reject wrong-tool calls. |
| No catch-all unsafe method tool | The generic tools do not accept an arbitrary HTTP method. `search` returns `execution_tool` so Claude must choose `get`, `execute_safe`, or `execute_destructive`. |
| API docs for generic endpoint tools | `search` returns `docs_topic`, `docs_url`, and `docs_hint`; `get_docs` exposes bundled Scalev Developers docs. |
| Write-surface transparency | `submission/catalog-surface-report.md` records the generated catalog counts by read/write/destructive class, write endpoint tags, and every destructive operation. The current generated snapshot is 223 approved business-authenticated `/v3` endpoints: 98 reads, 94 non-destructive writes/actions, and 31 destructive writes/actions. |
| Short tool names | `scripts/check-submission-package.mjs` verifies the exact 25-tool list from `src/toolNames.ts`; all names are under 64 characters. |
| Narrow descriptions | Tool descriptions in `src/tools.ts` and `src/semanticTools.ts` describe the specific Scalev action and required business selector. |
| Prompt-injection and hidden Unicode scan | `scripts/check-submission-text.mjs` scans README files, SECURITY, CHANGELOG, submission docs, source, and generated catalogs for hidden/control Unicode and common prompt-injection phrases. |
| Reviewer evidence redaction | `scripts/check-evidence-redaction.mjs` scans reviewer evidence and submission files for actual bearer tokens, OAuth token fields, API keys, cookie headers, passwords, private keys, credential-bearing URLs, and JWTs. |
| No-PII logging | `src/logger.ts` logs request id, tool name, operation id, status, and Scalev API `error_code` only. `scripts/check-logging-privacy.mjs` enforces central logging, Sentry `sendDefaultPii: false`, and the allowed log-field set. |
| Public documentation | English and Indonesian docs are live at `https://docs.scalev.com/en/scalev-mcp-connector` and `https://docs.scalev.com/id/konektor-scalev-mcp`; both reflect the 25-tool surface and return `200` on the latest `pnpm check:live-readiness` run. |
| Legal and support links | `https://scalev.com/privacy`, `https://scalev.com/privacy-en`, `https://scalev.com/terms`, and `https://scalev.com/contact-us` all return `200`. |
| Security commitments page | `https://scalev.com/security` and `https://scalev.com/security-en` publish the dedicated technical-security commitments (TLS, OAuth 2.1, HSTS, audit log redaction, rate limits, no-card-storage, subprocessor security, vulnerability disclosure). The privacy policy §8, security.txt Policy line, `/health` JSON `security_policy_url`, marketing footer, and README Legal section all cross-link to it. |
| Public source repository | `https://github.com/scalevcom/scalev-mcp` exposes the full Worker source. `package.json` metadata, `/health` JSON `source_repository_url`, README EN+ID Legal sections, marketing landing-page footers, and the submission form draft `source_repository_url` field all advertise it. |
| Reviewer setup instructions | `submission/reviewer-test-account-instructions.md` provides the step-by-step custom connector setup path, the seeded reviewer business `unique_id`, secondary selector-test business, and the latest seed audit evidence. |
| Reviewer evidence structure | `scripts/check-reviewer-evidence.mjs` verifies the three reviewer prompts, the three follow-up Landing Pages prompts (4/5/6), all 25 tool rows, and the 5 negative-evidence rows are present. Final mode rejects any unresolved pending markers. |
| Branding assets | Required local assets are present under `assets/`. `scripts/check-assets.mjs` verifies the SVG logo metadata plus PNG image formats and dimensions, and `scripts/check-submission-package.mjs` requires those assets and scripts. |
| Post-deploy live verification | `scripts/check-live-readiness.mjs` checks metadata, health, `security.txt`, `WWW-Authenticate`, allowed and disallowed `Origin`, public docs/legal/support links, the `/security` and `/security-en` commitments pages, strict HSTS preload headers, `status.scalev.com`, effective CAA, and `https://scalev.com/claude` plus `https://scalev.com/claude-id`. Latest run: 23 of 23 PASS, recorded in `submission/live-checks-2026-05-25.md`. |
| Final go/no-go gate | `pnpm check:submission-final` reruns the local submission package checks, fails on unresolved reviewer placeholders or pending evidence through final mode, and then requires live readiness to pass. |
| DNS and status-page setup | CAA records published on the apex (`pki.goog`, `letsencrypt.org` for `issue`+`issuewild`, `iodef mailto:security@scalev.com`) cover `mcp.scalev.com` and `api.scalev.com` via DNS-tree walk. `status.scalev.com` is live and monitors `https://mcp.scalev.com/health`. Setup history is in `submission/dns-and-status-page-plan.md`. |
| Plain remote MCP screenshots | Plain remote MCP does not require MCP Apps carousel assets. Reviewer evidence screenshots are kept under `assets/reviewer-evidence/`. |
| Allowed link URIs | Submission notes omit allowed link URIs because the connector does not expose `ui/open-link`; `scripts/check-submission-package.mjs` scans source/test/config files and fails if open-link support appears without updating the submission package. |
| API ownership | The connector Worker forwards to first-party Scalev API `/v3` only. |
| No unsupported financial-transfer surface | The exposed semantic tools cover Landing Pages and Orders. The order tools do not transfer money or financial assets. The catalog generator, catalog-risk check, the Scalev API client wrapper, and tests exclude OAuth billing, developer payout, and direct payment-gateway routes from generic catalog execution. |

## Submission Readiness Status (2026-05-25)

All items previously listed under "Remaining Proof Before Final Submission" are
resolved.

| Item | Resolution |
| --- | --- |
| Fully populated test account | Reviewer business `NNY34GV8VWBL2KSH` (ICA Testing Account) seeded with 30 orders across all 7 statuses, 5 landing pages (2 draft + 3 published, 2 HTML-mode), 10 products, 5 customers, and the 3 named fixtures CR212101/CR212102/CR212103. `Util.ReviewerSeedAudit.run/2` on 2026-05-25T08:37:54Z returned zero warnings, zero failures, zero unlabeled records. Audit JSON embedded in `submission/reviewer-test-account-instructions.md`. |
| Final reviewer credentials | Reviewer account `tester@scalev.com`, primary business `NNY34GV8VWBL2KSH`, secondary selector-test business `KJKODFJYD4RGFE9N`, last data reset `2026-05-25T08:37:54Z`. Password delivery via 1Password share link at submission time (out of band). |
| Every tool tested in Claude | Six reviewer prompts captured against the deployed Worker: Prompt 1 (identity + landing pages), Prompt 2 (HTML Mode CRUD), Prompt 3 (orders + statistics), Prompt 4 (Landing Pages read surface), Prompt 5 (display CRUD), Prompt 6 (tag write). Screenshots in `assets/reviewer-evidence/prompt-*.png`. |
| Every tool exercised through live evidence | `assets/reviewer-evidence/tool-exercise-matrix.md` tracks all 25 tools and the 5 negative checks. Every row is Captured 2026-05-24 or Captured 2026-05-25. Local automated tests cover routing, annotations, origin, and safety. |
| Live `scalev.com/claude` landing page | Both EN (`/claude`) and ID (`/claude-id`) return `200`. Footers cross-link to privacy, terms, security commitments, security.txt, status page, and public source repository. |
| Live security.txt on both hosts | `https://mcp.scalev.com/.well-known/security.txt` and `https://api.scalev.com/.well-known/security.txt` both return `200` with `Contact:`, `Policy:` (privacy + security), `Canonical:`, `Expires:`. |
| Live status page | `https://status.scalev.com` returns `200` and monitors `https://mcp.scalev.com/health`. |
| Reviewer walkthrough | Static screenshots under `assets/reviewer-evidence/` (3 reviewer prompts, 3 Landing Pages follow-ups, 4 OAuth flow steps, 5 negative checks) provide the complete reviewer walkthrough. No video required for plain remote MCP review. |
