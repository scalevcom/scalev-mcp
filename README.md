# nexus-mcp

Cloudflare Worker MCP gateway for Scalev Nexus.

Hard boundary: this Worker only calls Nexus `/v3` endpoints. Any configured Nexus URL containing `/v2/` is rejected before a request is sent. Browser approval UI traffic outside the Worker is not part of this boundary, but the MCP OAuth flow still needs the `resource` value preserved through approval and token exchange.

## Local Development

```bash
pnpm install
pnpm run dev
```

Required local secrets can be placed in `.dev.vars`:

```bash
NEXUS_API_BASE_URL=https://api.scalev.test
NEXUS_OAUTH_ISSUER=https://api.scalev.test/v3/oauth
MCP_RESOURCE_URI=https://mcp.scalev.test/mcp
```

## OAuth

The Worker serves MCP protected-resource metadata and points clients to the Nexus `/v3/oauth` authorization server. MCP clients obtain a merchant OAuth token from Nexus, then send it to `/mcp`. The Worker only checks that a bearer token is present and forwards that exact token to normal business-authenticated Nexus `/v3` endpoints.

Tokens must use the MCP resource/audience value for this Worker, for example:

```text
https://mcp.scalev.com/mcp
```

## Tools

The Worker exposes exactly four tools:

- `get_me`: confirms the connected Scalev business, user, OAuth app, authorized business, auth method, and effective scopes.
- `search`: searches the generated business-authenticated `/v3` endpoint catalog. This discovers API capabilities only; it does not read or mutate business records.
- `get`: runs one catalog-approved GET `/v3` operation and forwards the user's OAuth bearer token unchanged to Nexus. It never accepts a request body.
- `execute`: runs one catalog-approved non-GET `/v3` operation and forwards the user's OAuth bearer token unchanged to Nexus. This tool is write-capable because it covers create, update, delete, validation, and action endpoints.

`search` is local catalog search. It does not call Nexus. Use it to find an `operation_id`, required path parameters, query parameters, request body shape, scopes, and the right `execution_tool` before calling `get` or `execute`.

`get` and `execute` only run operations that exist in the generated catalog. Nexus remains the source of truth for bearer-token validation, business access, scope enforcement, endpoint behavior, payload validation, and persistence.

The catalog is generated from the sibling `../api-openapi/specs/v3/openapi.yaml` contract:

```bash
pnpm run generate:v3-catalog
pnpm run check:v3-catalog
```

Run the generator whenever the public business-authenticated `/v3` OpenAPI contract changes, then commit the generated `src/generated/v3Catalog.ts` diff with the Worker change.

## Cloudflare Variables

Configure these Worker variables in Cloudflare:

- `NEXUS_API_BASE_URL`
- `NEXUS_OAUTH_ISSUER`
- `MCP_RESOURCE_URI`

The Worker uses the merchant OAuth bearer token for Nexus `/v3` API requests. Nexus remains responsible for scope enforcement and endpoint behavior.

## Deployment

Deployments run from GitHub Actions on pushes to `main`, or manually through the
`Deploy` workflow.

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Required API token permissions:

- `Account: Workers Scripts: Edit`

The `mcp.scalev.com` custom domain is managed manually in the Cloudflare
dashboard. CI intentionally does not manage Worker routes, so the deploy token
does not need `Zone: Workers Routes: Edit`.

The production Worker variables are committed in `wrangler.toml`:

```text
MCP_RESOURCE_URI=https://mcp.scalev.com/mcp
NEXUS_API_BASE_URL=https://api.scalev.com
NEXUS_OAUTH_ISSUER=https://api.scalev.com/v3/oauth
```

Before merging a deployment change, run:

```bash
pnpm run check:v3-catalog
pnpm run typecheck
pnpm test
pnpm wrangler deploy --dry-run
```
