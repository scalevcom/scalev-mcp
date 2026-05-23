# Reviewer Prompt Evidence

Capture final Claude custom-connector screenshots or transcripts here before submission. These are reviewer evidence for a remote MCP connector, not MCP Apps carousel assets.

## Prompt 1

```text
Use Scalev to list my connected businesses, choose the review business, and summarize my landing pages.
```

Expected evidence:

- `get_me` returns the primary review business and secondary selector-test business under `connected_businesses`.
- `list_landing_pages` uses top-level `business_unique_id`.
- Claude summarizes at least five seeded landing pages.

## Prompt 2

```text
Create a draft HTML Mode landing page called Claude Review Draft, update it to publish with is_published: true, fetch it, then delete it.
```

Expected evidence:

- `create_landing_page` uses the documented LandingPageCreateRequestBody.
- `update_landing_page` includes `is_published: true`.
- `delete_landing_page` is treated as destructive.

## Prompt 3

```text
Find pending review orders, fetch one order, update its notes, change its status to confirmed, and cancel AWB only on the seeded safe AWB test order.
```

Expected evidence:

- `list_orders`, `get_order`, `update_order`, and `change_order_status` complete successfully.
- `cancel_order_awb` only runs on seeded review data and is treated as destructive.

## Negative Checks

- Running `deleteLandingPage` through `execute_safe` fails with a wrong-tool error.
- Omitting `business_unique_id` while the primary and secondary reviewer businesses are both connected returns a friendly selector-required error.
- OAuth revoke and reconnect produces a fresh working `get_me`.
