# Live Edge Checks

Date: 2026-05-22

These checks record the current production edge state while the local connector-readiness changes are still undeployed.

Runbook command:

```bash
pnpm check:live-readiness:report
```

## Passing

- `GET https://mcp.scalev.com/mcp` returned `401` with `WWW-Authenticate`.
- `GET https://mcp.scalev.com/mcp` returned no raw business/customer payload.
- `GET https://docs.scalev.com/en/scalev-mcp-connector` returned `200`.
- `GET https://docs.scalev.com/id/konektor-scalev-mcp` returned `200`.
- `GET https://scalev.com/privacy`, `GET https://scalev.com/terms`, and `GET https://scalev.com/contact-us` returned `200`.

## Pending Deployment

- `GET https://mcp.scalev.com/.well-known/security.txt` returned `404`.
- `GET https://api.scalev.com/.well-known/security.txt` returned `404`.
- `GET https://mcp.scalev.com/health` returned `404`; it is implemented locally and pending Worker deployment.
- `GET https://scalev.com/claude` returned `404`; publish `submission/scalev-claude-landing-page.html` as the Scalev-owned HTML Mode landing page before final submission.
- `GET https://status.scalev.com` failed to fetch; final submission requires it to return `200` and monitor `https://mcp.scalev.com/health`.
- MCP/API live responses are still missing `x-frame-options: DENY` and still use HSTS `max-age=2592000`; local code now sets `x-frame-options: DENY` and `strict-transport-security: max-age=31536000; includeSubDomains; preload` after deployment. The live check now requires max-age, `includeSubDomains`, and `preload`.
- `GET https://mcp.scalev.com/mcp` with allowed browser `Origin: https://claude.ai` and `Origin: https://chatgpt.com` is now part of `pnpm check:live-readiness`; final behavior should reach the unauthenticated `401` challenge path rather than returning `403`.
- `GET https://mcp.scalev.com/mcp` with disallowed browser `Origin: https://example.invalid` currently returns the unauthenticated `401` path instead of local-code `403 forbidden_origin`; recheck after Worker deployment.

`pnpm check:live-readiness:report` found 38 issue entries on 2026-05-22, all tied to the deploy/live-proof, status-page, and CAA items above.

## DNS Follow-Up

- `dig +short CAA scalev.com` returned no CAA records.
- `dig +short CAA mcp.scalev.com` returned no CAA records.
- `dig +short CAA api.scalev.com` returned no CAA records.

`pnpm check:live-readiness` now checks effective CAA records for `scalev.com`, `mcp.scalev.com`, and `api.scalev.com`. Add CAA records before submission if the HSTS/CAA hardening item stays in scope. Suggested issuer values should match the certificate authority actually used by Cloudflare Universal SSL and any backup certificate automation.

The operational setup details are tracked in `submission/dns-and-status-page-plan.md`.
