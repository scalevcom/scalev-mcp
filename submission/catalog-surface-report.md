# Catalog Surface Report

Generated from `src/generated/v3Catalog.ts`.

- Source OpenAPI SHA-256: `04cc6e32c34ff51e949e35ecb29c172e1e9459dd5f62a2a66d2297f41dfa628f`
- Total catalog endpoints: 218
- Read-only GET endpoints: 96
- Non-destructive write/action endpoints: 92
- Destructive write/action endpoints: 30

## Submission Posture

- Claude-visible semantic tools stay focused on Landing Pages and Orders.
- Generic catalog tools remain available for approved business-authenticated `/v3` coverage.
- `search` returns `execution_tool`, so write calls are split between `execute_safe` and `execute_destructive`.
- Destructive operations require the destructive tool annotation and are rejected by `execute_safe`.
- OAuth flow, storefront browser, OAuth billing, developer payout, and direct payment-gateway routes are excluded by generation and runtime checks.
- Nexus remains the authority for OAuth token validation, selected-business authorization, scopes, audit logs, and rate limits.

## Write Endpoints By Tag

| Tag | Write endpoints |
| --- | ---: |
| Business Products | 29 |
| WABA | 21 |
| Orders | 20 |
| Business Bundles | 13 |
| Analytics Setup | 12 |
| Business Customers | 7 |
| Landing Pages | 7 |
| Storefront Setup | 4 |
| WhatsApp Integrations | 4 |
| Shipping | 3 |
| Business Stores | 2 |

## Destructive Endpoints

| Method | Path | Operation | Summary |
| --- | --- | --- | --- |
| DELETE | `/v3/bundles/{bundle_id}/bundle-price-options/{id}` | `deleteBundlePriceOption` | Delete a bundle price option |
| DELETE | `/v3/bundles/{bundle_id}/follow-up-chats/{id}` | `deleteBundleFollowUpChat` | Delete a bundle follow-up chat |
| DELETE | `/v3/bundles/{bundle_id}/partners/{id}` | `deleteBundlePartner` | Remove a bundle partner |
| DELETE | `/v3/bundles/{id}` | `deleteBundle` | Delete a business bundle |
| DELETE | `/v3/course-contents/{uuid}` | `deleteCourseContent` | Delete a course content item |
| DELETE | `/v3/course-sections/{uuid}` | `deleteCourseSection` | Delete a course section |
| DELETE | `/v3/customers/{customer_id}/addresses/{id}` | `deleteBusinessCustomerAddress` | Delete a business customer address |
| DELETE | `/v3/fb-pixels/{id}` | `deleteFacebookPixel` | Delete a Facebook pixel |
| DELETE | `/v3/gtm/{id}` | `deleteGtmContainer` | Delete a Google Tag Manager container |
| DELETE | `/v3/kwai-pixels/{id}` | `deleteKwaiPixel` | Delete a SnackVideo pixel |
| POST | `/v3/orders/{id}/duplicate` | `duplicateOrder` | Duplicate and cancel an order |
| POST | `/v3/orders/cancel-awb` | `cancelOrderAwb` | Cancel airway bills for orders |
| POST | `/v3/orders/delete` | `deleteOrders` | Delete orders in bulk |
| DELETE | `/v3/pages/{id}` | `deleteLandingPage` | Delete a landing page |
| DELETE | `/v3/pages/{page_id}/page-displays/{display_id}` | `deleteLandingPageDisplay` | Delete a landing page display |
| DELETE | `/v3/products/{id}` | `deleteProduct` | Delete a business product |
| DELETE | `/v3/products/{product_id}/follow-up-chats/{id}` | `deleteProductFollowUpChat` | Delete a product follow-up chat |
| DELETE | `/v3/products/{product_id}/knowledge-items/{id}` | `deleteProductKnowledgeItem` | Delete a product knowledge item |
| DELETE | `/v3/products/{product_id}/partners/{id}` | `deleteProductPartner` | Remove a product partner |
| DELETE | `/v3/stores/{store_id}/bundle-price-options/{id}` | `detachBusinessStoreBundlePriceOption` | Remove a bundle price option from a business store |
| DELETE | `/v3/stores/{store_id}/public-api-keys/{id}` | `revokeStorefrontPublicApiKey` | Revoke a storefront public API key |
| DELETE | `/v3/stores/{store_id}/storefront/allowed-origins/{id}` | `revokeStorefrontAllowedOrigin` | Revoke a storefront allowed origin |
| DELETE | `/v3/tiktok-pixels/{id}` | `deleteTiktokPixel` | Delete a TikTok pixel |
| DELETE | `/v3/variants/{variant_id}/digital-product-files/{id}` | `deleteVariantDigitalProductFile` | Delete a variant digital product file |
| DELETE | `/v3/variants/{variant_id}/knowledge-items/{id}` | `deleteVariantKnowledgeItem` | Delete a variant knowledge item |
| DELETE | `/v3/waba-accounts/{id}` | `deleteWabaAccount` | Delete a WABA account |
| DELETE | `/v3/waba-accounts/{unique_id}/quick-replies/{id}` | `deleteQuickReply` | Delete a WABA quick reply |
| DELETE | `/v3/waba-accounts/{waba_unique_id}/customers/{wa_user_id}/messages/{wamid}` | `deleteWabaMessage` | Delete a WABA customer message |
| DELETE | `/v3/waba-customer-tags/{id}` | `deleteWabaCustomerTag` | Delete a WABA customer tag |
| DELETE | `/v3/whatsapp-integrations/{id}` | `deleteWhatsappIntegration` | Delete a WhatsApp integration |
