# Reviewer Prompt Evidence

Final status: captured 2026-05-24 and 2026-05-25 — full Claude custom-connector transcripts and screenshots for the three core reviewer prompts, three follow-up Landing Pages prompts covering the 0.3.2 tool additions, the OAuth approval flow, and the five negative checks are stored alongside this file. These are reviewer evidence for a remote MCP connector, not MCP Apps carousel assets.

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
- `create_landing_page_display` or `validate_landing_page_display` is used for display-version HTML/CSS/JS work instead of generic `execute_safe`.
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

## Prompt 4 — Landing Pages read surface (0.3.2 additions)

```text
Use Scalev. On ICA Testing Account, show me the available landing page tags, then for the published Claude Review HTML Mode page fetch its public view payload, list its display versions, and validate a small HTML Mode display payload without saving it.
```

Expected evidence:

- `list_landing_page_tags` lists the seeded review tags without falling back to generic `get`.
- `get_landing_page_public_view` returns authenticated public rendering data for the published page.
- `list_landing_page_displays` returns the page's display versions.
- `validate_landing_page_display` returns a passing validation response without persisting anything.

## Prompt 5 — Landing Pages display CRUD (0.3.2 additions)

```text
Use Scalev. On ICA Testing Account, find the published landing page Claude Review HTML Mode Published and create a new draft HTML Mode display version with a minimal HTML payload bound to the page's store variant, fetch the new display back to confirm it persisted, then delete it.
```

Expected evidence:

- `create_landing_page_display` creates a non-published HTML Mode display bound to a real store variant via `form_display.store_id` and `variant_ids`.
- `get_landing_page_display` returns the persisted display with matching `html_code` and form-display binding.
- `delete_landing_page_display` removes the new display only; the original display remains, and the post-delete `list_landing_page_displays` confirms the rollback.

## Prompt 6 — Landing Pages tag write (0.3.2 additions)

```text
Use Scalev. On ICA Testing Account, replace the tags on landing page 267655 with two tags claude-review and mcp-evidence, then read the page back to confirm the tags were updated.
```

Expected evidence:

- `update_landing_page_tags` replaces the page tag set without going through generic `execute_safe`.
- The follow-up `get_landing_page` read returns the same two tags, demonstrating the replacement is persisted server-side rather than only echoed in the update response.

## Negative Checks

- Running `deleteLandingPage` through `execute_safe` fails with a wrong-tool error.
- Omitting `business_unique_id` while the primary and secondary reviewer businesses are both connected returns a friendly selector-required error.
- OAuth revoke and reconnect produces a fresh working `get_me`.
