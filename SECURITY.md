# Security Policy

## Reporting Security Issues

Report suspected vulnerabilities in the Scalev MCP connector to:

```text
cs@scalev.com
```

For fraud or abuse reports involving a Scalev user:

```text
laporan@scalev.com
```

Include the connector URL, approximate time, request id if available, and a concise reproduction. Do not include OAuth access tokens, refresh tokens, API keys, customer payment data, or full order payloads in email.

The MCP host also publishes a machine-readable contact file at:

```text
https://mcp.scalev.com/.well-known/security.txt
```

## Supported Version

| Version | Status |
| --- | --- |
| `0.3.x` | Supported |

## Security Model

- The Worker accepts OAuth bearer tokens and forwards them unchanged to the Scalev API `/v3`.
- The Scalev API owns token validation, selected-business resolution, authorization, audit logs, and rate limits.
- The Worker does not store OAuth tokens or business data.
- Logs must stay metadata-only: request id, tool name, operation id, status, and Scalev API `error_code`.
- Browser requests to `/mcp` are Origin-checked; server-to-server requests without an `Origin` header are allowed.

## Operational Response

Security reports should receive an initial response within two business days. Critical token, auth, or data-exposure issues should be mitigated or disabled before public disclosure.
