# Reviewer Test Account Instructions

Final status: `PENDING_PRODUCTION_REVIEWER_ACCOUNT`

Use this file as the reviewer-facing setup script after the production review
business is seeded. Do not commit passwords, bearer tokens, refresh tokens,
backup codes, raw customer data, raw order payloads, or landing-page HTML here.

## Account Details To Fill Before Submission

- Reviewer account identifier: `TBD`
- Password delivery channel: `TBD - send out of band`
- Reviewer business unique id: `TBD`
- Secondary selector-test business unique id: `TBD`
- Seed audit evidence: `TBD - output from Util.ReviewerSeed.run("<business_unique_id>", format: :json)` and `Util.ReviewerSeedAudit.run("<business_unique_id>", format: :json)`
- Last data reset timestamp: `TBD`

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
  - `Claude Review AWB Cancel Order`

## Troubleshooting Notes

- If Claude reports that a business selector is required, call `get_me`, choose the `unique_id` for the `Claude Review` business, and pass it as top-level `business_unique_id`.
- If OAuth fails before consent, check that the connector URL is exactly `https://mcp.scalev.com/mcp`.
- If write tools fail with validation errors, use `search` and `get_docs` to confirm the current `/v3` request body shape before retrying.
- If the seeded destructive fixture has already been used, stop destructive testing and ask Scalev to rerun `Util.ReviewerSeed.run("<business_unique_id>")` for the reviewer business.
