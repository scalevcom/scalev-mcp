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

## Deployment Backlog (resolved 2026-05-24)

All items in this section have been resolved by the subsequent Worker deploy on 2026-05-23 and the marketing/status page publishes on 2026-05-24. Snapshot retained as historical evidence of the readiness trajectory.

- ~~`GET https://mcp.scalev.com/.well-known/security.txt` returned `404`~~ → now `200`.
- ~~`GET https://api.scalev.com/.well-known/security.txt` returned `404`~~ → now `200`.
- ~~`GET https://mcp.scalev.com/health` returned `404`~~ → now `200` (JSON health payload).
- ~~`GET https://scalev.com/claude` returned `404`~~ → now `200`, serving the rebuilt EN landing page with the canonical "Scalev Claude Connector" brand string and the three reviewer prompt blockquotes.
- ~~`GET https://status.scalev.com` failed to fetch~~ → now `200`, monitoring `https://mcp.scalev.com/health`.
- ~~Missing `x-frame-options: DENY` and weak HSTS~~ → resolved via a Cloudflare Transform Rule that emits exactly one `x-frame-options: DENY` zone-wide; HSTS now `max-age=31536000; includeSubDomains; preload`.
- ~~Allowed browser `Origin` headers returning unexpected status~~ → resolved; allowed Claude and OpenAI/ChatGPT origins now reach the unauthenticated `401` challenge path, disallowed origins receive `403 forbidden_origin`.

`pnpm check:live-readiness` last ran on 2026-05-24 and returned all 19 rows passing.

## DNS Hardening (resolved 2026-05-24)

All items in this section have been resolved. Snapshot retained as historical evidence.

- ~~`dig +short CAA scalev.com` returned no CAA records~~ → now returns CAA `issue`/`issuewild` records for `pki.goog` (Google Trust Services, used by Cloudflare Universal SSL + Total TLS) and `letsencrypt.org`, plus an `iodef` `mailto:security@scalev.com` entry. CAA walks the DNS tree, so the apex records cover `mcp.scalev.com` and `api.scalev.com` automatically.

Setup details are tracked in `submission/dns-and-status-page-plan.md`.
