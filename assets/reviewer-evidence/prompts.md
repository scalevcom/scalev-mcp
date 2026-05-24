# Reviewer Prompt Evidence

Final status: captured 2026-05-24 — full Claude custom-connector transcripts and screenshots for all three reviewer prompts plus the five negative checks are stored alongside this file. These are reviewer evidence for a remote MCP connector, not MCP Apps carousel assets.

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
Use Scalev. On the ICA Testing Account business, find pending orders, fetch one order, update its notes, change its status to confirmed, then show me my order statistics broken down by day.
```

Expected evidence:

- `list_orders`, `get_order`, `update_order`, and `change_order_status` complete successfully against the seeded reviewer business.
- `get_order_statistics` returns an aggregated response with the requested `breakdown_date: day` granularity, exercising the new merchant-dashboard surface.

The earlier `cancel_order_awb` semantic tool was removed in 0.3.1 because
AWB cancellation requires a connected courier-provider integration the
reviewer business cannot have. The underlying `cancelOrderAwb` endpoint
remains accessible to power users via the generic `execute_destructive`
tool. The destructive-write annotation behavior is evidenced by
`delete_landing_page` in Prompt 2.

## Negative Checks

- Running `deleteLandingPage` through `execute_safe` fails with a wrong-tool error.
- Omitting `business_unique_id` while the primary and secondary reviewer businesses are both connected returns a friendly selector-required error.
- OAuth revoke and reconnect produces a fresh working `get_me`.
