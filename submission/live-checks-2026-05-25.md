# Live Edge Checks

Date: 2026-05-25

Final pre-submission live readiness snapshot. Captured after the privacy
policy (EN + ID) and security commitments page (EN + ID) publishes that
unblocked Anthropic Connector Directory submission.

Runbook command:

```bash
pnpm check:live-readiness
```

## Passing (23 of 23)

OAuth + MCP transport

- `GET https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp` → `200` (RFC 9728 protected-resource metadata).
- `GET https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server` → `200` (RFC 8414 authorization-server metadata).
- `GET https://mcp.scalev.com/mcp` (no auth, no Origin) → `401` with `WWW-Authenticate: Bearer resource_metadata="https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp"`.
- `GET https://mcp.scalev.com/mcp` with `Origin: https://claude.ai` → `401` with the same `WWW-Authenticate` challenge (allowed browser origin reaches the auth path).
- `GET https://mcp.scalev.com/mcp` with `Origin: https://chatgpt.com` → `401` with the same `WWW-Authenticate` challenge.
- `GET https://mcp.scalev.com/mcp` with `Origin: https://example.invalid` → `403 forbidden_origin` (disallowed browser origin rejected at the edge).

Health + security disclosure

- `GET https://mcp.scalev.com/health` → `200` JSON; `service: scalev-claude-connector`, `version: 0.3.4`, `transport: streamable_http`, `security_policy_url: https://scalev.com/security`, `source_repository_url: https://github.com/scalevcom/scalev-mcp`.
- `GET https://mcp.scalev.com/.well-known/security.txt` → `200` with `Contact:`, `Policy:` (privacy + security), `Canonical:`, `Expires:` lines.
- `GET https://api.scalev.com/.well-known/security.txt` → `200` with matching policy fields.

Public marketing + legal surface

- `GET https://scalev.com/claude` → `200` (English Scalev Claude Connector landing page; canonical brand string + `https://mcp.scalev.com/mcp` + Add to Claude CTA).
- `GET https://scalev.com/claude-id` → `200` (Indonesian Scalev Claude Connector landing page).
- `GET https://scalev.com/privacy` → `200` (Indonesian privacy policy, 13 sections, MCP/AI clauses, named subprocessors, /security cross-link in §8).
- `GET https://scalev.com/privacy-en` → `200` (English privacy policy mirror).
- `GET https://scalev.com/security` → `200` (Indonesian security commitments, 9 sections covering TLS, OAuth 2.1 + PKCE + DCR + CIMD, HSTS preload, audit log redaction, rate limiting, no-card-storage, subprocessor security, vulnerability disclosure, security contact).
- `GET https://scalev.com/security-en` → `200` (English security commitments mirror).
- `GET https://scalev.com/terms` → `200`.
- `GET https://scalev.com/contact-us` → `200`.
- `GET https://status.scalev.com` → `200` (monitoring `https://mcp.scalev.com/health`).

Connector docs

- `GET https://docs.scalev.com/en/scalev-mcp-connector` → `200` with the canonical 25-tool surface (post-0.3.3).
- `GET https://docs.scalev.com/id/konektor-scalev-mcp` → `200` with the same 25-tool surface in Indonesian.

DNS hardening

- `dig CAA scalev.com` → `issue "pki.goog"`, `issue "letsencrypt.org"`, `issuewild "pki.goog"`, `issuewild "letsencrypt.org"`, `iodef "mailto:security@scalev.com"`. CAA walks the DNS tree, so apex records cover `mcp.scalev.com` and `api.scalev.com`.
- `dig CAA mcp.scalev.com` → resolves via apex (intentional).
- `dig CAA api.scalev.com` → resolves via apex (intentional).

## TLS Posture

All four hosts (`scalev.com`, `api.scalev.com`, `mcp.scalev.com`, `app.scalev.com`)
reject TLS 1.0 and TLS 1.1 and negotiate TLS 1.2+ only. HSTS header on every
HTTPS response carries `max-age=31536000; includeSubDomains; preload`.

## Reviewer Evidence

Tool-by-tool live capture for all 25 tools and 5 negative checks is in
`assets/reviewer-evidence/tool-exercise-matrix.md` and the screenshot files
alongside it. Last reviewer seed audit (`Util.ReviewerSeedAudit.run/2`)
returned `warnings: []`, `failures: []`, `unlabeled: 0`, `checked_at:
2026-05-25T08:37:54Z`. Audit JSON embedded in
`submission/reviewer-test-account-instructions.md`.

## Status

`READY_FOR_SUBMISSION`. All live readiness gates green; no outstanding
blockers.
