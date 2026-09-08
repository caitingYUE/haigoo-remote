# Mini Membership Refund and Match Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stable Match loading state and make Mini Program membership/order state converge after payment, renewal, and WeChat virtual-payment refunds.

**Architecture:** Keep the existing Taro/React pages and WeChat callback endpoint. The database entitlement ledger remains authoritative; the callback atomically reconciles a payment refund and the affected entitlement segment, while profile and membership pages refresh the server session before rendering current membership data.

**Tech Stack:** Taro 4, React 18, TypeScript, SCSS, Node.js ESM, Neon/PostgreSQL SQL migrations, PGlite regression tests.

**Spec:** `docs/superpowers/specs/2026-09-08-mini-membership-refund-and-match-loading-design.md`

## Global Constraints

- Preserve existing Mini Program routes, pricing, plan IDs, and three-tab navigation.
- Use existing icon and semantic color tokens; no new dependency for loading animation.
- Full refunds auto-revoke only unused, unambiguous entitlements; partial/consumed/legacy cases remain `review_required`.
- Callback failures must return non-success so WeChat retries; callback processing is idempotent.
- Do not expose provider secrets or raw callback bodies to the client.
- Preserve unrelated dirty-worktree changes.

---

### Task 1: Lock down the failing behavior with focused tests

**Files:**
- Modify: `test-mini-refund-callback.js`
- Modify: `scripts/test-mini-refund-db.mjs`
- Modify: `test-mini-virtual-payment.js`
- Create: `test-mini-membership-refresh.js`

**Interfaces:**
- Consumes: existing callback handler, refund SQL functions, Mini Program source text.
- Produces: runnable regression checks for callback boundaries, state refresh, and loading copy.

- [ ] **Step 1: Add callback assertions**

Assert unsigned callbacks return 401, sandbox/production environment mismatches are rejected, refund callbacks with missing `Env` resolve the order environment, and a failed SQL reconciliation produces a non-success HTTP response.

- [ ] **Step 2: Add database assertions**

Cover full refund revocation, renewal-only rollback, later-segment rebasing, partial refund review, consumed half-year service review, callback-before-payment retry behavior, refund replay idempotence, and refund-ID payload conflicts.

- [ ] **Step 3: Add frontend contract assertions**

Read the relevant source files and assert the loading state contains `正在匹配中`, the profile and membership `useDidShow` paths call session refresh, and order presentation contains `已退款` and `部分退款`.

- [ ] **Step 4: Run the focused tests before implementation**

Run: `npm run test:mini-refund` and `npm run test:mini-payment`

Expected: existing refund/loading assertions fail only where the requested behavior is missing; unrelated baseline failures are recorded before edits.

### Task 2: Replace the Match loading skeleton

