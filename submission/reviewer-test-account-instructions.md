# Reviewer Test Account Instructions

Final status: `READY_FOR_REVIEW` (seeded and audited 2026-05-23T12:03:59Z; 0 warnings, 0 failures, 0 unlabeled records)

Use this file as the reviewer-facing setup script. Do not commit passwords,
bearer tokens, refresh tokens, backup codes, raw customer data, raw order
payloads, or landing-page HTML here.

## Account Details

- Reviewer account identifier: `tester@scalev.com`
- Password delivery channel: 1Password share link (single-use, expires in 30 days), delivered via the submission form's reviewer-credentials notes field at submission time.
- Reviewer business unique id: `NNY34GV8VWBL2KSH` (legal name `ICA Testing Account`, username `ica-testing-account`)
- Secondary selector-test business unique id: `KJKODFJYD4RGFE9N`
- Last data reset timestamp: `2026-05-23T12:03:59Z`

### Seed Audit Evidence

`Util.ReviewerSeedAudit.run("NNY34GV8VWBL2KSH", format: :json)` returned the
following on 2026-05-23T12:03:59Z. Empty `warnings`, empty `failures`, and zero
`unlabeled` records confirm the reviewer business contains review-only data.

```json
{
  "stats": {
    "orders": {
      "total": 30,
      "by_status": {
        "canceled": 3,
        "completed": 4,
        "confirmed": 5,
        "draft": 4,
        "in_process": 4,
        "pending": 6,
        "shipped": 4
      },
      "covered_statuses": [
        "draft",
        "pending",
        "confirmed",
        "in_process",
        "shipped",
        "completed",
        "canceled"
      ]
    },
    "landing_pages": {
      "total": 5,
      "draft": 2,
      "published": 3,
      "html_mode": 2,
      "html_mode_draft": 1,
      "html_mode_published": 1
    },
    "products": {
      "total": 10,
      "active_variants": 10
    },
    "customers": {
      "total": 5
    },
    "fixtures": {
      "update_order": {
        "status": "pending",
        "valid": true,
        "order_id": "CR212101",
        "awb_status": "unavailable",
        "awb_ca_status": "unavailable",
        "present": true
      },
      "awb_cancel_order": {
        "status": "confirmed",
        "valid": true,
        "order_id": "CR212103",
        "awb_status": "created",
        "awb_ca_status": "created",
        "present": true
      },
      "status_order": {
        "status": "pending",
        "valid": true,
        "order_id": "CR212102",
        "awb_status": "unavailable",
        "awb_ca_status": "unavailable",
        "present": true
      }
    },
    "unlabeled": {
      "orders": 0,
      "landing_pages": 0,
      "products": 0,
      "customers": 0
    }
  },
  "warnings": [],
  "business": {
    "id": 2121,
    "username": "ica-testing-account",
    "unique_id": "NNY34GV8VWBL2KSH",
    "legal_name": "ICA Testing Account"
  },
  "failures": [],
  "checked_at": "2026-05-23T12:03:59Z"
}
```

## Setup Steps For Anthropic Reviewer

1. Sign in to Claude using a plan that supports custom remote MCP connectors.
2. Open Claude connector settings.
3. Add a custom connector named `Scalev`.
4. Use this remote MCP server URL:

   ```text
   https://mcp.scalev.com/mcp
   ```

5. Complete the Scalev OAuth flow with the reviewer account.
6. On the Scalev consent screen, select the primary `Claude Review` business and the secondary selector-test business. Use the primary business for all write/destructive tests; the secondary business exists only so omitted `business_unique_id` calls prove the selector-required path.
7. Return to Claude and enable the Scalev connector in the conversation.
8. Run the three reviewer prompts in `assets/reviewer-evidence/prompts.md`.
9. Run or inspect the tool-by-tool coverage in `assets/reviewer-evidence/tool-exercise-matrix.md`.
10. For negative tests, omit `business_unique_id` while both reviewer businesses are connected, try one destructive operation through `execute_safe`, and try one safe write through `execute_destructive`.
11. Revoke the connector from Scalev connected-app settings, reconnect it from Claude, and verify `get_me` works with a fresh connection.

## Expected Review Data

- At least 30 non-sensitive orders tagged `Claude connector review seed`.
- At least 5 landing pages, including draft and HTML Mode examples.
- At least 5 synthetic customers.
- At least 10 synthetic products or bundles.
- One secondary selector-test business connected to the same reviewer account. It should contain minimal synthetic data and must not be used for write or destructive tests.
- Named safe order fixtures:
  - `Claude Review Update Order`
  - `Claude Review Status Order`
- `get_order_statistics` aggregates across the existing seeded orders; no dedicated fixture is required.

## Troubleshooting Notes

- If Claude reports that a business selector is required, call `get_me`, choose the `unique_id` for the `Claude Review` business, and pass it as top-level `business_unique_id`.
- If OAuth fails before consent, check that the connector URL is exactly `https://mcp.scalev.com/mcp`.
- If write tools fail with validation errors, use `search` and `get_docs` to confirm the current `/v3` request body shape before retrying.
- If the seeded destructive fixture has already been used, stop destructive testing and ask Scalev to rerun `Util.ReviewerSeed.run("<business_unique_id>")` for the reviewer business.
