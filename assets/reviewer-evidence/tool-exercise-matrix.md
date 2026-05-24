# Tool Exercise Matrix

Capture MCP Inspector or equivalent Claude custom-connector evidence for every
tool before final submission. Do not store bearer tokens, refresh tokens, raw
request bodies, customer private data, full order payloads, or landing-page
HTML in this file.

Final status: `PENDING_FINAL_CLAUDE_RUN`

## Evidence Rules

- Use the seeded Claude Review business only.
- Record request ids when available.
- Redact business/user/customer identifiers unless they are synthetic review ids.
- For destructive tools, record the explicit seeded fixture and confirmation prompt.
- For generic `execute_*` tools, record both one successful allowed call and one wrong-tool refusal.

## Matrix

| Tool | Surface | Reviewer Fixture | Expected Evidence | Status |
| --- | --- | --- | --- | --- |
| `get_me` | Claude and MCP Inspector | Reviewer OAuth connection with at least two connected businesses | Returns token identity and `connected_businesses[]`; no selected business is implied | Pending |
| `get_docs` | MCP Inspector | Bundled docs catalog | Returns Scalev MCP or OAuth docs for a requested topic | Pending |
| `search` | MCP Inspector | Generated `/v3` catalog | Returns matching endpoint metadata, docs hints, and `execution_tool` | Pending |
| `get` | MCP Inspector | `listLandingPages` or `listOrders` GET operation | Runs only GET operations and forwards `business_unique_id` as `b_uid` | Pending |
| `execute_safe` | MCP Inspector | Non-destructive update against seeded review data | Runs one safe non-GET operation and refuses a destructive operation | Pending |
| `execute_destructive` | MCP Inspector | Seeded review landing page or AWB cancellation fixture | Runs one destructive operation and refuses a safe operation | Pending |
| `list_landing_pages` | Claude prompt 1 | At least five Claude Review landing pages | Lists seeded landing pages with published/draft coverage | Pending |
| `get_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Fetches the created or seeded landing page | Pending |
| `create_landing_page` | Claude prompt 2 | Synthetic HTML Mode draft | Creates review page using documented request body shape | Pending |
| `update_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Updates metadata or `is_published` state | Pending |
| `delete_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Deletes only the synthetic review page and prompts as destructive | Pending |
| `list_orders` | Claude prompt 3 | At least 30 Claude connector review orders | Lists review-tagged orders across required statuses | Pending |
| `get_order` | Claude prompt 3 | Seeded safe order id | Fetches one review order without dumping unrelated business data | Pending |
| `create_order` | MCP Inspector | Synthetic customer/product fixture | Creates a synthetic review order or a disposable draft order | Pending |
| `update_order` | Claude prompt 3 | `Claude Review Update Order` | Updates a harmless review note or metadata field | Pending |
| `change_order_status` | Claude prompt 3 | `Claude Review Status Order` | Changes only the seeded status fixture as instructed | Pending |
| `get_order_statistics` | Claude prompt 3 | Seeded reviewer business orders | Returns aggregated order statistics with the requested `breakdown_date` granularity; respects `business_unique_id` selection | Pending |

## Negative Evidence

| Check | Expected Evidence | Status |
| --- | --- | --- |
| Missing selector | Business-scoped call without `business_unique_id` fails with a friendly selector-required error when multiple businesses are connected | Pending |
| Safe tool refuses destructive action | `execute_safe` refuses a generated destructive operation such as `deleteLandingPage` | Pending |
| Destructive tool refuses safe action | `execute_destructive` refuses a generated safe write operation | Pending |
| OAuth revoke and reconnect | Revoked connector stops working, reconnect creates a fresh working `get_me`, and old refresh reuse is rejected | Pending |
| Response/log privacy | Evidence and logs contain request id, tool name, operation id, status, and Scalev API `error_code` only | Pending |