**Files:**
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx:415-419`
- Modify: `miniprogram/src/pages/index/index.scss:30-31`

**Interfaces:**
- Consumes: existing `WatchStep` state, `MiniIcon`, Match semantic tokens.
- Produces: fixed-height loading state with accessible status text and reduced-motion CSS.

- [ ] **Step 1: Render the stable loading state**

Replace the current `match-deck-skeleton` block with a loading container that renders `MiniIcon name='search'`, `正在匹配中`, and `正在根据你的方向整理企业信息` with `aria-live='polite'`.

- [ ] **Step 2: Add bounded motion styles**

Give the loading container a stable minimum height, centered alignment, and a small search icon animation. Add `@media (prefers-reduced-motion: reduce)` to disable the animation and keep the same geometry.

- [ ] **Step 3: Run Mini Program type and source checks**

Run: `npm --prefix miniprogram run type-check` and `npm run test:mini-match-v2`

Expected: both pass, and the loading contract test sees no stretched skeleton-only state.

### Task 3: Refresh the authoritative membership session before page payloads

**Files:**
- Modify: `miniprogram/src/pages/profile/index.tsx:50-73`
- Modify: `miniprogram/src/pages/membership/index.tsx:72-91`
- Modify: `miniprogram/src/services/mini-auth-service.ts:35-60`
- Modify: `test-mini-membership-refresh.js`

**Interfaces:**
- Consumes: `refreshWechatSession()`, existing page loaders, scoped Mini session storage.
- Produces: current `memberExpireAt`, `memberType`, and `isMember` values before profile/membership cards render.

- [ ] **Step 1: Refresh session in profile loader**

When a bound session exists, call `refreshWechatSession()` first, tolerate a refresh failure without replacing the current session with optimistic data, then load follows, Match, career, and member services using the refreshed session.

- [ ] **Step 2: Refresh session in membership loader**

Before `fetchMembershipPlans()`, call `refreshWechatSession()` for authenticated users. Keep guest behavior unchanged and retain the existing recoverable error UI if refresh or plan loading fails.

- [ ] **Step 3: Guard concurrent refreshes**

Use the existing page-level load lifecycle so repeated `useDidShow` calls cannot overwrite newer membership state with an older response. Do not add a global cache or new dependency.

- [ ] **Step 4: Run refresh contract and type checks**

Run: `node test-mini-membership-refresh.js` and `npm --prefix miniprogram run type-check`

Expected: the session is refreshed before both page payloads and the current expiry is persisted in the scoped session.

### Task 4: Audit and finalize refund SQL reconciliation

**Files:**
- Modify: `server-utils/dal/migrations/085_wechat_virtual_payment_refunds.sql`
- Modify: `server-utils/dal/migrations/086_wechat_refund_consistency.sql`
- Modify: `scripts/test-mini-refund-db.mjs`

**Interfaces:**
- Consumes: `payment_records`, `payment_refunds`, `membership_entitlement_segments`, member-service tables, existing `reconcile_membership_entitlements()`.
- Produces: idempotent `apply_wechat_virtual_refund()` and consistent payment/member state.

- [ ] **Step 1: Run migration parser checks**

Run: `node scripts/run-sql-migration.mjs --dry-run 085_wechat_virtual_payment_refunds.sql` and the same command for `086_wechat_refund_consistency.sql`.

Expected: both migrations parse successfully with no database writes.

- [ ] **Step 2: Fix only verified SQL defects**

Ensure the final function locks payment then user, rejects successful refunds before payment completion, records failed refunds without revoking, validates cumulative amounts, supersedes only the linked segment, revokes unused linked service entitlements, rebases pending segments, and calls membership reconciliation. Keep partial/consumed/ambiguous cases reviewable.

- [ ] **Step 3: Run the PGlite database regression**

Run: `npm run test:mini-refund-db -- --pglite=<installed-pglite-entry>`

Expected: PASS for activation, renewal, full/partial/failed refunds, replay/conflict handling, service revocation, repurchase, legacy review, and migration rerun.

### Task 5: Finalize callback handling and order-state contract

**Files:**
- Modify: `api/wechat-virtual-payment-notify.js:130-212`
- Modify: `lib/services/wechat-virtual-payment-service.js:409-467`
- Modify: `miniprogram/src/pages/payment-orders/index.tsx:30-215`
- Modify: `test-mini-refund-callback.js`

**Interfaces:**
- Consumes: WeChat `xpay_refund_notify`, relay signature helpers, `applyRefund()`, existing order list payload.
- Produces: secure callback acknowledgment and truthful Mini Program order status.

- [ ] **Step 1: Verify callback event routing**

Ensure documented refund fields (`MchOrderId`, `WxRefundId`, `RefundFee`, `RetCode`, optional `Env`) are normalized, missing environment is resolved from the original order, and the callback returns failure when reconciliation throws or returns unsuccessful.

- [ ] **Step 2: Verify service validation**

Keep AppID/OpenID/currency/environment matching, positive integer amount validation, and provider refund-ID idempotency. Do not treat a failed refund notification as a completed refund.

- [ ] **Step 3: Verify order labels**

Render completed, partial refund, full refund, and review-required states distinctly with refunded amount where present. Keep support copy actionable and avoid implying automatic entitlement recovery for review-required cases.

- [ ] **Step 4: Run callback/payment tests**

Run: `npm run test:mini-refund` and `npm run test:mini-payment`

Expected: callback authentication, environment routing, reconciliation, replay, and order-state assertions pass.

### Task 6: Build, static-check, and deployment verification

**Files:**
- Modify only files proven necessary by prior tasks.
- Verify: `docs/wechat-virtual-payment-setup.md`, `scripts/verify-mini-refund-preview.mjs`, `scripts/verify-mini-payment-runtime.mjs`

**Interfaces:**
- Consumes: finalized frontend/backend/migration changes and configured Preview/Production environments.
- Produces: release-ready build evidence and a deployment gap report if infrastructure is not configured.

- [ ] **Step 1: Run focused and Mini Program checks**

Run: `npm run test:mini-refund`, `npm run test:mini-refund-db -- --pglite=<installed-pglite-entry>`, `npm --prefix miniprogram run type-check`, and `npm --prefix miniprogram run build:weapp:experience`.

- [ ] **Step 2: Run the Preview refund fixture check**

Run: `node scripts/verify-mini-refund-preview.mjs --env-file=<explicit-preview-env-file>`.

Expected: the fixture activates and revokes within a rollback-only transaction; no real payment or user data remains.

- [ ] **Step 3: Run callback runtime checks**

Run: `npm run check:mini-payment-runtime`.

Expected: unsigned callbacks are rejected in Preview and Production, environment variables are aligned, and any missing migration/callback deployment is reported explicitly.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors, no accidental reversal of existing user changes, and only scoped files are included in the implementation diff.
