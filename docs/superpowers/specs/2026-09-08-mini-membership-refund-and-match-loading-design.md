# Mini Program Membership Refund and Match Loading Design

- Date: 2026-09-08
- Status: Confirmed in conversation; awaiting written-spec review
- Design path: Architectural

## Goal

Make the Mini Program's Match loading state understandable and make membership state converge after purchase, renewal, or WeChat virtual-payment refund. The server-side entitlement ledger is authoritative; the Mini Program never infers a refund from local payment UI state.

## Scope

This change covers the Match loading state, profile and membership-page refresh behavior, WeChat virtual-payment refund reconciliation, order-state presentation, and regression/deployment verification. It does not redesign the Match feed, change membership prices, or add a new payment provider.

## Design

### Match loading

Replace the stretched vertical skeleton shown while `CareerWatchPage` is in `loading` with a fixed, centered state that keeps the page geometry stable. The state uses the existing icon system and semantic brand tokens, displays `正在匹配中` as the primary label, and provides a short secondary status line. Motion is limited to a lightweight search/loading treatment and is disabled under the platform reduced-motion setting. Existing cached-result, empty, and error transitions remain unchanged.

### Membership state convergence

`users`, active `membership_entitlement_segments`, and `payment_records` are the server-side source of truth. On every `useDidShow` for the profile and membership pages, refresh the authenticated Mini Program session before loading the page payload. Persist the returned membership summary into the scoped Mini session so the profile card, membership card, Match access scope, and subsequent requests use the same current expiry. A failed refresh must not overwrite a known-good state with an optimistic value; the page shows its existing recoverable error state.

### Refund state machine

The callback endpoint accepts `xpay_refund_notify` only after WeChat/relay signature and environment checks. Refund processing is idempotent by `(provider, provider_refund_id)` and locks the payment and user in the same order as payment completion. A successful full refund is automatically reconciled only when the original order is completed, the amount exactly consumes the remaining order amount, the order has a linked entitlement segment, and linked service entitlements are unused. In that case the payment becomes `refunded`, the segment is superseded with reason `wechat_virtual_refund`, unused service entitlements become unavailable, pending later segments are rebased, and the user summary is reconciled.

Partial refunds, consumed service entitlements, missing/ambiguous ledger links, invalid amounts, and legacy orders are recorded as `review_required` (or rejected as invalid) and do not guessingly revoke access. Failed refund notifications are recorded without changing entitlements and are not treated as successful refunds. Callback failures return a non-success response so WeChat can retry. Replays with the same payload return an idempotent success; a provider refund ID reused with a different order or amount is a conflict.

### Orders and UI

The Mini Program order list renders `completed`, `partially_refunded`, `refunded`, and `review_required` distinctly, including the refunded amount and a customer-support review label where needed. The profile and membership status cards are refreshed from the same server response after a refund; no client-side date arithmetic is used.

## Data flow

```text
WeChat xpay_refund_notify
  -> signature/environment validation
  -> apply_wechat_virtual_refund()
  -> payment_records + payment_refunds + entitlement ledger transaction
  -> fresh mini session / member services response
  -> profile, membership, order cards converge
```

## Error and compliance boundaries

- Do not revoke a consumed service or a partial refund automatically.
- Do not acknowledge a successful refund before reconciliation completes.
- Do not process a sandbox notification against production data, or a production notification against preview data.
- Do not expose provider secrets or raw callback bodies to the client.
- If the callback URL, message token, environment variables, or migration are missing in the target environment, report the deployment defect rather than fabricating a client fallback.

## Verification

- Static/type checks for changed TypeScript and JavaScript modules.
- Refund callback tests for signature rejection, environment isolation, full/partial/failed refunds, replay idempotence, replay conflicts, callback-before-payment ordering, and consumed-service review.
- PostgreSQL/PGlite migration tests for entitlement revocation, queue rebasing, renewal rollback, service re-purchase, and migration reruns.
- Mini Program build and a real-device smoke path covering Match loading, profile refresh, membership refresh, order status, full refund, and return navigation.
- Preview/production runtime checks confirming the callback URL is reachable, the correct migration is applied, and unsigned callbacks are rejected.

## Files expected to change

- `miniprogram/src/pages/index/career-watch-page.tsx`
- `miniprogram/src/pages/index/index.scss`
- `miniprogram/src/pages/profile/index.tsx`
- `miniprogram/src/pages/membership/index.tsx`
- `miniprogram/src/services/mini-auth-service.ts`
- `lib/services/wechat-virtual-payment-service.js`
- `api/wechat-virtual-payment-notify.js`
- `server-utils/dal/migrations/085_wechat_virtual_payment_refunds.sql`
- `server-utils/dal/migrations/086_wechat_refund_consistency.sql`
- focused refund and Mini Program regression tests
