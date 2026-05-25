# Tool Exercise Matrix

Capture MCP Inspector or equivalent Claude custom-connector evidence for every
tool before final submission. Do not store bearer tokens, refresh tokens, raw
request bodies, customer private data, full order payloads, or landing-page
HTML in this file.

Current status: 17 previously captured tools and 5 negative checks were evidenced on 2026-05-24. The 9 new direct landing-page helper tools need post-deploy recapture before final submission.

## Evidence Rules

- Use the seeded Claude Review business only.
- Record request ids when available.
- Redact business/user/customer identifiers unless they are synthetic review ids.
- For destructive tools, record the explicit seeded fixture and confirmation prompt.
- For generic `execute_*` tools, record both one successful allowed call and one wrong-tool refusal.

## Matrix

| Tool | Surface | Reviewer Fixture | Expected Evidence | Status |
| --- | --- | --- | --- | --- |
| `get_me` | Claude and MCP Inspector | Reviewer OAuth connection with at least two connected businesses | Returns token identity and `connected_businesses[]`; no selected business is implied | Captured 2026-05-24 |
| `get_docs` | MCP Inspector | Bundled docs catalog | Returns Scalev MCP or OAuth docs for a requested topic | Captured 2026-05-24 |
| `search` | MCP Inspector | Generated `/v3` catalog | Returns matching endpoint metadata, docs hints, and `execution_tool` | Captured 2026-05-24 |
| `get` | MCP Inspector | `listLandingPages` or `listOrders` GET operation | Runs only GET operations and forwards `business_unique_id` as `b_uid` | Captured 2026-05-24 |
| `execute_safe` | MCP Inspector | Non-destructive update against seeded review data | Runs one safe non-GET operation and refuses a destructive operation | Captured 2026-05-24 |
| `execute_destructive` | MCP Inspector | Seeded review landing page or AWB cancellation fixture | Runs one destructive operation and refuses a safe operation | Captured 2026-05-24 |
| `list_landing_pages` | Claude prompt 1 | At least five Claude Review landing pages | Lists seeded landing pages with published/draft coverage | Captured 2026-05-24 |
| `list_landing_page_tags` | MCP Inspector | Seeded Claude Review landing page tags | Lists available landing page tags without using generic `get` | Pending post-deploy recapture |
| `get_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Fetches the created or seeded landing page | Captured 2026-05-24 |
| `get_landing_page_public_view` | MCP Inspector | Published Claude Review HTML Mode page | Fetches authenticated public rendering data without using generic `get` | Pending post-deploy recapture |
| `create_landing_page` | Claude prompt 2 | Synthetic HTML Mode draft | Creates review page using documented request body shape | Captured 2026-05-24 |
| `update_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Updates metadata or `is_published` state | Captured 2026-05-24 |
| `update_landing_page_tags` | MCP Inspector | Created or seeded Claude Review landing page | Replaces page tags without using generic `execute_safe` | Pending post-deploy recapture |
| `delete_landing_page` | Claude prompt 2 | Created Claude Review HTML Mode page | Deletes only the synthetic review page and prompts as destructive | Captured 2026-05-24 |
| `list_landing_page_displays` | MCP Inspector | Created or seeded Claude Review HTML Mode page | Lists display versions without using generic `get` | Pending post-deploy recapture |
| `create_landing_page_display` | Claude prompt 2 or MCP Inspector | Created Claude Review HTML Mode page | Creates a new HTML/CSS/JS display version without using generic `execute_safe` | Pending post-deploy recapture |
| `validate_landing_page_display` | MCP Inspector | HTML Mode display payload | Validates the display payload without persisting a display | Pending post-deploy recapture |
| `get_landing_page_display` | MCP Inspector | Created display id | Fetches one saved display version without using generic `get` | Pending post-deploy recapture |
| `delete_landing_page_display` | MCP Inspector | Non-current synthetic display id | Deletes one non-current display and prompts as destructive | Pending post-deploy recapture |
| `list_orders` | Claude prompt 3 | At least 30 Claude connector review orders | Lists review-tagged orders across required statuses | Captured 2026-05-24 |
| `get_order` | Claude prompt 3 | Seeded safe order id | Fetches one review order without dumping unrelated business data | Captured 2026-05-24 |
| `create_order` | MCP Inspector | Synthetic customer/product fixture | Creates a synthetic review order or a disposable draft order | Captured 2026-05-24 |
| `update_order` | Claude prompt 3 | `Claude Review Update Order` | Updates a harmless review note or metadata field | Captured 2026-05-24 |
| `change_order_status` | Claude prompt 3 | `Claude Review Status Order` | Changes only the seeded status fixture as instructed | Captured 2026-05-24 |
| `get_order_statistics` | Claude prompt 3 | Seeded reviewer business orders | Returns aggregated order statistics with the requested `breakdown_date` granularity; respects `business_unique_id` selection | Captured 2026-05-24 |

## Negative Evidence

| Check | Expected Evidence | Status |
| --- | --- | --- |
| Missing selector | Business-scoped call without `business_unique_id` fails with a friendly selector-required error when multiple businesses are connected | Captured 2026-05-24 |
| Safe tool refuses destructive action | `execute_safe` refuses a generated destructive operation such as `deleteLandingPage` | Captured 2026-05-24 |
| Destructive tool refuses safe action | `execute_destructive` refuses a generated safe write operation | Captured 2026-05-24 |
| OAuth revoke and reconnect | Revoked connector stops working, reconnect creates a fresh working `get_me`, and old refresh reuse is rejected | Captured 2026-05-24 |
| Response/log privacy | Evidence and logs contain request id, tool name, operation id, status, and Scalev API `error_code` only | Captured 2026-05-24 |
