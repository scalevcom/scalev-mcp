# Reviewer Data Seed Plan

Date: 2026-05-22

This plan defines the production reviewer business data needed before submitting the Scalev Claude connector. Use only non-sensitive, disposable data created for connector review.

## Review Business

- Create one production business dedicated to Claude connector review.
- Business name should clearly include `Claude Review`.
- Record the business `unique_id` in `submission/claude-connector-submission.md` after seeding.
- Connect only the reviewer OAuth application and reviewer users needed for Anthropic testing.
- Do not reuse real merchant, customer, product, order, or shipment data.

## Selector-Test Business

- Create a second production business connected to the same reviewer account.
- Business name should clearly include `Claude Selector Test`.
- Use it only to prove multi-business selector behavior. Do not use it for write or destructive reviewer prompts.
- Seed only minimal synthetic data needed for `get_me` and optional read-only sanity checks.
- Record the secondary business `unique_id` in `submission/reviewer-test-account-instructions.md`.

## Users And OAuth

- Create a reviewer login that can authorize the Scalev OAuth application.
- Grant the OAuth app only the scopes exposed by the connector:
  - `page:list`
  - `page:read`
  - `page:create`
  - `page:update`
  - `page:delete`
  - `order:list`
  - `order:read`
  - `order:create`
  - `order:update`
  - `order:change_status`
  - `order:create_awb`
- Connect both the primary review business and the secondary selector-test business to the reviewer account, so omitted `business_unique_id` produces the expected friendly selector-required error.
- Verify revoke and reconnect before final submission.

## Landing Pages

Seed at least five landing pages:

| Name | State | Purpose |
| --- | --- | --- |
| Claude Review Published A | published | Basic read/list evidence |
| Claude Review Published B | published | Multiple published page evidence |
| Claude Review Draft A | draft | Draft visibility evidence |
| Claude Review HTML Mode Draft | draft HTML Mode | HTML Mode create/update evidence |
| Claude Review HTML Mode Published | published HTML Mode | `is_published` evidence |

Landing page content must be safe test copy only. Do not include real customer names, private offers, hidden instructions, or prompt-injection text.

## Customers And Products

Seed at least five test customers:

- Use names like `Claude Review Customer 01`.
- Use synthetic email addresses controlled by Scalev, or a reserved internal review domain.
- Use synthetic Indonesian phone numbers that cannot reach real customers.

Seed at least ten products or bundles:

- Use names like `Claude Review Product 01`.
- Keep prices low and obviously synthetic.
- Include enough active variants or bundle price options to support order create/update flows.
- Do not connect the products to real inventory, supplier, fulfillment, affiliate, or ad-account data.

## Orders

Seed at least 30 orders across representative statuses. Include a clear review tag or note on every order, for example `Claude connector review seed`.

Minimum status coverage:

- draft
- pending
- confirmed
- in_process
- shipped
- completed
- canceled

Required named order fixtures:

| Name or Note | Initial State | Allowed Reviewer Action |
| --- | --- | --- |
| Claude Review Update Order | pending or confirmed | Update a harmless note field |
| Claude Review Status Order | pending | Change status to confirmed |
| Claude Review AWB Cancel Order | AWB present, safe cancellation state | Run `cancel_order_awb` |

The AWB cancellation fixture must not cancel a real shipment, charge a customer, notify a real courier recipient, or mutate a live merchant fulfillment flow. If that cannot be guaranteed in production, omit AWB cancellation from the reviewer prompt and explain the limitation in the submission notes.

## Evidence Checklist

Run the Scalev API seed audit from a production IEx session after creating or resetting the reviewer business:

```elixir
Util.ReviewerSeedAudit.run("<business_unique_id>")
Util.ReviewerSeedAudit.run("<business_unique_id>", format: :json)
```

Save only the JSON summary or a redacted terminal transcript in the private submission evidence bundle. The audit reports counts, statuses, and named safe fixture ids; it does not print raw customer data, order payloads, bearer tokens, request bodies, landing-page HTML, or OAuth secrets.

After seeding, record:

- reviewer account identifier, without password
- business `unique_id`
- secondary selector-test business `unique_id`
- seeded landing page names and ids
- seeded safe order ids and allowed actions
- reset timestamp
- OAuth revoke/reconnect result
- three Claude prompt transcripts or screenshots under `assets/reviewer-evidence/`

Do not store passwords, bearer tokens, refresh tokens, request bodies, customer private data, or raw order payloads in the repository.
