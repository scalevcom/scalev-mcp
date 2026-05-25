# DNS And Status Page Plan

Audit started: 2026-05-22
Status: RESOLVED 2026-05-24 (see `submission/live-checks-2026-05-25.md` for current verified state)

This was the production operations checklist for the Claude connector
submission items that could not be completed from the local repositories
alone. All items here have been resolved on production; the historical
text is retained as deployment evidence.

## Edge Evidence At Audit Time (2026-05-22)

- `scalev.com`, `mcp.scalev.com`, and `api.scalev.com` presented edge
  certificates issued by Google Trust Services `WE1`.
- `dig +short CAA scalev.com`, `dig +short CAA mcp.scalev.com`, and
  `dig +short CAA api.scalev.com` returned no CAA records.
- `pnpm check:live-readiness:report` recorded `status.scalev.com` as a
  live blocker until the production monitor was reachable.

## Current State (2026-05-25)

- CAA records are published on the apex (`pki.goog`, `letsencrypt.org` for
  `issue` and `issuewild`, plus `iodef "mailto:security@scalev.com"`) and
  cover `mcp.scalev.com` and `api.scalev.com` via DNS-tree walk.
- `status.scalev.com` is live and monitors `https://mcp.scalev.com/health`.
- `pnpm check:live-readiness` runs all CAA and status checks as PASS.

Cloudflare's CAA guidance says Universal SSL can use partner CAs and documents
Google Trust Services as `pki.goog; cansignhttpexchanges=yes`. Confirm the
active Cloudflare edge certificate authority before adding records because
Cloudflare may add or change partner CAs for operational reasons.

Source: `https://developers.cloudflare.com/ssl/edge-certificates/caa-records/`

## CAA Records

Add effective CAA coverage for the zone apex so the records apply to the
connector and API subdomains unless a subdomain override is intentionally
needed.

Recommended starting records if Cloudflare remains on Google Trust Services:

```text
scalev.com.  CAA 0 issue "pki.goog; cansignhttpexchanges=yes"
scalev.com.  CAA 0 issuewild "pki.goog; cansignhttpexchanges=yes"
```

Optional contact record:

```text
scalev.com.  CAA 0 iodef "mailto:security@scalev.com"
```

Before applying:

- Confirm whether the zone has non-Cloudflare certificate automation that also
  needs CAA permission.
- Confirm whether Cloudflare auto-added additional CAA records after the first
  manual CAA record is created.
- Confirm renewal is still healthy for the Universal SSL certificate after DNS
  propagation.

Verification:

```bash
dig +short CAA scalev.com
dig +short CAA mcp.scalev.com
dig +short CAA api.scalev.com
pnpm check:live-readiness
```

## Status Page

Create or configure `https://status.scalev.com` before formal submission.

Minimum checks:

- `https://mcp.scalev.com/health` returns `200` and JSON `status: "ok"`.
- `https://mcp.scalev.com/.well-known/oauth-protected-resource/mcp` returns
  `200`.
- `https://api.scalev.com/v3/oauth/.well-known/oauth-authorization-server`
  returns `200`.
- `https://api.scalev.com/.well-known/security.txt` returns `200`.
- Unauthenticated `https://mcp.scalev.com/mcp` returns `401` with
  `WWW-Authenticate`.

Recommended alert routing:

- Page Scalev API/OAuth owner for `/v3/oauth` or `/v3/me` failures.
- Page connector owner for Worker `/health`, protected-resource metadata, or
  Origin validation failures.
- Keep reviewer-facing incident updates free of OAuth tokens, request bodies,
  customer data, order payloads, and landing-page HTML.

Verification:

```bash
curl -i https://status.scalev.com
pnpm check:live-readiness
```

## Final Submission Evidence

Before the submission form is sent, attach or privately retain:

- `pnpm check:live-readiness` output with passing CAA and status-page checks.
- The status page URL and monitor list.
- A note confirming no third-party domains are declared as allowed link URIs.
- A note confirming `status.scalev.com` monitors the production connector, not a
  staging or preview URL.
