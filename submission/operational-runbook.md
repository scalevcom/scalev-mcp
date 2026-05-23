# Scalev Claude Connector Operational Runbook

Date: 2026-05-22

## Scope

This runbook covers the production remote MCP connector at `https://mcp.scalev.com/mcp`, the Nexus `/v3` OAuth/API surfaces it calls, and the submission-review support path.

## Support Ownership

- Primary support URL: `https://scalev.com/contact-us`
- Security contact: `https://mcp.scalev.com/.well-known/security.txt`
- Anthropic submission path: MCP directory submission form; use `mcp-review@anthropic.com` only for form-access problems, optional early outreach, or review escalation.
- Internal owner: Scalev engineering on-call for Nexus/OAuth.
- Review-window expectation: respond to Anthropic reviewer questions within one business day.

Do not ask reviewers to send OAuth tokens, refresh tokens, order payloads, customer data, landing-page HTML, or raw request bodies. Request connector URL, approximate time, request id if visible, OAuth app/client id if shown, and a short reproduction.

## Versioning

- Connector package version: `0.3.x` during Claude directory submission.
- Public tool-surface changes require a minor version bump.
- Tool description, docs, and generated catalog changes without behavior changes may use a patch version.
- Keep Nexus behavior, `../api-openapi/specs/v3/openapi.yaml`, and `src/generated/v3Catalog.ts` synchronized in the same rollout.

## Canary Checklist

Before broad rollout:

0. Run `pnpm check:submission-local` from `nexus-mcp`.
1. Deploy Nexus/API changes to the canary environment.
2. Deploy the Worker to a canary route or preview environment when available.
3. Run unauthenticated `/mcp` and assert `401` plus `WWW-Authenticate`.
4. Run OAuth DCR registration and authorization with PKCE S256.
5. Confirm `/v3/me` and `get_me` return `connected_businesses`.
6. Run one read tool, one non-destructive write tool, and one destructive tool against seeded review data.
7. Revoke and reconnect OAuth, then confirm refresh-token reuse is rejected.
8. Check Sentry/Worker logs contain only request id, tool name, operation id, status, and Nexus `error_code`.

## Production Verification

After deploy:

```bash
pnpm check:evidence-redaction
pnpm check:submission-workspace
pnpm check:live-readiness
```

Immediately before opening the Anthropic submission form:

```bash
pnpm check:submission-final
```

This final gate reruns the local submission package checks, requires final mode
to have no reviewer placeholders or pending evidence markers, and then requires
the live readiness checks to pass.

The evidence redaction script scans reviewer evidence and submission files for
actual bearer tokens, OAuth token fields, API keys, cookie headers, passwords,
private keys, credential-bearing URLs, and JWTs. The workspace script checks
that the sibling Nexus, OpenAPI, frontend, and docs artifacts required by this
submission are present. The live script checks the same endpoints as the manual
curl list below, plus the public docs/legal/support links,
`https://scalev.com/claude`, required security headers, unauthenticated
`WWW-Authenticate`, allowed and disallowed browser `Origin`,
`status.scalev.com`, and effective CAA records for the connector/API hostnames.
Use `submission/dns-and-status-page-plan.md` for the DNS CAA records and status
monitor setup before the final live check.

Manual curl fallback:

```bash
curl -i https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp
curl -i https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server
curl -i https://mcp.scalev.com/health
curl -i https://mcp.scalev.com/.well-known/security.txt
curl -i https://api.scalev.com/.well-known/security.txt
curl -i https://mcp.scalev.com/mcp
curl -i https://status.scalev.com
```

Expected:

- protected-resource metadata returns `200`
- authorization-server metadata returns `200`
- connector health returns `200` with `status: "ok"` and no secrets
- both `security.txt` endpoints return `200`
- unauthenticated `/mcp` returns `401` with `WWW-Authenticate`
- `/mcp` with `Origin: https://claude.ai` or `Origin: https://chatgpt.com` reaches the authenticated challenge path, while a disallowed browser origin returns `403`
- MCP/API responses include HSTS with `includeSubDomains; preload`, `x-content-type-options: nosniff`, and `x-frame-options: DENY`
- `status.scalev.com` returns `200`
- effective CAA records exist for `scalev.com`, `mcp.scalev.com`, and `api.scalev.com`

## Rollback

Rollback order if the connector causes authorization, data-access, or tool-routing regressions:

1. Disable the Claude OAuth application or revoke the reviewer/test installation if the risk is credential-scoped.
2. Roll back the `nexus-mcp` Worker to the previous known-good deployment.
3. If `/v3` behavior is faulty, roll back Nexus after confirming the previous OpenAPI/catalog version still matches the deployed Worker.
4. Pause submission or notify the reviewer if the issue affects review credentials.
5. Preserve request ids and timestamps for post-incident analysis; do not preserve raw bodies or tokens.

## Reviewer Data Reset

Seeded reviewer data should be non-sensitive and disposable. If a reviewer run modifies or deletes expected objects, reseed the review business before the next review pass and record the reset time in the submission evidence folder.

Use `submission/reviewer-data-seed-plan.md` as the source of truth for the reviewer data contract, safe AWB cancellation constraints, and final evidence checklist. After every reset, run `Util.ReviewerSeedAudit.run("<business_unique_id>", format: :json)` from a production IEx session and keep the summary with the reviewer evidence.
